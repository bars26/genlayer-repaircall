# RepairCall: reproduction of the live run

Contract on GenLayer Studio: [`0x0F82D377e0833A01dcFCBDFBB9d8355c6dC9013c`](https://explorer-studio.genlayer.com/address/0x0F82D377e0833A01dcFCBDFBB9d8355c6dC9013c) (source `contracts/repair_call.py`, checked
byte-identical with `node scripts/verify-code.mjs 0x0F82D377e0833A01dcFCBDFBB9d8355c6dC9013c`).

`scripts/demo.mjs` opened two **demo calls** from test wallets and nominated **real community guides** published on iFixit in
the weeks before the run. Every nomination is validator consensus: each validator read the guide from the iFixit API, ran the
code checks (public, created after the call's start, type, own steps and photos, iFixit flags, the device's place under the
call's category), compared it with up to five earlier guides of the same device (shared step photos, shared phrases) and read
its steps against the call.

Accounts: sponsor `0x919CC991AEFF0e813D2C49ddeA27782b13D4976B`, scout `0x022153B39F42e77aB3e5BCFB8EF1e244E4958234`, scout2 `0xc3483F5B34e2bD21DB0B04d5F8999d4B7b50bAeA`, contester `0x35B929aB7af8EaA28e64fDcB1786F6a5f7eDdD65`.

## Calls

| Call | Title | Devices under | Types | Guides from | Steps | Reward | Funded | Paid |
|---|---|---|---|---|---|---|---|---|
| `call_0` | Audio gear: speakers, headphones, amps | Electronics | replacement,repair,disassembly,technique | 2026-10-15 | 6 | 0.5 GEN (scout 20%) | 2 GEN | 1.5 GEN |
| `call_1` | Game consoles and controllers | Game Console | replacement,repair,disassembly,technique | 2026-10-15 | 6 | 0.5 GEN (scout 20%) | 2.5 GEN | 1.5 GEN |
| `call_2` | Battery replacements | Appliance | replacement,repair,technique | 2026-10-15 | 6 | 0.5 GEN (scout 20%) | 2 GEN | 0 GEN |

## Nominations

| Nomination | Call | Guide | Device · type | Created | Own steps / photos | Validators read | State | Why |
|---|---|---|---|---|---|---|---|---|
| claim_0 | `call_0` | [249025](https://www.ifixit.com/Guide/_/249025) Disassembling JBL Spyro subwoofer | JBL Spyro · disassembly | 2026-11-11 | 18/18 | COMPLETE | **accepted** | Accepted: uncontested by 2026-11-11T13:06:34 UTC |
| claim_1 | `call_0` | [248288](https://www.ifixit.com/Guide/_/248288) Cleaning Corsair HS65 Wired Headset volume potentiometer | Headphone · disassembly | 2026-11-08 | 9/9 | COMPLETE | **upheld** | Upheld: the second look kept it; the contester's stake goes to the scout |
| claim_2 | `call_0` | [245429](https://www.ifixit.com/Guide/_/245429) ONKYO Speaker D-102AXLTD Woofer Surround Replacement | ONKYO Speaker D-102AXLTD · technique | 2026-10-25 | 7/7 | COMPLETE | **accepted** | Accepted: uncontested by 2026-11-11T13:07:32 UTC |
| claim_3 | `call_1` | [248913](https://www.ifixit.com/Guide/_/248913) Xbox Series LB RB repair | Xbox Series X Wireless Controller · technique | 2026-11-10 | 16/16 | COMPLETE | **accepted** | Accepted: uncontested by 2026-11-11T13:07:56 UTC |
| claim_4 | `call_1` | [246022](https://www.ifixit.com/Guide/_/246022) Bandai WonderSwan Polarizing film on the screen Replacement | Bandai WonderSwan · replacement | 2026-10-27 | 6/6 | COMPLETE | **accepted** | Accepted: uncontested by 2026-11-11T13:08:35 UTC |
| claim_5 | `call_1` | [243391](https://www.ifixit.com/Guide/_/243391) ModRetro Transparent Chromatic Disassembly | ModRetro Chromatic · disassembly | 2026-10-15 | 12/12 | COMPLETE | **accepted** | Accepted: uncontested by 2026-11-11T13:08:54 UTC |
| claim_6 | `call_2` | [245804](https://www.ifixit.com/Guide/_/245804) GE Refrigerator water filter Replacement | GE Refrigerator · replacement | 2026-10-26 | 9/9 | OFF_SCOPE | **rejected** | Not what the call asks for; stake to the pot |
| claim_7 | `call_2` | [243703](https://www.ifixit.com/Guide/_/243703) Guide 8: Roomba 520 White, Cleaning the infrared obstacle detection LEDs. | iRobot Roomba 520 · technique | 2026-10-17 | 7/7 | OFF_SCOPE | **rejected** | Not what the call asks for; stake to the pot |

## Evidence per nomination

| Nomination | Revision | Author (iFixit user) | Scout / author share | Contest | Packet sha256 |
|---|---|---|---|---|---|
| claim_0 | 3088021 | Alexander Efremov (1258577) | 0.1 GEN / 0.4 GEN held |   | `b1fa3f28bd7015844fa9e9a11cd881876c914db38355793df6aca38f19186d19` |
| claim_1 | 3083742 | Matrix Melody (6125072) | 0.1 GEN / 0.4 GEN held | UPHELD  | `cfbeda83c7c50a071b6f1af90bc3c5e8bf20a5cef18f296220e43af1594aa67d` |
| claim_2 | 3069290 | mura mura (6019014) | 0.1 GEN / 0.4 GEN held |   | `4d14f1a063feeae9647cbf13fc6a04f758e5e1728ce0fbafe515a9d65de99f92` |
| claim_3 | 3087450 | @HectorNavarroMX (2567058) | 0.1 GEN / 0.4 GEN held |   | `2d8ad0188b409603e476b909a4b7ff571bce087f08382ec18acc5508a3c3d4ec` |
| claim_4 | 3072059 | Bård Eilertsen (4642030) | 0.1 GEN / 0.4 GEN held |   | `8aa44f97f73eda92d72840bf17f0f8351eafef14570129004dc562bb2ea14b4b` |
| claim_5 | 3057481 | tmai_modretro (5671533) | 0.1 GEN / 0.4 GEN held |   | `9e0e38761be4862bde5a909061a0215de234bf8cd1022985fc17bbe846df41c6` |
| claim_6 | 3077250 | Britney Boromand (6000366) | 0 GEN / 0 GEN  |   | `5ac05ae8b67283d407fbb696d8383edf14413f1dbbc2b5eabc2011ad4bf3c259` |
| claim_7 | 3068892 | Carlos López (España - Spain) (1252901) | 0 GEN / 0 GEN  |   | `2a15da2f085649eae199469155f57592d292b71baf1104c40b29e01720adeaf4` |

## Refused in code

- `call_0`, guide [999999999](https://www.ifixit.com/Guide/_/999999999): no such guide
- `call_0`, guide [249050](https://www.ifixit.com/Guide/_/249050): Xiaomi Redmi 8 receiver: an empty guide (0 steps)
- `call_0`, guide [160588](https://www.ifixit.com/Guide/_/160588): a 2023 guide: created before the call's start
- `call_0`, guide [248065](https://www.ifixit.com/Guide/_/248065): Yamaha amplifier restoration: its device page sits under no category
- `call_1`, guide [247031](https://www.ifixit.com/Guide/_/247031): Chrysler instrument cluster: flagged in progress by iFixit
- `call_0`, guide [248998](https://www.ifixit.com/Guide/_/248998): OVNS e-cigarette indicator reset: 22 steps, but 19 are inlined from its two prerequisite guides (3 own)
- `call_2`, guide [242713](https://www.ifixit.com/Guide/_/242713): Miele vacuum motor repair, created 2026-10-12: before the call's start (its 10 steps also all come from prerequisite guides)

The exact messages are in the transaction list below.

## Balance reconciliation

`totals()` (pots, rewards held for candidates, stakes of candidates, unreturned shares of closed calls, authors' shares
waiting to be collected, and credited GEN not yet withdrawn), kept as running totals, against the contract's on-chain
balance after every transfer had finalized:

| Point | Expected | Held for authors | Contract balance | Match |
|---|---|---|---|---|
| after a refused call: its GEN is credited back | 0 GEN | 0 GEN | 0 GEN | yes |
| after opening three calls | 6.5 GEN | 0 GEN | 6.5 GEN | yes |
| after nominating | 8 GEN | 0 GEN | 8 GEN | yes |
| after contests | 8 GEN | 0.4 GEN | 8 GEN | yes |
| after settling | 8 GEN | 2.4 GEN | 8 GEN | yes |
| end of run, after withdrawals | 6.1 GEN | 2.4 GEN | 6.1 GEN | yes |

Credited before withdrawing: scout 1.2 GEN, scout2 0.5 GEN, contester 0.2 GEN.


## Every transaction

| Who | Call | GEN | Result | Returned / refused | Tx |
|---|---|---|---|---|---|
| sponsor | `create_call("Old guides", "Electronics", "replacement", "Anything electronic, any age at all.", "2020-01-01", "2027-01-10", 6, 0.5 GEN, 2000, 0.1 GEN, 10, 6)` | 1 | SUCCESS | REFUNDED: since must be from 90 days ago to today (your GEN is credited back: withdraw it) | [`0x55dc950e…`](https://explorer-studio.genlayer.com/tx/0x55dc950e805a399c0cde3cb0c5e8b94b3dd3b3b6450a0685b73428c77f3786dd) |
| sponsor | `withdraw()` | 0 | SUCCESS | 1000000000000000000 | [`0xe763d682…`](https://explorer-studio.genlayer.com/tx/0xe763d6824132b70caac057494ced8735673548b1625f2d10c7310a6fc866b23c) |
| sponsor | `create_call("Audio gear: speakers, headphones, amps", "Electronics", "replacement,repair,disassembly,technique", "Fixes for speakers, headphones and amplifiers: , "2026-10-15", "2027-01-10", 6, 0.5 GEN, 2000, 0.1 GEN, 10, 6)` | 2 | SUCCESS | call_0 | [`0x27ed858e…`](https://explorer-studio.genlayer.com/tx/0x27ed858ef46186d84d8c975e8d3085ecd0b7c427302a038d8ba3e75117faa11d) |
| sponsor | `create_call("Game consoles and controllers", "Game Console", "replacement,repair,disassembly,technique", "Repairs of game consoles, handhelds and control, "2026-10-15", "2027-01-10", 6, 0.5 GEN, 2000, 0.1 GEN, 10, 6)` | 2 | SUCCESS | call_1 | [`0xb66021ac…`](https://explorer-studio.genlayer.com/tx/0xb66021ace8abb23d420e2e5eef2f8239faeae1d135560fc41f8fac3bf6447951) |
| sponsor | `create_call("Battery replacements", "Appliance", "replacement,repair,technique", "Battery replacements for appliances and robot v, "2026-10-15", "2027-01-10", 6, 0.5 GEN, 2000, 0.1 GEN, 10, 6)` | 2 | SUCCESS | call_2 | [`0xe6dbeb65…`](https://explorer-studio.genlayer.com/tx/0xe6dbeb658648b5f30a27b4d1a986f8ac8295490f4ad6c8cc4592433bc6b5d282) |
| scout2 | `fund("call_1")` | 0.5 | SUCCESS | funded | [`0xed7e0825…`](https://explorer-studio.genlayer.com/tx/0xed7e082586b780ef89b712aafa999eb0af27f158c04f2bbe8e35b1defd86095d) |
| scout | `deposit()` | 0.8 | SUCCESS | 800000000000000000 | [`0x99a69d47…`](https://explorer-studio.genlayer.com/tx/0x99a69d47fd0405ecebea316e11659f3a89028646c8c360c22876a19b46a220d1) |
| scout2 | `deposit()` | 0.4 | SUCCESS | 400000000000000000 | [`0x6144e722…`](https://explorer-studio.genlayer.com/tx/0x6144e722096002de5b5bf4cb96967f5b659ed161d2c51b7137948d8beaba73fa) |
| contester | `deposit()` | 0.3 | SUCCESS | 300000000000000000 | [`0x7a7a6a33…`](https://explorer-studio.genlayer.com/tx/0x7a7a6a3393150b50ceac634e990cd604e2764e320183642607871e9b4f187a27) |
| scout | `nominate("call_0", 249025)` | 0 | SUCCESS | claim_0 | [`0xd8a33135…`](https://explorer-studio.genlayer.com/tx/0xd8a3313516fba4b0377a262d3f6640df0baaab6245864effa49b1f87d4cef049) |
| scout | `nominate("call_0", 248288)` | 0 | SUCCESS | claim_1 | [`0x39f784b3…`](https://explorer-studio.genlayer.com/tx/0x39f784b3df87c899de2e97caf2981100112e73946f37d1fa8adc50c8490563b6) |
| scout2 | `nominate("call_0", 245429)` | 0 | SUCCESS | claim_2 | [`0xba44b117…`](https://explorer-studio.genlayer.com/tx/0xba44b1174f597aaca87fa0134a71deba9a1385ce0f1fb13ec304cea3ab68607d) |
| scout | `nominate("call_1", 248913)` | 0 | SUCCESS | claim_3 | [`0xaf4ed79f…`](https://explorer-studio.genlayer.com/tx/0xaf4ed79f9093b5938d4e9be73e38d0c91aee43274f34e6fb378ada766d22ede2) |
| scout | `nominate("call_1", 246022)` | 0 | SUCCESS | claim_4 | [`0x8e77ad1e…`](https://explorer-studio.genlayer.com/tx/0x8e77ad1e9137e2f263642ab7b52ae73d7f382b4d966e53a122915e8c6319ee83) |
| scout2 | `nominate("call_1", 243391)` | 0 | SUCCESS | claim_5 | [`0x64348272…`](https://explorer-studio.genlayer.com/tx/0x64348272678f54c4122e1ada55385a0d281dfef0e2e8d36ac902d92b925f5c48) |
| scout2 | `nominate("call_2", 245804)` | 0 | SUCCESS | claim_6 | [`0xbd580669…`](https://explorer-studio.genlayer.com/tx/0xbd58066956d82260599884a3a65075c4cb9d7bad290c5e08ca2de758fb0a5342) |
| scout | `nominate("call_2", 243703)` | 0 | SUCCESS | claim_7 | [`0x0b146675…`](https://explorer-studio.genlayer.com/tx/0x0b1466755441e0d69729900fa11c99f9b6a2b6d09eae2ea5730e801443436048) |
| scout2 | `nominate("call_0", 999999999)` | 0 | ERROR | guide 999999999: iFixit has no guide with this id | [`0x45202be7…`](https://explorer-studio.genlayer.com/tx/0x45202be76ce46b90a8788b34568babf3e1c5759a675c4a9620a0de822a95e50c) |
| scout2 | `nominate("call_0", 249050)` | 0 | ERROR | guide 249050: the guide has fewer steps than the call asks for | [`0xcc280172…`](https://explorer-studio.genlayer.com/tx/0xcc280172ac382defbdbbca504511310f8fc136fee53528105370ef3109e63373) |
| scout2 | `nominate("call_0", 160588)` | 0 | ERROR | guide 160588: the guide was created before the call's start date | [`0x83c2a2bf…`](https://explorer-studio.genlayer.com/tx/0x83c2a2bfdabb33c66c6807c3cd04c74903b4776db62c868105a8c84a72470a71) |
| scout2 | `nominate("call_0", 248065)` | 0 | ERROR | guide 248065: the guide's device is not under the call's category | [`0x819bbf29…`](https://explorer-studio.genlayer.com/tx/0x819bbf291ee2bb937d57a2f7ef089178f5239ed1ed58f94a716aa7c69042525c) |
| scout2 | `nominate("call_1", 247031)` | 0 | ERROR | guide 247031: iFixit flags this guide | [`0x839f1817…`](https://explorer-studio.genlayer.com/tx/0x839f18171ecbb6f6741d43c875b7244d326519a4785189b391dc265cf419e4f1) |
| scout2 | `nominate("call_0", 248998)` | 0 | ERROR | guide 248998: the guide has fewer steps than the call asks for | [`0x2c3133b2…`](https://explorer-studio.genlayer.com/tx/0x2c3133b20824ee7b4f43168aa5c128094a3a87e11a97a35a9191758288c83bf1) |
| scout2 | `nominate("call_2", 242713)` | 0 | ERROR | guide 242713: the guide was created before the call's start date | [`0xd1c86809…`](https://explorer-studio.genlayer.com/tx/0xd1c86809993b28bc0bfe49da0f6368bf4205451eee1596ce05221a0cda63cad7) |
| scout2 | `nominate("call_0", 249025)` | 0 | ERROR | claim_0 already nominates guide 249025 | [`0xcf91b734…`](https://explorer-studio.genlayer.com/tx/0xcf91b7345a3828c799f549ca14f7e22fa4433a908b1b9146e93e01d7edf91ac1) |
| scout | `contest("claim_0", "My own nomination, contested to test the rule.", "")` | 0 | ERROR | the scout cannot contest their own nomination | [`0x55a50a1e…`](https://explorer-studio.genlayer.com/tx/0x55a50a1e4d12f3789e2a654ebfa00cb8ff353fa2435e74195e22ee2124c8c49e) |
| contester | `settle("claim_0")` | 0 | ERROR | claim_0 can be contested until 2026-11-11T13:06:34 UTC | [`0x03be9e19…`](https://explorer-studio.genlayer.com/tx/0x03be9e19495cb44f66c4039deaaa1eca7db0a666ede1bf7896cad4ab98ea2262) |
| contester | `contest("claim_1", "This looks like an earlier guide; the steps are, "160588")` | 0 | SUCCESS | upheld | [`0x057d61f6…`](https://explorer-studio.genlayer.com/tx/0x057d61f661e852f8bd44c34fa45018f68f767a36f02ccc90e2e4dad39ba44d9c) |
| contester | `settle("claim_0")` | 0 | SUCCESS | accepted | [`0x03544799…`](https://explorer-studio.genlayer.com/tx/0x03544799aad08885556acc5ad160ee249cfda252d3d189b00d89eb9595ff388d) |
| contester | `settle("claim_2")` | 0 | SUCCESS | accepted | [`0x6b4e08d4…`](https://explorer-studio.genlayer.com/tx/0x6b4e08d4789a71ffb00d6a88803c712686416dd0a3b4f7e7c2e8089d7a5c55cc) |
| contester | `settle("claim_3")` | 0 | SUCCESS | accepted | [`0x67869ad2…`](https://explorer-studio.genlayer.com/tx/0x67869ad2107a1c6cabee6a433f04dc498fce6627712e943b4ab7f6630ccd95d3) |
| contester | `settle("claim_4")` | 0 | SUCCESS | accepted | [`0xea9d6ceb…`](https://explorer-studio.genlayer.com/tx/0xea9d6ceb4b1a050b9f1d9a5126bfc3ddcfd46610d1fc58b370383ec003c3cf69) |
| contester | `settle("claim_5")` | 0 | SUCCESS | accepted | [`0xf5648c79…`](https://explorer-studio.genlayer.com/tx/0xf5648c7930ac59e670469b8e2123931886642acd42f8b38ab4751fb9b9a7185c) |
| scout | `collect("claim_0")` | 0 | ERROR | add 0x022153B39F42e77aB3e5BCFB8EF1e244E4958234 to the About text of iFixit user 1258577 (Alexander Efremov), then collect | [`0x8a0fd4a8…`](https://explorer-studio.genlayer.com/tx/0x8a0fd4a859cd9da07ba5ea4d2fa0f58cd12da2b705c14c1bdf5c5efe4225fe1f) |
| scout | `lapse("claim_0")` | 0 | ERROR | the author can collect until 2027-05-10T13:09:15 UTC | [`0x3a78c1d9…`](https://explorer-studio.genlayer.com/tx/0x3a78c1d99bef0ab5d8f636e0601c082916cd4461a1284a5c7cca8bb76f68cfc8) |
| sponsor | `close("call_0")` | 0 | ERROR | Nominations are taken until 2027-01-10 | [`0xd1f1c114…`](https://explorer-studio.genlayer.com/tx/0xd1f1c114d08bfb92b197f354e633cf8dcceb3312635791e681573c8da1b01679) |
| scout | `withdraw()` | 0 | SUCCESS | 1200000000000000000 | [`0x4233488f…`](https://explorer-studio.genlayer.com/tx/0x4233488f9a58c5a66b0ccc51b9661cb672f75be98ec733c11db8651da6df3749) |
| scout2 | `withdraw()` | 0 | SUCCESS | 500000000000000000 | [`0x128f60ea…`](https://explorer-studio.genlayer.com/tx/0x128f60ea4f58948fbd66b773ac0f5b12ad505ca9814671b7595fcbac4d564d96) |
| contester | `withdraw()` | 0 | SUCCESS | 200000000000000000 | [`0x167c1c19…`](https://explorer-studio.genlayer.com/tx/0x167c1c19875b358c74aaa3cf631ad797a7b4be47895a80f1947fb5ffa710902c) |
