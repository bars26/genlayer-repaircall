"use client";

import { useState } from "react";
import { BookOpenCheck, HandCoins, Loader2, Megaphone, RefreshCw, Scale } from "lucide-react";
import { CallCard } from "@/components/CallCard";
import { ClaimCard } from "@/components/ClaimCard";
import { CreateCallModal } from "@/components/CreateCallModal";
import { GuideBench } from "@/components/GuideBench";
import { Navbar } from "@/components/Navbar";
import { OwedCard } from "@/components/OwedCard";
import { TransactionPanel } from "@/components/TransactionPanel";
import { Button } from "@/components/ui/button";
import { formatGen, wei } from "@/lib/contracts/types";
import { useRegistry } from "@/lib/hooks/useRepairCall";
import { addressUrl } from "@/lib/network";
import { useNetwork } from "@/lib/useNetwork";

const STEPS = [
  { icon: Megaphone, title: "A sponsor opens a call", body: "A repair café, a school or a right-to-repair group names the devices and the guides it wants, and funds the pot." },
  { icon: BookOpenCheck, title: "A scout nominates a guide", body: "Any new iFixit guide that fits, with a stake. The bench shows what the validators will check before you send it." },
  { icon: Scale, title: "Code checks, validators read", body: "Validators read the guide from iFixit, check its date, type, device, photos and flags in code, compare it with earlier guides, and read its steps." },
  { icon: HandCoins, title: "Contest, settle, collect", body: "A candidate is open to contest. Then the scout is paid, and the author's share waits until they list a wallet on their iFixit profile." },
];

export default function HomePage() {
  const { calls, claims, isLoading, isError, error, isFetching, refetch, fetchedAt } = useRegistry();
  const [creating, setCreating] = useState(false);
  const [callId, setCallId] = useState("");
  const net = useNetwork();
  const order = ["candidate", "upheld", "accepted", "unclear", "rejected", "overturned"];
  const shown = [...claims].sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state) || Number(b.id.split("_")[1]) - Number(a.id.split("_")[1]));
  const accepted = claims.filter((d) => ["accepted", "upheld"].includes(d.state)).length;
  const paid = calls.reduce((s, c) => s + wei(c.paid_total), 0n);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar onCreate={() => setCreating(true)} />
      <main className="flex-grow pt-24 pb-12 px-4 md:px-6">
        <div className="max-w-6xl mx-auto space-y-10">
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 space-y-5 lg:pt-3">
              <p className="label-tag">repair guides · ifixit · genlayer</p>
              <h1 className="display text-[46px] md:text-[60px] font-extrabold leading-[0.95] tracking-tight">
                Pay for the repair guide
                <br />
                <span className="text-[#E8590C]">that is missing.</span>
              </h1>
              <p className="text-lg text-muted-foreground">
                Dozens of iFixit guides are started every day; of the 200 newest, only 22 had six photographed steps of their own. RepairCall lets a sponsor fund the guides it needs,
                anyone nominate a new one with a stake, and GenLayer validators decide, reading the guide on iFixit themselves. Accepted guides pay the scout now
                and hold the author&apos;s share until the author claims it.
              </p>
              <dl className="grid grid-cols-3 gap-2">
                {[
                  ["nominations", String(claims.length)],
                  ["accepted", String(accepted)],
                  ["GEN paid", formatGen(paid, 2)],
                ].map(([k, v]) => (
                  <div key={k} className="lab-card px-3 py-2.5">
                    <dt className="label-tag">{k}</dt>
                    <dd className="display text-3xl font-extrabold">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="lg:col-span-7">
              <GuideBench calls={calls} claims={claims} callId={callId} onCallChange={setCallId} />
            </div>
          </section>

          <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-lg border border-border bg-[#FFFCF6]/85 p-4">
                <p className="flex items-center gap-2">
                  <span className="mono text-xs text-muted-foreground">0{i + 1}</span>
                  <s.icon className="h-4 w-4 text-[#E8590C]" />
                  <strong className="display text-base">{s.title}</strong>
                </p>
                <p className="text-sm text-muted-foreground mt-1.5">{s.body}</p>
              </div>
            ))}
          </section>
          <p className="text-xs text-muted-foreground -mt-6">
            Guides stay on iFixit under their authors&apos; licence (CC BY-NC-SA); RepairCall only reads them and pays for them. The calls below are demos funded by test
            wallets; the guides are real.
          </p>

          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-5">
              <div className="flex items-end justify-between gap-3">
                <h2 className="display text-3xl font-extrabold">Nominations</h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {fetchedAt && <span>updated {new Date(fetchedAt).toLocaleTimeString()}</span>}
                  <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh">
                    <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>
              {isLoading && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Reading the nominations from {net.label}…
                </p>
              )}
              {isError && <p className="text-destructive text-sm">Could not read the contract: {error?.message}</p>}
              {!isLoading && shown.length === 0 && <div className="lab-card p-6 text-center text-muted-foreground">No nominations yet: check a guide on the bench above.</div>}
              {shown.map((d) => (
                <ClaimCard key={d.id} claim={d} call={calls.find((c) => c.id === d.call_id)} />
              ))}
            </div>
            <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-24">
              <OwedCard />
              {[...calls].reverse().map((c) => (
                <CallCard key={c.id} call={c} selected={c.id === callId} onSelect={() => (setCallId(c.id), window.scrollTo({ top: 0, behavior: "smooth" }))} />
              ))}
              {calls.length === 0 && !isLoading && (
                <div className="lab-card p-5 text-sm space-y-3">
                  <p>No call pays for guides yet.</p>
                  <Button size="sm" onClick={() => setCreating(true)}>
                    Open a call
                  </Button>
                </div>
              )}
              <TransactionPanel />
            </aside>
          </section>
        </div>
      </main>
      <footer className="border-t border-border py-6 px-4 text-center text-xs text-muted-foreground space-y-1">
        <p>
          RepairCall on {net.label} ·{" "}
          <a className="underline mono" href={addressUrl(net, net.contract)} target="_blank" rel="noreferrer">
            {net.contract.slice(0, 6)}…{net.contract.slice(-4)}
          </a>{" "}
          · guides, devices and profiles read from the iFixit API.
        </p>
        <p>
          <a className="underline" href="https://github.com/bars26/genlayer-repaircall" target="_blank" rel="noreferrer">
            Source and reproduction on GitHub
          </a>
        </p>
      </footer>
      <CreateCallModal open={creating} onOpenChange={setCreating} />
    </div>
  );
}
