/**
 * Preview of an iFixit guide with the same facts the contract checks (steps, photos, flags, type, device and the
 * categories above it), so the bench can show a scout what the validators will see before they stake.
 * Read server-side: one request per guide plus one for its device page, cached at the CDN for a minute.
 */

export const dynamic = "force-dynamic";

const API = "https://www.ifixit.com/api/2.0";
const HEADERS = { "user-agent": "RepairCall/1.0 (GenLayer; github.com/bars26/genlayer-repaircall)" };

const date = (ts: unknown) => {
  const n = Number(ts);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString().slice(0, 10) : "";
};

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("id") ?? "";
  // Accept a guide number or an iFixit guide URL (…/Guide/Title/248913).
  const id = raw.trim().match(/^(\d{1,9})$/)?.[1] ?? raw.match(/ifixit\.com\/Guide\/[^/]+\/(\d{1,9})/i)?.[1];
  if (!id) return Response.json({ error: "Paste an iFixit guide URL or number." }, { status: 400 });
  const res = await fetch(`${API}/guides/${id}`, { headers: HEADERS, cache: "no-store" });
  if (res.status === 404 || res.status === 403) return Response.json({ error: `iFixit has no public guide ${id}.` }, { status: 404 });
  if (!res.ok) return Response.json({ error: `iFixit answered ${res.status}; try again.` }, { status: 502 });
  const g: any = await res.json();
  // iFixit inlines the steps of prerequisite guides (each step names the guide it belongs to); like the contract, count only the guide's own.
  const all: any[] = Array.isArray(g.steps) ? g.steps : [];
  const steps = all.filter((s) => Number(s?.guideid ?? g.guideid) === Number(g.guideid));
  const photos = steps.filter((s) => s?.media?.type === "image" && Array.isArray(s.media.data) && s.media.data.length).length;
  let ancestors: string[] = [];
  if (g.category) {
    const w = await fetch(`${API}/wikis/CATEGORY/${encodeURIComponent(String(g.category).replaceAll(" ", "_"))}`, { headers: HEADERS, cache: "no-store" });
    if (w.ok) ancestors = (((await w.json()) as any).ancestors ?? []).map((a: any) => String(a?.title ?? "")).filter((t: string) => t && t !== "Root");
  }
  const preview = {
    guideid: Number(g.guideid),
    revisionid: Number(g.revisionid ?? 0),
    title: String(g.title ?? ""),
    url: String(g.url ?? `https://www.ifixit.com/Guide/_/${id}`),
    category: String(g.category ?? ""),
    kind: String(g.type ?? "").toLowerCase(),
    subject: String(g.subject ?? ""),
    public: !!g.public && !!g.published_date,
    created: date(g.created_date),
    author_id: Number(g.author?.userid ?? 0),
    author_name: String(g.author?.username ?? ""),
    steps: steps.length,
    inlined: all.length - steps.length,
    photos,
    flags: (Array.isArray(g.flags) ? g.flags : []).map((f: any) => String(f?.flagid ?? "")).filter(Boolean).sort(),
    image: String(g.image?.medium ?? g.image?.standard ?? ""),
    ancestors,
    prerequisites: (Array.isArray(g.prerequisites) ? g.prerequisites : []).map((p: any) => String(p?.title ?? "")).filter(Boolean),
  };
  return Response.json(preview, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
