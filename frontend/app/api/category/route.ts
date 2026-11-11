/**
 * Checks an iFixit category title before a sponsor opens a call: does the device page exist, what sits above it,
 * and how many guides and sub-categories it has. Read server-side and cached at the CDN.
 */

export const dynamic = "force-dynamic";

const API = "https://www.ifixit.com/api/2.0";
const HEADERS = { "user-agent": "RepairCall/1.0 (GenLayer; github.com/bars26/genlayer-repaircall)" };

export async function GET(request: Request) {
  const title = (new URL(request.url).searchParams.get("title") ?? "").trim();
  if (!/^[^\x00-\x1f/<>]{2,80}$/.test(title)) return Response.json({ error: "An iFixit category title, 2 to 80 characters." }, { status: 400 });
  const res = await fetch(`${API}/wikis/CATEGORY/${encodeURIComponent(title.replaceAll(" ", "_"))}`, { headers: HEADERS, cache: "no-store" });
  if (res.status === 404) return Response.json({ error: `iFixit has no category called “${title}”.` }, { status: 404 });
  if (!res.ok) return Response.json({ error: `iFixit answered ${res.status}; try again.` }, { status: 502 });
  const w: any = await res.json();
  return Response.json(
    {
      title: String(w.title ?? title),
      url: `https://www.ifixit.com/Device/${encodeURIComponent(String(w.title ?? title).replaceAll(" ", "_"))}`,
      ancestors: (w.ancestors ?? []).map((a: any) => String(a?.title ?? "")).filter((t: string) => t && t !== "Root"),
      children: Array.isArray(w.children) ? w.children.length : 0,
      guides: Array.isArray(w.guides) ? w.guides.length : 0,
    },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } }
  );
}
