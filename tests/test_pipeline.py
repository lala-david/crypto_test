"""네트워크·LLM 없이 핵심 로직 검증: 주소 추출, 프롬프트/스키마, LLM 결과 병합, 리포트 렌더링.

실행: python -m pytest -q  또는  python tests/test_pipeline.py
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from collector.addresses import extract_addresses, extract_tx_hashes, merge_addresses  # noqa: E402
from collector.enrich import JSON_SCHEMA, AddressOut, EnrichOut, build_incident, guess_amount_usd  # noqa: E402
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
