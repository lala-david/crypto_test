"""DeFiLlama hacks API — 구조화된 사고 목록(주소 없음, 날짜·금액·수법 정확)."""
from __future__ import annotations

from typing import List

from ..models import RawItem
from .base import Source, SourceContext, to_date_str

URL = "https://api.llama.fi/hacks"

_CLASS_MAP = {
    "key compromise": "private_key_compromise",
    "rugpull": "rug_pull",
    "rug pull": "rug_pull",
    "phishing": "phishing_social_engineering",
    "social engineering": "phishing_social_engineering",
}


class DefiLlamaSource(Source):
    name = "defillama"

    def collect(self, ctx: SourceContext) -> List[RawItem]:
        data = ctx.http.get_json(URL)
        items: List[RawItem] = []
        for r in data:
            d = to_date_str(r.get("date"))
            if not d or d < ctx.since.isoformat():
                continue
            cls = (r.get("classification") or "").strip()
            tech = (r.get("technique") or "").strip()
            itype = "hack_exploit"
            for k, v in _CLASS_MAP.items():
                if k in cls.lower() or k in tech.lower():
                    itype = v
            amount = r.get("amount")
            structured = {
                "name": r.get("name"),
                "incident_date": d,
                "amount_usd": amount,
                "chains": r.get("chain") or [],
                "classification": cls,
                "technique": tech,
                "target_type": r.get("targetType"),
                "bridge_hack": r.get("bridgeHack"),
                "returned_funds": r.get("returnedFunds"),
                "language": r.get("language"),
                "attack_method": f"{cls} — {tech}".strip(" —"),
                "summary": f"DeFiLlama: {r.get('name')} ({', '.join(r.get('chain') or [])}) — {cls} / {tech}, 손실 ${(amount or 0):,.0f}"
                           + (f", 회수 ${r.get('returnedFunds'):,.0f}" if r.get("returnedFunds") else ""),
                "incident_type": itype,
            }
            src_url = (r.get("source") or "").strip()
            items.append(
                RawItem(
                    source=self.name,
                    source_id=f"{r.get('name')}|{d}",
                    url=src_url if src_url.startswith("http") else "https://defillama.com/hacks",
                    title=f"{r.get('name')} — {cls}" + (f" ({tech})" if tech else ""),
                    published_at=d, text="", structured=structured, tags=[t for t in (cls, tech) if t],
                    needs_llm=False,
                )
            )
        ctx.log.info("defillama: 전체 %d건 중 기간 내 %d건", len(data), len(items))
        return items
