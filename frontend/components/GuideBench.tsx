"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ExternalLink, Loader2, Search, X } from "lucide-react";
import { checkGuide, formatGen, todayUtc, wei, type Call, type Claim, type GuidePreview } from "@/lib/contracts/types";
import { useWallet } from "@/lib/genlayer/wallet";
import { useRepairCallWrite } from "@/lib/hooks/useRepairCall";
import { Button } from "./ui/button";

const SAMPLES = [
  { name: "Roomba 520 battery", id: "246601" },
  { name: "Roomba 520 charging", id: "243269" },
  { name: "Pixel 8 back cover", id: "243571" },
  { name: "JBL Spyro subwoofer", id: "249025" },
];
const RENOMINATE = ["rejected", "unclear", "overturned"];

export function GuideBench({ calls, claims, callId, onCallChange }: { calls: Call[]; claims: Claim[]; callId: string; onCallChange: (id: string) => void }) {
  const { isConnected } = useWallet();
  const { writeAsync, pending } = useRepairCallWrite();
  const [input, setInput] = useState("");
  const [guide, setGuide] = useState<string | null>(null);

  // A link can open the bench on a guide: ?guide=246601&call=call_0
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const g = (p.get("guide") ?? "").trim();
    if (/^\d{1,9}$/.test(g)) {
      setInput(g);
      setGuide(g);
    }
    const c = p.get("call");
    if (c) onCallChange(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = useQuery<GuidePreview, Error>({
    queryKey: ["guide", guide],
    enabled: !!guide,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch(`/api/guide?id=${encodeURIComponent(guide!)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      return body;
    },
  });
  const g = q.data;
  const open = calls.filter((c) => c.state === "open" && todayUtc() <= c.ends);
  const call = open.find((c) => c.id === callId) ?? open[0];
  const check = g && call ? checkGuide(g, call) : null;
  const latest = g ? claims.filter((d) => String(d.guideid) === String(g.guideid)).at(-1) : undefined;
  const blocked = latest && (!RENOMINATE.includes(latest.state) || String(latest.revisionid) === String(g?.revisionid));
  const potOk = call ? wei(call.pot) >= wei(call.reward) : false;

  const rows: [boolean, string][] = g && call
    ? [
        [g.public, g.public ? "Public on iFixit" : "Not public"],
        [g.created >= call.since, `Created ${g.created} (call takes guides from ${call.since})`],
        [call.types.split(",").includes(g.kind), `Type: ${g.kind || "none"} (call: ${call.types.replaceAll(",", ", ")})`],
        [g.steps >= Number(call.min_steps), `${g.steps} own steps (at least ${String(call.min_steps)})${g.inlined ? `; ${g.inlined} more come from prerequisite guides and do not count` : ""}`],
        [g.photos >= g.steps && g.steps > 0, `${g.photos} of ${g.steps} steps photographed`],
        [g.flags.every((f) => f === "GUIDE_USER_CONTRIBUTED"), g.flags.length ? `iFixit flags: ${g.flags.map((f) => f.replace(/^GUIDE_/, "").replaceAll("_", " ").toLowerCase()).join(", ")}` : "No iFixit flags"],
        [[g.category, ...g.ancestors].some((t) => t.toLowerCase() === call.category.toLowerCase()), `${[...g.ancestors].reverse().concat(g.category).join(" › ")}`],
      ]
    : [];

  return (
    <div className="lab-card overflow-hidden">
      <div className="lab-head px-5 py-3 flex items-center justify-between">
        <span className="display font-bold text-lg">The bench</span>
        <span className="label-tag !text-[#C9CDD2]">no wallet needed to look</span>
      </div>
      <div className="p-5 space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const id = input.trim().match(/^(\d{1,9})$/)?.[1] ?? input.match(/Guide\/[^/]+\/(\d{1,9})/i)?.[1] ?? null;
            setGuide(id);
          }}
        >
          <input className="field h-10" placeholder="iFixit guide URL or number, e.g. 246601" value={input} onChange={(e) => setInput(e.target.value)} />
          <Button type="submit" className="h-10">
            <Search className="h-4 w-4" /> Check
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          Try a recent guide:{" "}
          {SAMPLES.map((s, i) => (
            <span key={s.id}>
              {i > 0 && " · "}
              <button type="button" className="underline decoration-dotted" onClick={() => (setInput(s.id), setGuide(s.id))}>
                {s.name}
              </button>
            </span>
          ))}
        </p>
        {open.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="label-tag">for</span>
            <select className="field h-9" value={call?.id ?? ""} onChange={(e) => onCallChange(e.target.value)}>
              {open.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} · {c.title} ({c.category})
                </option>
              ))}
            </select>
          </div>
        )}
        {q.isFetching && (
          <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading the guide from iFixit…
          </p>
        )}
        {q.isError && <p className="text-sm text-destructive">{q.error.message}</p>}
        {g && (
          <div className="grid sm:grid-cols-[140px_1fr] gap-4">
            {g.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={g.image} alt="" className="rounded-md border border-border w-full aspect-[4/3] object-cover bg-white" />
            ) : (
              <div className="rounded-md border border-border aspect-[4/3] bg-[#ECE8DF]" />
            )}
            <div className="space-y-2 min-w-0">
              <p className="label-tag">
                guide {g.guideid} · revision {g.revisionid} · by {g.author_name}
              </p>
              <a href={g.url} target="_blank" rel="noreferrer" className="display text-lg font-bold leading-snug hover:underline">
                {g.title} <ExternalLink className="inline h-3.5 w-3.5 -mt-1 opacity-60" />
              </a>
              {g.prerequisites.length > 0 && <p className="text-xs text-muted-foreground">Done first in: {g.prerequisites.join("; ")}</p>}
              {call ? (
                <ul className="space-y-1">
                  {rows.map(([ok, text]) => (
                    <li key={text} className="check-row">
                      {ok ? <Check className="h-4 w-4 text-[#1F6B4A] shrink-0" /> : <X className="h-4 w-4 text-destructive shrink-0" />}
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No open call yet: open one to nominate guides.</p>
              )}
            </div>
          </div>
        )}
        {g && call && check && (
          <div className="border-t border-border pt-4 space-y-2">
            <p className={`text-sm ${check.reason ? "text-destructive" : ""}`}>{check.message}</p>
            {blocked && latest ? (
              <a className="text-sm underline" href={`#${latest.id}`}>
                {latest.id} already nominates this guide{RENOMINATE.includes(latest.state) ? " (no new revision since)" : ""}
              </a>
            ) : (
              <Button
                disabled={!isConnected || !!check.reason || !potOk || !!pending}
                onClick={() => writeAsync({ kind: "nominate", callId: call.id, guideId: g.guideid, stake: wei(call.stake) }).catch(() => {})}
              >
                {pending === `nominate:${g.guideid}` && <Loader2 className="h-4 w-4 animate-spin" />}
                {isConnected ? `Nominate · stake ${formatGen(call.stake, 4)} GEN` : "Connect a wallet to nominate"}
              </Button>
            )}
            {!potOk && <p className="text-xs text-destructive">This call&apos;s pot cannot pay another reward; add GEN to it first.</p>}
            <p className="text-xs text-muted-foreground">
              The validators run these checks themselves, compare the guide with up to five earlier guides of the same device (shared photos and phrases), and read its
              steps against the call. Incomplete or off-scope guides lose the stake to the pot; unclear ones get it back.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
