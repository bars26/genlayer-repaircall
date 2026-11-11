"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { callTypes, formatGen, funderRow, fundersOf, parseGen, scoutShare, todayUtc, wei, type Call } from "@/lib/contracts/types";
import { useRepairCallWrite } from "@/lib/hooks/useRepairCall";
import { useWallet } from "@/lib/genlayer/wallet";
import { Button } from "./ui/button";

const deviceUrl = (title: string) => `https://www.ifixit.com/Device/${encodeURIComponent(title.replaceAll(" ", "_"))}`;

export function CallCard({ call, selected, onSelect }: { call: Call; selected?: boolean; onSelect?: () => void }) {
  const { address, isConnected } = useWallet();
  const { writeAsync, pending } = useRepairCallWrite();
  const [fundInput, setFundInput] = useState("1");
  const fundWei = parseGen(fundInput);
  const funded = wei(call.funded_total);
  const paid = wei(call.paid_total);
  const open = call.state === "open";
  const takes = open && todayUtc() <= call.ends;
  const canClose = open && todayUtc() > call.ends;
  const mine = funderRow(call, address);
  const toReturn = fundersOf(call).filter((f) => !f.refunded);
  const rewardsLeft = wei(call.reward) > 0n ? Number(wei(call.pot) / wei(call.reward)) : 0;
  const scout = scoutShare(call);

  return (
    <div className={`lab-card overflow-hidden text-sm transition ${selected ? "ring-2 ring-[#E8590C]" : ""}`}>
      {takes && <div className="hazard" />}
      <div className="lab-head px-5 py-3">
        <p className="label-tag !text-[#C9CDD2]">
          {call.id} · {open ? (takes ? "open" : "past its last day") : "closed"} · {String(call.n_funders)} funder{Number(call.n_funders) === 1 ? "" : "s"}
        </p>
        <p className="display text-lg font-bold leading-tight">{call.title}</p>
      </div>
      <div className="p-5 space-y-3">
        <p className="text-[13px] leading-relaxed">“{call.scope}”</p>
        <dl className="grid grid-cols-2 gap-2 text-[13px]">
          <div className="ledger">
            <dt>devices under</dt>
            <dd>
              <a className="underline decoration-dotted" href={deviceUrl(call.category)} target="_blank" rel="noreferrer">
                {call.category}
              </a>
            </dd>
          </div>
          <div className="ledger">
            <dt>guide types</dt>
            <dd className="truncate" title={callTypes(call).join(", ")}>{callTypes(call).join(", ")}</dd>
          </div>
          <div className="ledger">
            <dt>created from</dt>
            <dd className="mono">{call.since}</dd>
          </div>
          <div className="ledger">
            <dt>at least</dt>
            <dd>{String(call.min_steps)} photographed steps</dd>
          </div>
        </dl>
        <p>
          Each accepted guide pays <span className="tape">{formatGen(call.reward, 4)} GEN</span>: {formatGen(scout, 4)} to the scout who nominated it,{" "}
          {formatGen(wei(call.reward) - scout, 4)} held for its author. Nominating or contesting stakes {formatGen(call.stake, 4)} GEN; candidates stay open to contest
          for {String(call.contest_minutes)} minutes; nominations until {call.ends}.
        </p>
        <div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-[#E5DDCC]">
            <div className="bg-[#2F7D5B]" style={{ width: `${funded > 0n ? Number((paid * 10000n) / funded) / 100 : 0}%` }} />
            <div className="bg-[#E8590C]" style={{ width: `${funded > 0n ? Number((wei(call.reserved) * 10000n) / funded) / 100 : 0}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatGen(paid, 4)} GEN paid · {formatGen(call.reserved, 4)} held for candidates · {formatGen(call.pot, 4)} free ({rewardsLeft} reward{rewardsLeft === 1 ? "" : "s"}) ·{" "}
            {String(call.n_claims)} nomination{Number(call.n_claims) === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {onSelect && takes && (
            <Button size="sm" className="h-9" variant={selected ? "default" : "outline"} onClick={onSelect}>
              {selected ? "Nominating for this call" : "Nominate for this call"}
            </Button>
          )}
          {takes && (
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (fundWei && fundWei > 0n) writeAsync({ kind: "fund", callId: call.id, value: fundWei }).catch(() => {});
              }}
            >
              <input aria-label="GEN to add" className="field h-9" style={{ width: 70 }} inputMode="decimal" value={fundInput} onChange={(e) => setFundInput(e.target.value)} />
              <Button type="submit" size="sm" variant="outline" className="h-9" disabled={!isConnected || !fundWei || !!pending}>
                {pending === `fund:${call.id}` && <Loader2 className="h-4 w-4 animate-spin" />}
                Add GEN
              </Button>
            </form>
          )}
          <a className="ml-auto text-xs text-muted-foreground inline-flex items-center gap-1 underline decoration-dotted" href={deviceUrl(call.category)} target="_blank" rel="noreferrer">
            iFixit device page <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        {canClose && (
          <Button size="sm" variant="outline" disabled={!isConnected || !!pending} onClick={() => writeAsync({ kind: "close", callId: call.id }).catch(() => {})}>
            Close and return the pot
          </Button>
        )}
        {!open && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Closed: {formatGen(call.returned_total, 4)} of {formatGen(call.returnable, 4)} GEN credited back to {String(call.n_refunded)}/{String(call.n_funders)} funders,
              who take it out with Withdraw.
            </p>
            <div className="flex flex-wrap gap-2">
              {mine && !mine.refunded && (
                <Button size="sm" className="h-8" disabled={!!pending} onClick={() => writeAsync({ kind: "refund", callId: call.id, funder: mine.address }).catch(() => {})}>
                  Credit my share
                </Button>
              )}
              {toReturn
                .filter((f) => f !== mine)
                .slice(0, 4)
                .map((f) => (
                  <Button key={f.address} size="sm" variant="outline" className="h-8 mono text-xs" disabled={!isConnected || !!pending}
                    onClick={() => writeAsync({ kind: "refund", callId: call.id, funder: f.address }).catch(() => {})}>
                    Credit {f.address.slice(0, 6)}…{f.address.slice(-4)}
                  </Button>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
