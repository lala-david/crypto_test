"""백엔드 데이터 서비스 — DB(collector.db)에서 병합 사건·브리핑·통계·주소 조회를 계산해 API 에 제공.

캐시: incidents 테이블의 (건수, 최신 collected_at) 서명이 바뀌면 다시 계산한다. 수집기가 매시간 DB 를 갱신하면 자동 반영.
"""
from __future__ import annotations

import glob
import json
import os
import threading
from collections import Counter, defaultdict
from datetime import date, timedelta
from typing import Dict, List, Optional

from .crimial import CrimialHunter
from .dedupe import LLMJudge
from .merge import mark_followups, merge_incidents, normalize_name
from .models import INCIDENT_TYPE_KO, Incident
from .store import Store

LEGAL = {"sanctions_designation", "law_enforcement_action", "laundering_report"}


def inc_json(i: Incident, day: str) -> dict:
    return {
        "uid": i.uid, "day": day, "project": i.project or i.title, "title": i.title, "type": i.incident_type,
        "incident_date": i.incident_date, "published_at": i.published_at, "chains": i.chains,
        "amount_usd": i.amount_usd, "amount_text": i.amount_text,
        "background_ko": i.background_ko, "background_en": i.background_en,
        "attack_method_ko": i.attack_method_ko, "attack_method_en": i.attack_method_en,
        "summary_ko": i.summary_ko, "summary_en": i.summary_en, "fund_flow_ko": i.fund_flow_ko, "fund_flow_en": i.fund_flow_en,
        "actors": i.actors, "tags": i.tags[:12],
        "addresses": [{"chain": a.chain, "address": a.address, "role": a.role, "note": a.note} for a in i.addresses],
        "tx_hashes": i.tx_hashes[:30], "url": i.url, "source": i.source,
        "sources": [{"source": i.source, "url": i.url, "title": i.title}] + [
            {"source": m.get("source"), "url": m.get("url"), "title": m.get("title")} for m in i.merged_from],
        "followup_of": i.followup_of, "blacklist_hits": len(i.blacklist_hits),
        "blacklist_detail": {k: v for k, v in list(i.blacklist_hits.items())[:20]}, "enriched": i.enriched,
    }


class DataService:
    def __init__(self, root: str, cfg: dict):
        self.root = root
        self.cfg = cfg
        self.data_dir = os.path.join(root, cfg.get("data_dir", "data"))
        self.store = Store(self.data_dir)
        self.crimial = CrimialHunter(cfg.get("crimial_hunter") or {}, root)
        self._lock = threading.Lock()
        self._sig = None
        self.incidents: List[dict] = []      # 병합 사건(전체), 최신 먼저
        self.by_uid: Dict[str, dict] = {}
        self.briefings: List[dict] = []
        self.meta: dict = {}

    # ---- 캐시 갱신 -------------------------------------------------------
    def _signature(self):
        r = self.store.conn.execute("SELECT COUNT(*), MAX(collected_at) FROM incidents").fetchone()
        b = tuple(sorted(os.path.basename(p) + str(int(os.path.getmtime(p))) for p in glob.glob(os.path.join(self.data_dir, "briefings", "*.json"))))
        return (r[0], r[1], b)

    def refresh(self, force: bool = False) -> None:
        sig = self._signature()
        if not force and sig == self._sig:
            return
        with self._lock:
            if not force and sig == self._sig:
                return
            judge = LLMJudge(None, self.store)  # 캐시된 판정만 사용
            days = [r[0] for r in self.store.conn.execute(
                "SELECT DISTINCT substr(collected_at,1,10) d FROM incidents WHERE relevant=1 ORDER BY d")]
            history: List[Incident] = []
            merged_all: List[dict] = []
            per_day: Dict[str, List[Incident]] = {}
            for d in days:
                merged = [i for i in merge_incidents(self.store.incidents_collected_on(d), judge) if i.relevant]
                mark_followups(merged, history, judge)
                for i in merged:
                    i.blacklist_hits = self.crimial.hits(i.addresses)
                per_day[d] = merged
                history = history + merged
                merged_all += [inc_json(i, d) for i in merged]
            merged_all.sort(key=lambda r: (r["day"], r["incident_date"] or ""), reverse=True)
            briefings = []
            for p in sorted(glob.glob(os.path.join(self.data_dir, "briefings", "*.json"))):
                d = os.path.basename(p)[:-5]
                with open(p, encoding="utf-8") as f:
                    b = json.load(f)
                lst = per_day.get(d, [])
                briefings.append({"day": d, **{k: b.get(k, "") for k in ("headline_ko", "headline_en", "briefing_ko", "briefing_en")},
                                  "relevant": len(lst), "followups": sum(1 for i in lst if i.followup_of),
                                  "amount_usd": sum(i.amount_usd or 0 for i in lst)})
            briefings.sort(key=lambda b: b["day"], reverse=True)
            run = self.store.conn.execute("SELECT run_at, collected, new_items FROM runs ORDER BY run_at DESC LIMIT 1").fetchone()
            src_runs = [dict(r) for r in self.store.conn.execute("SELECT name, last_run_at, last_count FROM source_runs ORDER BY last_run_at DESC")]
            self.incidents, self.by_uid, self.briefings = merged_all, {r["uid"]: r for r in merged_all}, briefings
            self.meta = {
                "generated_at": (run[0] if run else sig[1]) or "", "days": len(days), "first_day": days[0] if days else None,
                "last_day": days[-1] if days else None, "incidents_total": len(merged_all),
                "addresses_total": self.store.conn.execute("SELECT COUNT(DISTINCT address) FROM addresses").fetchone()[0],
                "sdn_addresses": self.store.sdn_count(),
                "sources": sorted({s["source"] for r in merged_all for s in r["sources"] if s.get("source")}),
                "source_runs": src_runs, "last_run": dict(run) if run else None,
                "type_labels_ko": INCIDENT_TYPE_KO,
            }
            self._sig = sig

    # ---- 조회 -------------------------------------------------------------
    def _range(self, days: Optional[str], from_: Optional[str], to: Optional[str]):
        last = self.meta.get("last_day") or date.today().isoformat()
        if from_ or to:
            return from_ or "0000-00-00", to or "9999-99-99"
        if not days or days == "all":
            return "0000-00-00", "9999-99-99"
        start = (date.fromisoformat(last) - timedelta(days=int(days) - 1)).isoformat()
        return start, "9999-99-99"

    def filter(self, days=None, from_=None, to=None, type_=None, chain=None, source=None, q=None, hide_followups=False) -> List[dict]:
        self.refresh()
        lo, hi = self._range(days, from_, to)
        ql = (q or "").strip().lower()
        out = []
        for r in self.incidents:
            if not (lo <= r["day"] <= hi):
                continue
            if type_ and r["type"] != type_:
                continue
            if chain and not any(c.lower() == chain.lower() for c in r["chains"]):
                continue
            if source and not any(s["source"] == source for s in r["sources"]):
                continue
            if hide_followups and r["followup_of"]:
                continue
            if ql:
                hay = " ".join([r["project"], r["title"], *r["actors"], *r["tags"], *r["chains"], r["summary_ko"], r["summary_en"],
                                r["attack_method_ko"], *[a["address"] for a in r["addresses"]], *r["tx_hashes"]]).lower()
                if ql not in hay:
                    continue
            out.append(r)
        return out

    def facets(self, rows: List[dict]) -> dict:
        return {
            "types": dict(Counter(r["type"] for r in rows).most_common()),
            "chains": dict(Counter(c for r in rows for c in r["chains"]).most_common()),
            "sources": dict(Counter(s["source"] for r in rows for s in r["sources"] if s.get("source")).most_common()),
        }

    def stats(self, rows: List[dict]) -> dict:
        daily: Dict[str, dict] = defaultdict(lambda: {"count": 0, "amount": 0.0, "legal": 0, "new": 0})
        if rows:
            d0, d1 = min(r["day"] for r in rows), max(r["day"] for r in rows)
            d = date.fromisoformat(d0)
            while d <= date.fromisoformat(d1):
                daily[d.isoformat()]
                d += timedelta(days=1)
        by_type: Dict[str, dict] = defaultdict(lambda: {"count": 0, "amount": 0.0})
        by_chain: Dict[str, dict] = defaultdict(lambda: {"count": 0, "amount": 0.0})
        roles: Counter = Counter()
        for r in rows:
            dd = daily[r["day"]]
            dd["count"] += 1
            dd["amount"] += r["amount_usd"] or 0
            dd["legal"] += 1 if r["type"] in LEGAL else 0
            dd["new"] += 0 if r["followup_of"] else 1
            by_type[r["type"]]["count"] += 1
            by_type[r["type"]]["amount"] += r["amount_usd"] or 0
            for c in r["chains"][:1]:
                by_chain[c]["count"] += 1
                by_chain[c]["amount"] += r["amount_usd"] or 0
            for a in r["addresses"]:
                roles[a["role"]] += 1
        top = sorted([r for r in rows if r["amount_usd"]], key=lambda r: -r["amount_usd"])[:5]
        return {
            "total_count": len(rows), "total_amount": sum(r["amount_usd"] or 0 for r in rows),
            "new_count": sum(1 for r in rows if not r["followup_of"]), "followup_count": sum(1 for r in rows if r["followup_of"]),
            "addresses": len({a["address"].lower() for r in rows for a in r["addresses"]}),
            "daily": [{"day": k, **v} for k, v in sorted(daily.items())],
            "by_type": sorted([{"key": k, **v} for k, v in by_type.items()], key=lambda x: -x["amount"]),
            "by_chain": sorted([{"key": k, **v} for k, v in by_chain.items()], key=lambda x: -x["amount"]),
            "roles": dict(roles.most_common()),
            "top": [{"uid": r["uid"], "project": r["project"], "amount_usd": r["amount_usd"], "day": r["day"], "incident_date": r["incident_date"]} for r in top],
        }

    def related(self, r: dict, limit: int = 8) -> List[dict]:
        key = normalize_name(r["project"])
        addrs = {a["address"].lower() for a in r["addresses"] if a["role"] in ("attacker", "laundering", "sanctioned")}
        out = []
        for o in self.incidents:
            if o["uid"] == r["uid"]:
                continue
            ok = (o.get("followup_of") or {}).get("uid") == r["uid"] or (r.get("followup_of") or {}).get("uid") == o["uid"]
            if not ok and key and len(key) >= 3:
                ko = normalize_name(o["project"])
                ok = ko == key or ko.startswith(key) or key.startswith(ko)
            if not ok and addrs:
                ok = any(a["address"].lower() in addrs and a["role"] in ("attacker", "laundering", "sanctioned") for a in o["addresses"])
            if ok:
                out.append({k: o[k] for k in ("uid", "project", "day", "incident_date", "type", "amount_usd", "chains", "source")})
            if len(out) >= limit:
                break
        return out

    def lookup_address(self, q: str) -> dict:
        self.refresh()
        qn = q.strip()
        ql = qn.lower()
        matches = []
        for r in self.incidents:
            for a in r["addresses"]:
                if a["address"].lower() == ql or (len(ql) >= 6 and ql in a["address"].lower()):
                    matches.append({**a, "incident": {k: r[k] for k in ("uid", "project", "day", "incident_date", "type", "amount_usd", "chains")}})
        sdn = [dict(x) for x in self.store.conn.execute(
            "SELECT chain, address, entity_uid, entity_name, programs, first_seen_at FROM sdn_snapshot WHERE lower(address)=? OR (length(?)>=6 AND instr(lower(address), ?)>0) LIMIT 50",
            (ql, ql, ql))]
        bl = None
        if self.crimial.enabled and qn:
            from .models import Address
            hits = self.crimial.hits([Address(chain="", address=qn)])
            bl = hits.get(qn)
            if not bl and qn.startswith("0x"):
                bl = hits.get(qn.lower()) or self.crimial.hits([Address(chain="", address=qn.lower())]).get(qn.lower())
        return {"query": qn, "matches": matches[:200], "sdn": sdn, "blacklist": bl, "found": bool(matches or sdn or bl)}

    def suggest(self, q: str, limit: int = 10) -> dict:
        self.refresh()
        ql = q.strip().lower()
        projects = []
        seen = set()
        for r in self.incidents:
            if ql in r["project"].lower() and r["project"] not in seen:
                seen.add(r["project"])
                projects.append({"uid": r["uid"], "project": r["project"], "day": r["day"]})
            if len(projects) >= limit:
                break
        return {"projects": projects}
