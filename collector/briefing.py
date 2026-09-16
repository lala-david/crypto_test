"""하루치 사건 카드를 모아 한/영 브리핑(경영진 요약)을 쓴다."""
from __future__ import annotations

import json
import logging
from typing import List, Optional

from .llm import LLMProvider, clean_text
from .models import INCIDENT_TYPE_KO, Incident
from .prompts import briefing_system_prompt

log = logging.getLogger("collector.briefing")

BRIEFING_SCHEMA = {
    "type": "object",
    "properties": {
        "headline_ko": {"type": "string"},
        "headline_en": {"type": "string"},
        "briefing_ko": {"type": "string"},
        "briefing_en": {"type": "string"},
    },
    "required": ["headline_ko", "headline_en", "briefing_ko", "briefing_en"],
    "additionalProperties": False,
}



def _digest(incidents: List[Incident]) -> str:
    rows = []
    for i in incidents:
        rows.append({
            "project": i.project, "type": INCIDENT_TYPE_KO.get(i.incident_type, i.incident_type),
            "incident_date": i.incident_date, "chains": i.chains, "amount_usd": i.amount_usd,
            "amount_text": i.amount_text, "method": i.attack_method_ko or i.attack_method_en,
            "summary": i.summary_ko or i.summary_en, "fund_flow": i.fund_flow_ko, "actors": i.actors,
            "addresses": len(i.addresses), "source": i.source, "url": i.url,
            "other_sources": [m.get("source") for m in i.merged_from],
            "blacklist_rehits": len(i.blacklist_hits),
            "followup_of": (f"{i.followup_of.get('day')} {i.followup_of.get('project')}" if i.followup_of else None),
        })
    return json.dumps(rows, ensure_ascii=False)


def write_briefing(provider: Optional[LLMProvider], day: str, incidents: List[Incident], max_tokens: int = 4000,
                   prompt_style: str = "few_shot") -> Optional[dict]:
    relevant = [i for i in incidents if i.relevant]
    if not relevant:
        return {"headline_ko": "신규 관련 사건 없음", "headline_en": "No new incidents",
                "briefing_ko": "- 오늘 수집된 신규 관련 사건이 없습니다.", "briefing_en": "- No new relevant incidents were collected today."}
    if provider is None:
        top = sorted(relevant, key=lambda i: -(i.amount_usd or 0))[:8]
        ko = "\n".join(f"- **{i.project or i.title}** ({INCIDENT_TYPE_KO.get(i.incident_type, i.incident_type)}, {i.amount_text or '금액 미상'}) — {i.url}" for i in top)
        en = "\n".join(f"- **{i.project or i.title}** ({i.incident_type}, {i.amount_text or 'amount n/a'}) — {i.url}" for i in top)
        return {"headline_ko": f"신규 사건 {len(relevant)}건 (규칙 기반)", "headline_en": f"{len(relevant)} new incidents (rule-based)",
                "briefing_ko": ko, "briefing_en": en}
    user = f"날짜: {day}\n사건 카드 {len(relevant)}건:\n{_digest(relevant)}"
    try:
        data = provider.complete_json(briefing_system_prompt(prompt_style), user, BRIEFING_SCHEMA, max_tokens)
    except Exception as e:
        log.error("브리핑 생성 실패: %s", str(e)[:300])
        return None
    if not data or not data.get("briefing_ko"):
        return None
    return {k: clean_text(str(data.get(k, ""))) for k in ("headline_ko", "headline_en", "briefing_ko", "briefing_en")}
