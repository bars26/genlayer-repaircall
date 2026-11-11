"""Direct-mode tests for the RepairCall contract, with real iFixit guides (tests/fixtures) and mocked reads."""

import copy
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from tests.direct.conftest import CONTRACT_PATH, llm_json, to_hex

GEN = 10**18
STAKE = GEN // 10
REWARD = GEN // 2
SCOUT_BPS = 2000  # the scout gets 20%, the author 80%
FIX = Path(__file__).resolve().parents[1] / "fixtures"
API = "https://www.ifixit.com/api/2.0"
GUIDE = 248913  # "Xbox Series LB RB repair", 16 steps, every step photographed
SIBLINGS = [187435, 179646, 179645, 171489, 160588]  # earlier guides of the same controller
AUTHOR = 2567058
CATEGORY_URL = f"{API}/wikis/CATEGORY/Xbox_Series_X_Wireless_Controller"
JUDGE = r"A sponsor pays for new repair guides"
SECOND = r"accepted for this call"


def _days_from_now(n):
    return (datetime.now(timezone.utc) + timedelta(days=n)).strftime("%Y-%m-%d")


def _load(name):
    return json.loads((FIX / name).read_text())


def _guide(**changes):
    """The real guide, created five days ago (so it is new for any call reaching back further), with changes."""
    g = _load(f"guide-{GUIDE}.json")
    g["created_date"] = g["published_date"] = int((datetime.now(timezone.utc) - timedelta(days=5)).timestamp())
    g.update(changes)
    return g


def _mock(direct_vm, url, body, status=200):
    data = body if isinstance(body, bytes) else (json.dumps(body) if not isinstance(body, str) else body).encode()
    direct_vm.mock_web("^" + re.escape(url) + "$", {"method": "GET", "response": {"status": status, "headers": {}, "body": data}})


def _ifixit(direct_vm, guide=None, siblings=None, user=None, status=200):
    """Mock iFixit: the nominated guide, its category (ancestors and guides) and the earlier guides of that device."""
    direct_vm.clear_mocks()
    _mock(direct_vm, f"{API}/guides/{GUIDE}", guide if guide is not None else _guide(), status=status)
    _mock(direct_vm, CATEGORY_URL, _load("category-xbox-series-x-controller.json"))
    for gid in SIBLINGS:
        _mock(direct_vm, f"{API}/guides/{gid}", (siblings or {}).get(gid) or _load(f"guide-{gid}.json"))
    _mock(direct_vm, f"{API}/users/{AUTHOR}", user or _load(f"user-{AUTHOR}.json"))


def _judge(direct_vm, answer):
    direct_vm.mock_llm(JUDGE, llm_json({"answer": answer}))


def _payments(contract, monkeypatch):
    sent = []
    monkeypatch.setattr(sys.modules[type(contract).__module__], "_send", lambda to, amount: sent.append((to.as_hex, int(amount))))
    return sent


def _owed(contract, who):
    return int(contract.owed_to(to_hex(who)))


def _totals(contract):
    return json.loads(contract.totals())


def _module(contract):
    return sys.modules[type(contract).__module__]


def _call(direct_vm, direct_deploy, sponsor, value=2 * GEN, category="Game Console", types="technique,repair,replacement",
          since=None, min_steps=6, reward=REWARD, cap=5, deploy=True, contract=None):
    direct_vm.sender = sponsor
    contract = direct_deploy(CONTRACT_PATH) if deploy else contract
    direct_vm.value = value
    cid = contract.create_call("Game controller repairs", category, types,
                               "Repairs of game console controllers: sticks, buttons, triggers, batteries.",
                               since or _days_from_now(-30), _days_from_now(60), min_steps, reward, SCOUT_BPS, STAKE, 60, cap)
    direct_vm.value = 0
    return contract, cid


def _deposit(direct_vm, contract, who, amount=STAKE):
    direct_vm.sender, direct_vm.value = who, amount
    contract.deposit()
    direct_vm.value = 0


def _nominate(direct_vm, contract, who, answer="COMPLETE", call_id="call_0", stake=STAKE, **mocks):
    _ifixit(direct_vm, **mocks)
    _judge(direct_vm, answer)
    if stake:
        _deposit(direct_vm, contract, who, stake)
    direct_vm.sender = who
    return contract.nominate(call_id, GUIDE)


def _expire(contract, cid):
    contract.claims[cid].deadline = "2020-01-01T00:00:00"


def _balance_ok(contract, received, sent):
    """totals() must equal what came in minus what went out."""
    assert int(_totals(contract)["expected_balance"]) == received - sum(a for _, a in sent)


# --- reading a guide in code ---------------------------------------------------------------------------------------


def test_guide_facts_text_and_copies_from_a_real_guide(direct_vm, direct_deploy, direct_alice):
    contract, _ = _call(direct_vm, direct_deploy, direct_alice)
    m = _module(contract)
    g = _guide()
    facts = m.guide_facts(g)
    assert facts["guideid"] == GUIDE and facts["steps"] == 16 and facts["photos"] == 16
    assert facts["author_id"] == AUTHOR and facts["kind"] == "technique" and facts["public"]
    assert facts["flags"] == ["GUIDE_USER_CONTRIBUTED"] and facts["created"] == _days_from_now(-5)
    text = m.guide_text(g)
    assert text.startswith("Title: Xbox Series LB RB repair") and "Step 16:" in text and "Conclusion:" in text
    # A guide is a copy of itself; the earlier guides of the same controller are not copies of it.
    assert m.copy_of(g, g)[2]
    for gid in SIBLINGS:
        shared, score, copied = m.copy_of(g, _load(f"guide-{gid}.json"))
        assert not copied and shared == 0 and score < 0.2


def test_steps_inlined_from_prerequisite_guides_are_not_counted_or_compared(direct_vm, direct_deploy, direct_alice):
    contract, _ = _call(direct_vm, direct_deploy, direct_alice)
    m = _module(contract)
    g = _guide()
    earlier = _load("guide-179645.json")
    # iFixit inlines a prerequisite's steps, each carrying the prerequisite's guideid
    g["steps"] = [dict(st, guideid=179645) for st in earlier["steps"]] + g["steps"]
    g["prerequisites"] = [{"guideid": 179645, "title": earlier["title"]}]
    facts = m.guide_facts(g)
    assert (facts["steps"], facts["photos"]) == (16, 16)
    assert not m.copy_of(g, earlier)[2]
    text = m.guide_text(g, limit=100_000)
    assert "Step 1 (from prerequisite guide 179645):" in text and f"Done first, in their own guides: {earlier['title']}" in text


@pytest.mark.parametrize("change, reason", [
    ({"public": False}, "not_public"),
    ({"created": "2020-01-01"}, "too_old"),
    ({"kind": "teardown"}, "wrong_type"),
    ({"steps": 5, "photos": 5}, "too_few_steps"),
    ({"photos": 15}, "missing_photos"),
    ({"flags": ["GUIDE_IN_PROGRESS", "GUIDE_USER_CONTRIBUTED"]}, "flagged"),
    ({}, ""),
])
def test_code_checks_in_order(direct_vm, direct_deploy, direct_alice, change, reason):
    contract, _ = _call(direct_vm, direct_deploy, direct_alice)
    m = _module(contract)
    facts = {**m.guide_facts(_guide()), **change}
    call = {"since": _days_from_now(-30), "types": ["technique", "repair"], "min_steps": 6}
    assert m.check_guide(facts, call) == reason


# --- calls -----------------------------------------------------------------------------------------------------------


@pytest.mark.parametrize("kwargs, value, reason", [
    ({"types": "unboxing"}, 2 * GEN, "types must be one or more of"),
    ({"since": "2020-01-01"}, 2 * GEN, "since must be from 90 days ago"),
    ({"since": "2026-02-31"}, 2 * GEN, "real dates"),
    ({"min_steps": 2}, 2 * GEN, "min_steps 3-60"),
    ({"category": "a/b"}, 2 * GEN, "category must be an iFixit category"),
    ({}, REWARD - 1, "fund it with at least one reward"),
])
def test_invalid_calls_are_refused_and_their_gen_credited_back(direct_vm, direct_deploy, direct_alice, kwargs, value, reason):
    direct_vm.sender = direct_alice
    contract = direct_deploy(CONTRACT_PATH)
    _, out = _call(direct_vm, direct_deploy, direct_alice, value=value, deploy=False, contract=contract, **kwargs)
    assert out.startswith("REFUNDED") and reason in out
    assert _owed(contract, direct_alice) == value and int(contract.call_count) == 0


# --- nominating ------------------------------------------------------------------------------------------------------


def test_a_complete_guide_becomes_a_candidate_with_its_reward_held(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, cid = _call(direct_vm, direct_deploy, direct_alice)
    assert _nominate(direct_vm, contract, direct_bob) == "claim_0"
    d = contract.get_claim("claim_0")
    assert (d.state, d.answer, int(d.steps), int(d.photos), int(d.author_id)) == ("candidate", "COMPLETE", 16, 16, AUTHOR)
    assert d.author_name == "@HectorNavarroMX" and d.kind == "technique" and len(d.packet) == 64 and d.deadline
    c = contract.get_call(cid)
    assert int(c.reserved) == REWARD and int(c.pot) == 2 * GEN - REWARD and _owed(contract, direct_bob) == 0
    t = _totals(contract)
    assert (int(t["open_stakes"]), int(t["reserved"]), int(t["expected_balance"])) == (STAKE, REWARD, 2 * GEN + STAKE)


@pytest.mark.parametrize("mocks, call_kwargs, message", [
    ({"status": 404}, {}, "iFixit has no guide with this id"),
    ({"guide": _guide(public=False)}, {}, "the guide is not public on iFixit"),
    ({"guide": _guide(created_date=1_600_000_000)}, {}, "created before the call's start date"),
    ({"guide": _guide(type="teardown")}, {}, "type is not one this call pays for"),
    ({}, {"min_steps": 20}, "fewer steps than the call asks for"),
    ({"guide": _guide(flags=[{"flagid": "GUIDE_LOUSY_PICTURES"}])}, {}, "iFixit flags this guide"),
    ({}, {"category": "Speaker"}, "not under the call's category"),
])
def test_code_refusals_revert_and_keep_the_deposit(direct_vm, direct_deploy, direct_alice, direct_bob, mocks, call_kwargs, message):
    contract, _ = _call(direct_vm, direct_deploy, direct_alice, **call_kwargs)
    with direct_vm.expect_revert(message):
        _nominate(direct_vm, contract, direct_bob, **mocks)
    assert int(contract.claim_count) == 0 and _owed(contract, direct_bob) == STAKE


def test_a_step_without_a_photo_is_refused(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, _ = _call(direct_vm, direct_deploy, direct_alice)
    g = _guide()
    g["steps"][3]["media"] = {"type": "image", "data": []}
    with direct_vm.expect_revert("every step needs a photo"):
        _nominate(direct_vm, contract, direct_bob, guide=g)


def test_a_guide_that_reuses_an_earlier_guides_photos_is_a_copy(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, _ = _call(direct_vm, direct_deploy, direct_alice)
    g = _guide()
    earlier = copy.deepcopy(_load("guide-179645.json"))
    own = next(st for st in earlier["steps"] if st["guideid"] == 179645)
    own["media"]["data"] = g["steps"][0]["media"]["data"] + g["steps"][1]["media"]["data"]
    with direct_vm.expect_revert("repeats an earlier guide (guide 179645: 2 shared photos"):
        _nominate(direct_vm, contract, direct_bob, guide=g, siblings={179645: earlier})


@pytest.mark.parametrize("answer, state, scout_back, pot_gain", [
    ("INCOMPLETE", "rejected", 0, STAKE),
    ("OFF_SCOPE", "rejected", 0, STAKE),
    ("UNCLEAR", "unclear", STAKE, 0),
    ("SOMETHING", "unclear", STAKE, 0),
])
def test_what_the_validators_read(direct_vm, direct_deploy, direct_alice, direct_bob, answer, state, scout_back, pot_gain):
    contract, cid = _call(direct_vm, direct_deploy, direct_alice)
    _nominate(direct_vm, contract, direct_bob, answer=answer)
    d = contract.get_claim("claim_0")
    assert d.state == state and _owed(contract, direct_bob) == scout_back
    assert int(contract.get_call(cid).pot) == 2 * GEN + pot_gain and int(contract.get_call(cid).reserved) == 0


def test_one_live_nomination_per_guide_and_renominating_needs_a_new_revision(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract, _ = _call(direct_vm, direct_deploy, direct_alice)
    _nominate(direct_vm, contract, direct_bob, answer="INCOMPLETE")
    with direct_vm.expect_revert("has not changed since claim_0"):
        _nominate(direct_vm, contract, direct_charlie)
    # the author edits the guide: a new revision can be nominated again
    assert _nominate(direct_vm, contract, direct_charlie, stake=0, guide=_guide(revisionid=9_999_999)) == "claim_1"
    with direct_vm.expect_revert("claim_1 already nominates guide 248913"):
        _nominate(direct_vm, contract, direct_bob, guide=_guide(revisionid=10_000_000))


def test_caps_pot_and_deposit_are_checked_before_reading(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, cid = _call(direct_vm, direct_deploy, direct_alice, cap=1, value=REWARD)
    with direct_vm.expect_revert("deposit the stake first"):
        _nominate(direct_vm, contract, direct_bob, stake=STAKE // 2)
    _nominate(direct_vm, contract, direct_bob, answer="UNCLEAR", stake=STAKE // 2)  # now 0.1 credited
    with direct_vm.expect_revert("at most 1 nominations per scout"):
        _nominate(direct_vm, contract, direct_bob, guide=_guide(revisionid=1))


def test_a_spent_pot_takes_no_more_nominations(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, _ = _call(direct_vm, direct_deploy, direct_alice, value=REWARD)
    _nominate(direct_vm, contract, direct_bob)  # holds the only reward
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("cannot pay another reward"):
        contract.nominate("call_0", 123)


# --- settling and contests -------------------------------------------------------------------------------------------


def test_an_uncontested_candidate_pays_the_scout_and_holds_the_authors_share(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie, monkeypatch):
    contract, cid = _call(direct_vm, direct_deploy, direct_alice)
    sent = _payments(contract, monkeypatch)
    _nominate(direct_vm, contract, direct_bob)
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("can be contested until"):
        contract.settle("claim_0")
    _expire(contract, "claim_0")
    assert contract.settle("claim_0") == "accepted"
    d = contract.get_claim("claim_0")
    scout = REWARD * SCOUT_BPS // 10000
    assert (int(d.scout_share), int(d.author_share), d.author_state) == (scout, REWARD - scout, "held") and d.collect_by
    assert _owed(contract, direct_bob) == STAKE + scout and int(contract.get_call(cid).paid_total) == REWARD
    t = _totals(contract)
    assert int(t["authors_held"]) == REWARD - scout and int(t["reserved"]) == 0 and int(t["open_stakes"]) == 0
    direct_vm.sender = direct_bob
    assert int(contract.withdraw()) == STAKE + scout
    _balance_ok(contract, 2 * GEN + STAKE, sent)


@pytest.mark.parametrize("answer, state, scout_owed, contester_owed, reward_paid", [
    ("UPHELD", "upheld", 2 * STAKE + REWARD * SCOUT_BPS // 10000, 0, True),
    ("OVERTURNED", "overturned", 0, 2 * STAKE, False),
    ("UNCLEAR", "accepted", STAKE + REWARD * SCOUT_BPS // 10000, STAKE, True),
])
def test_contest_outcomes(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie, answer, state, scout_owed, contester_owed, reward_paid):
    contract, cid = _call(direct_vm, direct_deploy, direct_alice)
    _nominate(direct_vm, contract, direct_bob)
    _deposit(direct_vm, contract, direct_charlie)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("the scout cannot contest"):
        contract.contest("claim_0", "My own nomination, contested to test the rule.", "")
    _ifixit(direct_vm)
    direct_vm.mock_llm(SECOND, llm_json({"answer": answer}))
    direct_vm.sender = direct_charlie
    assert contract.contest("claim_0", "Step 9 skips how the trigger spring goes back in.", "") == state
    d = contract.get_claim("claim_0")
    assert d.contest_answer == answer and _owed(contract, direct_bob) == scout_owed and _owed(contract, direct_charlie) == contester_owed
    c = contract.get_call(cid)
    assert int(c.paid_total) == (REWARD if reward_paid else 0) and int(c.reserved) == 0
    assert int(c.pot) == 2 * GEN - (REWARD if reward_paid else 0)
    assert int(_totals(contract)["expected_balance"]) == 2 * GEN + 2 * STAKE


def test_a_contest_naming_the_copied_guide_is_decided_in_code(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract, _ = _call(direct_vm, direct_deploy, direct_alice)
    _nominate(direct_vm, contract, direct_bob)
    _deposit(direct_vm, contract, direct_charlie)
    g = _guide()
    source = copy.deepcopy(g)  # an older guide with the same steps
    source.update(guideid=111, created_date=1_600_000_000)
    source["steps"] = [dict(st, guideid=111) for st in source["steps"]]
    _ifixit(direct_vm, guide=g)
    _mock(direct_vm, f"{API}/guides/111", source)
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("source_guideid must be another"):
        contract.contest("claim_0", "Copied from another guide word for word.", str(GUIDE))
    assert contract.contest("claim_0", "Copied from guide 111 word for word.", "111") == "overturned"
    d = contract.get_claim("claim_0")
    assert d.contest_answer == "COPIED" and d.copy.startswith("guide 111: 16 shared photos") and _owed(contract, direct_charlie) == 2 * STAKE


def test_a_named_source_that_is_newer_or_different_goes_to_the_second_look(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract, _ = _call(direct_vm, direct_deploy, direct_alice)
    _nominate(direct_vm, contract, direct_bob)
    _deposit(direct_vm, contract, direct_charlie)
    _ifixit(direct_vm)
    direct_vm.mock_llm(SECOND, llm_json({"answer": "UPHELD"}))
    direct_vm.sender = direct_charlie
    assert contract.contest("claim_0", "Looks like guide 179645 to me.", "179645") == "upheld"


# --- the author's share ----------------------------------------------------------------------------------------------


def _accepted(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, cid = _call(direct_vm, direct_deploy, direct_alice)
    _nominate(direct_vm, contract, direct_bob)
    _expire(contract, "claim_0")
    contract.settle("claim_0")
    return contract, cid


def test_the_author_collects_with_their_wallet_in_the_ifixit_profile(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract, _ = _accepted(direct_vm, direct_deploy, direct_alice, direct_bob)
    share = REWARD - REWARD * SCOUT_BPS // 10000
    _ifixit(direct_vm)  # the real profile does not list a wallet
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert(f"add {to_hex(direct_charlie)} to the About text of iFixit user {AUTHOR}"):
        contract.collect("claim_0")
    user = {**_load(f"user-{AUTHOR}.json"), "about_raw": f"I fix controllers. GenLayer: {to_hex(direct_charlie).lower()}"}
    _ifixit(direct_vm, user=user)
    assert int(contract.collect("claim_0")) == share
    d = contract.get_claim("claim_0")
    assert d.author_state == "collected" and _owed(contract, direct_charlie) == share and int(_totals(contract)["authors_held"]) == 0
    with direct_vm.expect_revert("holds no author share"):
        contract.collect("claim_0")


def test_an_uncollected_share_lapses_to_the_pot_or_the_sponsor(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, cid = _accepted(direct_vm, direct_deploy, direct_alice, direct_bob)
    share = REWARD - REWARD * SCOUT_BPS // 10000
    with direct_vm.expect_revert("the author can collect until"):
        contract.lapse("claim_0")
    contract.claims["claim_0"].collect_by = "2020-01-01T00:00:00"
    with direct_vm.expect_revert("could be collected until"):
        contract.collect("claim_0")
    pot = int(contract.get_call(cid).pot)
    assert int(contract.lapse("claim_0")) == share and int(contract.get_call(cid).pot) == pot + share


def test_on_a_closed_call_an_uncollected_share_goes_to_the_sponsor(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, cid = _accepted(direct_vm, direct_deploy, direct_alice, direct_bob)
    share = REWARD - REWARD * SCOUT_BPS // 10000
    contract.calls[cid].ends = "2020-01-01"
    contract.close(cid)
    contract.claims["claim_0"].collect_by = "2020-01-01T00:00:00"
    before = _owed(contract, direct_alice)
    contract.lapse("claim_0")
    assert _owed(contract, direct_alice) == before + share and int(_totals(contract)["authors_held"]) == 0


# --- closing ---------------------------------------------------------------------------------------------------------


def test_close_and_pro_rata_refunds(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie, monkeypatch):
    contract, cid = _call(direct_vm, direct_deploy, direct_alice)
    sent = _payments(contract, monkeypatch)
    direct_vm.sender, direct_vm.value = direct_bob, GEN
    assert contract.fund(cid) == "funded"
    direct_vm.value = 0
    _nominate(direct_vm, contract, direct_charlie)
    with direct_vm.expect_revert("Nominations are taken until"):
        contract.close(cid)
    contract.calls[cid].ends = "2020-01-01"
    with direct_vm.expect_revert("Settle or resolve the open candidates first"):
        contract.close(cid)
    _expire(contract, "claim_0")
    contract.settle("claim_0")
    returnable = int(contract.close(cid))
    assert returnable == 3 * GEN - REWARD
    with direct_vm.expect_revert("already closed"):
        contract.close(cid)
    a = int(contract.refund(cid, to_hex(direct_alice)))
    b = int(contract.refund(cid, to_hex(direct_bob)))
    assert a == returnable * 2 // 3 and a + b == returnable
    with direct_vm.expect_revert("has already been credited"):
        contract.refund(cid, to_hex(direct_bob))
    for who in (direct_alice, direct_bob, direct_charlie):
        direct_vm.sender = who
        contract.withdraw()
    t = _totals(contract)
    assert int(t["owed"]) == 0 and int(t["returnable"]) == 0
    _balance_ok(contract, 3 * GEN + STAKE, sent)
    assert int(t["expected_balance"]) == REWARD - REWARD * SCOUT_BPS // 10000  # only the author's share is left


def test_the_validator_settles_on_the_cautious_answer(direct_vm, direct_deploy, direct_alice):
    contract, _ = _call(direct_vm, direct_deploy, direct_alice)
    m = _module(contract)

    class Ret:
        def __init__(self, data):
            self.calldata = json.dumps(data)

    monkey = m.gl.vm.Return
    m.gl.vm.Return = Ret
    try:
        base = {"state": "ok", "guideid": 1}
        mine = {**base, "answer": "COMPLETE"}
        check = m._validator(lambda: json.dumps(mine), ("UNCLEAR",))
        assert check(Ret({**base, "answer": "COMPLETE"}))
        assert check(Ret({**base, "answer": "UNCLEAR"}))  # the leader's cautious answer is accepted
        assert not check(Ret({**base, "answer": "INCOMPLETE"}))
        assert not check(Ret({**base, "guideid": 2, "answer": "UNCLEAR"}))  # code facts must match exactly
        rejecting = m._validator(lambda: json.dumps({**base, "answer": "OFF_SCOPE"}), ("UNCLEAR",))
        assert rejecting(Ret({**base, "answer": "INCOMPLETE"}))  # both say do not pay
    finally:
        m.gl.vm.Return = monkey
