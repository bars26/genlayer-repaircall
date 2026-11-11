"use client";

import { useState } from "react";
import { ExternalLink, Gavel, HandCoins, Loader2, Scale, Undo2 } from "lucide-react";
import { STATE_STYLE, ZERO, deadlineMs, formatGen, guideUrl, sameAddress, short, userUrl, type Call, type Claim } from "@/lib/contracts/types";
import { useWallet } from "@/lib/genlayer/wallet";
import { useRepairCallWrite } from "@/lib/hooks/useRepairCall";
import { useNow } from "@/lib/hooks/useNow";
import { Button } from "./ui/button";

export function ClaimCard({ claim: d, call }: { claim: Claim; call?: Call }) {
  const { address, isConnected } = useWallet();
  const { writeAsync, pending } = useRepairCallWrite();
  const now = useNow(5_000);
  const [reason, setReason] = useState("");
  const [source, setSource] = useState("");
  const [contesting, setContesting] = useState(false);
  const style = STATE_STYLE[d.state] ?? { label: d.state, tag: "tag-grey", help: "" };
  const due = deadlineMs(d);
  const open = d.state === "candidate" && now <= due;
  const settleable = d.state === "candidate" && now > due;
  const left = Math.max(0, Math.round((due - now) / 60000));
  const mineScout = sameAddress(d.scout, address);
  const collectBy = d.collect_by ? Date.parse(`${d.collect_by}Z`) : 0;
  const busy = !!pending;
  const sourceOk = source === "" || (/^[1-9]\d{0,8}$/.test(source) && source !== String(d.guideid));

  return (
    <article id={d.id} className="lab-card p-5 text-sm space-y-3 scroll-mt-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`tag ${style.tag}`} title={style.help}>
              {style.label}
            </span>
            <span className="label-tag">
              {d.id} · {d.call_id} · nominated {d.filed_at.replace("T", " ")} UTC
            </span>
          </div>
          <h3 className="display text-lg font-bold leading-snug">
            <a href={guideUrl(d.guideid)} target="_blank" rel="noreferrer" className="hover:underline">
              {d.title} <ExternalLink className="inline h-3.5 w-3.5 -mt-1 opacity-60" />
            </a>
          </h3>
          <p className="text-muted-foreground text-[13px]">
            {d.kind} · {d.category}
            {d.subject ? ` · ${d.subject}` : ""} · by{" "}
            <a className="underline decoration-dotted" href={userUrl(d.author_id)} target="_blank" rel="noreferrer">
              {d.author_name || `user ${String(d.author_id)}`}
            </a>
            , created {d.created}
          </p>
        </div>
      </div>
      <p>{d.why}</p>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[13px]">
        <div className="ledger">
          <dt>steps / photos</dt>
          <dd>
            {String(d.steps)} / {String(d.photos)}
          </dd>
        </div>
        <div className="ledger">
          <dt>validators read</dt>
          <dd>{d.answer.replace("_", " ")}</dd>
        </div>
        <div className="ledger">
          <dt>stake</dt>
          <dd>{formatGen(d.stake, 4)} GEN</dd>
        </div>
        <div className="ledger">
          <dt>{d.state === "candidate" ? "reward held" : "scout / author"}</dt>
          <dd>{d.state === "candidate" ? `${formatGen(d.reward, 4)} GEN` : `${formatGen(d.scout_share, 4)} / ${formatGen(d.author_share, 4)}`}</dd>
        </div>
      </dl>
      {d.contester !== ZERO && d.contester && (
        <blockquote className="border-l-2 border-[#E8590C] pl-3 text-[13px]">
          <p className="label-tag">
            contested by {short(d.contester)} · {d.contest_answer === "COPIED" ? "copy check in code" : `second look: ${d.contest_answer.toLowerCase()}`}
            {d.contest_source ? ` · named guide ${d.contest_source}` : ""}
          </p>
          <p className="italic">“{d.contest_text}”</p>
          {d.copy && <p className="mono text-xs mt-1">{d.copy}</p>}
        </blockquote>
      )}
      {d.author_state && (
        <p className="text-[13px] rounded-md bg-[#F4EEE2] px-3 py-2">
          {d.author_state === "held" && (
            <>
              <strong>{formatGen(d.author_share, 4)} GEN held for {d.author_name}</strong> until {d.collect_by.replace("T", " ")} UTC. The author collects it by adding their
              wallet address to the About text of their{" "}
              <a className="underline" href={userUrl(d.author_id)} target="_blank" rel="noreferrer">
                iFixit profile
              </a>{" "}
              and pressing Collect.
            </>
          )}
          {d.author_state === "collected" && <>Collected by the author ({short(d.collected_by)}).</>}
          {d.author_state === "lapsed" && <>Not collected in time: the author&apos;s share went back to the call (or its sponsor).</>}
        </p>
      )}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Evidence</summary>
        <p className="mono mt-1 break-all">
          guide {String(d.guideid)} revision {String(d.revisionid)} · scout {d.scout} · packet sha256 {d.packet}
        </p>
      </details>
      <div className="flex flex-wrap gap-2">
        {open && (
          <>
            <span className="text-xs text-muted-foreground self-center">Open to contest for {left} more minute{left === 1 ? "" : "s"}.</span>
            {!mineScout && (
              <Button size="sm" variant="outline" disabled={!isConnected || busy} onClick={() => setContesting((v) => !v)}>
                <Scale className="h-4 w-4" /> Contest
              </Button>
            )}
          </>
        )}
        {settleable && (
          <Button size="sm" disabled={!isConnected || busy} onClick={() => writeAsync({ kind: "settle", claimId: d.id, callId: d.call_id }).catch(() => {})}>
            {pending === `settle:${d.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />} Settle
          </Button>
        )}
        {d.author_state === "held" && now <= collectBy && (
          <Button size="sm" variant="outline" disabled={!isConnected || busy} onClick={() => writeAsync({ kind: "collect", claimId: d.id, callId: d.call_id }).catch(() => {})}
            title="For the guide's author: your wallet must be listed in your iFixit profile">
            {pending === `collect:${d.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <HandCoins className="h-4 w-4" />} Collect as the author
          </Button>
        )}
        {d.author_state === "held" && now > collectBy && (
          <Button size="sm" variant="outline" disabled={!isConnected || busy} onClick={() => writeAsync({ kind: "lapse", claimId: d.id, callId: d.call_id }).catch(() => {})}>
            <Undo2 className="h-4 w-4" /> Return the uncollected share
          </Button>
        )}
      </div>
      {contesting && open && (
        <form
          className="space-y-2 rounded-md border border-border bg-white p-3"
          onSubmit={(e) => {
            e.preventDefault();
            writeAsync({ kind: "contest", claimId: d.id, callId: d.call_id, reason: reason.trim(), source, stake: BigInt(String(d.stake)) })
              .then(() => setContesting(false))
              .catch(() => {});
          }}
        >
          <label className="label-tag" htmlFor={`why-${d.id}`}>
            what is wrong with this guide (validators read it next to the guide)
          </label>
          <textarea id={`why-${d.id}`} className="field" rows={2} maxLength={600} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="For example: step 7 skips disconnecting the battery; or: copied from an earlier guide." />
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="label-tag" htmlFor={`src-${d.id}`}>
                copied from guide (optional)
              </label>
              <input id={`src-${d.id}`} className="field h-9" style={{ width: 140 }} inputMode="numeric" value={source} onChange={(e) => setSource(e.target.value.trim())} placeholder="guide number" />
            </div>
            <Button type="submit" size="sm" className="h-9" disabled={reason.trim().length < 10 || !sourceOk || busy}>
              {pending === `contest:${d.id}` && <Loader2 className="h-4 w-4 animate-spin" />}
              Contest · stake {formatGen(d.stake, 4)} GEN
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A named guide that is older is compared in code (shared step photos, shared phrases): a copy overturns the nomination at once. Otherwise the validators read
            the guide again with your reason. If they cannot decide, the first reading stands and your stake comes back.
          </p>
        </form>
      )}
      {call && d.state === "candidate" && <p className="sr-only">{call.title}</p>}
    </article>
  );
}
