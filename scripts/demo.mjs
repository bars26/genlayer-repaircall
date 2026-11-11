// Live run of RepairCall on GenLayer Studio with real, recent iFixit guides.
//
//   node scripts/demo.mjs <contract-address>          # writes docs/studio/demo-run.json
//
// The calls and the wallets are test wallets. The guides are real community guides published on iFixit in the weeks
// before the run; every nomination is judged by the validators reading iFixit themselves. Results are recorded as they
// come.

import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { writeFileSync } from "fs";

const [CONTRACT] = process.argv.slice(2);
if (!CONTRACT) {
  console.error("usage: node scripts/demo.mjs <contract-address>");
  process.exit(1);
}
const RPC = "https://studio.genlayer.com/api";
const GEN = 10n ** 18n;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TRANSIENT = /rate limit|Unexpected token '<'|not valid JSON|fetch failed|ECONNRESET|socket hang up|50[234]/i;

async function rpc(method, params) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const body = await res.json();
      if (body.error) throw new Error(`${method}: ${body.error.message}`);
      return body.result;
    } catch (err) {
      if (attempt >= 5 || /^\w+: /.test(String(err?.message))) throw err;
      await sleep(10000 * attempt);
    }
  }
}

const log = [];
async function write(c, who, functionName, args, value = 0n, { expectError = false, allowError = false } = {}) {
  for (let attempt = 1; ; attempt++) {
    let hash;
    try {
      hash = await c.writeContract({ address: CONTRACT, functionName, args, value });
      let receipt;
      for (let wait = 1; ; wait++) {
        try {
          receipt = await c.waitForTransactionReceipt({ hash, status: "ACCEPTED", retries: 120, interval: 5000 });
          break;
        } catch (err) {
          if (!TRANSIENT.test(String(err?.message || err)) || wait >= 6) throw Object.assign(err, { sent: true });
          await sleep(10000 * wait);
        }
      }
      // A receipt can be ACCEPTED while leaders are still rotating: wait until the last round is Accepted or Undetermined.
      let rounds = receipt?.consensus_history?.consensus_results ?? [];
      for (let poll = 0; rounds.length && !["Accepted", "Undetermined"].includes(rounds.at(-1)?.consensus_round) && poll < 60; poll++) {
        await sleep(5000);
        try { rounds = (await c.getTransaction({ hash }))?.consensus_history?.consensus_results ?? rounds; } catch {}
      }
      const lr = receipt?.consensus_data?.leader_receipt;
      const first = Array.isArray(lr) ? lr[0] : lr;
      // A round the validators could not decide leaves the leader's result in the receipt but changes nothing.
      const decided = rounds.length === 0 || rounds.at(-1)?.consensus_round !== "Undetermined";
      const exec = decided ? first?.execution_result ?? "?" : "UNDETERMINED";
      let returned = decided ? first?.result?.payload?.readable : undefined;
      try { returned = JSON.parse(returned); } catch {}
      const row = { who, call: `${functionName}(${args.map((a) => (typeof a === "bigint" ? `${Number(a) / 1e18} GEN` : JSON.stringify(a)).slice(0, 48)).join(", ")})`,
        value: (Number(value) / 1e18).toString(), hash, status: receipt.statusName ?? "ACCEPTED", exec, returned: typeof returned === "string" ? returned : undefined };
      if (exec !== "SUCCESS") row.refused = typeof first?.result?.payload === "string" ? first.result.payload : "";
      log.push(row);
      console.log(`${who.padEnd(10)} ${row.call.slice(0, 64).padEnd(64)} ${row.exec.padEnd(7)} ${hash.slice(0, 12)}${row.returned ? "  -> " + row.returned.slice(0, 150) : ""}${row.refused ? "  !! " + row.refused.slice(0, 140) : ""}`);
      if (expectError && exec === "SUCCESS") throw new Error(`${functionName} was expected to be refused`);
      if (!expectError && !allowError && exec !== "SUCCESS") throw new Error(`${functionName} executed with ${exec}: ${row.refused}`);
      return row;
    } catch (err) {
      if (TRANSIENT.test(String(err?.message || err)) && attempt < 4 && !err?.sent && !hash) {
        await sleep(15000 * attempt);
        continue;
      }
      throw err;
    }
  }
}

// Studio sometimes answers a read right after an accepted write from state that does not have it yet: retry those too.
const LAGGING = /execution failed|No (call|nomination) with id/i;
const read = async (c, functionName, args = []) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await c.readContract({ address: CONTRACT, functionName, args });
    } catch (err) {
      const msg = String(err?.message) + JSON.stringify(err?.cause ?? "");
      if ((TRANSIENT.test(msg) || LAGGING.test(msg)) && attempt < 8) { await sleep(5000 * attempt); continue; }
      throw err;
    }
  }
};
const plain = (o) => JSON.parse(JSON.stringify(o instanceof Map ? Object.fromEntries(o) : o, (k, v) => (typeof v === "bigint" ? v.toString() : v instanceof Map ? Object.fromEntries(v) : v)));
const balance = async (addr) => BigInt(await rpc("eth_getBalance", [addr, "latest"]));
const fmt = (wei) => (Number(wei) / 1e18).toFixed(2);

const keys = { sponsor: generatePrivateKey(), scout: generatePrivateKey(), scout2: generatePrivateKey(), contester: generatePrivateKey() };
const acct = Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, createAccount(v)]));
const C = Object.fromEntries(Object.entries(acct).map(([k, a]) => [k, createClient({ chain: studionet, endpoint: RPC, account: a })]));
console.log("contract  ", CONTRACT);
for (const [k, a] of Object.entries(acct)) console.log(k.padEnd(10), a.address);
for (const [k, g] of [["sponsor", 25n], ["scout", 5n], ["scout2", 5n], ["contester", 5n]]) await rpc("sim_fundAccount", [acct[k].address, Number(g * GEN)]);
await sleep(3000);

const quiet = async () => {
  let last = -1;
  for (let i = 0; i < 60; i++) {
    const txs = await rpc("sim_getTransactionsForAddress", [CONTRACT]);
    const busy = txs.filter((t) => !["FINALIZED", "CANCELED", "UNDETERMINED"].includes(t.status)).length;
    if (busy === 0 && txs.length === last) return;
    last = busy === 0 ? txs.length : -1;
    await sleep(10000);
  }
  throw new Error("transactions did not finalize");
};
const reconciliations = [];
const reconcile = async (label) => {
  await quiet();
  const t = JSON.parse(await read(C.sponsor, "totals"));
  const onChain = await balance(CONTRACT);
  const ok = BigInt(t.expected_balance) === onChain;
  reconciliations.push({ label, expected: t.expected_balance, owed: t.owed, authors_held: t.authors_held, balance: onChain.toString(), ok });
  console.log(`  reconcile (${label}): expected ${fmt(t.expected_balance)} GEN (credited ${fmt(t.owed)}, held for authors ${fmt(t.authors_held)}); balance ${fmt(onChain)} GEN ${ok ? "OK" : "MISMATCH"}`);
  if (!ok) throw new Error("balance mismatch");
};

const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const SINCE = "2026-10-15", ENDS = day(60);
const REWARD = GEN / 2n, STAKE = GEN / 10n, MINUTES = 10, SCOUT_BPS = 2000;
const first = (await read(C.sponsor, "get_calls", [0, 200])).length;
const AUDIO = `call_${first}`, GAMES = `call_${first + 1}`, BATTERY = `call_${first + 2}`;

// A call reaching back too far is refused and its GEN credited back.
await write(C.sponsor, "sponsor", "create_call", ["Old guides", "Electronics", "replacement", "Anything electronic, any age at all.", "2020-01-01", ENDS, 6, REWARD, SCOUT_BPS, STAKE, MINUTES, 6], GEN);
await write(C.sponsor, "sponsor", "withdraw", []);
await reconcile("after a refused call: its GEN is credited back");

await write(C.sponsor, "sponsor", "create_call", ["Audio gear: speakers, headphones, amps", "Electronics", "replacement,repair,disassembly,technique",
  "Fixes for speakers, headphones and amplifiers: replacing drivers or surrounds, cleaning controls, opening and reassembling the unit.",
  SINCE, ENDS, 6, REWARD, SCOUT_BPS, STAKE, MINUTES, 6], 2n * GEN);
await write(C.sponsor, "sponsor", "create_call", ["Game consoles and controllers", "Game Console", "replacement,repair,disassembly,technique",
  "Repairs of game consoles, handhelds and controllers: buttons, sticks, screens, shells, batteries.",
  SINCE, ENDS, 6, REWARD, SCOUT_BPS, STAKE, MINUTES, 6], 2n * GEN);
await write(C.sponsor, "sponsor", "create_call", ["Battery replacements", "Appliance", "replacement,repair,technique",
  "Battery replacements for appliances and robot vacuums: opening the unit, removing the old battery or cells, fitting and testing the new ones.",
  SINCE, ENDS, 6, REWARD, SCOUT_BPS, STAKE, MINUTES, 6], 2n * GEN);
await write(C.scout2, "scout2", "fund", [GAMES], GEN / 2n);
await reconcile("after opening three calls");

await write(C.scout, "scout", "deposit", [], 8n * STAKE);
await write(C.scout2, "scout2", "deposit", [], 4n * STAKE);
await write(C.contester, "contester", "deposit", [], 3n * STAKE);

// Real guides published on iFixit from 2026-10-15 on, every step photographed (the validators check that again).
const CASES = [
  { key: "jbl_spyro", call: AUDIO, guide: 249025, who: "scout", what: "Disassembling JBL Spyro subwoofer (18 steps)" },
  { key: "corsair_pot", call: AUDIO, guide: 248288, who: "scout", what: "Cleaning Corsair HS65 headset volume potentiometer (9 steps)" },
  { key: "onkyo_surround", call: AUDIO, guide: 245429, who: "scout2", what: "ONKYO D-102AXLTD woofer surround replacement (7 steps)" },
  { key: "xbox_lbrb", call: GAMES, guide: 248913, who: "scout", what: "Xbox Series LB/RB button repair (16 steps, starts with the controller already open)" },
  { key: "wonderswan", call: GAMES, guide: 246022, who: "scout", what: "Bandai WonderSwan polarizing film replacement (6 steps)" },
  { key: "chromatic", call: GAMES, guide: 243391, who: "scout2", what: "ModRetro Chromatic disassembly (12 steps)" },
  { key: "ge_filter", call: BATTERY, guide: 245804, who: "scout2", what: "GE refrigerator water filter replacement: an appliance, but no battery" },
  { key: "roomba_ir", call: BATTERY, guide: 243703, who: "scout", what: "Roomba 520 infrared sensor cleaning: a robot vacuum, but no battery" },
];
const ids = {};
for (const c of CASES) {
  const r = await write(C[c.who], c.who, "nominate", [c.call, c.guide], 0n, { allowError: true });
  if (!String(r.returned).startsWith("claim_")) continue; // refused or undecided: the deposit stays credited
  ids[c.key] = r.returned;
  const d = plain(await read(C.sponsor, "get_claim", [ids[c.key]]));
  console.log(`  -> ${ids[c.key]} ${c.key}: ${d.state} (${d.answer}) ${d.why}`);
}
// Refused in code (the call reverts; the deposit stays credited).
const REFUSALS = [
  [AUDIO, 999999999, "no such guide"],
  [AUDIO, 249050, "Xiaomi Redmi 8 receiver: an empty guide (0 steps)"],
  [AUDIO, 160588, "a 2023 guide: created before the call's start"],
  [AUDIO, 248065, "Yamaha amplifier restoration: its device page sits under no category"],
  [GAMES, 247031, "Chrysler instrument cluster: flagged in progress by iFixit"],
  [AUDIO, 248998, "OVNS e-cigarette indicator reset: 22 steps, but 19 are inlined from its two prerequisite guides (3 own)"],
  [BATTERY, 242713, "Miele vacuum motor repair: all 10 steps come from prerequisite guides (0 own)"],
];
for (const [call, guide] of REFUSALS) await write(C.scout2, "scout2", "nominate", [call, guide], 0n, { expectError: true });
const again = CASES.find((c) => ids[c.key]);
if (again) await write(C.scout2, "scout2", "nominate", [again.call, again.guide], 0n, { expectError: true }); // already nominated, or unchanged
await reconcile("after nominating");

const state = async (id) => plain(await read(C.sponsor, "get_claim", [id])).state;
const candidates = [];
for (const id of Object.values(ids)) if ((await state(id)) === "candidate") candidates.push(id);
console.log(`  candidates: ${candidates.join(", ") || "none"}`);
if (candidates.length) {
  const own = plain(await read(C.sponsor, "get_claim", [candidates[0]]));
  const ownerKey = own.scout.toLowerCase() === acct.scout.address.toLowerCase() ? "scout" : "scout2";
  await write(C[ownerKey], ownerKey, "contest", [candidates[0], "My own nomination, contested to test the rule.", ""], 0n, { expectError: true });
  await write(C.contester, "contester", "settle", [candidates[0]], 0n, { expectError: true }); // still open to contest
}
// A contest naming an earlier guide as the source: compared in code (not a copy), then a second look.
if (candidates.length > 1) {
  await write(C.contester, "contester", "contest", [candidates[1], "This looks like an earlier guide; the steps are not new.", "160588"], 0n, { allowError: true });
}
await reconcile("after contests");

// Wait for the contest window, then settle every open candidate.
const open = [];
for (const id of Object.values(ids)) if ((await state(id)) === "candidate") open.push(id);
if (open.length) {
  const deadline = Math.max(...(await Promise.all(open.map(async (id) => Date.parse(plain(await read(C.sponsor, "get_claim", [id])).deadline + "Z")))));
  const waitMs = deadline - Date.now() + 20000;
  console.log(`  waiting ${Math.round(waitMs / 1000)} s for the contest window to end`);
  if (waitMs > 0) await sleep(waitMs);
  for (const id of open) await write(C.contester, "contester", "settle", [id]);
}
// The author's share: only a wallet listed in the author's iFixit profile can collect it.
const held = [];
for (const id of Object.values(ids)) if (plain(await read(C.sponsor, "get_claim", [id])).author_state === "held") held.push(id);
if (held.length) await write(C.scout, "scout", "collect", [held[0]], 0n, { expectError: true });
if (held.length) await write(C.scout, "scout", "lapse", [held[0]], 0n, { expectError: true });
await write(C.sponsor, "sponsor", "close", [AUDIO], 0n, { expectError: true }); // nominations are taken until the last day
await reconcile("after settling");

const credited = {};
for (const who of ["scout", "scout2", "contester"]) {
  const owed = BigInt(await read(C.sponsor, "owed_to", [acct[who].address]));
  credited[who] = owed.toString();
  if (owed > 0n) await write(C[who], who, "withdraw", []);
}
await reconcile("end of run, after withdrawals");

const out = { contract: CONTRACT, accounts: Object.fromEntries(Object.entries(acct).map(([k, a]) => [k, a.address])),
  calls: [plain(await read(C.sponsor, "get_call", [AUDIO])), plain(await read(C.sponsor, "get_call", [GAMES])), plain(await read(C.sponsor, "get_call", [BATTERY]))],
  cases: CASES, refusals: REFUSALS, claims: {}, credited, reconciliations, log };
for (const [k, id] of Object.entries(ids)) out.claims[id] = { case: k, ...plain(await read(C.sponsor, "get_claim", [id])) };
writeFileSync(new URL("../docs/studio/demo-run.json", import.meta.url), JSON.stringify(out, null, 2));
console.log("\nwrote docs/studio/demo-run.json");
for (const [id, d] of Object.entries(out.claims)) console.log(`  ${id} ${d.case}: ${d.state} (${d.answer}${d.contest_answer ? ", contest " + d.contest_answer : ""}) — ${d.why}`);
