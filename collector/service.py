"""백엔드 데이터 서비스 — DB(collector.db)에서 병합 사건·브리핑·통계·주소 조회를 계산해 API 에 제공.

캐시: incidents 테이블의 (건수, 최신 collected_at) 서명이 바뀌면 다시 계산한다. 수집기가 매시간 DB 를 갱신하면 자동 반영.

집계 규칙(데이터 검토 2026-09-18 반영):
- 후속 보도(followup_of)는 '전체 건수'에만 들어가고, 금액 합계·비중·순위·평균·유형/체인 신규 건수에서는 제외한다.
- 후속 보도가 더 큰 금액을 보고하면 원 사건의 금액을 갱신한다(amount_revised_from).
- 체인은 첫 번째(대표) 체인 기준으로 묶고, 체인이 없는 사건은 "unknown" 버킷으로 남겨 Σ 가 전체와 맞게 한다. 체인 이름은 별칭을 정규화한다.
- 주소는 (EVM 은 소문자, 그 외는 원문) 기준으로 중복을 제거하고 역할은 우선순위(sanctioned > attacker > laundering > victim > unknown)로 하나만 남긴다.
- 출처는 URL 기준으로 중복 제거하고, 소스별 집계는 사건당 한 번만 센다(커버리지).
- 금액은 '피해(공격 계열)'와 '제재·수사 금액(법집행 계열)'을 따로 낸다.
"""
from __future__ import annotations

import glob
import json
import os
import re
import threading
from collections import Counter, defaultdict
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

from .addrcheck import AddrChecker, kind_text
from .crimial import CrimialHunter
from .dedupe import LLMJudge
from .merge import mark_followups, merge_incidents, normalize_name
from .models import INCIDENT_TYPE_KO, Address, Incident
from .store import Store

LEGAL = {"sanctions_designation", "law_enforcement_action", "laundering_report"}
ROLE_PRIORITY = {"sanctioned": 0, "attacker": 1, "laundering": 2, "victim": 3, "unknown": 4}
CHAIN_ALIAS = {
    "tron": "Tron", "trx": "Tron", "eth": "Ethereum", "ether": "Ethereum", "ethereum mainnet": "Ethereum",
    "bsc": "BSC", "bnb chain": "BSC", "bnb smart chain": "BSC", "binance smart chain": "BSC", "binance chain": "BSC",
    "liquid network": "Liquid", "btc": "Bitcoin", "sol": "Solana", "matic": "Polygon", "polygon pos": "Polygon",
    "arb": "Arbitrum", "arbitrum one": "Arbitrum", "op": "Optimism", "avax": "Avalanche", "avalanche c-chain": "Avalanche",
    # 표시 이름의 대소문자 변형(과거 merge_addresses 가 대문자로 저장한 값 포함)
    "ethereum": "Ethereum", "bitcoin": "Bitcoin", "solana": "Solana", "polygon": "Polygon", "arbitrum": "Arbitrum", "optimism": "Optimism",
    "avalanche": "Avalanche", "base": "Base", "hyperevm": "HyperEVM", "hyperliquid": "HyperEVM", "cronos": "Cronos", "sonic": "Sonic", "linea": "Linea",
    "monero": "Monero", "xmr": "Monero", "osmosis": "Osmosis", "nomic": "Nomic", "noble": "Noble", "axelar": "Axelar", "cosmos": "Cosmos", "starknet": "Starknet",
}


def norm_chain(c: str) -> str:
    return CHAIN_ALIAS.get((c or "").strip().lower(), (c or "").strip())


def norm_chains(chains: List[str]) -> List[str]:
    out: List[str] = []
    for c in chains or []:
        n = norm_chain(c)
        if n and n not in out:
            out.append(n)
    return out


def addr_key(a: Address) -> str:
    """EVM(0x…)과 bech32(bc1/ltc1/tb1…)는 대소문자 구분이 없으므로 소문자로 비교한다."""
    s = a.address.strip()
    low = s.lower()
    return low if (low.startswith("0x") or low.startswith(("bc1", "tb1", "ltc1", "bnb1", "cosmos1", "osmo1"))) else s


def dedupe_addresses(addresses: List[Address]) -> List[Address]:
    """같은 주소(EVM 소문자 기준)는 하나로. 역할은 우선순위가 높은 것, 체인 표기는 첫 것, 다른 체인 표기는 note 에 남긴다."""
    seen: Dict[str, Address] = {}
    order: List[str] = []
    for a in addresses:
        k = addr_key(a)
        if k not in seen:
            seen[k] = Address(chain=norm_chain(a.chain) or a.chain, address=a.address, role=a.role or "unknown", note=a.note or "")
            order.append(k)
            continue
        cur = seen[k]
        if ROLE_PRIORITY.get(a.role, 9) < ROLE_PRIORITY.get(cur.role, 9):
            cur.role = a.role
        nc = norm_chain(a.chain)
        if nc and nc != cur.chain and nc not in cur.note:
            cur.note = (cur.note + (" · " if cur.note else "") + nc).strip()
        if a.note and a.note not in cur.note:
            cur.note = (cur.note + (" · " if cur.note else "") + a.note).strip()
    return [seen[k] for k in order]


def inc_json(i: Incident, day: str) -> dict:
    addrs = dedupe_addresses(i.addresses)
    srcs, seen_urls = [], set()
    for s in [{"source": i.source, "url": i.url, "title": i.title}] + [
            {"source": m.get("source"), "url": m.get("url"), "title": m.get("title")} for m in i.merged_from]:
        u = (s.get("url") or "").split("?")[0].rstrip("/")
        if u in seen_urls:
            continue
        seen_urls.add(u)
        srcs.append(s)
    legal = i.incident_type in LEGAL
    pub = (i.published_at or "")[:10] if re.match(r"^\d{4}-\d{2}-\d{2}", i.published_at or "") else ""
    event_date = (pub or i.incident_date or day) if legal else (i.incident_date or pub or day)
    return {
        "uid": i.uid, "day": day, "event_date": event_date, "project": i.project or i.title, "title": i.title, "type": i.incident_type,
        "incident_date": i.incident_date, "published_at": i.published_at, "chains": norm_chains(i.chains),
        "amount_usd": i.amount_usd, "amount_text": i.amount_text, "amount_revised_from": getattr(i, "_amount_revised_from", None),
        "background_ko": i.background_ko, "background_en": i.background_en,
        "attack_method_ko": i.attack_method_ko, "attack_method_en": i.attack_method_en,
        "summary_ko": i.summary_ko, "summary_en": i.summary_en, "fund_flow_ko": i.fund_flow_ko, "fund_flow_en": i.fund_flow_en,
        "actors": i.actors, "tags": i.tags[:12],
        "addresses": [{"chain": a.chain, "address": a.address, "role": a.role, "note": a.note} for a in addrs],
        "tx_hashes": i.tx_hashes[:30], "url": i.url, "source": i.source, "sources": srcs,
        "followup_of": i.followup_of, "blacklist_hits": len(i.blacklist_hits),
        "blacklist_detail": {k: v for k, v in list(i.blacklist_hits.items())[:20]}, "enriched": i.enriched,
        "legal": legal,
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
        # 건수 · 최신 수집시각 · json 총 길이(재검증으로 내용만 바뀐 경우 감지)
        r = self.store.conn.execute("SELECT COUNT(*), MAX(collected_at), SUM(length(json)) FROM incidents").fetchone()
        b = tuple(sorted(os.path.basename(p) + str(int(os.path.getmtime(p))) for p in glob.glob(os.path.join(self.data_dir, "briefings", "*.json"))))
        lp = os.path.join(self.data_dir, "address_labels.json")
        return (r[0], r[1], r[2], b, int(os.path.getmtime(lp)) if os.path.exists(lp) else 0)

    def _attach_address_labels(self, rows: List[dict]) -> None:
        """addrcheck 결과(address_labels.json)를 주소 dict 에 붙인다: kind(eoa/contract/wallet/…), ctype, kind_text, label, tx_count."""
        path = os.path.join(self.data_dir, "address_labels.json")
        labels: Dict[str, dict] = {}
        if os.path.exists(path):
            try:
                with open(path, encoding="utf-8") as f:
                    labels = json.load(f)
            except Exception:
                labels = {}
        self.address_labels = labels
        for r in rows:
            for a in r["addresses"]:
                x = labels.get(AddrChecker.key(a["address"]))
                if not x:
                    a.update(kind="", ctype="", kind_text="", label="", tx_count=None)
                    continue
                a.update(kind=x.get("kind") or "", ctype=x.get("ctype") or "", kind_text=kind_text(x), label=x.get("label") or "",
                         tx_count=x.get("tx_count"), symbol=x.get("symbol") or "", proxy=bool(x.get("proxy")), checked_at=(x.get("checked_at") or "")[:10])

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
            per_day: Dict[str, List[Incident]] = {}
            for d in days:
                merged = [i for i in merge_incidents(self.store.incidents_collected_on(d), judge) if i.relevant]
                mark_followups(merged, history, judge)
                for i in merged:
                    i.blacklist_hits = self.crimial.hits(i.addresses)
                per_day[d] = merged
                history = history + merged
            # 후속 보도의 금액 상향 → 원 사건 갱신
            originals: Dict[str, Incident] = {i.uid: i for lst in per_day.values() for i in lst}
            for lst in per_day.values():
                for i in lst:
                    if i.followup_of and i.amount_usd:
                        o = originals.get((i.followup_of or {}).get("uid"))
                        if o is not None and (o.amount_usd or 0) < i.amount_usd:
                            o._amount_revised_from = o.amount_usd  # type: ignore[attr-defined]
                            o.amount_usd = i.amount_usd
            merged_all: List[dict] = []
            for d in days:
                merged_all += [inc_json(i, d) for i in per_day[d]]
            merged_all.sort(key=lambda r: (r["day"], r["incident_date"] or ""), reverse=True)
            self._attach_address_labels(merged_all)
            briefings = []
            for p in sorted(glob.glob(os.path.join(self.data_dir, "briefings", "*.json"))):
                d = os.path.basename(p)[:-5]
                with open(p, encoding="utf-8") as f:
                    b = json.load(f)
                lst = per_day.get(d, [])
                base = [i for i in lst if not i.followup_of]
                briefings.append({"day": d, **{k: b.get(k, "") for k in ("headline_ko", "headline_en", "briefing_ko", "briefing_en")},
                                  "relevant": len(lst), "new": len(base), "followups": len(lst) - len(base),
                                  "amount_usd": sum(i.amount_usd or 0 for i in base)})
            briefings.sort(key=lambda b: b["day"], reverse=True)
            run = self.store.conn.execute("SELECT run_at, collected, new_items FROM runs ORDER BY run_at DESC LIMIT 1").fetchone()
            src_runs = [dict(r) for r in self.store.conn.execute("SELECT name, last_run_at, last_count FROM source_runs ORDER BY last_run_at DESC")]
            self.incidents, self.by_uid, self.briefings = merged_all, {r["uid"]: r for r in merged_all}, briefings
            self.meta = {
                "generated_at": (run[0] if run else sig[1]) or "", "days": len(days), "first_day": days[0] if days else None,
                "last_day": days[-1] if days else None, "incidents_total": len(merged_all),
                "first_event_day": min((r["event_date"] for r in merged_all if r.get("event_date")), default=None),
                "new_total": sum(1 for r in merged_all if not r["followup_of"]),
                "addresses_total": len({a["address"].lower() for r in merged_all for a in r["addresses"]}),
                "sdn_addresses": self.store.sdn_count(),
                "sources": sorted({s["source"] for r in merged_all for s in r["sources"] if s.get("source")}),
                "source_runs": src_runs, "last_run": dict(run) if run else None,
                "type_labels_ko": INCIDENT_TYPE_KO,
            }
            self._sig = sig

    # ---- 조회 -------------------------------------------------------------
    def range_bounds(self, days: Optional[str], from_: Optional[str], to: Optional[str]) -> Tuple[str, str]:
        """(시작일, 종료일) — 종료일은 마지막 수집일. 'all' 은 첫 수집일부터."""
        last = self.meta.get("last_day") or date.today().isoformat()
        first = min(self.meta.get("first_day") or last, self.meta.get("first_event_day") or last)
        if from_ or to:
            return (from_ or first), (to or last)
        if not days or days == "all":
            return first, last
        start = (date.fromisoformat(last) - timedelta(days=int(days) - 1)).isoformat()
        return start, last

    @staticmethod
    def date_key(r: dict, basis: str = "event") -> str:
        """집계 기준 날짜. event = 사건일(법집행은 발표일), collected = 수집일."""
        return r["day"] if basis == "collected" else (r.get("event_date") or r["day"])

    def filter(self, days=None, from_=None, to=None, type_=None, chain=None, source=None, q=None, hide_followups=False, basis: str = "event") -> List[dict]:
        self.refresh()
        lo, hi = self.range_bounds(days, from_, to)
        ql = (q or "").strip().lower()
        chain_n = norm_chain(chain).lower() if chain else ""
        out = []
        for r in self.incidents:
            if not (lo <= self.date_key(r, basis) <= hi):
                continue
            if type_ and r["type"] != type_:
                continue
            if chain_n and not any(c.lower() == chain_n for c in r["chains"]):
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
        """소스는 사건당 한 번만(커버리지). 체인은 사건이 언급한 모든 체인."""
        return {
            "types": dict(Counter(r["type"] for r in rows).most_common()),
            "chains": dict(Counter(c for r in rows for c in r["chains"]).most_common()),
            "sources": dict(Counter(s for r in rows for s in {x["source"] for x in r["sources"] if x.get("source")}).most_common()),
            "incidents": len(rows),
        }

    def stats(self, rows: List[dict], lo: Optional[str] = None, hi: Optional[str] = None, basis: str = "event") -> dict:
        base = [r for r in rows if not r["followup_of"]]
        known = [r for r in base if r["amount_usd"]]
        key = lambda r: self.date_key(r, basis)
        # 일별: 선택 기간 전체를 채운다(사건이 없던 날은 0)
        daily: Dict[str, dict] = defaultdict(lambda: {"count": 0, "new": 0, "amount": 0.0, "legal": 0, "addresses": 0})
        daily_addr: Dict[str, set] = defaultdict(set)
        if rows or (lo and hi):
            d0 = lo or min(key(r) for r in rows)
            d1 = hi or max(key(r) for r in rows)
            try:
                d = date.fromisoformat(d0)
                end = date.fromisoformat(d1)
            except ValueError:
                d, end = date.today(), date.today()
            if (end - d).days > 400:
                d = end - timedelta(days=400)
            while d <= end:
                daily[d.isoformat()]
                d += timedelta(days=1)
        by_type: Dict[str, dict] = defaultdict(lambda: {"count": 0, "new": 0, "known": 0, "amount": 0.0})
        by_chain: Dict[str, dict] = defaultdict(lambda: {"count": 0, "new": 0, "known": 0, "amount": 0.0})
        for r in rows:
            fresh = not r["followup_of"]
            amt = (r["amount_usd"] or 0) if fresh else 0
            has_amt = fresh and bool(r["amount_usd"])
            dd = daily[key(r)]
            dd["count"] += 1
            dd["new"] += 1 if fresh else 0
            dd["amount"] += amt
            dd["legal"] += 1 if r["type"] in LEGAL else 0
            daily_addr[key(r)].update(a["address"].lower() for a in r["addresses"])
            bt = by_type[r["type"]]
            bt["count"] += 1; bt["new"] += 1 if fresh else 0; bt["known"] += 1 if has_amt else 0; bt["amount"] += amt
            ck = r["chains"][0] if r["chains"] else "unknown"
            bc = by_chain[ck]
            bc["count"] += 1; bc["new"] += 1 if fresh else 0; bc["known"] += 1 if has_amt else 0; bc["amount"] += amt
        # 주소 역할: 주소 중복 제거 후 우선순위 역할 하나만
        best: Dict[str, str] = {}
        for r in rows:
            for a in r["addresses"]:
                k = a["address"].lower()
                if k not in best or ROLE_PRIORITY.get(a["role"], 9) < ROLE_PRIORITY.get(best[k], 9):
                    best[k] = a["role"]
        roles = Counter(best.values())
        for k, v in daily_addr.items():
            daily[k]["addresses"] = len(v)
        top = sorted(known, key=lambda r: -r["amount_usd"])[:10]
        loss = sum(r["amount_usd"] for r in known if r["type"] not in LEGAL)
        legal_amt = sum(r["amount_usd"] for r in known if r["type"] in LEGAL)
        collected_days = sum(1 for v in daily.values() if v["count"])
        return {
            "range": {"from": lo, "to": hi, "calendar_days": len(daily), "collected_days": collected_days, "basis": basis},
            "total_count": len(rows), "new_count": len(base), "followup_count": len(rows) - len(base),
            "known_amount_count": len(known), "unknown_amount_count": len(base) - len(known),
            "total_amount": loss + legal_amt, "loss_amount": loss, "legal_amount": legal_amt,
            "legal_count": sum(1 for r in base if r["type"] in LEGAL),
            "addresses": len(best),
            "daily": [{"day": k, **v} for k, v in sorted(daily.items())],
            "by_type": sorted([{"key": k, **v} for k, v in by_type.items()], key=lambda x: (-x["new"], -x["amount"])),
            "by_chain": sorted([{"key": k, **v} for k, v in by_chain.items()], key=lambda x: (-x["new"], -x["amount"])),
            "roles": dict(roles.most_common()),
            "top": [{"uid": r["uid"], "project": r["project"], "amount_usd": r["amount_usd"], "day": r["day"], "incident_date": r["incident_date"], "event_date": r["event_date"],
                     "type": r["type"], "legal": r["type"] in LEGAL, "chains": r["chains"][:1]} for r in top],
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
                out.append({k: o[k] for k in ("uid", "project", "day", "incident_date", "type", "amount_usd", "chains", "source", "followup_of")})
            if len(out) >= limit:
                break
        return out

    def list_addresses(self, days=None, from_=None, to=None, role=None, chain=None, q=None, basis: str = "event", limit: int = 5000, kind: str = "") -> dict:
        """기간 내 사건에서 수집한 지갑 주소 목록(주소당 1행, 사건 여러 개면 묶음). 후속 보도 카드도 포함(주소는 사실이므로)."""
        rows = self.filter(days, from_, to, basis=basis)
        seen: Dict[str, dict] = {}
        chain_n = norm_chain(chain).lower() if chain else ""
        ql = (q or "").strip().lower()
        for r in rows:
            for a in r["addresses"]:
                if role and a["role"] != role:
                    continue
                if chain_n and (a["chain"] or "").lower() != chain_n:
                    continue
                if kind and (a.get("kind") or "unchecked") != kind and not (kind == "contract" and a.get("kind") == "contract"):
                    continue
                if ql and ql not in a["address"].lower() and ql not in r["project"].lower():
                    continue
                k = a["address"].lower()
                if k not in seen:
                    seen[k] = {"address": a["address"], "chain": a["chain"], "role": a["role"], "note": a["note"], "blacklist": bool((r.get("blacklist_detail") or {}).get(a["address"])),
                               "kind": a.get("kind", ""), "ctype": a.get("ctype", ""), "kind_text": a.get("kind_text", ""), "label": a.get("label", ""), "tx_count": a.get("tx_count"),
                               "incidents": [], "first_day": r["day"], "event_date": r.get("event_date")}
                e = seen[k]
                if ROLE_PRIORITY.get(a["role"], 9) < ROLE_PRIORITY.get(e["role"], 9):
                    e["role"] = a["role"]
                if not any(x["uid"] == r["uid"] for x in e["incidents"]):
                    e["incidents"].append({"uid": r["uid"], "project": r["project"], "type": r["type"], "day": r["day"], "event_date": r.get("event_date"), "amount_usd": r["amount_usd"]})
                if r["day"] > e["first_day"]:
                    e["first_day"] = r["day"]
        out = sorted(seen.values(), key=lambda e: (ROLE_PRIORITY.get(e["role"], 9), e["first_day"]), reverse=False)
        out.sort(key=lambda e: e["first_day"], reverse=True)
        roles = Counter(e["role"] for e in out)
        chains = Counter(e["chain"] for e in out)
        kinds = Counter((e.get("kind") or "unchecked") for e in out)
        return {"total": len(out), "items": out[:limit], "roles": dict(roles.most_common()), "chains": dict(chains.most_common()), "kinds": dict(kinds.most_common())}

    def lookup_address(self, q: str) -> dict:
        self.refresh()
        qn = q.strip()
        ql = qn.lower()
        matches = []
        for r in self.incidents:
            for a in r["addresses"]:
                if a["address"].lower() == ql or (len(ql) >= 6 and ql in a["address"].lower()):
                    matches.append({**a, "incident": {k: r[k] for k in ("uid", "project", "day", "incident_date", "type", "amount_usd", "chains", "followup_of")}})
        sdn = [dict(x) for x in self.store.conn.execute(
            "SELECT chain, address, entity_uid, entity_name, programs, first_seen_at FROM sdn_snapshot WHERE lower(address)=? OR (length(?)>=6 AND instr(lower(address), ?)>0) LIMIT 50",
            (ql, ql, ql))]
        bl = None
        if self.crimial.enabled and qn:
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
