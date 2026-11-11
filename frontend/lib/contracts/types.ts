/** Types and display helpers for the RepairCall contract. */

type Num = string | number | bigint;

export type State = "candidate" | "accepted" | "upheld" | "overturned" | "rejected" | "unclear";
export type AuthorState = "" | "held" | "collected" | "lapsed";

export interface Call {
  id: string;
  sponsor: string;
  title: string;
  category: string;
  types: string;
  scope: string;
  since: string;
  ends: string;
  min_steps: Num;
  reward: Num;
  scout_bps: Num;
  stake: Num;
  contest_minutes: Num;
  per_scout: Num;
  state: "open" | "closed";
  pot: Num;
  reserved: Num;
  funded_total: Num;
  paid_total: Num;
  returnable: Num;
  returned_total: Num;
  n_funders: Num;
  n_refunded: Num;
  n_claims: Num;
  created_at: string;
  history_json: string;
  /** Not stored on the call: attached by the registry snapshot from get_funders. */
  funders?: FunderRow[];
}

export interface FunderRow {
  address: string;
  amount: string;
  refunded: boolean;
}

export interface Claim {
  id: string;
  call_id: string;
  scout: string;
  guideid: Num;
  revisionid: Num;
  title: string;
  category: string;
  kind: string;
  subject: string;
  created: string;
  author_id: Num;
  author_name: string;
  steps: Num;
  photos: Num;
  answer: string;
  state: State;
  why: string;
  packet: string;
  stake: Num;
  reward: Num;
  scout_share: Num;
  author_share: Num;
  author_state: AuthorState;
  collect_by: string;
  collected_by: string;
  filed_at: string;
  deadline: string;
  contester: string;
  contest_text: string;
  contest_source: string;
  contest_answer: string;
  copy: string;
  settled_at: string;
}

/** A guide as the app previews it (app/api/guide), with the same facts the contract checks. */
export interface GuidePreview {
  guideid: number;
  revisionid: number;
  title: string;
  url: string;
  category: string;
  kind: string;
  subject: string;
  public: boolean;
  created: string;
  author_id: number;
  author_name: string;
  steps: number;
  /** steps inlined from prerequisite guides, not counted */
  inlined: number;
  photos: number;
  flags: string[];
  image: string;
  ancestors: string[];
  prerequisites: string[];
}

export const MIN_FUND_WEI = 10n ** 17n;
export const MIN_STAKE_WEI = 10n ** 16n;
export const ZERO = "0x0000000000000000000000000000000000000000";
export const TYPES = ["replacement", "repair", "disassembly", "teardown", "technique", "installation", "maintenance"] as const;
export const OK_FLAGS = ["GUIDE_USER_CONTRIBUTED"];

/** How each state reads, and the tag it gets. */
export const STATE_STYLE: Record<State, { label: string; tag: string; help: string }> = {
  candidate: { label: "Candidate · open to contest", tag: "tag-orange", help: "The validators read it as complete and within the call. Anyone may contest until the deadline." },
  accepted: { label: "Accepted", tag: "tag-green", help: "Uncontested after the window (or a contest the second look could not decide). The scout was paid; the author's share is held for the author." },
  upheld: { label: "Upheld", tag: "tag-green", help: "Contested, and the second look kept it. The scout took the contester's stake; the author's share is held for the author." },
  overturned: { label: "Overturned", tag: "tag-grey", help: "Contested, and the second look (or the copy check) agreed with the contest. The contester took the scout's stake." },
  rejected: { label: "Not this time", tag: "tag-grey", help: "The validators read the guide as incomplete or outside the call. The stake went to the pot; a new revision can be nominated again." },
  unclear: { label: "Unclear", tag: "tag-grey", help: "The validators could not tell. Stake back; a new revision can be nominated again." },
};

export function wei(v: Num | undefined): bigint {
  try {
    return BigInt(String(v ?? "0").split(".")[0]);
  } catch {
    return 0n;
  }
}

export function formatGen(v: Num | undefined, digits = 2): string {
  const n = Number(wei(v)) / 1e18;
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function parseGen(input: string): bigint | null {
  const t = input.trim();
  if (!/^\d+(\.\d{1,18})?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  return BigInt(whole) * 10n ** 18n + BigInt((frac + "0".repeat(18)).slice(0, 18));
}

export function parseJson<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export const sameAddress = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
export const short = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
export const todayUtc = () => new Date().toISOString().slice(0, 10);
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
export const fundersOf = (c: Call): FunderRow[] => c.funders ?? [];
export const funderRow = (c: Call, a?: string | null) => (a ? fundersOf(c).find((r) => sameAddress(r.address, a)) : undefined);
export const guideUrl = (id: Num) => `https://www.ifixit.com/Guide/_/${String(id)}`;
export const userUrl = (id: Num) => `https://www.ifixit.com/User/${String(id)}`;
export const deadlineMs = (d: Claim) => (d.deadline ? Date.parse(`${d.deadline}Z`) : 0);
export const isOpenCandidate = (d: Claim, now = Date.now()) => d.state === "candidate" && now <= deadlineMs(d);
export const scoutShare = (c: Call) => (wei(c.reward) * wei(c.scout_bps)) / 10000n;
export const callTypes = (c: Call) => c.types.split(",").filter(Boolean);

/** The contract's code checks, in the same order, for a preview against a call. '' when the guide passes them all. */
export function checkGuide(g: GuidePreview, c: Call): { reason: string; message: string } {
  const fail = (reason: string, message: string) => ({ reason, message });
  if (!g.public) return fail("not_public", "The guide is not public on iFixit.");
  if (g.created < c.since) return fail("too_old", `Created ${g.created}, before this call's start (${c.since}).`);
  if (!callTypes(c).includes(g.kind)) return fail("wrong_type", `A ${g.kind || "untyped"} guide; this call pays for ${callTypes(c).join(", ")}.`);
  if (g.steps < Number(c.min_steps)) return fail("too_few_steps", `${g.steps} steps; this call asks for at least ${c.min_steps}.`);
  if (g.photos < g.steps) return fail("missing_photos", `${g.steps - g.photos} of ${g.steps} steps have no photo.`);
  const bad = g.flags.filter((f) => !OK_FLAGS.includes(f));
  if (bad.length) return fail("flagged", `iFixit flags it: ${bad.map((f) => f.replace(/^GUIDE_/, "").replaceAll("_", " ").toLowerCase()).join(", ")}.`);
  if (![g.category, ...g.ancestors].some((t) => t.toLowerCase() === c.category.toLowerCase()))
    return fail("outside", `${g.category} is not under ${c.category} on iFixit.`);
  return { reason: "", message: "Passes the code checks; the validators also compare it with earlier guides and read its steps." };
}
