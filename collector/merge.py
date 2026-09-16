"""소스 간 같은 사건 병합 + 이전 날짜 사건의 후속 보도 판별.

같은 사건 판단 (규칙):
  1) 주소 또는 tx 해시를 공유 (victim 역할 주소는 제외)
  2) 정규화한 프로젝트명이 같거나 접두/부분집합/trigram≥0.6 이고, 날짜가 맞음
     (사건일 둘 다 있으면 ±3일, 또는 게시일 ±7일)
  3) 제재/수사 계열과 해킹 계열은 이름이 같아도 다른 사건
규칙으로 못 묶었지만 '있을 법한' 쌍(같은 계열, 날짜 근접, 체인/금액 유사)은 judge(LLM)에게 물어 결정한다.
대표 카드 = LLM 카드 있음 > 소스 우선순위 > 주소 수 > 요약 길이. 주소·tx·체인·관련자는 합집합.
"""
from __future__ import annotations

import re
from dataclasses import replace
from datetime import date
from typing import Callable, Dict, List, Optional, Set, Tuple

from .addresses import merge_addresses
from .models import Incident

Judge = Callable[[Incident, Incident], Optional[bool]]

SOURCE_PRIORITY = ["rekt", "chainalysis", "trm", "ofac", "doj", "defihacklabs", "zachxbt", "slowmist", "defillama",
                   "ofac_sdn", "scamsniffer"]

_STOP = {"finance", "protocol", "network", "labs", "lab", "dao", "exchange", "the", "amm", "swap", "bridge", "chain",
         "token", "v1", "v2", "v3", "v4", "app", "io", "fi", "defi", "guarantee", "market", "markets", "inc", "co", "ltd"}
_GLUED_SUFFIXES = ("token", "finance", "protocol", "network", "swap", "dao", "labs", "exchange", "bridge", "chain", "amm", "fi")
_GENERIC = {"", "unknown", "scamsniffer", "phishing", "blacklist", "ofac", "sdn", "attacker", "hacker"}
_LEGAL = {"sanctions_designation", "law_enforcement_action", "laundering_report"}


def normalize_name(name: str) -> str:
    n = (name or "").lower()
    n = re.sub(r"\(.*?\)", " ", n)
    n = re.sub(r"[^a-z0-9가-힣 ]+", " ", n)
    toks = [t for t in n.split() if t not in _STOP]
    joined = "".join(toks)
    for suf in _GLUED_SUFFIXES:  # 'orbtoken' → 'orb', 'yamfinance' → 'yam'
        if joined.endswith(suf) and len(joined) - len(suf) >= 3:
            joined = joined[: -len(suf)]
            break
    return joined


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
    if min(len(na), len(nb)) >= 4 and (na.startswith(nb) or nb.startswith(na)):
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


def _days_apart(a: Optional[str], b: Optional[str]) -> Optional[int]:
    da, db = _day(a), _day(b)
    return abs((da - db).days) if da and db else None


def dates_compatible(a: Incident, b: Incident) -> bool:
    di = _days_apart(a.incident_date, b.incident_date)
    dp = _days_apart(a.published_at, b.published_at)
    if di is not None:
        if di <= 3:
            return True
        # 사건일이 서로 멀면 원칙적으로 다른 사건. 단 법집행/제재 카드는 모델이 '범행일'을 사건일로 잡는 경우가 있어
        # 게시일이 가까우면(또는 게시일을 몰라 비교가 불가하면) 같은 조치로 본다 (예: 기소 보도자료 vs 같은 날 뉴스)
        return family(a.incident_type) == "legal" and (dp is None or dp <= 7)
    if dp is not None:
        return dp <= 14
    return True


def family(itype: str) -> str:
    return "legal" if itype in _LEGAL else "attack"


def _keys(i: Incident) -> Set[Tuple[str, str]]:
    keys = {("addr", a.address.lower()) for a in i.addresses if a.role in ("attacker", "laundering", "sanctioned", "unknown")}
    keys |= {("tx", t.lower()) for t in i.tx_hashes}
    return keys


def same_incident(a: Incident, b: Incident) -> bool:
    if a.uid == b.uid:
        return True
    if _keys(a) & _keys(b):
        return True
    if family(a.incident_type) != family(b.incident_type):
        return False
    return names_match(a.project or a.title, b.project or b.title) and dates_compatible(a, b)


def plausible_pair(a: Incident, b: Incident) -> bool:
    """규칙으론 못 묶었지만 LLM에 물어볼 가치가 있는 쌍. 호출 수를 줄이기 위해 엄격하게:
    같은 계열 + 사건일 ±3일(둘 다 있을 때; 하나만 있으면 게시일 ±3일) + 체인 겹침 + (금액 유사 또는 이름 약한 유사)."""
    if family(a.incident_type) != family(b.incident_type):
        return False
    di, dp = _days_apart(a.incident_date, b.incident_date), _days_apart(a.published_at, b.published_at)
    if di is not None:
        if di > 3:
            return False
    elif dp is None or dp > 3:
        return False
    ca = {c.lower() for c in a.chains}
    cb = {c.lower() for c in b.chains}
    if not (ca and cb and ca & cb):
        return False
    if a.amount_usd and b.amount_usd:
        ratio = a.amount_usd / b.amount_usd
        return 0.5 <= ratio <= 2.0
    # 금액 비교가 안 되면 이름이라도 조금은 닮아야 한다
    na, nb = normalize_name(a.project or a.title), normalize_name(b.project or b.title)
    ta, tb = name_tokens(a.project or a.title), name_tokens(b.project or b.title)
    ga, gb = _trigrams(na), _trigrams(nb)
    sim = len(ga & gb) / max(1, len(ga | gb))
    return bool(ta & tb) or sim >= 0.3


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


def merge_incidents(incidents: List[Incident], judge: Optional[Judge] = None) -> List[Incident]:
    """관련 사건만 병합. 무관 항목은 그대로 통과. judge 가 있으면 애매한 쌍을 물어본다."""
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
    if judge is not None:
        for i in range(n):
            for j in range(i + 1, n):
                if find(i) != find(j) and plausible_pair(relevant[i], relevant[j]):
                    if judge(relevant[i], relevant[j]):
                        parent[find(j)] = find(i)
    groups: Dict[int, List[Incident]] = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(relevant[i])
    merged = [merge_group(g) for g in groups.values()]
    merged.sort(key=lambda i: (i.incident_date or i.published_at or "", i.published_at), reverse=True)
    return merged + others


def mark_followups(todays: List[Incident], history: List[Incident], judge: Optional[Judge] = None) -> int:
    """오늘 사건이 이전 날짜(history: 이미 병합된 대표 카드들)의 후속 보도면 followup_of 를 채운다. 표시 건수 반환."""
    n = 0
    for inc in todays:
        if not inc.relevant:
            continue
        hit = next((h for h in history if same_incident(inc, h)), None)
        if hit is None and judge is not None:
            for h in history:
                if plausible_pair(inc, h) and judge(inc, h):
                    hit = h
                    break
        if hit is not None:
            inc.followup_of = {"uid": hit.uid, "day": (hit.collected_at or "")[:10], "project": hit.project or hit.title,
                               "url": hit.url, "incident_date": hit.incident_date}
            n += 1
    return n
