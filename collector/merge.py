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


def _leaderboard(i: Incident) -> bool:
    return "rekt_leaderboard" in (i.tags or [])


def dates_compatible(a: Incident, b: Incident) -> bool:
    di = _days_apart(a.incident_date, b.incident_date)
    dp = _days_apart(a.published_at, b.published_at)
    if di is not None:
        if di <= 3:
            return True
        # Rekt 리더보드는 사건일이 기사 기준이라 다른 출처와 며칠씩 어긋난다(LuBian 12/20 ↔ DeFiLlama 12/28).
        # 피해 대상 이름이 같은 카드끼리만 여기에 오므로 ±14일까지 같은 사건으로 본다.
        if (_leaderboard(a) or _leaderboard(b)) and di <= 14:
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


def _title_sim(a: str, b: str) -> float:
    ta, tb = _trigrams((a or "").lower()), _trigrams((b or "").lower())
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def same_legal_release(a: Incident, b: Incident) -> bool:
    """법집행 카드 전용: 같은 소스가 같은 금액을 7일 안에 다시 낸 보도자료(제목이 닮음)는 같은 사건.
    예: DOJ 'Surge Takedown Exceeding $245 Million' 이 지역 검찰청별로 재게시되는 경우."""
    if family(a.incident_type) != "legal" or family(b.incident_type) != "legal":
        return False
    if not a.source or a.source != b.source:
        return False
    # 금액이 둘 다 있으면 같아야 하고, 둘 다 비어 있으면(단속 총액을 지운 경우) 제목 유사도로만 판단
    if a.amount_usd and b.amount_usd and a.amount_usd != b.amount_usd:
        return False
    if bool(a.amount_usd) != bool(b.amount_usd):
        return False
    dp = _days_apart(a.published_at, b.published_at)
    if dp is None or dp > 7:
        return False
    return _title_sim(a.title, b.title) >= 0.5


def same_incident(a: Incident, b: Incident) -> bool:
    if a.uid == b.uid:
        return True
    if _keys(a) & _keys(b):
        return True
    # 유형 계열이 달라도(법집행 보도자료 ↔ 뉴스가 '피싱'으로 분류) 피해 대상 이름이 같고 금액이 ±5% 안이며 게시일 7일 이내면 같은 사건
    if a.amount_usd and b.amount_usd and abs(a.amount_usd - b.amount_usd) / max(a.amount_usd, b.amount_usd) <= 0.05:
        dp = _days_apart(a.published_at, b.published_at)
        na, nb = normalize_name(a.project or a.title), normalize_name(b.project or b.title)
        if dp is not None and dp <= 7 and na and na == nb and len(na) >= 4:
            return True
    if family(a.incident_type) != family(b.incident_type):
        return False
    if same_legal_release(a, b):
        return True
    if names_match(a.project or a.title, b.project or b.title) and dates_compatible(a, b):
        return True
    # 같은 피해 대상(정규화 이름이 완전히 같음)에 대한 보도가 14일 안에 이어지면 같은 사건의 후속으로 본다
    # (예: Revolut 개인정보 유출 9.11 → 협박·몸값 요구 9.17)
    na, nb = normalize_name(a.project or a.title), normalize_name(b.project or b.title)
    if na and na == nb and len(na) >= 4:
        dp = _days_apart(a.incident_date or a.published_at, b.incident_date or b.published_at)
        return dp is not None and dp <= 14
    return False


_LEGAL_STOP = {"district", "attorney", "national", "charged", "guilty", "pleads", "sentenced", "indicted", "office", "united", "states",
               "department", "justice", "fraud", "million", "cryptocurrency", "crypto", "bitcoin", "laundering", "money", "former", "years",
               "prison", "scheme", "conspiracy", "federal", "court", "with", "from", "that", "this", "over", "into", "against", "joins", "division"}


def _name_words(i: Incident) -> Set[str]:
    """법집행 카드 매칭용 고유 토큰: project + title 의 4자 이상 영문 토큰(일반어 제외)."""
    import re as _re
    words = set()
    for s in (i.project or "", i.title or "", *(i.actors or [])[:5]):
        for w in _re.findall(r"[A-Za-z][A-Za-z0-9]{3,}", s):
            wl = w.lower()
            if wl not in _LEGAL_STOP:
                words.add(wl)
    return words


def plausible_pair(a: Incident, b: Incident) -> bool:
    """규칙으론 못 묶었지만 LLM에 물어볼 가치가 있는 쌍. 호출 수를 줄이기 위해 엄격하게:
    같은 계열 + 사건일 ±3일(둘 다 있을 때; 하나만 있으면 게시일 ±3일) + 체인 겹침 + (금액 유사 또는 이름 약한 유사)."""
    if family(a.incident_type) != family(b.incident_type):
        return False
    di, dp = _days_apart(a.incident_date, b.incident_date), _days_apart(a.published_at, b.published_at)
    if family(a.incident_type) == "legal":
        # 법집행·제재 카드는 체인이 없으므로 이름/제목에 같은 고유 토큰(4자 이상)이 있고 게시일이 ±5일이면 LLM 에 묻는다.
        # 예: DOJ "Two Robinhood Employees Charged" ↔ 블록미디어 "로빈후드 상장 정보로 … 기소" (project="Robinhood")
        if dp is None or dp > 5:
            return False
        wa = _name_words(a); wb = _name_words(b)
        return bool(wa & wb)
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


def consensus_amount(members: List[Incident], tol: float = 0.05) -> Optional[tuple]:
    """금액이 있는 카드가 2개 이상이면 ±tol 로 묶어 (가장 많은 출처 수, 가장 늦은 게시일) 순으로 고른다. 1개 이하면 None(기존 규칙)."""
    have = [m for m in members if m.amount_usd]
    if len(have) < 2:
        return None
    clusters: List[List[Incident]] = []
    for m in sorted(have, key=lambda x: x.amount_usd):
        for c in clusters:
            center = sum(x.amount_usd for x in c) / len(c)
            if abs(m.amount_usd - center) / center <= tol:
                c.append(m)
                break
        else:
            clusters.append([m])
    def prio(x: Incident) -> int:  # 출처 우선순위(높을수록 신뢰): rekt·chainalysis·trm·… > rss
        # Rekt 리더보드 금액은 현재 시세로 재평가된 값이 섞여 있다(LuBian 2020년 $3.5B → 리더보드 $14.8B).
        # 다른 출처가 사건 당시 금액을 주면 그쪽을 따른다.
        if "rekt_leaderboard" in (x.tags or []):
            return -99
        return -(SOURCE_PRIORITY.index(x.source) if x.source in SOURCE_PRIORITY else len(SOURCE_PRIORITY) + (0 if x.source.startswith("rss:") else 1) + 1)
    def latest(c):
        return max((x.published_at or "") for x in c)
    # 다수 → 동수면 출처 우선순위(정확한 사후 분석 소스) → 그래도 같으면 늦은 보도(정정치)
    best = max(clusters, key=lambda c: (len(c), max(prio(x) for x in c), latest(c)))
    pick = max(best, key=lambda x: (x.published_at or "", 1 if x.amount_text else 0))
    return pick.amount_usd, pick.amount_text or ""


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
    # 금액은 대표 카드 하나가 아니라 출처 합의로 정한다: ±5% 로 묶은 값 중 가장 많은 출처가 말한 값, 동수면 더 늦게 보도된 값(정정 반영).
    # 예: Bitget — 초기 보도 $352M(2건) 이 뒤에 $387.5M(5건)로 정정됨 → $387.5M
    cons = consensus_amount(members)
    if cons is not None:
        rep.amount_usd, rep.amount_text = cons
    elif rep.amount_usd is None:
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
