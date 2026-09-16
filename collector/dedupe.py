"""LLM 판정: 두 사건 카드가 같은 사건인가. 결정은 DB(merge_decisions)에 캐시해 매시간 재질문하지 않는다."""
from __future__ import annotations

import json
import logging
from typing import Optional

from .llm import LLMProvider
from .models import Incident
from .prompts import DEDUPE_SYSTEM

log = logging.getLogger("collector.dedupe")

SCHEMA = {
    "type": "object",
    "properties": {
        "same": {"type": "boolean"},
        "confidence": {"type": "number"},
        "evidence": {"type": "string"},
        "reason": {"type": "string"},
    },
    "required": ["same", "confidence", "evidence", "reason"],
    "additionalProperties": False,
}
MIN_CONFIDENCE = 0.8


def _digest(i: Incident) -> dict:
    return {
        "project": i.project or i.title, "title": i.title, "type": i.incident_type, "incident_date": i.incident_date,
        "published_at": i.published_at, "chains": i.chains, "amount_usd": i.amount_usd, "amount_text": i.amount_text,
        "summary": (i.summary_ko or i.summary_en)[:600], "actors": i.actors[:5], "source": i.source, "url": i.url,
        "addresses": [a.address for a in i.addresses[:5]],
    }


class LLMJudge:
    def __init__(self, provider: Optional[LLMProvider], store, max_calls: int = 40):
        self.provider = provider
        self.store = store
        self.max_calls = max_calls
        self.calls = 0

    def __call__(self, a: Incident, b: Incident) -> Optional[bool]:
        key = tuple(sorted((a.uid, b.uid)))
        cached = self.store.merge_decision(*key)
        if cached is not None:
            return cached
        if self.provider is None or self.calls >= self.max_calls:
            return None
        self.calls += 1
        user = "카드 A:\n" + json.dumps(_digest(a), ensure_ascii=False) + "\n\n카드 B:\n" + json.dumps(_digest(b), ensure_ascii=False)
        try:
            out = self.provider.complete_json(DEDUPE_SYSTEM, user, SCHEMA, 400)
        except Exception as e:
            log.warning("중복 판정 호출 실패: %s", str(e)[:200])
            return None
        if not out or "same" not in out:
            return None
        try:
            conf = float(out.get("confidence", 0))
        except (TypeError, ValueError):
            conf = 0.0
        same = bool(out["same"]) and conf >= MIN_CONFIDENCE   # 확신 낮은 '같음'은 채택하지 않음
        note = f"conf={conf:.2f} | {str(out.get('evidence', ''))[:120]} | {str(out.get('reason', ''))[:120]}"
        self.store.set_merge_decision(key[0], key[1], same, note[:300])
        log.info("중복 판정: %s ↔ %s → %s (%s)", (a.project or a.title)[:30], (b.project or b.title)[:30], same, note[:140])
        return same
