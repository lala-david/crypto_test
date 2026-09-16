"""정적 사이트 데이터 내보내기 (docs/data/*.json) — docs/index.html 이 fetch 해서 그린다.

incidents.json  : 최근 N일(기본 90)의 병합 사건 (날짜별 규칙+캐시 판정 병합, 후속 표시 포함)
archive/YYYY-MM.json : 월별 전체 (오래된 달은 사이트가 필요할 때만 로드)
briefings.json  : 날짜별 브리핑(한/영) + 건수
meta.json       : 생성 시각, 누적 통계, 소스 목록
"""
from __future__ import annotations

import glob
import json
import os
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional

from .merge import mark_followups, merge_incidents
from .models import Incident


def _inc_json(i: Incident, day: str) -> dict:
    return {
        "uid": i.uid, "day": day, "project": i.project or i.title, "title": i.title, "type": i.incident_type,
        "incident_date": i.incident_date, "published_at": i.published_at, "chains": i.chains,
        "amount_usd": i.amount_usd, "amount_text": i.amount_text,
        "background_ko": i.background_ko, "background_en": i.background_en,
        "attack_method_ko": i.attack_method_ko, "attack_method_en": i.attack_method_en,
        "summary_ko": i.summary_ko, "summary_en": i.summary_en,
        "fund_flow_ko": i.fund_flow_ko, "fund_flow_en": i.fund_flow_en,
        "actors": i.actors, "tags": i.tags[:12],
        "addresses": [{"chain": a.chain, "address": a.address, "role": a.role, "note": a.note} for a in i.addresses],
        "tx_hashes": i.tx_hashes[:20], "url": i.url, "source": i.source,
        "sources": [{"source": i.source, "url": i.url, "title": i.title}] + [
            {"source": m.get("source"), "url": m.get("url"), "title": m.get("title")} for m in i.merged_from],
        "followup_of": i.followup_of, "blacklist_hits": len(i.blacklist_hits), "enriched": i.enriched,
    }


def export_site(store, docs_dir: str, recent_days: int = 90, judge=None, crimial=None) -> dict:
    data_dir = os.path.join(docs_dir, "data")
    os.makedirs(os.path.join(data_dir, "archive"), exist_ok=True)

    days = [r[0] for r in store.conn.execute(
        "SELECT DISTINCT substr(collected_at,1,10) d FROM incidents WHERE relevant=1 ORDER BY d")]
    merged_by_day: Dict[str, List[Incident]] = {}
    history: List[Incident] = []
    for d in days:
        merged = [i for i in merge_incidents(store.incidents_collected_on(d), judge) if i.relevant]
        mark_followups(merged, history, judge)
        if crimial is not None:
            for i in merged:
                i.blacklist_hits = crimial.hits(i.addresses)
        merged_by_day[d] = merged
        history = history + merged

    cutoff = (date.today() - timedelta(days=recent_days)).isoformat()
    recent, by_month = [], defaultdict(list)
    for d, lst in merged_by_day.items():
        for i in lst:
            rec = _inc_json(i, d)
            by_month[d[:7]].append(rec)
            if d >= cutoff:
                recent.append(rec)
    recent.sort(key=lambda r: (r["day"], r["incident_date"] or ""), reverse=True)
    with open(os.path.join(data_dir, "incidents.json"), "w", encoding="utf-8") as f:
        json.dump(recent, f, ensure_ascii=False)
    for month, lst in by_month.items():
        with open(os.path.join(data_dir, "archive", f"{month}.json"), "w", encoding="utf-8") as f:
            json.dump(lst, f, ensure_ascii=False)

    briefings = []
    for p in sorted(glob.glob(os.path.join(store.data_dir, "briefings", "*.json"))):
        d = os.path.basename(p)[:-5]
        with open(p, encoding="utf-8") as f:
            b = json.load(f)
        lst = merged_by_day.get(d, [])
        briefings.append({"day": d, **{k: b.get(k, "") for k in ("headline_ko", "headline_en", "briefing_ko", "briefing_en")},
                          "relevant": len(lst), "followups": sum(1 for i in lst if i.followup_of),
                          "amount_usd": sum(i.amount_usd or 0 for i in lst)})
    briefings.sort(key=lambda b: b["day"], reverse=True)
    with open(os.path.join(data_dir, "briefings.json"), "w", encoding="utf-8") as f:
        json.dump(briefings, f, ensure_ascii=False)

    all_inc = [i for lst in merged_by_day.values() for i in lst]
    meta = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "days": len(days), "first_day": days[0] if days else None, "last_day": days[-1] if days else None,
        "incidents_total": len(all_inc),
        "addresses_total": store.conn.execute("SELECT COUNT(DISTINCT address) FROM addresses").fetchone()[0],
        "sdn_addresses": store.sdn_count(),
        "sources": sorted({i.source for i in all_inc} | {m.get("source") for i in all_inc for m in i.merged_from if m.get("source")}),
        "months": sorted(by_month.keys()),
        "recent_days": recent_days,
    }
    with open(os.path.join(data_dir, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False)
    return meta
