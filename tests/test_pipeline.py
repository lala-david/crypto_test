"""네트워크·LLM 없이 핵심 로직 검증: 주소 추출, 프롬프트/스키마, LLM 결과 병합, 리포트 렌더링.

실행: python -m pytest -q  또는  python tests/test_pipeline.py
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from collector.addresses import extract_addresses, extract_tx_hashes, merge_addresses  # noqa: E402
from collector.enrich import JSON_SCHEMA, PENDING_REASON, AddressOut, EnrichOut, build_incident, finalize_unenriched, guess_amount_usd  # noqa: E402
from collector.keywords import any_keyword, keyword_hit  # noqa: E402
from collector.llm import parse_json_text  # noqa: E402
from collector.models import Address, RawItem  # noqa: E402
from collector.prompts import CARD_FEWSHOT, briefing_system_prompt, card_system_prompt  # noqa: E402
from collector.report import build_markdown  # noqa: E402

SAMPLE = """
The attacker (0x085f3115ca368aa262246d22f9476e1e2c87e8be) borrowed $120.4 million and bridged
$9.19 million out. Funds moved to bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq and
1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2, then to TW5tokvhEfrb77z98Rc8HqbkzQJ6sxYtGX on Tron.
Tx: 0x90f15fbabf76e6f0a3f4a1c3f8a4a6d2c8b7e9f1a2b3c4d5e6f7a8b9c0d1e2f3.
Fake: 0x1234 and 1InvalidAddressWithBadChecksum00000 and whether together strong.
"""


def test_extract_addresses_validates_checksums():
    got = {(a.chain, a.address) for a in extract_addresses(SAMPLE)}
    assert ("ETH", "0x085f3115ca368aa262246d22f9476e1e2c87e8be") in got
    assert ("BTC", "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq") in got
    assert ("BTC", "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2") in got
    assert ("TRX", "TW5tokvhEfrb77z98Rc8HqbkzQJ6sxYtGX") in got
    assert not any(a.address.startswith("1Invalid") for a in extract_addresses(SAMPLE))
    assert len(extract_tx_hashes(SAMPLE)) == 1


def test_keywords_word_boundary_and_korean_prefix():
    assert not any_keyword("whether together strong Etherton definition", ["ether", "tron", "defi"])
    assert any_keyword("Ethereum wallets drained", ["ethereum", "drain"])
    assert any_keyword("was designated by OFAC", ["designat*"])
    assert any_keyword("업비트 해킹으로 가상자산 탈취", ["해킹*"]) and any_keyword("가상자산이", ["가상자산*"])
    assert keyword_hit("crypto exchange hacked", {"crypto": ["crypto"], "crime": ["hack"]})


def test_amount_guess():
    assert guess_amount_usd("lost $120.4 million and $9.19M") == 120_400_000


def test_parse_json_text_strips_think_and_fences():
    assert parse_json_text('<think>hmm</think>```json\n{"a": 1}\n```') == {"a": 1}
    assert parse_json_text('prefix text {"a": {"b": 2}} suffix') == {"a": {"b": 2}}
    assert parse_json_text("no json here") is None


def test_prompts_and_fewshot_match_schema():
    sp = card_system_prompt("few_shot")
    assert "예시 1 입력" in sp and "절대 규칙" in sp
    assert "예시" not in card_system_prompt("zero_shot")
    for ex in CARD_FEWSHOT:
        out = EnrichOut.model_validate(ex["output"])           # pydantic 통과
        assert set(ex["output"].keys()) == set(JSON_SCHEMA["required"])  # 스키마 키 완전 일치
        assert out.incident_type in JSON_SCHEMA["properties"]["incident_type"]["enum"]
    bp = briefing_system_prompt("few_shot")
    example = bp.split("## 예시 출력", 1)[1].split("\n", 1)[1].split("\n\n## 출력")[0]
    assert set(json.loads(example)) == {"headline_ko", "headline_en", "briefing_ko", "briefing_en"}


def test_clean_text_normalizes_units_and_dashes():
    from collector.llm import clean_text

    assert clean_text("$320 M 탈취, 2026‑09‑06, 300 × 펌핑, $4.2 m, $736 K") == "$320M 탈취, 2026-09-06, 300x 펌핑, $4.2M, $736K"
    assert clean_text("$5 Million") == "$5 Million"  # 단어는 건드리지 않음


def test_build_incident_merges_llm_and_regex():
    item = RawItem(source="rekt", source_id="/x-rekt", url="https://rekt.news/x-rekt", title="X - Rekt",
                   published_at="2026-09-14", text=SAMPLE)
    out = EnrichOut(
        relevant=True, incident_type="hack_exploit", project="Tectonic", incident_date="2026-08-30",
        chains=["Cronos"], amount_usd=120_400_000, amount_text="$120.4M", attack_method_ko="시세 조작 담보 대출",
        attack_method_en="Price-manipulated collateral borrowing",
        background_ko="배경", summary_ko="요약", summary_en="Summary", fund_flow_ko="브리지 경유", actors=[],
        addresses=[
            AddressOut(chain="ETH", address="0x085f3115ca368aa262246d22f9476e1e2c87e8be", role="attacker", note="공격자"),
            AddressOut(chain="ETH", address="0x000000000000000000000000000000000000dead", role="attacker", note="본문에 없음"),
        ],
        tx_hashes=[],
    )
    inc = build_incident(item, out, "ollama:test", {"crypto": ["crypto"], "crime": ["hack"]})
    addrs = {a.address: a for a in inc.addresses}
    assert inc.enriched and inc.project == "Tectonic"
    assert addrs["0x085f3115ca368aa262246d22f9476e1e2c87e8be"].role == "attacker"   # LLM 역할 유지
    assert "0x000000000000000000000000000000000000dead" not in addrs                  # 본문에 없는 주소는 버림
    assert "TW5tokvhEfrb77z98Rc8HqbkzQJ6sxYtGX" in addrs                             # 정규식 보강
    assert addrs["TW5tokvhEfrb77z98Rc8HqbkzQJ6sxYtGX"].role == "unknown"

    briefing = {"headline_ko": "헤드라인", "headline_en": "Headline", "briefing_ko": "- 불릿", "briefing_en": "- bullet"}
    md_ko = build_markdown("2026-09-15", [inc], {"rekt": 1}, [], briefing=briefing, lang="ko")
    md_en = build_markdown("2026-09-15", [inc], {"rekt": 1}, [], briefing=briefing, lang="en")
    assert "시세 조작 담보 대출" in md_ko and "헤드라인" in md_ko and "tronscan" in md_ko
    assert "Price-manipulated collateral borrowing" in md_en and "Headline" in md_en and "배경" in md_en  # en 없으면 ko 대체


def test_build_incident_fallback_without_llm():
    item = RawItem(source="doj", source_id="u1", url="https://justice.gov/x", title="Crypto hack indictment",
                   published_at="2026-09-14", text=SAMPLE)
    inc = build_incident(item, None, "", {"crypto": ["crypto"], "crime": ["hack", "indict*"]},
                         ignore_addresses=["0x085F3115CA368AA262246D22F9476E1E2C87E8BE"])
    assert not inc.enriched and inc.relevant and inc.amount_usd == 120_400_000
    assert len(inc.addresses) == 3  # ignore 목록 1개 제외


def test_merge_addresses_prefers_known_role():
    a = [Address("ETH", "0xABC", "unknown")]
    b = [Address("eth", "0xabc", "attacker", "n")]
    m = merge_addresses(a, b)
    assert len(m) == 1 and m[0].role == "attacker" and m[0].note == "n"


def test_briefing_pages_are_organized_by_date(tmp_path):
    from collector.report import build_briefing_page, write_briefing_index, write_briefing_page, write_report

    b = {"headline_ko": "h1", "headline_en": "h2", "briefing_ko": "- a", "briefing_en": "- b"}
    page = build_briefing_page("2026-09-15", b, [])
    assert "🇰🇷 브리핑" in page and "h1" in page and "reports/2026-09/2026-09-15.ko.md" in page
    p = write_briefing_page(str(tmp_path / "briefings"), "2026-09-15", page)
    assert p.replace("\\", "/").endswith("briefings/2026-09/2026-09-15.md")
    r = write_report(str(tmp_path / "reports"), "2026-09-15", "x", "ko")
    assert r.replace("\\", "/").endswith("reports/2026-09/2026-09-15.ko.md")
    idx = write_briefing_index(str(tmp_path / "briefings"), [
        {"day": "2026-09-15", "headline_ko": "h1", "headline_en": "h2", "total": 3, "relevant": 2},
        {"day": "2026-08-31", "headline_ko": "old", "headline_en": "old", "total": 1, "relevant": 1},
    ])
    t = open(idx, encoding="utf-8").read()
    assert t.index("## 2026-09") < t.index("## 2026-08") and "[2026-09-15](2026-09/2026-09-15.md)" in t and "최신 / Latest" in t


if __name__ == "__main__":
    import pytest

    sys.exit(pytest.main(["-q", __file__]))


# ---------------------------------------------------------------------------
# 병합 / crimial_hunter
# ---------------------------------------------------------------------------
from collector.crimial import category_for, to_ch_chain  # noqa: E402
from collector.merge import merge_incidents, names_match, same_incident  # noqa: E402
from collector.models import Incident  # noqa: E402


def _inc(uid, source, project, itype="hack_exploit", date="2026-09-12", pub="2026-09-13", addrs=(), enriched=True, amount=None):
    return Incident(uid=uid, source=source, source_id=uid, url=f"https://x/{uid}", title=project, published_at=pub,
                    collected_at="2026-09-15T10:00:00", relevant=True, incident_type=itype, project=project,
                    incident_date=date, addresses=[Address("ETH", a, "attacker") for a in addrs], enriched=enriched,
                    amount_usd=amount, summary_ko="s" * (10 if enriched else 0))


def test_names_match_variants():
    assert names_match("Chainflip AMM", "Chainflip")
    assert names_match("Xinbi Guarantee", "Xinbi")
    assert names_match("ether.fi Liquid", "Ether.fi")
    assert not names_match("Nomic", "Nesa")
    assert not names_match("ScamSniffer phishing blacklist", "Phishing")


def test_same_incident_rules():
    a = _inc("a", "slowmist", "Chainflip", date="2026-09-12")
    b = _inc("b", "defillama", "Chainflip AMM", date="2026-09-12", enriched=False)
    c = _inc("c", "rekt", "Chainflip", date="2026-08-01")                     # 날짜 멀면 다른 사건
    d = _inc("d", "doj", "Chainflip", itype="law_enforcement_action")         # 계열 다르면 다른 사건
    e = _inc("e", "zachxbt", "Unknown", addrs=("0xAAA",))
    f = _inc("f", "rekt", "Foo", addrs=("0xaaa",))                           # 주소 공유 → 같은 사건
    assert same_incident(a, b) and not same_incident(a, c) and not same_incident(a, d) and same_incident(e, f)


def test_merge_incidents_picks_representative_and_unions():
    a = _inc("a", "slowmist", "Chainflip", addrs=("0x1",), amount=736442)
    b = _inc("b", "defillama", "Chainflip AMM", enriched=False, amount=736442)
    r = _inc("r", "rekt", "Chainflip", addrs=("0x2",), amount=None)
    other = _inc("o", "rekt", "Nomic", date="2026-09-09")
    merged = merge_incidents([a, b, r, other])
    assert len(merged) == 2
    rep = next(m for m in merged if m.project.startswith("Chainflip"))
    assert rep.source == "rekt" and {x.address for x in rep.addresses} == {"0x1", "0x2"}
    assert rep.amount_usd == 736442 and {m["source"] for m in rep.merged_from} == {"slowmist", "defillama"}


def test_crimial_mapping():
    assert to_ch_chain("BSC", "0xabc") == "ETH" and to_ch_chain("TRX", "Txyz") == "TRON" and to_ch_chain("SOL", "abc") == "SOL"
    assert category_for("attacker", "hack_exploit") == "exploit"
    assert category_for("sanctioned", "sanctions_designation") == "sanctions"
    assert category_for("laundering", "hack_exploit") == "laundering"
    assert category_for("attacker", "phishing_social_engineering") == "phishing_drainer"


def test_merge_rules_for_leftover_duplicates():
    from collector.merge import mark_followups, plausible_pair

    # 법집행 계열: LLM이 사건일을 범행일로 잡아도 게시일이 가까우면 같은 사건 (Malone Lam 사례)
    a = _inc("a", "doj", "Malone Lam", itype="law_enforcement_action", date="2025-09-18", pub="2026-09-09")
    b = _inc("b", "rss:cointelegraph_scams", "Malone Lam", itype="law_enforcement_action", date="2026-09-09", pub="2026-09-09")
    assert same_incident(a, b)
    # 붙어 쓴 접미사: ORBToken ↔ ORB, YamFinance ↔ Yam
    assert names_match("ORBToken", "ORB") and names_match("YamFinance", "Yam") and not names_match("ORB", "Orbit Bridge")
    # 이름이 전혀 달라 규칙으로는 못 묶지만 LLM에 물어볼 만한 쌍
    c = _inc("c", "slowmist", "Unknown Gnosis Safe Wallet", date="2026-09-15", pub="2026-09-15", amount=7_700_000)
    d = _inc("d", "rss:cointelegraph_hacks", "custom Safe module", date="2026-09-15", pub="2026-09-16", amount=7_700_000)
    c.chains, d.chains = ["Ethereum"], ["Ethereum"]
    assert not same_incident(c, d) and plausible_pair(c, d)
    merged = merge_incidents([c, d], judge=lambda x, y: True)
    assert len(merged) == 1 and merged[0].merged_from
    # 후속 보도 표시: 어제 사건과 같은 사건이면 followup_of 채움
    yesterday = _inc("y", "chainalysis", "Liquid Network", date="2026-09-06", pub="2026-09-09")
    today = _inc("t", "rss:cointelegraph_hacks", "Liquid Network", date="2026-09-06", pub="2026-09-16")
    assert mark_followups([today], [yesterday]) == 1 and today.followup_of["uid"] == "y"


def test_to_date_str_handles_epoch_strings():
    from collector.sources.base import to_date_str

    assert to_date_str("1788912000") == "2026-09-09" and to_date_str(1788912000) == "2026-09-09"
    assert to_date_str("2026-09-09T12:00:00Z") == "2026-09-09" and to_date_str("$D2024-03-21T00:00:00.000Z") == "2024-03-21"
    assert to_date_str("garbage") == ""


def test_notifiers_format_and_dedupe_per_channel(tmp_path):
    import json as _json
    from collector.notify import TeamsNotifier, TelegramNotifier, format_briefing, format_incident, teams_briefing_card, teams_incident_card
    from collector.store import Store

    inc = _inc("t1", "rekt", "Tectonic <Cronos>", date="2026-08-30", pub="2026-09-14", addrs=("0xabc",), amount=120_400_000)
    inc.summary_ko = "공격자가 TONIC 가격을 300배 올렸다. Cronos가 롤백했다. 세 번째 문장."
    inc.merged_from = [{"uid": "t2", "source": "slowmist", "url": "https://x/2"}]
    msg = format_incident(inc, "https://github.com/o/r", "2026-09-15")
    assert "🔴" in msg and "&lt;Cronos&gt;" in msg and "$120.4M" in msg and "세 번째" not in msg and "reports/2026-09/2026-09-15.ko.md" in msg
    b = {"headline_ko": "h", "briefing_ko": "- **[A](https://a)** — x\n- 시사점"}
    assert '<a href="https://a">A</a>' in format_briefing("2026-09-15", b, 3, 1, "https://github.com/o/r")

    card = teams_incident_card(inc, "https://github.com/o/r", "2026-09-15")
    content = card["attachments"][0]["content"]
    assert card["type"] == "message" and content["type"] == "AdaptiveCard"
    assert any(f["title"] == "금액" and f["value"] == "$120.4M" for f in content["body"][1]["facts"])
    assert {a["title"] for a in content["actions"]} >= {"원문 (rekt)", "slowmist", "상세 리포트"}
    _json.dumps(card); _json.dumps(teams_briefing_card("2026-09-15", b, 3, 1, "https://github.com/o/r"))  # 직렬화 가능

    st = Store(str(tmp_path))
    tg = TelegramNotifier({"enabled": True}, str(tmp_path))
    tm = TeamsNotifier({"enabled": True}, str(tmp_path))
    assert not tg.enabled and not tm.enabled                                   # 설정 없으면 비활성
    tm.enabled, tm.url = True, "https://example.invalid/hook"
    tm.post = lambda payload: True                                             # 네트워크 대신
    assert tm.alert_incidents(st, [inc], "2026-09-15") == 1
    assert st.alert_sent("teams:t1") and st.alert_sent("teams:t2")             # 대표+병합 uid 모두 기록
    assert tm.alert_incidents(st, [inc], "2026-09-15") == 0                    # 같은 채널 재발송 없음
    tg.enabled, tg.token, tg.chat = True, "x", "1"
    tg.send = lambda text: True
    assert tg.alert_incidents(st, [inc], "2026-09-15") == 1                    # 다른 채널은 별도 기록
    assert tm.alert_briefing(st, "2026-09-15", b, [inc]) and not tm.alert_briefing(st, "2026-09-15", b, [inc])


def test_consensus_amount_prefers_majority_then_latest():
    from collector.merge import consensus_amount
    from collector.models import Incident
    def inc(uid, src, amt, pub, text=""):
        return Incident(uid=uid, source=src, source_id=uid, url="u" + uid, title="Bitget", published_at=pub, collected_at=pub, project="Bitget",
                        incident_type="hack_exploit", amount_usd=amt, amount_text=text)
    members = [inc("1", "defillama", 387_000_000, "2026-09-24"), inc("2", "slowmist", 387_500_000, "2026-09-24", "$387,500,000"),
               inc("3", "rss:cointelegraph_hacks", 352_000_000, "2026-09-24", "$352M"), inc("4", "trm", 351_600_000, "2026-09-25", "$351.6 million"),
               inc("5", "rss:cointelegraph_hacks", 388_000_000, "2026-09-25", "$388M"), inc("6", "rss:tokenpost", 387_500_000, "2026-09-27", "$387.5 million")]
    amt, text = consensus_amount(members)
    assert amt == 387_500_000 and text == "$387.5 million"
    assert consensus_amount(members[:1]) is None                       # 1개면 기존 규칙
    tie = [inc("a", "slowmist", 100, "2026-09-02", "$100"), inc("b", "defillama", 200, "2026-09-03", "$200")]
    assert consensus_amount(tie)[0] == 100                             # 동수 → 출처 우선순위(slowmist > defillama)
    tie2 = [inc("a", "rss:x", 100, "2026-09-01", "$100"), inc("b", "rss:y", 200, "2026-09-02", "$200")]
    assert consensus_amount(tie2)[0] == 200                            # 우선순위도 같으면 늦은 보도


def test_unenriched_card_is_held_back_when_llm_expected():
    """LLM 을 쓰는 실행에서 호출이 실패한 항목은 relevant=False + pending 으로 보류(다음 실행 재시도). --no-llm 실행은 규칙 기반 그대로."""
    item = RawItem(source="rss:tokenpost", source_id="u2", url="https://x/news", title="비텐서, TAO 보상 전환 구상 공개",
                   published_at="2026-09-29", text="가상자산 hack 관련 단어가 들어간 일반 뉴스")
    inc = build_incident(item, None, "", {"crypto": ["가상자산"], "crime": ["hack"]})
    assert inc.relevant and not inc.enriched
    assert finalize_unenriched(inc, item, llm_expected=True) is True
    assert inc.relevant is False and inc.relevance_reason == PENDING_REASON and "pending_llm" in inc.enrich_note
    inc2 = build_incident(item, None, "", {"crypto": ["가상자산"], "crime": ["hack"]})
    assert finalize_unenriched(inc2, item, llm_expected=False) is False and inc2.relevant
    structured = RawItem(source="defillama", source_id="d1", url="https://defillama.com/hacks/x", title="X", published_at="2026-09-29",
                         text="", needs_llm=False, structured={"name": "X", "incident_type": "hack_exploit", "amount_usd": 100.0})
    inc3 = build_incident(structured, None, "", {})
    assert finalize_unenriched(inc3, structured, llm_expected=True) is False and inc3.relevant


def test_other_type_is_not_an_incident():
    item = RawItem(source="rss:tokenpost", source_id="u3", url="https://x/n", title="스트라이프, AI 다중 계정 악용 40% 증가", published_at="2026-09-29", text="...")
    out = EnrichOut(relevant=True, incident_type="other", project="Stripe", incident_date=None, chains=[], amount_usd=None, amount_text="",
                    attack_method_ko="", attack_method_en="", background_ko="", summary_ko="", summary_en="", fund_flow_ko="", actors=[], addresses=[], tx_hashes=[])
    inc = build_incident(item, out, "ollama:test", {})
    assert inc.enriched and inc.relevant is False and "other" in inc.relevance_reason
    out2 = out.model_copy(update={"incident_type": "hack_exploit"})
    assert build_incident(item, out2, "ollama:test", {}).relevant is True


def test_same_incident_across_families_when_name_and_amount_match():
    from collector.merge import same_incident
    from collector.models import Incident
    a = Incident(uid="a", source="doj", source_id="1", url="https://justice.gov/a", title="Civil Forfeiture Action to Recover Cryptocurrency",
                 published_at="2026-09-29", collected_at="2026-09-29T10:00:00", project="Coinbase", incident_type="law_enforcement_action", amount_usd=47000.0)
    b = Incident(uid="b", source="rss:tokenpost", source_id="2", url="https://tokenpost.kr/b", title="11만270 USDT 몰수 청구",
                 published_at="2026-09-28", collected_at="2026-09-29T10:04:00", project="Coinbase", incident_type="phishing_social_engineering", amount_usd=47000.0)
    assert same_incident(a, b)
    c = Incident(uid="c", source="rss:x", source_id="3", url="https://x/c", title="Coinbase phishing wave", published_at="2026-09-28",
                 collected_at="2026-09-29T10:04:00", project="Coinbase", incident_type="phishing_social_engineering", amount_usd=2_000_000.0)
    assert not same_incident(a, c)   # 이름은 같아도 금액이 다르면 다른 사건


def test_review_categories_include_crypto_incidental():
    from collector.relabel import EXCLUDE_CATEGORIES, REVIEW_CATEGORIES, REVIEW_SCHEMA
    from collector.prompts import REVIEW_SYSTEM
    assert "crypto_incidental" in REVIEW_CATEGORIES and "crypto_incidental" in EXCLUDE_CATEGORIES
    assert set(REVIEW_SCHEMA["properties"]["category"]["enum"]) == set(REVIEW_CATEGORIES)
    assert "crypto_incidental" in REVIEW_SYSTEM


def test_backfill_stamp_sets_collected_day_and_relevance():
    from datetime import date
    from collector.enrich import backfill_stamp
    from collector.sources.defihacklabs import year_archives
    item = RawItem(source="defillama", source_id="X|2021-08-10", url="https://defillama.com/hacks", title="X — Protocol Logic", published_at="2021-08-10",
                   text="", needs_llm=False, structured={"name": "X", "incident_date": "2021-08-10", "incident_type": "hack_exploit", "amount_usd": 5.0e8})
    inc = build_incident(item, None, "", {})
    backfill_stamp(inc, item)
    assert inc.collected_at == "2021-08-10T00:00:00" and inc.relevant and "backfill" in inc.tags
    item2 = RawItem(source="defihacklabs", source_id="20220301|Y", url="https://github.com/x", title="Y — Reentrancy", published_at="2022-03-01",
                    text="Y (2022-03-01) — Reentrancy", needs_llm=True, structured={"name": "Y", "incident_date": "2022-03-01", "incident_type": "hack_exploit"})
    inc2 = build_incident(item2, None, "", {"crypto": ["crypto"], "crime": ["hack"]})
    assert not inc2.relevant                      # 키워드만으로는 무관 판정
    backfill_stamp(inc2, item2)
    assert inc2.relevant and inc2.collected_at.startswith("2022-03-01")   # 구조화 소스는 확정 사고
    assert year_archives(date(2020, 1, 1), date(2026, 9, 29)) == [2021, 2022, 2023, 2024, 2025]
    assert year_archives(date(2026, 9, 1), date(2026, 9, 29)) == []
