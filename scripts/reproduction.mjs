// Builds docs/REPRODUCTION.md from the live run (docs/studio/demo-run.json, written by scripts/demo.mjs) and, when
// present, the MetaMask run from the live app (docs/studio/ui-test.json).
//
//   node scripts/reproduction.mjs

import { existsSync, readFileSync, writeFileSync } from "fs";

const EXPLORER = "https://explorer-studio.genlayer.com";
const load = (p) => (existsSync(new URL(p, import.meta.url)) ? JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8")) : null);
const run = load("../docs/studio/demo-run.json");
const ui = load("../docs/studio/ui-test.json");
const tx = (h) => (h ? `[\`${h.slice(0, 10)}…\`](${EXPLORER}/tx/${h})` : "");
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const gen = (wei) => `${(Number(BigInt(wei || 0)) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 4 })} GEN`;
const guide = (id) => `https://www.ifixit.com/Guide/_/${id}`;

const calls = run.calls.map((c) =>
  `| \`${c.id}\` | ${esc(c.title)} | ${esc(c.category)} | ${esc(c.types)} | ${c.since} | ${c.min_steps} | ${gen(c.reward)} (scout ${Number(c.scout_bps) / 100}%) | ${gen(c.funded_total)} | ${gen(c.paid_total)} |`
);
const claims = Object.entries(run.claims).map(([id, d]) =>
  `| ${id} | \`${d.call_id}\` | [${d.guideid}](${guide(d.guideid)}) ${esc(d.title)} | ${esc(d.category)} · ${d.kind} | ${d.created} | ${d.steps}/${d.photos} | ${d.answer} | **${d.state}** | ${esc(d.why)} |`
);
const evidence = Object.entries(run.claims).map(([id, d]) =>
  `| ${id} | ${d.revisionid} | ${esc(d.author_name)} (${d.author_id}) | ${gen(d.scout_share)} / ${gen(d.author_share)} ${d.author_state || ""} | ${d.contest_answer || ""} ${esc(d.copy)} | \`${d.packet}\` |`
);
const uiTest = ui
  ? `## Wallet test from the live app

${ui.note} Wallet \`${ui.wallet}\`.

| Step | GEN sent | Result | Tx |
|---|---|---|---|
${ui.steps.map(([step, value, result, hash]) => `| ${esc(step)} | ${value} | ${esc(result)} | ${tx(hash)} |`).join("\n")}
`
  : "";

const md = `# RepairCall: reproduction of the live run

Contract on GenLayer Studio: [\`${run.contract}\`](${EXPLORER}/address/${run.contract}) (source \`contracts/repair_call.py\`, checked
byte-identical with \`node scripts/verify-code.mjs ${run.contract}\`).

\`scripts/demo.mjs\` opened two **demo calls** from test wallets and nominated **real community guides** published on iFixit in
the weeks before the run. Every nomination is validator consensus: each validator read the guide from the iFixit API, ran the
code checks (public, created after the call's start, type, own steps and photos, iFixit flags, the device's place under the
call's category), compared it with up to five earlier guides of the same device (shared step photos, shared phrases) and read
its steps against the call.

Accounts: ${Object.entries(run.accounts).map(([k, a]) => `${k} \`${a}\``).join(", ")}.

## Calls

| Call | Title | Devices under | Types | Guides from | Steps | Reward | Funded | Paid |
|---|---|---|---|---|---|---|---|---|
${calls.join("\n")}

## Nominations

| Nomination | Call | Guide | Device · type | Created | Own steps / photos | Validators read | State | Why |
|---|---|---|---|---|---|---|---|---|
${claims.join("\n")}

## Evidence per nomination

| Nomination | Revision | Author (iFixit user) | Scout / author share | Contest | Packet sha256 |
|---|---|---|---|---|---|
${evidence.join("\n")}

## Refused in code

${run.refusals.map(([call, id, what]) => `- \`${call}\`, guide [${id}](${guide(id)}): ${what}`).join("\n")}

The exact messages are in the transaction list below.

## Balance reconciliation

\`totals()\` (pots, rewards held for candidates, stakes of candidates, unreturned shares of closed calls, authors' shares
waiting to be collected, and credited GEN not yet withdrawn), kept as running totals, against the contract's on-chain
balance after every transfer had finalized:

| Point | Expected | Held for authors | Contract balance | Match |
|---|---|---|---|---|
${run.reconciliations.map((r) => `| ${r.label} | ${gen(r.expected)} | ${gen(r.authors_held)} | ${gen(r.balance)} | ${r.ok ? "yes" : "**no**"} |`).join("\n")}

Credited before withdrawing: ${Object.entries(run.credited).map(([k, v]) => `${k} ${gen(v)}`).join(", ")}.

${uiTest}
## Every transaction

| Who | Call | GEN | Result | Returned / refused | Tx |
|---|---|---|---|---|---|
${run.log.map((r) => `| ${r.who} | \`${esc(r.call)}\` | ${r.value} | ${r.exec} | ${esc((r.returned || r.refused || "").slice(0, 170))} | ${tx(r.hash)} |`).join("\n")}
`;

writeFileSync(new URL("../docs/REPRODUCTION.md", import.meta.url), md);
console.log(`wrote docs/REPRODUCTION.md (${run.log.length} transactions)`);
