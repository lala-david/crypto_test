"""ChainLight Lumos (lumos.chainlight.io) — Next.js RSC 페이로드에 박힌 사고 목록(공격자 주소·tx 포함)."""
from __future__ import annotations

import json
import re
from typing import List

from ..models import Address, RawItem
from .base import Source, SourceContext, to_date_str

URL = "https://lumos.chainlight.io/"

_ROLE_MAP = {
    "attackeraddress": "attacker",
    "attacker": "attacker",
    "address": "unknown",
    "victimaddress": "victim",
    "victim": "victim",
}


def parse_project_summaries(html: str) -> list:
    chunks = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html, flags=re.S)
    blob = "".join(chunks).encode("utf-8").decode("unicode_escape", errors="ignore")
    i = blob.find('"projectSummaries":')
    if i < 0:
        return []
    start = blob.index("[", i)
    depth = 0
    for j in range(start, len(blob)):
        c = blob[j]
        if c == "[":
            depth += 1
        elif c == "]":
            depth -= 1
            if depth == 0:
                return json.loads(blob[start : j + 1])
    return []


class LumosSource(Source):
    name = "lumos"

    def collect(self, ctx: SourceContext) -> List[RawItem]:
        html = ctx.http.get_text(URL)
        records = parse_project_summaries(html)
        items: List[RawItem] = []
        for r in records:
            hacked = to_date_str(r.get("hackedAt"))
            ef = r.get("exploitedFund") or {}
            updated = to_date_str(ef.get("lastUpdatedAt"))
            if max(hacked, updated) < ctx.since.isoformat():
                continue
            addrs: List[Address] = []
            txs: List[str] = []
            for l in ef.get("links") or []:
                slug = ((l.get("type") or {}).get("slug") or "").lower()
                val = (l.get("value") or "").strip()
                if not val:
                    continue
                if "tx" in slug:
                    txs.append(val)
                else:
                    from ..addresses import infer_chain

                    addrs.append(Address(chain=infer_chain(val), address=val, role=_ROLE_MAP.get(slug, "unknown"),
                                         note=f"Lumos {slug}"))
            cat = (r.get("category") or {}).get("name", "")
            cat2 = (r.get("category2") or {}).get("name", "")
            structured = {
                "name": r.get("name"),
                "incident_date": hacked,
                "amount_usd": r.get("amount"),
                "attack_vector": cat,
                "project_category": cat2,
                "destinations": ef.get("destinations") or [],
                "destinations2": ef.get("destinations2") or [],
                "lumos_score": r.get("score"),
                "attack_method": f"{cat}" + (f" / {cat2}" if cat2 else ""),
                "fund_flow": ", ".join(ef.get("destinations") or []),
                "summary": f"Lumos DB: {r.get('name')} — {cat} ({cat2}), 손실 ${(r.get('amount') or 0):,.0f}, 자금 행선지: {', '.join(ef.get('destinations') or []) or '미상'}",
                "incident_type": "rug_pull" if "rug" in cat.lower() else ("private_key_compromise" if "key" in cat.lower() or "hijack" in cat.lower() else "hack_exploit"),
            }
            items.append(
                RawItem(
                    source=self.name, source_id=r.get("slug") or r.get("name"), url=URL + "?q=" + (r.get("slug") or ""),
                    title=f"{r.get('name')} — {cat}", published_at=updated or hacked, text="",
                    structured=structured, addresses=addrs, tx_hashes=txs, tags=[t for t in (cat, cat2) if t],
                    needs_llm=False,
                )
            )
        ctx.log.info("lumos: 전체 %d건 중 기간 내 %d건", len(records), len(items))
        return items
