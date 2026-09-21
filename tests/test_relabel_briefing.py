"""재검증 하네스(규칙 QA·근거 검증)와 구조화 브리핑 조립 테스트."""
from collector.briefing import assemble, event_date, money
from collector.models import Incident
from collector.relabel import apply_verified, evidence_in_text, money_values, qa_flags


def _inc(**kw) -> Incident:
    base = dict(uid="u1", source="rekt", source_id="1", url="https://x/a", title="Example DEX exploited for $4.2M in tokens", published_at="2026-09-16T10:00:00",
                collected_at="2026-09-17T01:00:00", project="Example DEX", incident_type="hack_exploit", incident_date="2026-09-15",
                chains=["Base"], amount_usd=4_200_000.0, amount_text="$4.2M")
    base.update(kw)
    return Incident(**base)


def test_money_values_and_flags():
    text = "The attacker drained $4.2 million from Example DEX on September 15. A bounty of $100,000 was offered."
    assert any(abs(v - 4_200_000) < 1 for v in money_values(text))
    assert qa_flags(_inc(), text) == []
    assert "date_after_published" in qa_flags(_inc(incident_date="2026-09-20"), text)
    assert "amount_not_in_text" in qa_flags(_inc(amount_usd=9_000_000), text)
    assert "no_chain" in qa_flags(_inc(chains=[]), text)
    assert "project_is_title" in qa_flags(_inc(project="Example DEX exploited for $4.2M in tokens"), text)
    assert "relevance_suspect" in qa_flags(_inc(title="Former deputy sentenced", summary_ko="공권력 남용", summary_en=""), text)
    assert "type_maybe_legal" in qa_flags(_inc(title="Man sentenced for laundering", incident_type="hack_exploit"), text)


def test_apply_verified_requires_evidence():
    text = "On September 14, 2026 the Example DEX pool on Base was drained of $4.8 million worth of tokens."
    inc = _inc()
    out = {"incident_date": "2026-09-14", "incident_date_evidence": "On September 14, 2026 the Example DEX pool", "amount_usd": 4_800_000, "amount_text": "$4.8 million",
           "amount_evidence": "drained of $4.8 million worth", "chains": ["Base"], "project": "Example DEX", "incident_type": "hack_exploit", "type_evidence": "", "relevant": True, "notes": ""}
    changed, rejected = apply_verified(inc, out, text)
    assert "incident_date" in changed and inc.incident_date == "2026-09-14"
    assert "amount_usd" in changed and inc.amount_usd == 4_800_000
    # 근거가 원문에 없으면 거부
    inc2 = _inc()
    out2 = dict(out, incident_date="2026-09-10", incident_date_evidence="totally made up sentence", amount_usd=9_900_000, amount_evidence="not in text")
    changed2, rejected2 = apply_verified(inc2, out2, text)
    assert "incident_date" not in changed2 and inc2.incident_date == "2026-09-15"
    assert "amount_usd" not in changed2 and inc2.amount_usd == 4_200_000
    assert rejected2
    # 게시일보다 뒤인 날짜는 거부
    inc3 = _inc()
    changed3, rejected3 = apply_verified(inc3, dict(out, incident_date="2026-09-20", incident_date_evidence="On September 14, 2026 the Example DEX pool"), text)
    assert inc3.incident_date == "2026-09-15" and any("date>" in r for r in rejected3)
    assert evidence_in_text("Example DEX pool on Base", text) and not evidence_in_text("nothing here", text)


def test_assemble_structure_and_dates():
    big = _inc(uid="a", project="Big Hack", amount_usd=7_800_000, incident_date="2026-09-15", chains=["Ethereum"])
    legal = _inc(uid="b", project="SBA PPP", incident_type="law_enforcement_action", amount_usd=245_000_000, incident_date="2025-01-01", published_at="2026-09-14T09:00:00", chains=[])
    small = _inc(uid="c", project="Tiny", amount_usd=25_000, chains=["BSC"])
    follow = _inc(uid="d", project="Big Hack", amount_usd=7_900_000, followup_of={"uid": "a", "day": "2026-09-16", "project": "Big Hack"})
    b = assemble("2026-09-18", [small, follow, legal, big], {"a": {"line_ko": "멀티콜로 탈취", "line_en": "drained via multicall"}}, "오라클 조작이 반복", "Oracle manipulation repeats")
    assert b["headline_ko"].startswith("9월 18일 브리핑 · 신규 3건")
    assert "피해 $7.8M" in b["headline_ko"] and "제재·수사 $245M" in b["headline_ko"] and "후속 1건" in b["headline_ko"]
    lines = b["briefing_ko"].split("\n")
    assert lines[0].startswith("- **[SBA PPP]") and "**$245M**" in lines[0] and "9.14" in lines[0]  # 법집행은 발표일
    assert lines[1].startswith("- **[Big Hack]") and "Ethereum · 해킹 · **$7.8M** · 9.15 — 멀티콜로 탈취" in lines[1]
    assert lines[2].startswith("- **소액·미상 1건** — ") and "$25K" in lines[2]
    assert lines[3].startswith("- **후속 1건** — ") and "첫 보도 9.16" in lines[3]
    assert lines[4] == "- **시사점** — 오라클 조작이 반복."
    assert event_date(legal) == "2026-09-14" and event_date(big) == "2026-09-15"
    assert money(1_230_000_000) == "$1.23B" and money(750_000_000) == "$750M" and money(25_000) == "$25K"


def test_strip_line_removes_amount_phrases():
    from collector.briefing import _strip_line
    assert "달러" not in _strip_line("개인키가 탈취돼 약 1,530,000달러가 유출되었습니다", "Fetch.ai")
    assert "$" not in _strip_line("attacker drained $4.2M from the pool", "X")
    assert "USD" not in _strip_line("lost about 1.5M USD worth of tokens", "X")
    assert _strip_line("개인키가 탈취돼 약 462,730 달러 규모의 자산이 유출", "NuNet").startswith("개인키가 탈취돼")
