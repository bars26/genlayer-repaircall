"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { MIN_FUND_WEI, MIN_STAKE_WEI, TYPES, addDays, formatGen, parseGen, todayUtc } from "@/lib/contracts/types";
import { useRepairCallWrite } from "@/lib/hooks/useRepairCall";
import { useWallet } from "@/lib/genlayer/wallet";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const realDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
type CategoryCheck = { title: string; ancestors: string[]; guides: number; children: number; url: string } | { error: string } | null;

/** Open a call for new iFixit guides: accepted guides are paid from the pot, split between scout and author. */
export function CreateCallModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { isConnected } = useWallet();
  const { writeAsync, pending } = useRepairCallWrite();
  const [f, setF] = useState({
    title: "Phone battery replacements",
    category: "Phone",
    scope: "Battery replacements for phones: opening the phone safely, disconnecting and removing the old battery, fitting the new one and closing up.",
    since: addDays(todayUtc(), -14),
    ends: addDays(todayUtc(), 60),
    minSteps: "8",
    reward: "0.5",
    scoutPct: "20",
    stake: "0.1",
    minutes: "1440",
    perScout: "10",
    fund: "3",
  });
  const [types, setTypes] = useState<string[]>(["replacement", "repair"]);
  const [cat, setCat] = useState<CategoryCheck>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  // Look the category up on iFixit as the sponsor types (debounced): a misspelt category would take no guide at all.
  useEffect(() => {
    const t = f.category.trim();
    if (t.length < 2) return setCat(null);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/category?title=${encodeURIComponent(t)}`);
        setCat(await res.json());
      } catch {
        setCat({ error: "Could not reach iFixit." });
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [f.category]);

  const reward = parseGen(f.reward);
  const stake = parseGen(f.stake);
  const fund = parseGen(f.fund);
  const scoutBps = Math.round(Number(f.scoutPct) * 100);
  const oldest = addDays(todayUtc(), -90);
  const catOk = !!cat && "title" in cat;
  const problems = [
    !(f.title.trim().length >= 3 && f.title.trim().length <= 80) && "The title must be 3 to 80 characters.",
    !catOk && "Pick a category that exists on iFixit (its device page).",
    types.length === 0 && "Pick at least one guide type.",
    !(f.scope.trim().length >= 10 && f.scope.trim().length <= 240) && "Describe what you pay for in 10 to 240 characters.",
    !(realDay(f.since) && f.since >= oldest && f.since <= todayUtc()) && `Guides created from: a real date between ${oldest} and today.`,
    !(realDay(f.ends) && f.ends >= todayUtc()) && "The last day must be a real date, today or later.",
    !(/^\d{1,2}$/.test(f.minSteps) && Number(f.minSteps) >= 3 && Number(f.minSteps) <= 60) && "Minimum steps: 3 to 60.",
    !(reward && reward >= MIN_STAKE_WEI) && "The reward must be at least 0.01 GEN.",
    !(/^\d{1,2}(\.\d{1,2})?$/.test(f.scoutPct) && scoutBps >= 0 && scoutBps <= 5000) && "The scout's share must be 0 to 50%.",
    !(stake && stake >= MIN_STAKE_WEI) && "The stake must be at least 0.01 GEN.",
    !(/^\d{1,5}$/.test(f.minutes) && Number(f.minutes) >= 10 && Number(f.minutes) <= 43200) && "The contest window must be 10 to 43200 minutes.",
    !(/^\d{1,2}$/.test(f.perScout) && Number(f.perScout) >= 1 && Number(f.perScout) <= 50) && "Nominations per scout must be 1 to 50.",
    !(fund && reward && fund >= reward && fund >= MIN_FUND_WEI) && "Fund at least one reward and at least 0.1 GEN.",
  ].filter(Boolean) as string[];
  const rewards = reward && fund && reward > 0n ? Number(fund / reward) : 0;

  const submit = async () => {
    if (!reward || !fund || !stake || !catOk) return;
    try {
      await writeAsync({
        kind: "create",
        input: {
          title: f.title.trim(), category: (cat as { title: string }).title, types: types.join(","), scope: f.scope.trim(), since: f.since, ends: f.ends,
          minSteps: Number(f.minSteps), reward, scoutBps, stake, contestMinutes: Number(f.minutes), perScout: Number(f.perScout),
        },
        fund,
      });
      onOpenChange(false);
    } catch {
      // shown in the toast and the transactions panel
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="display text-2xl">Open a call for repair guides</DialogTitle>
          <DialogDescription>
            Name the devices and the kind of guide you want written. Anyone may nominate a new iFixit guide with a stake; validators read it and pay accepted guides from
            your pot, part to the scout now and the rest held for the guide&apos;s author. What is left after the last day comes back to the funders.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={f.title} onChange={set("title")} maxLength={80} />
            </div>
            <div className="space-y-1">
              <Label>iFixit category (devices under it qualify)</Label>
              <Input value={f.category} onChange={set("category")} maxLength={80} />
              <p className="text-xs min-h-4">
                {cat && "title" in cat ? (
                  <span className="text-[#1F6B4A] inline-flex items-center gap-1">
                    <Check className="h-3 w-3" /> {[...cat.ancestors].reverse().concat(cat.title).join(" › ")} · {cat.children} sub-categories
                  </span>
                ) : cat && "error" in cat ? (
                  <span className="text-destructive inline-flex items-center gap-1">
                    <X className="h-3 w-3" /> {cat.error}
                  </span>
                ) : null}
              </p>
            </div>
          </div>
          <div className="space-y-1">
            <Label>What you pay for (the validators read this)</Label>
            <textarea className="field" rows={2} value={f.scope} maxLength={240} onChange={set("scope")} />
          </div>
          <div className="space-y-1">
            <Label>Guide types</Label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypes(types.includes(t) ? types.filter((x) => x !== t) : [...types, t])}
                  className={`rounded-full border px-3 py-1 text-xs ${types.includes(t) ? "bg-[#1E2226] text-white border-[#1E2226]" : "bg-white border-border"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Guides created from</Label>
              <Input type="date" value={f.since} onChange={set("since")} />
            </div>
            <div className="space-y-1">
              <Label>Last day for nominations</Label>
              <Input type="date" value={f.ends} onChange={set("ends")} />
            </div>
            <div className="space-y-1">
              <Label>Photographed steps, at least</Label>
              <Input value={f.minSteps} onChange={set("minSteps")} inputMode="numeric" />
            </div>
            <div className="space-y-1">
              <Label>Reward per guide (GEN)</Label>
              <Input value={f.reward} onChange={set("reward")} inputMode="decimal" />
            </div>
            <div className="space-y-1">
              <Label>Scout&apos;s share (%)</Label>
              <Input value={f.scoutPct} onChange={set("scoutPct")} inputMode="decimal" />
            </div>
            <div className="space-y-1">
              <Label>Stake to nominate or contest</Label>
              <Input value={f.stake} onChange={set("stake")} inputMode="decimal" />
            </div>
            <div className="space-y-1">
              <Label>Contest window (minutes)</Label>
              <Input value={f.minutes} onChange={set("minutes")} inputMode="numeric" />
            </div>
            <div className="space-y-1">
              <Label>Nominations per scout</Label>
              <Input value={f.perScout} onChange={set("perScout")} inputMode="numeric" />
            </div>
            <div className="space-y-1">
              <Label>Fund now (GEN)</Label>
              <Input value={f.fund} onChange={set("fund")} inputMode="decimal" />
            </div>
          </div>
          <p className="text-sm rounded-lg bg-[#F4EEE2] p-3">
            Pays up to <strong>{rewards}</strong> guides. Authors collect their share by adding their wallet to their iFixit profile within 180 days; an uncollected share
            returns to this call (or to you, once it is closed).
          </p>
          {problems.length > 0 && (
            <ul className="text-sm text-destructive list-disc pl-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <Button className="w-full" onClick={submit} disabled={!isConnected || problems.length > 0 || pending === "create"}>
            {pending === "create" && <Loader2 className="h-4 w-4 animate-spin" />}
            {isConnected ? `Fund ${fund ? formatGen(fund, 4) : "?"} GEN and open the call` : "Connect a wallet to open a call"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
