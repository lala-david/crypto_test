"""정적 사이트 데이터 내보내기 (docs/data/*.json) — docs/index.html 이 fetch 해서 그린다.

incidents.json  : 최근 N일(기본 90)의 병합 사건 (날짜별 규칙+캐시 판정 병합, 후속 표시 포함)
all.json        : 전체 기간 사건의 요약 필드만(목록·통계용 slim). 상세는 archive/YYYY-MM.json 에서 가져온다
addresses.json  : 전체 지갑 주소(주소·체인·역할·사건 요약) — 정적 배포에서 지갑 주소 페이지용
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

from .merge import consensus_amount, mark_followups, merge_incidents
from .service import norm_chain, norm_chains
from .models import Incident


_labels = lambda _addr: {}   # export_site 안에서 addrcheck 결과 함수로 교체된다


def _inc_json(i: Incident, day: str) -> dict:
    return {
        "uid": i.uid, "day": day, "project": i.project or i.title, "title": i.title, "type": i.incident_type,
        "incident_date": i.incident_date, "published_at": i.published_at, "chains": norm_chains(i.chains),
        "amount_usd": i.amount_usd, "amount_text": i.amount_text,
        "background_ko": i.background_ko, "background_en": i.background_en,
        "attack_method_ko": i.attack_method_ko, "attack_method_en": i.attack_method_en,
        "summary_ko": i.summary_ko, "summary_en": i.summary_en,
        "fund_flow_ko": i.fund_flow_ko, "fund_flow_en": i.fund_flow_en,
        "actors": i.actors, "tags": i.tags[:12],
        "addresses": [{"chain": norm_chain(a.chain) or a.chain, "address": a.address, "role": a.role, "note": a.note, **_labels(a.address)} for a in i.addresses],
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

    # 원 사건 + 후속 보도의 금액을 출처 합의로 정한다(service.refresh 와 같은 규칙) — 정적 스냅샷도 대시보드와 같은 값이 되게.
    originals = {i.uid: i for lst in merged_by_day.values() for i in lst}
    follows: Dict[str, List[Incident]] = defaultdict(list)
    for lst in merged_by_day.values():
        for i in lst:
            uid = (i.followup_of or {}).get("uid")
            if uid in originals:
                follows[uid].append(i)
    for uid, fl in follows.items():
        o = originals[uid]
        cons = consensus_amount([o] + fl)
        if cons and cons[0] and cons[0] != o.amount_usd:
            o.amount_usd, o.amount_text = cons[0], (cons[1] or o.amount_text)

    cutoff = (date.today() - timedelta(days=recent_days)).isoformat()
    recent, by_month = [], defaultdict(list)
    for d, lst in merged_by_day.items():
        for i in lst:
            rec = _inc_json(i, d)
            by_month[d[:7]].append(rec)
            if d >= cutoff:
                recent.append(rec)
    # 전체 기간 slim: 목록·통계·차트가 쓰는 필드만(상세는 월별 아카이브에서)
    # addrcheck 결과(data/address_labels.json)를 붙여 정적 스냅샷에서도 종류·라벨이 보이게 한다
    try:
        from .addrcheck import AddrChecker, kind_text
        with open(os.path.join(store.data_dir, "address_labels.json"), encoding="utf-8") as f:
            addr_labels = json.load(f)
    except Exception:
        addr_labels, AddrChecker, kind_text = {}, None, None

    def label_of(address: str) -> dict:
        if not addr_labels or AddrChecker is None:
            return {}
        x = addr_labels.get(AddrChecker.key(address)) or {}
        if not x:
            return {}
        return {"kind": x.get("kind") or "", "ctype": x.get("ctype") or "", "kind_text": kind_text(x),
                "label": x.get("label") or "", "tx_count": x.get("tx_count"), "delegated": x.get("delegated") or "",
                "scam": bool(x.get("scam")), "verified": bool(x.get("verified"))}

    global _labels
    _labels = label_of
    slim = []
    addr_rows = []
    for d, lst in merged_by_day.items():
        for i in lst:
            slim.append({
                "uid": i.uid, "day": d, "event_date": i.incident_date or d, "project": i.project or i.title,
                "type": i.incident_type, "incident_date": i.incident_date, "chains": norm_chains(i.chains),
                "amount_usd": i.amount_usd, "amount_text": i.amount_text, "source": i.source,
                "src_count": 1 + len(i.merged_from), "addr_count": len(i.addresses),
                "blacklist_hits": len(i.blacklist_hits), "followup_of": i.followup_of, "month": d[:7],
            })
            for a in i.addresses:
                addr_rows.append({"address": a.address, "chain": norm_chain(a.chain) or a.chain, "role": a.role, "note": a.note,
                                  "uid": i.uid, "project": i.project or i.title, "type": i.incident_type,
                                  "day": d, "event_date": i.incident_date or d,
                                  "blacklist": bool((i.blacklist_hits or {}).get(a.address)), **label_of(a.address)})
    slim.sort(key=lambda r: (r["event_date"] or r["day"]), reverse=True)
    with open(os.path.join(data_dir, "all.json"), "w", encoding="utf-8") as f:
        json.dump(slim, f, ensure_ascii=False)
    with open(os.path.join(data_dir, "addresses.json"), "w", encoding="utf-8") as f:
        json.dump(addr_rows, f, ensure_ascii=False)

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
        "slim_total": len(slim), "addresses_rows": len(addr_rows),
        "recent_days": recent_days,
    }
    with open(os.path.join(data_dir, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False)
    return meta
