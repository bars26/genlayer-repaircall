"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import RepairCall, { type CreateCallInput, type TxProgress, type TxResult } from "../contracts/RepairCall";
import { STATE_STYLE, formatGen, sameAddress, todayUtc, type Call, type Claim } from "../contracts/types";
import { isOnGenLayerNetwork, switchToGenLayerNetwork } from "../genlayer/client";
import { useWallet } from "../genlayer/wallet";
import { currentNetwork } from "../network";
import { TxError, classifyError } from "../utils/errors";
import { error, success } from "../utils/toast";
import { startTx, updateTx, type TxKind } from "./useTxLog";

export function useRepairCallContract(): RepairCall | null {
  const { address } = useWallet();
  const network = currentNetwork();
  return useMemo(() => (/^0x[0-9a-fA-F]{40}$/.test(network.contract) ? new RepairCall(network, address) : null), [network, address]);
}

type Registry = { calls: Call[]; claims: Claim[]; fetchedAt?: string };
const registryKey = () => ["registry", currentNetwork().id];

async function fetchJson(url: string, timeoutMs = 60_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const res = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body;
}

/** Every call and nomination, from the CDN-cached server snapshot (app/api/registry); falls back to two direct reads. */
export function useRegistry() {
  const contract = useRepairCallContract();
  const query = useQuery<Registry, Error>({
    queryKey: registryKey(),
    queryFn: async () => {
      try {
        const body = await fetchJson(`/api/registry?network=${currentNetwork().id}`);
        if (!Array.isArray(body.calls) || !Array.isArray(body.claims)) throw new Error("Malformed snapshot");
        return body as Registry;
      } catch (snapshotErr) {
        if (!contract) throw classifyError(snapshotErr, "read");
        const [calls, claims] = await Promise.all([contract.getCalls(), contract.getClaims()]);
        return { calls, claims, fetchedAt: new Date().toISOString() };
      }
    },
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });
  return {
    calls: query.data?.calls ?? [],
    claims: query.data?.claims ?? [],
    fetchedAt: query.data?.fetchedAt,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Re-read what a write touched and merge it into the cached registry. */
async function mergeFresh(qc: ReturnType<typeof useQueryClient>, contract: RepairCall, callId?: string, claimId?: string) {
  try {
    const [call, claim] = await Promise.all([
      callId ? contract.getCallWithFunders(callId) : Promise.resolve(null),
      claimId ? contract.getClaim(claimId) : Promise.resolve(null),
    ]);
    qc.setQueryData<Registry>(registryKey(), (prev) => {
      let calls = prev?.calls ?? [];
      let claims = prev?.claims ?? [];
      if (call) calls = calls.some((c) => c.id === call.id) ? calls.map((c) => (c.id === call.id ? call : c)) : [...calls, call];
      if (claim) claims = claims.some((d) => d.id === claim.id) ? claims.map((d) => (d.id === claim.id ? claim : d)) : [...claims, claim];
      return { calls, claims, fetchedAt: prev?.fetchedAt };
    });
  } catch {
    // Already confirmed on chain; the next snapshot refresh picks it up.
  }
}

export type WriteVars =
  | { kind: "create"; input: CreateCallInput; fund: bigint }
  | { kind: "fund"; callId: string; value: bigint }
  | { kind: "nominate"; callId: string; guideId: number; stake: bigint }
  | { kind: "settle"; claimId: string; callId: string }
  | { kind: "contest"; claimId: string; callId: string; reason: string; source: string; stake: bigint }
  | { kind: "collect"; claimId: string; callId: string }
  | { kind: "lapse"; claimId: string; callId: string }
  | { kind: "close"; callId: string }
  | { kind: "refund"; callId: string; funder: string }
  | { kind: "withdraw" };

export const WRITE_LABEL: Record<TxKind, string> = {
  create: "Open a call",
  fund: "Add to the call",
  nominate: "Nominate a guide",
  settle: "Settle a nomination",
  contest: "Contest a nomination",
  collect: "Collect the author's share",
  lapse: "Return an uncollected share",
  close: "Close the call",
  refund: "Credit a funder's share",
  withdraw: "Withdraw your GEN",
};

const pendingKey = (v: WriteVars) =>
  v.kind === "withdraw" || v.kind === "create"
    ? v.kind
    : v.kind === "nominate"
      ? `nominate:${v.guideId}`
      : v.kind === "refund"
        ? `refund:${v.callId}:${v.funder.toLowerCase()}`
        : `${v.kind}:${"claimId" in v ? v.claimId : v.callId}`;

/** One mutation for every RepairCall write, with a transaction log entry and typed errors. */
export function useRepairCallWrite() {
  const contract = useRepairCallContract();
  const { address } = useWallet();
  const qc = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (vars: WriteVars) => {
      const target =
        vars.kind === "withdraw" ? "your credited GEN" : vars.kind === "create" ? vars.input.title : vars.kind === "nominate" ? `guide ${vars.guideId}` : "claimId" in vars ? vars.claimId : vars.callId;
      const logId = startTx(vars.kind, target);
      setPending(pendingKey(vars));
      const onProgress = (p: TxProgress) =>
        updateTx(logId, { state: p.step === "awaiting_wallet" ? "awaiting_wallet" : p.step === "accepted" ? "accepted" : "confirming", txHash: p.txHash, progress: p.message });
      const refuse = (message: string): never => {
        throw new TxError({ kind: "contract_revert", phase: "estimate", message, hint: "The data was refreshed; nothing was sent." });
      };
      try {
        if (!contract) throw new TxError({ kind: "unknown", phase: "send", message: "The contract address is not configured." });
        if (!address) throw new TxError({ kind: "wallet_missing", phase: "send", message: "No wallet is connected." });
        // A wallet that was already connected keeps whatever chain it was on: ask MetaMask to switch first.
        if (!(await isOnGenLayerNetwork())) {
          try {
            await switchToGenLayerNetwork();
          } catch (err) {
            throw classifyError(err, "send");
          }
        }
        let result: TxResult;
        let callId = "callId" in vars ? vars.callId : undefined;
        let claimId = "claimId" in vars ? vars.claimId : undefined;
        let note = "Done.";
        const bradbury = contract.network.id === "bradbury";
        const owedBefore = ["create", "fund", "nominate", "contest", "collect", "withdraw"].includes(vars.kind) ? await contract.owedTo(address) : 0n;
        // A refused payable call (or a reverted one on Bradbury, which reports no return value) shows up as GEN credited back.
        const refusedPayment = async (sent: bigint, txHash: string) => {
          if ((await contract.owedTo(address)) >= owedBefore + sent && sent > 0n) {
            throw new TxError({
              kind: "contract_revert",
              phase: "verify",
              txHash,
              message: "The contract refused this call and credited your GEN back.",
              hint: "Withdraw it from “Your GEN in RepairCall”. The usual reasons are checked before sending.",
            });
          }
        };
        // Stakes come out of your credit, so a reading the validators cannot decide never strands GEN.
        const ensureStake = async (stake: bigint) => {
          if (owedBefore < stake) {
            onProgress({ step: "awaiting_wallet", message: "First, deposit the stake: approve it in your wallet." });
            await contract.deposit(stake - owedBefore, onProgress);
          }
        };
        switch (vars.kind) {
          case "create":
            result = await contract.createCall(vars.input, vars.fund, onProgress);
            if (bradbury) {
              await refusedPayment(vars.fund, result.txHash);
              result.returned = (await contract.getCalls()).filter((c) => sameAddress(c.sponsor, address) && c.title === vars.input.title.trim()).at(-1)?.id;
            }
            callId = typeof result.returned === "string" ? result.returned : undefined;
            note = callId ? `${callId} pays ${formatGen(vars.input.reward, 4)} GEN per accepted guide until ${vars.input.ends}.` : "Call opened.";
            break;
          case "fund": {
            const c = await contract.getCall(vars.callId);
            if (c.state !== "open" || todayUtc() > c.ends) refuse("This call no longer takes GEN.");
            result = await contract.fund(vars.callId, vars.value, onProgress);
            if (bradbury) await refusedPayment(vars.value, result.txHash);
            note = "Added to the call. What is left when it closes returns to funders in proportion.";
            break;
          }
          case "nominate": {
            const c = await contract.getCall(vars.callId);
            if (c.state !== "open" || todayUtc() > c.ends) refuse("This call no longer takes nominations.");
            await ensureStake(vars.stake);
            result = await contract.nominate(vars.callId, vars.guideId, onProgress);
            if (bradbury) {
              const mine = (await contract.getClaims()).filter((d) => sameAddress(d.scout, address) && String(d.guideid) === String(vars.guideId));
              result.returned = mine.at(-1)?.id;
            }
            claimId = typeof result.returned === "string" ? result.returned : undefined;
            if (claimId) {
              const d = await contract.getClaim(claimId);
              note = `${claimId}: ${STATE_STYLE[d.state]?.label ?? d.state}. ${d.why}`;
            }
            break;
          }
          case "settle":
            result = await contract.settle(vars.claimId, onProgress);
            note = "Accepted: the scout's stake and share are credited; the author's share is held for the author.";
            break;
          case "contest": {
            await ensureStake(vars.stake);
            result = await contract.contest(vars.claimId, vars.reason, vars.source, onProgress);
            const d = await contract.getClaim(vars.claimId);
            note = `${STATE_STYLE[d.state]?.label ?? d.state}. ${d.why}`;
            break;
          }
          case "collect":
            result = await contract.collect(vars.claimId, onProgress);
            note = `${formatGen((await contract.owedTo(address)) - owedBefore, 4)} GEN credited to you as the guide's author.`;
            break;
          case "lapse":
            result = await contract.lapse(vars.claimId, onProgress);
            note = "The uncollected share went back to the call (or its sponsor, if closed).";
            break;
          case "close": {
            const c = await contract.getCall(vars.callId);
            if (c.state !== "open") refuse("This call is already closed.");
            if (todayUtc() <= c.ends) refuse(`Nominations are taken until ${c.ends}.`);
            result = await contract.close(vars.callId, onProgress);
            note = "Closed. Each funder's share can now be credited, one funder per transaction, by anyone.";
            break;
          }
          case "refund":
            result = await contract.refund(vars.callId, vars.funder, onProgress);
            note = `${vars.funder.slice(0, 6)}…${vars.funder.slice(-4)}'s share is credited; they take it out with Withdraw.`;
            break;
          case "withdraw":
            if (owedBefore === 0n) refuse("Nothing is credited to this wallet.");
            result = await contract.withdraw(onProgress);
            note = `${formatGen(owedBefore, 4)} GEN sent to your wallet${bradbury ? " (it arrives about a minute after the transaction finalizes)" : ""}.`;
            break;
        }
        updateTx(logId, { state: "accepted", txHash: result.txHash, status: result.status, executionResult: result.executionResult, progress: note });
        return { callId, claimId, txHash: result.txHash, kind: vars.kind, note };
      } catch (err) {
        const e = classifyError(err, "send");
        if (contract) mergeFresh(qc, contract, "callId" in vars ? vars.callId : undefined, "claimId" in vars ? vars.claimId : undefined);
        updateTx(logId, { state: "failed", txHash: e.txHash, error: { kind: e.kind, message: e.message, hint: e.hint, detail: e.detail, phase: e.phase } });
        error(`${WRITE_LABEL[vars.kind]} failed`, { description: [e.message, e.hint].filter(Boolean).join(" "), duration: 12000 });
        throw err;
      } finally {
        setPending(null);
      }
    },
    onSuccess: ({ callId, claimId, txHash, kind, note }) => {
      if (contract) mergeFresh(qc, contract, callId, claimId);
      qc.invalidateQueries({ queryKey: ["genBalance"] });
      qc.invalidateQueries({ queryKey: ["owed"] });
      success(`${WRITE_LABEL[kind]} confirmed`, { description: `${note} Tx ${txHash.slice(0, 10)}…`, duration: 12000 });
    },
  });

  return { write: mutation.mutate, writeAsync: mutation.mutateAsync, pending, isPending: mutation.isPending };
}
