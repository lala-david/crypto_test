"""소스 간 같은 사건 병합.

같은 사건인지 판단하는 기준 (하나라도 만족):
  1) 주소 또는 tx 해시를 공유 (victim 역할 주소는 제외 — 피해 컨트랙트는 여러 사건에 걸칠 수 있음)
  2) 정규화한 프로젝트명이 같거나 한쪽이 다른 쪽의 접두/부분집합 또는 trigram 유사도 ≥ 0.6, 그리고 사건일 차이가 허용 범위
     (둘 다 incident_date 가 있으면 ±3일, 아니면 게시일 기준 ±14일)
대표 카드 = LLM 카드 있음 > 소스 우선순위 > 주소 수 > 요약 길이. 주소·tx·체인·관련자는 합집합, 금액은 대표 카드 값(없으면 최대).
"""
from __future__ import annotations

import re
from dataclasses import replace
from datetime import date
from typing import Dict, List, Optional, Set

from .addresses import merge_addresses
from .models import Incident

# 대표 카드 선택 시 소스 우선순위 (앞일수록 우선)
SOURCE_PRIORITY = ["rekt", "chainalysis", "trm", "ofac", "doj", "defihacklabs", "zachxbt", "slowmist", "defillama",
                   "ofac_sdn", "scamsniffer"]

_STOP = {"finance", "protocol", "network", "labs", "lab", "dao", "exchange", "the", "amm", "swap", "bridge", "chain",
         "token", "v1", "v2", "v3", "v4", "app", "io", "fi", "defi", "guarantee", "market", "markets", "inc", "co", "ltd"}
_GENERIC = {"", "unknown", "scamsniffer", "phishing", "blacklist", "ofac", "sdn"}


def normalize_name(name: str) -> str:
    n = (name or "").lower()
    n = re.sub(r"\(.*?\)", " ", n)
    n = re.sub(r"[^a-z0-9가-힣 ]+", " ", n)
    toks = [t for t in n.split() if t not in _STOP]
    return "".join(toks)


def name_tokens(name: str) -> Set[str]:
    n = re.sub(r"[^a-z0-9가-힣 ]+", " ", (name or "").lower())
    return {t for t in n.split() if t not in _STOP and len(t) > 1}


def _trigrams(s: str) -> Set[str]:
    s = f"  {s} "
    return {s[i:i + 3] for i in range(len(s) - 2)}


def names_match(a: str, b: str) -> bool:
    na, nb = normalize_name(a), normalize_name(b)
    if not na or not nb or na in _GENERIC or nb in _GENERIC:
        return False
    if na == nb:
        return True
    if len(na) >= 4 and len(nb) >= 4 and (na.startswith(nb) or nb.startswith(na)):
        return True
    ta, tb = name_tokens(a), name_tokens(b)
    if ta and tb and (ta <= tb or tb <= ta):
        return True
    ga, gb = _trigrams(na), _trigrams(nb)
    return len(ga & gb) / max(1, len(ga | gb)) >= 0.6


def _day(s: Optional[str]) -> Optional[date]:
    try:
        return date.fromisoformat((s or "")[:10])
    except ValueError:
        return None


def dates_compatible(a: Incident, b: Incident) -> bool:
    da, db = _day(a.incident_date), _day(b.incident_date)
    if da and db:
        return abs((da - db).days) <= 3
    pa, pb = _day(a.published_at) or da, _day(b.published_at) or db
    if pa and pb:
        return abs((pa - pb).days) <= 14
    return True


def _keys(i: Incident) -> Set[str]:
    keys = {("addr", a.address.lower()) for a in i.addresses if a.role in ("attacker", "laundering", "sanctioned", "unknown")}
    keys |= {("tx", t.lower()) for t in i.tx_hashes}
    return keys


def same_incident(a: Incident, b: Incident) -> bool:
    if a.uid == b.uid:
        return True
    if _keys(a) & _keys(b):
        return True
    # 제재/수사 카드와 해킹 카드는 이름이 같아도 한 사건으로 보지 않는다 (예: 'Bybit' 해킹 vs 'Bybit' 관련 제재 보도)
    fam = lambda t: "legal" if t in ("sanctions_designation", "law_enforcement_action", "laundering_report") else "attack"
    if fam(a.incident_type) != fam(b.incident_type):
        return False
    return names_match(a.project or a.title, b.project or b.title) and dates_compatible(a, b)


def _rank(i: Incident) -> tuple:
    pri = SOURCE_PRIORITY.index(i.source) if i.source in SOURCE_PRIORITY else len(SOURCE_PRIORITY) + (0 if i.source.startswith("rss:") else 1)
    return (1 if i.enriched else 0, -pri, len(i.addresses), len(i.summary_ko) + len(i.summary_en))


def merge_group(members: List[Incident]) -> Incident:
    members = sorted(members, key=_rank, reverse=True)
    rep = replace(members[0])
    rep.addresses = merge_addresses(*[m.addresses for m in members])
    rep.tx_hashes = sorted({t for m in members for t in m.tx_hashes})
    chains: List[str] = []
    for m in members:
        for c in m.chains:
            if c and c.lower() not in {x.lower() for x in chains}:
                chains.append(c)
    rep.chains = chains
    actors: List[str] = []
    for m in members:
        for a in m.actors:
            if a and a.lower() not in {x.lower() for x in actors}:
                actors.append(a)
    rep.actors = actors
    if rep.amount_usd is None:
        amts = [m.amount_usd for m in members if m.amount_usd is not None]
        rep.amount_usd = max(amts) if amts else None
        rep.amount_text = rep.amount_text or next((m.amount_text for m in members if m.amount_text), "")
    if not rep.incident_date:
        ds = [m.incident_date for m in members if m.incident_date]
        rep.incident_date = min(ds) if ds else None
    for f in ("background_ko", "background_en", "attack_method_ko", "attack_method_en", "summary_ko", "summary_en",
              "fund_flow_ko", "fund_flow_en"):
        if not getattr(rep, f):
            setattr(rep, f, next((getattr(m, f) for m in members if getattr(m, f)), ""))
    rep.tags = sorted({t for m in members for t in m.tags})
    rep.merged_from = [{"uid": m.uid, "source": m.source, "url": m.url, "title": m.title, "published_at": m.published_at}
                       for m in members[1:]]
    return rep


def merge_incidents(incidents: List[Incident]) -> List[Incident]:
    """관련 사건만 병합. 무관 항목은 그대로 통과."""
    relevant = [i for i in incidents if i.relevant]
    others = [i for i in incidents if not i.relevant]
    n = len(relevant)
    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for i in range(n):
        for j in range(i + 1, n):
            if find(i) != find(j) and same_incident(relevant[i], relevant[j]):
                parent[find(j)] = find(i)
    groups: Dict[int, List[Incident]] = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(relevant[i])
    merged = [merge_group(g) for g in groups.values()]
    merged.sort(key=lambda i: (i.incident_date or i.published_at or "", i.published_at), reverse=True)
    return merged + others
