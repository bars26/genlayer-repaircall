# RepairCall

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/license/mit/)

<img src="assets/repaircall-logo.png" alt="RepairCall logo" width="96" align="right" />

**Pay for the repair guide that is missing. A sponsor funds a call for new iFixit repair guides; anyone nominates a guide with
a stake; GenLayer validators read the guide from iFixit themselves, check it in code, compare it with earlier guides of the
same device and read its steps. Accepted guides pay the scout who found them at once and hold the author's share until the
author claims it.**

Repair guides are how people keep devices out of the bin, and most of them are written by volunteers. iFixit gets dozens of new
community guides a day, yet of the 200 newest guides on 2026-11-11, 107 had no steps of their own and only 22 had six or
more of their own steps, each with a photo, and no quality flag. Repair cafés, schools and right-to-repair groups would pay for the guides they need, but nobody
can check, for every guide, that it is new, complete and about the right device. RepairCall makes that check a contract:

1. A **sponsor** opens a **call**: the devices (an iFixit category: every device under it qualifies), the guide types
   (replacement, repair, disassembly, …), what they pay for in plain words (the validators read it), guides created from a date,
   a minimum number of photographed steps, a reward per guide and the scout's share of it, the stake to nominate or contest, a
   contest window and a cap per scout.
2. A **scout** finds a new guide on iFixit and nominates it by number. The stake comes out of GEN the scout has `deposit`ed
   (the app deposits what is missing first), so a reading the validators cannot decide never strands a stake.
3. **Every validator** reads the guide from the iFixit API and runs the **code checks**: public and published, created on or
   after the call's start, an allowed type, at least the minimum number of **its own steps** (iFixit inlines the steps of
   prerequisite guides; those are not new work and are left out), **a photo on every one of them**, no iFixit quality flag
   (in progress, missing images, poor pictures…), and the guide's device **under the call's category** (read from the device
   page's ancestors). Then, in code, it **compares the guide with up to five earlier guides of the same device**: two shared
   step photos, or shared 4-word phrases with a Jaccard score of 0.6 or more, make it a repeat, and the nomination is refused.
4. Only then do the validators' **model read the guide's steps** against the call (prerequisite steps marked as such):
   COMPLETE (a careful reader could do the job, with reassembly and the warnings it needs), INCOMPLETE, OFF_SCOPE or UNCLEAR.
   Code decides: COMPLETE makes a **candidate** (a reward is held from the pot), INCOMPLETE or OFF_SCOPE **rejects** it (the
   stake goes to the pot), UNCLEAR returns the stake. Each validator re-runs the whole reading: everything computed in code
   must match the leader's exactly, and the model must land on the same side (pay / do not pay), unless the leader's answer is
   UNCLEAR. A wavering model therefore settles on the cautious outcome instead of failing consensus.
5. A candidate is **open to contest** for the call's window, with the same stake, a reason and, for a copy, the number of the
   earlier guide it copies. A named guide that is older is **compared in code**: a copy **overturns** the nomination at once
   (the contester takes both stakes). Otherwise the validators **read the guide again with the reason**: OVERTURNED (the
   contester takes both stakes), UPHELD (the scout takes the contester's stake), or UNCLEAR, in which case the first reading
   stands and the contester's stake comes back: a contest has to convince the second look.
6. An uncontested candidate is **accepted** after the window. The scout is credited the stake and the **scout's share**; the
   **author's share** is held for the guide's author for 180 days. The author **collects** it by writing their wallet address
   into the About text of their iFixit profile and pressing Collect: the validators read the profile, and only a wallet listed
   there is paid. An uncollected share **lapses** back to the call's pot (or to the sponsor, once the call is closed). Authors
   who have never heard of GenLayer can be paid for guides they already wrote.
7. A guide that was rejected, unclear or overturned can be nominated again **once it has a new revision** on iFixit.

**Live app:** [repaircall-bars26.vercel.app](https://repaircall-bars26.vercel.app). Paste any iFixit guide on the bench without a
wallet: the app shows its own steps, photos, flags and device path and runs the contract's code checks against a call before you
stake. Writes need MetaMask on GenLayer Studio (chain 61999); **Test GEN** funds your wallet.

**Contract:** [`0x0F82D377e0833A01dcFCBDFBB9d8355c6dC9013c`](https://explorer-studio.genlayer.com/address/0x0F82D377e0833A01dcFCBDFBB9d8355c6dC9013c) on GenLayer Studio.

## Why GenLayer

The question "is this a complete, new repair guide for these devices?" has a part code can answer (dates, counts, photos,
flags, the device tree, shared photos with earlier guides) and a part only a reader can (do the steps actually do the job?).
GenLayer lets validators do both on data none of them controls: each reads iFixit itself, so a scout cannot hand the contract a
doctored guide, and the money moves only on what they agree on. iFixit's own data is the source of truth for authorship, so
the author can be paid without ever signing up: the profile they already edit is the proof.

## Verified live, on real guides

`scripts/demo.mjs` (2026-11-11) opened three demo calls (reward 0.5 GEN, 20% to the scout, stake 0.1 GEN, contest window 10
minutes, guides created from 2026-10-15) and nominated real community guides published on iFixit in the four weeks before.
Every check, revision, share and packet hash is in [`docs/REPRODUCTION.md`](docs/REPRODUCTION.md).

| Call | Guide | Own steps / photos | Validators read | Outcome |
|---|---|---|---|---|
| Audio gear (Electronics) | [JBL Spyro subwoofer disassembly](https://www.ifixit.com/Guide/_/249025) | 18 / 18 | COMPLETE | **Accepted**: scout 0.1 GEN, 0.4 GEN held for the author |
| Audio gear | [Corsair HS65 headset volume potentiometer cleaning](https://www.ifixit.com/Guide/_/248288) | 9 / 9 | COMPLETE | Contested ("looks like an earlier guide", naming guide 160588): not a copy in code, **upheld** on the second look; the scout took the contester's stake |
| Audio gear | [ONKYO D-102AXLTD woofer surround replacement](https://www.ifixit.com/Guide/_/245429) | 7 / 7 | COMPLETE | **Accepted** |
| Game consoles (Game Console) | [Xbox Series LB/RB repair](https://www.ifixit.com/Guide/_/248913) | 16 / 16 | COMPLETE | **Accepted** |
| Game consoles | [Bandai WonderSwan polarizing film replacement](https://www.ifixit.com/Guide/_/246022) | 6 / 6 | COMPLETE | **Accepted** |
| Game consoles | [ModRetro Chromatic disassembly](https://www.ifixit.com/Guide/_/243391) | 12 / 12 | COMPLETE | **Accepted** |
| Battery replacements (Appliance) | [GE refrigerator water filter replacement](https://www.ifixit.com/Guide/_/245804) | 9 / 9 | OFF_SCOPE | **Rejected**: an appliance, no battery; the stake went to the pot |
| Battery replacements | [Roomba 520 infrared sensor cleaning](https://www.ifixit.com/Guide/_/243703) | 7 / 7 | OFF_SCOPE | **Rejected** |

Refused in code (the calls reverted, deposits stayed credited): a guide that does not exist; an empty guide (Xiaomi Redmi 8
receiver, 0 steps); a 2023 guide (before the call's start); a guide whose device page sits under no category (Yamaha amplifier);
a guide iFixit flags as in progress (Chrysler instrument cluster); an e-cigarette guide with 22 steps of which **19 are inlined
from its two prerequisite guides** (3 own steps); a guide created before the call's start; the same guide nominated twice; the
scout contesting their own nomination; settling a candidate before its window; **collecting an author's share from a wallet
not written in the author's iFixit profile**; returning a share before its 180 days; closing a call before its last day; and a
call reaching back to 2020 (its GEN credited back and withdrawn). `totals()` matched the contract's balance at all six
checkpoints; 2.4 GEN stay held for the six authors.

On a first run against an earlier build, the copy check flagged that e-cigarette guide as a repeat of its own prerequisite (36
shared photos): iFixit inlines prerequisite steps into a guide. The contract now counts and compares only a guide's own steps,
and marks the inlined ones for the model.


## Who can do what (and the attacks this blocks)

| Rule | Why |
|---|---|
| The guide, its device page, the earlier guides and the author's profile are read from the iFixit API by every validator | Nobody can submit a doctored copy of a guide or a profile |
| Only the guide's own steps count, and every one needs a photo; any iFixit quality flag blocks it | A guide padded with a prerequisite's steps, or an empty shell, earns nothing |
| Guides must be created on or after the call's start (at most 90 days before it opens) | Sponsors pay for new work, not for the back catalogue |
| Up to five earlier guides of the same device are compared in code (shared photos, shared phrases) | Re-posting someone else's guide, or your own, is refused before the model is asked |
| A guide has one live nomination at a time; after a rejection it needs a new revision | Nobody re-rolls the validators on an unchanged guide, and no guide is paid twice |
| A reward is held from the pot when a candidate is made, and a nomination is refused when the pot cannot pay one | A candidate is always payable; funders cannot drain the pot under it |
| A validator agrees with a pay decision only if its own reading also pays; an UNCLEAR leader is accepted when the code matches | A wavering model ends in the cautious outcome, never in a payout |
| Contests need the same stake, another wallet and an open window; a second look that cannot decide keeps the first reading | Scouts cannot contest themselves; contesters cannot grief a good guide for free |
| The author's share goes only to a wallet written in the author's iFixit profile, read by the validators; it lapses after 180 days | The scout cannot take the author's money, and nothing is held forever |
| Stakes come from deposited GEN and are taken only after the validators agree | A reading that ends undecided never strands a stake |
| Scout shares, stakes and refunds are credited; only `withdraw` sends GEN, to the caller | No call pays a third party or fails on someone else's behalf |
| Funders live in their own maps; closing does a fixed amount of work and each share is credited by its own `refund`; `totals()` reads running totals | No loop grows with the number of calls, funders or nominations |
| Payable calls (`create_call`, `fund`) never revert: they credit the GEN back and return `REFUNDED: <reason>`, including dates that do not exist. Nominating and contesting send no GEN and simply revert | GenLayer keeps the value of a reverted call |

## One source, two networks

`contracts/repair_call.py` runs on GenLayer Studio; a short block at its top picks the API names of the newer py-genlayer runner
that Bradbury testnet (Phase 2) runs, and `scripts/bradbury_source.py` writes `contracts/repair_call.bradbury.py` (the same
program with the Bradbury header and without comments, checked by comparing syntax trees; Bradbury stores deployed source
on-chain and a block holds about 38 KB of it). The direct tests run on both files in CI. The app is deployed on Studio.

## The app

- **The bench:** paste an iFixit guide URL or number (or try a recent guide). The app reads it through `/api/guide` and shows
  its photo, author, own steps (and how many came from prerequisites), photos, flags and device path, then runs the contract's
  code checks against the call you pick, line by line. A link can open it on a guide: `/?guide=246601&call=call_0`.
- **Nominations:** each with its tag, what the validators read, steps and photos, stake, the reward held or the scout and
  author shares, the contest (with the copy check's numbers when a source was named), the author's share and its deadline, and
  buttons to contest, settle, collect as the author or return a lapsed share.
- **Calls:** the scope the validators read, the device page, types, start date, minimum steps, the reward split, what was paid
  and held, adding GEN, and after the last day closing and each funder's share.
- **Open a call:** the category is looked up on iFixit as you type (`/api/category`), so a misspelt category cannot open a call
  that takes no guide.
- iFixit is read server-side (`/api/guide`, `/api/category`) and step photos come from iFixit's image CDN (allowed in the page's
  CSP). Page loads read the registry server-side, CDN-cached (Studio allows 30 calls a minute per IP).

## Run it

```bash
pip install -r requirements.txt
python3 scripts/bradbury_source.py --check
genvm-lint check contracts/repair_call.py && genvm-lint check contracts/repair_call.bradbury.py
pytest tests/direct/ -v                     # 43 tests, real iFixit guides in tests/fixtures, reads and the model mocked

# the same tests under the Bradbury runner (genlayer-test 0.30 reads GenVM Manager v0.6.0-rc10)
pip install "genlayer-test==0.30.0rc2" && REPAIRCALL_NETWORK=bradbury pytest tests/direct/ -v

npm install
node scripts/deploy.mjs
node scripts/verify-code.mjs <address>
node scripts/demo.mjs <address>             # the live run above
node scripts/reproduction.mjs               # regenerate docs/REPRODUCTION.md

cd frontend && npm run dev
```

## Limits, stated plainly

- "Complete" is the validators' reading of the text of the steps against the call, not a test of the repair. The code checks
  (photos on every step, flags, dates, the device tree) are what keep empty or padded guides out; the model judges the rest.
- The copy check reads at most five earlier guides of the device (the newest ones on its device page). An older copy can still
  be named in a contest, where it is compared in code.
- The step photos are counted, not looked at: the validators do not check that a photo shows what its step says.
- The author's share needs the author to edit their iFixit profile; authors who never do let it lapse after 180 days.
- iFixit's API needs no key and sends no rate-limit headers today; RepairCall reads a handful of pages per nomination.
- The demo calls and wallets are test wallets; the guides, devices and profiles are real.

Guides in `tests/fixtures` are iFixit community content (CC BY-NC-SA 3.0, by their authors), trimmed to the fields the contract
reads, for testing only. MIT licensed.
