"""데이터 재검증·재레이블링 하네스.

1) 규칙 QA 로 의심 카드를 고른다(날짜·금액·체인·이름·유형).
2) 원문을 다시 가져온다(HTTP 캐시 사용).
3) 로컬 LLM 에게 '현재 카드 + 원문'을 주고 핵심 필드를 확정하게 한다(JSON 스키마, 근거 구절 필수).
4) 근거 구절이 원문에 실제로 있고 규칙(날짜 ≤ 게시일, 금액 ↔ 근거 숫자 일치 등)을 통과한 수정만 적용한다.
5) 모든 판단을 data/relabel_log.jsonl 에 남긴다.

사용: python run.py --relabel [--relabel-all] [--limit N]  →  바뀐 날짜는 python run.py --rebuild-day YYYY-MM-DD --rebrief 로 재생성.
"""
from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from .http import Http
from .llm import LLMProvider
from .enrich import clean_text, is_stale_reference
from .models import INCIDENT_TYPES, Incident
from .prompts import AUDIT_SYSTEM, RELABEL_SYSTEM, REVIEW_SYSTEM, SUMMARY_SYSTEM
from .store import Store
from .textextract import html_to_text

log = logging.getLogger("collector.relabel")

ATTACK_ONCHAIN = {"hack_exploit", "private_key_compromise", "rug_pull", "phishing_social_engineering"}
LEGAL = {"sanctions_designation", "law_enforcement_action", "laundering_report"}
LEGAL_WORDS = re.compile(r"\b(indict|indicted|sentenc|charged|charges|plead|guilty|ofac|sanction|seiz|forfeit|arrest|extradit|convict|doj|prosecut)\w*", re.I)
ATTACK_WORDS = re.compile(r"\b(exploit|hack|hacked|drain|drained|rug|flash.?loan|reentrancy|oracle|private key|compromis)\w*", re.I)
GENERIC_PROJECT = re.compile(r"^(unknown|various|multiple|n/?a|none|government|.*\bgovernment\b.*|.*\bprogram\b.*|.*\bauthorit(y|ies)\b.*|.*\bdepartment\b.*|미상|불명|정부|다수)$", re.I)
CRYPTO_WORDS = re.compile(r"bitcoin|btc|ether|eth\b|crypto|token|wallet|blockchain|defi|exchange|usdt|usdc|stablecoin|nft|coin|mixer|tornado|tether|binance|solana|tron|ledger|drainer|smart contract|가상자산|암호화폐|코인|토큰|지갑|블록체인|거래소|스테이블|믹서|디파이|체인", re.I)
MONEY_RE = re.compile(r"(?:US\$|\$|USD\s?)\s?([\d][\d,]*(?:\.\d+)?)\s*(billion|million|thousand|bn|mn|[bmk])?\b|([\d][\d,]*(?:\.\d+)?)\s*(billion|million)\s+(?:US\s?)?dollars", re.I)
MULT = {"b": 1e9, "bn": 1e9, "billion": 1e9, "m": 1e6, "mn": 1e6, "million": 1e6, "k": 1e3, "thousand": 1e3}

RELABEL_SCHEMA = {
    "type": "object",
    "properties": {
        "incident_date": {"anyOf": [{"type": "string"}, {"type": "null"}]}, "incident_date_evidence": {"type": "string"},
        "amount_usd": {"anyOf": [{"type": "number"}, {"type": "null"}]}, "amount_text": {"type": "string"}, "amount_evidence": {"type": "string"},
        "chains": {"type": "array", "items": {"type": "string"}}, "project": {"type": "string"},
        "incident_type": {"type": "string", "enum": list(INCIDENT_TYPES)}, "type_evidence": {"type": "string"},
        "relevant": {"type": "boolean"}, "notes": {"type": "string"},
    },
    "required": ["incident_date", "incident_date_evidence", "amount_usd", "amount_text", "amount_evidence", "chains", "project", "incident_type", "type_evidence", "relevant", "notes"],
    "additionalProperties": False,
}


# ---------------------------------------------------------------------------
# 규칙 QA
# ---------------------------------------------------------------------------
def money_values(text: str) -> List[float]:
    out = []
    for m in MONEY_RE.finditer(text or ""):
        num = m.group(1) or m.group(3)
        unit = (m.group(2) or m.group(4) or "").lower()
        try:
            v = float(num.replace(",", ""))
        except ValueError:
            continue
        v *= MULT.get(unit, 1)
        if v >= 100:
            out.append(v)
    return out


def _close(a: float, b: float, tol: float = 0.05) -> bool:
    return a > 0 and b > 0 and abs(a - b) / max(a, b) <= tol


def qa_flags(inc: Incident, text: str = "") -> List[str]:
    flags: List[str] = []
    pub = (inc.published_at or "")[:10]
    day = (inc.collected_at or "")[:10]
    idt = inc.incident_date
    if is_stale_reference(idt, inc.published_at, inc.incident_type):
        flags.append("stale_reference")
    if not idt:
        flags.append("no_incident_date")
    else:
        if pub and idt > pub:
            flags.append("date_after_published")
        elif day and idt > day:
            flags.append("date_after_collected")
        if pub and day and idt == day and pub < day and idt != pub:
            flags.append("date_is_collection_day")
    if text:
        vals = money_values(text)
        if inc.amount_usd:
            if inc.amount_usd > 5e9:
                flags.append("amount_huge")
            if vals and not any(_close(inc.amount_usd, v) for v in vals):
                flags.append("amount_not_in_text")
        elif vals and max(vals) >= 1000 and inc.incident_type != "laundering_report":
            flags.append("amount_missing_but_text_has_money")
    if not inc.chains and inc.incident_type in ATTACK_ONCHAIN:
        flags.append("no_chain")
    p, ttl = (inc.project or "").strip().lower(), (inc.title or "").strip().lower()
    if not p or p == ttl or len(p) > 50:
        flags.append("project_is_title")
    elif GENERIC_PROJECT.search(p):
        flags.append("project_generic")
    head = f"{inc.title} {inc.summary_en or ''}"
    # 가상자산 단어가 제목·요약·수법 어디에도 없으면 관련성 의심 (DOJ 보도자료 등 일반 범죄가 섞여 들어오는 경우)
    blob = " ".join([inc.title or "", inc.summary_ko or "", inc.summary_en or "", inc.attack_method_ko or "", inc.background_ko or "", " ".join(inc.chains), " ".join(inc.tags)])
    if not CRYPTO_WORDS.search(blob) and not inc.addresses:
        flags.append("relevance_suspect")
    if inc.incident_type not in LEGAL and len(LEGAL_WORDS.findall(inc.title or "")) >= 1 and not ATTACK_WORDS.search(inc.title or ""):
        flags.append("type_maybe_legal")
    if inc.incident_type in LEGAL and ATTACK_WORDS.search(inc.title or "") and not LEGAL_WORDS.search(head):
        flags.append("type_maybe_attack")
    return flags


# ---------------------------------------------------------------------------
# 원문
# ---------------------------------------------------------------------------
# 여러 사건을 한 페이지에 나열하는 목록 URL(DeFiLlama hacks 등): 본문에 다른 사건의 금액·날짜가 섞여 있어 근거로 쓰면 오염된다 → 원문 없음으로 취급
LISTING_URL_RE = re.compile(r"(?i)(defillama\.com/hacks/?$|/hacks/?$|/exploits/?$|/incidents/?$)")


def fetch_text(http: Http, inc: Incident, max_chars: int = 30000) -> str:
    if LISTING_URL_RE.search((inc.url or "").split("?")[0]):
        return ""
    try:
        raw = http.get_text(inc.url, cache_ttl_hours=24 * 365)
    except Exception as e:
        log.warning("원문 재수집 실패 %s: %s", inc.url, str(e)[:120])
        return ""
    txt = raw
    if "<html" in raw[:2000].lower() or "<div" in raw[:5000].lower():
        try:
            txt = html_to_text(raw)
        except Exception:
            txt = re.sub(r"<[^>]+>", " ", raw)
    txt = re.sub(r"[ \t]+", " ", txt)
    txt = re.sub(r"\n{3,}", "\n\n", txt).strip()
    return txt[:max_chars]


# ---------------------------------------------------------------------------
# 근거 검증
# ---------------------------------------------------------------------------
def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip().lower()


def evidence_in_text(ev: str, text: str) -> bool:
    ev_n, tx_n = _norm(ev), _norm(text)
    if not ev_n or len(ev_n) < 6:
        return False
    if ev_n in tx_n:
        return True
    # 따옴표·대시 등 문장부호 차이 허용
    strip = lambda s: re.sub(r"[^0-9a-z가-힣$%.,]+", " ", s)
    return strip(ev_n).strip() in strip(tx_n)


def _iso(d: Optional[str]) -> Optional[str]:
    if not d:
        return None
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", d)
    if not m:
        return None
    try:
        datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"


NOT_LOSS_WORDS = re.compile(r"throughput|volume|market cap|시가총액|거래량|처리량|not (a )?seiz|처리 규모|누적 거래", re.I)


def text_mentions(inc: Incident, text: str) -> bool:
    """원문이 이 카드의 사건을 실제로 다루는지(이름 토큰의 60% 이상 등장) — JS 렌더링 페이지처럼 빈 목록만 받아온 경우를 걸러낸다."""
    if not text or len(text) < 400:
        return False
    toks = [w.lower() for w in re.findall(r"[A-Za-z0-9가-힣]{3,}", inc.project or inc.title or "")]
    if not toks:
        return True
    tl = text.lower()
    return sum(1 for w in toks if w in tl) >= max(1, int(len(toks) * 0.6))


_GENERIC_WORDS = {"developers", "developer", "users", "user", "victims", "victim", "investors", "investor", "traders", "trader", "customers", "customer",
                  "people", "individuals", "company", "companies", "exchange", "exchanges", "wallets", "wallet", "protocol", "platform", "government", "attackers", "hackers"}


def generic_phrase(name: str) -> bool:
    """'software developers'처럼 대문자·숫자가 없는 소문자 명사구이거나 마지막 단어가 일반 명사면 프로젝트 이름으로 받지 않는다."""
    n = (name or "").strip()
    if not n:
        return True
    words = re.findall(r"[A-Za-z]+", n)
    if not re.search(r"[A-Z0-9가-힣]", n) and len(words) >= 2:
        return True
    return bool(words) and words[-1].lower() in _GENERIC_WORDS and len(words) <= 3


def apply_verified(inc: Incident, out: dict, text: str) -> Tuple[List[str], List[str]]:
    """근거가 확인된 필드만 적용. (바뀐 필드 목록, 거부 이유 목록)"""
    changed, rejected = [], []
    pub = (inc.published_at or "")[:10]
    ok_text = text_mentions(inc, text)
    if not ok_text:
        # 원문이 없거나 사건을 다루지 않으면 '관련 없음'·'금액 삭제'·'유형 변경' 같은 삭제성 판단은 받지 않는다.
        out = dict(out, relevant=True, incident_type=inc.incident_type)
        if out.get("amount_usd") is None and inc.amount_usd:
            out["amount_usd"] = inc.amount_usd
        rejected.append("text: missing or unrelated → destructive changes blocked")
    notes = (out.get("notes") or "") + " " + (out.get("amount_text") or "")
    if isinstance(out.get("amount_usd"), (int, float)) and (out["amount_usd"] >= 5e9 or NOT_LOSS_WORDS.search(notes)):
        rejected.append(f"amount: {out['amount_usd']:.0f} looks like volume/throughput, not loss")
        out = dict(out, amount_usd=inc.amount_usd)
    # 날짜
    new_d = _iso(out.get("incident_date"))
    if new_d and new_d != inc.incident_date:
        if pub and new_d > pub:
            rejected.append(f"date>{pub}")
        elif not evidence_in_text(out.get("incident_date_evidence", ""), text):
            rejected.append("date: no evidence")
        else:
            inc.incident_date = new_d
            changed.append("incident_date")
    elif out.get("incident_date") is None and inc.incident_date and out.get("incident_date_evidence") == "" and "date_after_published" in qa_flags(inc):
        inc.incident_date = None
        changed.append("incident_date→null")
    # 금액 (review/audit 가 '피해액 아님'으로 비운 카드는 다시 채우지 않는다)
    new_a = out.get("amount_usd")
    if "not a loss" in (inc.enrich_note or ""):
        new_a = None if inc.amount_usd is None else inc.amount_usd
    if isinstance(new_a, (int, float)) and new_a > 0 and not _close(float(new_a), float(inc.amount_usd or 0), 0.001):
        ev = out.get("amount_evidence", "")
        ok = evidence_in_text(ev, text) and (any(_close(float(new_a), v) for v in money_values(ev)) or re.sub(r"[^\d]", "", ev).find(re.sub(r"[^\d]", "", f"{new_a:.0f}")[:4]) >= 0)
        if ok:
            inc.amount_usd = float(new_a)
            if out.get("amount_text"):
                inc.amount_text = out["amount_text"][:80]
            changed.append("amount_usd")
        else:
            rejected.append("amount: evidence mismatch")
    elif new_a is None and inc.amount_usd and out.get("amount_text") and evidence_in_text(out.get("amount_evidence", ""), text) and not money_values(out.get("amount_evidence", "")):
        # 원문이 코인 수량만 주는 경우: USD 금액을 지우고 텍스트만 남김
        inc.amount_usd = None
        inc.amount_text = out["amount_text"][:80]
        changed.append("amount_usd→null")
    # 체인
    new_c = [c.strip() for c in (out.get("chains") or []) if c and c.strip()]
    if new_c and [c.lower() for c in new_c] != [c.lower() for c in inc.chains]:
        tl = text.lower()
        keep = [c for c in new_c if c.lower() in tl or c.lower() in {"ethereum", "bsc", "bitcoin", "tron", "solana"} and c.lower()[:3] in tl]
        if keep and keep != inc.chains:
            inc.chains = keep[:5]
            changed.append("chains")
        elif not keep:
            rejected.append("chains: not in text")
    # 이름
    new_p = (out.get("project") or "").strip()
    if new_p and new_p != inc.project and len(new_p) <= 60 and new_p.lower() != (inc.title or "").strip().lower() and not generic_phrase(new_p):
        toks = [w for w in re.findall(r"[A-Za-z0-9가-힣]{3,}", new_p)]
        hit = sum(1 for w in toks if w.lower() in text.lower())
        if not toks or hit >= max(1, int(len(toks) * 0.6)):
            inc.project = new_p
            changed.append("project")
        else:
            rejected.append("project: not in text")
    # 유형
    new_t = out.get("incident_type")
    if new_t in INCIDENT_TYPES and new_t != inc.incident_type:
        if evidence_in_text(out.get("type_evidence", ""), text):
            inc.incident_type = new_t
            changed.append("incident_type")
        else:
            rejected.append("type: no evidence")
    # 관련성
    if out.get("relevant") is False and inc.relevant:
        # 원문에도 가상자산 단어가 없을 때만 '관련 없음' 을 받는다
        if out.get("notes") and not CRYPTO_WORDS.search(text or ""):
            inc.relevant = False
            inc.relevance_reason = ("재검증: " + out["notes"])[:200]
            changed.append("relevant→false")
        elif out.get("notes"):
            rejected.append("relevant→false: text mentions crypto")
    return changed, rejected


def _card_view(inc: Incident) -> dict:
    return {"uid": inc.uid, "source": inc.source, "title": inc.title, "published_at": inc.published_at, "collected_at": inc.collected_at[:10],
            "project": inc.project, "incident_type": inc.incident_type, "incident_date": inc.incident_date, "chains": inc.chains,
            "amount_usd": inc.amount_usd, "amount_text": inc.amount_text, "summary_ko": inc.summary_ko[:300]}


def verify_with_llm(provider: LLMProvider, inc: Incident, text: str, flags: List[str], max_tokens: int = 4000) -> Optional[dict]:
    user = "\n".join([
        "## 현재 카드", json.dumps(_card_view(inc), ensure_ascii=False),
        "## 규칙 검사에서 걸린 항목", ", ".join(flags) or "(없음 — 전체 재확인)",
        "## 원문", text or "(원문을 가져오지 못함 — 카드의 요약만으로 판단하고, 확실하지 않으면 현재 값 유지)",
    ])
    return provider.complete_json(RELABEL_SYSTEM, user, RELABEL_SCHEMA, max_tokens)


def run_relabel(store: Store, http: Http, provider: Optional[LLMProvider], data_dir: str, only_flagged: bool = True,
                limit: int = 0, max_tokens: int = 4000, log_path: Optional[str] = None, only_flags: Optional[set] = None) -> dict:
    """only_flags 가 주어지면 그 플래그 중 하나라도 걸린 카드만 LLM 에 보낸다(예: {"relevance_suspect"})."""
    rows = store.conn.execute("SELECT json FROM incidents WHERE relevant=1 ORDER BY collected_at").fetchall()
    from .store import incident_from_dict
    cards = [incident_from_dict(json.loads(r[0])) for r in rows]
    log_path = log_path or os.path.join(data_dir, "relabel_log.jsonl")
    summary = {"checked": 0, "flagged": 0, "llm_calls": 0, "changed": 0, "days": set(), "flags": {}}
    n = 0
    with open(log_path, "a", encoding="utf-8") as lf:
        for inc in cards:
            summary["checked"] += 1
            text = fetch_text(http, inc)
            flags = qa_flags(inc, text)
            for f in flags:
                summary["flags"][f] = summary["flags"].get(f, 0) + 1
            if flags:
                summary["flagged"] += 1
            if "stale_reference" in flags and inc.relevant:
                # 규칙만으로 확정: 회고성 기사 → 신규 사건 아님 (LLM 불필요)
                inc.relevant = False
                inc.relevance_reason = "회고성 기사: 사건일이 게시일보다 1년 이상 이전"
                inc.enrich_note = (inc.enrich_note + " | " if inc.enrich_note else "") + "relabel: stale_reference"
                store.save_incident(inc)
                summary["changed"] += 1
                summary["days"].add(inc.collected_at[:10])
                lf.write(json.dumps({"ts": datetime.now().isoformat(timespec="seconds"), "uid": inc.uid, "flags": flags, "changed": ["relevant→false (stale_reference)"], "project": inc.project}, ensure_ascii=False) + "\n")
                continue
            if only_flagged and not flags:
                continue
            if only_flags and not (set(flags) & only_flags):
                continue
            if provider is None:
                lf.write(json.dumps({"ts": datetime.now().isoformat(timespec="seconds"), "uid": inc.uid, "project": inc.project, "flags": flags, "llm": False}, ensure_ascii=False) + "\n")
                continue
            if limit and n >= limit:
                break
            n += 1
            summary["llm_calls"] += 1
            before = _card_view(inc)
            try:
                out = verify_with_llm(provider, inc, text, flags, max_tokens)
            except Exception as e:
                log.error("LLM 검증 실패 %s: %s", inc.uid, str(e)[:200])
                out = None
            changed, rejected = ([], ["llm: no output"]) if not out else apply_verified(inc, out, text)
            if changed:
                inc.enrich_note = (inc.enrich_note + " | " if inc.enrich_note else "") + "relabel " + datetime.now().strftime("%m-%d") + ": " + ",".join(changed)
                store.save_incident(inc)
                summary["changed"] += 1
                summary["days"].add(inc.collected_at[:10])
            log.info("[relabel] %s | flags=%s | changed=%s | rejected=%s", (inc.project or inc.title)[:40], flags, changed, rejected)
            lf.write(json.dumps({"ts": datetime.now().isoformat(timespec="seconds"), "uid": inc.uid, "flags": flags, "before": before,
                                 "after": _card_view(inc), "changed": changed, "rejected": rejected, "llm_out": out}, ensure_ascii=False) + "\n")
    summary["days"] = sorted(summary["days"])
    return summary


# ---------------------------------------------------------------------------
# 사건 여부 판정(review): 모든 relevant 카드를 같은 기준으로 LLM 에 묻고, 확신도 0.8 이상의 제외 판정만 적용한다.
# ---------------------------------------------------------------------------
REVIEW_CATEGORIES = ["new_attack", "new_enforcement", "sanctions", "laundering_report", "exchange_self_report", "court_procedure",
                     "retrospective", "general_crime_no_crypto", "crypto_incidental", "market_or_opinion", "duplicate_or_update_only", "other"]
EXCLUDE_CATEGORIES = {"exchange_self_report", "court_procedure", "retrospective", "general_crime_no_crypto", "crypto_incidental", "market_or_opinion"}
REVIEW_SCHEMA = {
    "type": "object",
    "properties": {
        "is_new_incident": {"type": "boolean"}, "category": {"type": "string", "enum": REVIEW_CATEGORIES},
        "crypto_involved": {"type": "boolean"}, "crypto_is_core": {"type": "boolean"}, "amount_is_loss": {"type": "boolean"},
        "confidence": {"type": "number"}, "evidence": {"type": "string"}, "reason": {"type": "string"},
    },
    "required": ["is_new_incident", "category", "crypto_involved", "crypto_is_core", "amount_is_loss", "confidence", "evidence", "reason"],
    "additionalProperties": False,
}


def _review_card(inc: Incident, text: str) -> str:
    card = {"source": inc.source, "title": inc.title, "published_at": inc.published_at, "project": inc.project, "incident_type": inc.incident_type,
            "incident_date": inc.incident_date, "chains": inc.chains, "amount_usd": inc.amount_usd, "amount_text": inc.amount_text,
            "summary_ko": inc.summary_ko[:600], "attack_method_ko": inc.attack_method_ko[:300], "background_ko": inc.background_ko[:300],
            "addresses": len(inc.addresses), "tags": inc.tags[:6]}
    return "## 카드\n" + json.dumps(card, ensure_ascii=False) + "\n## 원문 일부(카드와 무관하면 무시)\n" + (text[:6000] if text else "(없음)")


def _save_retry(store: Store, inc: Incident) -> None:
    import sqlite3, time
    for _ in range(6):
        try:
            store.save_incident(inc)
            return
        except sqlite3.OperationalError:
            time.sleep(1)
    store.save_incident(inc)


SUMMARY_SCHEMA = {
    "type": "object",
    "properties": {"summary_ko": {"type": "string"}, "attack_method_ko": {"type": "string"}},
    "required": ["summary_ko", "attack_method_ko"],
    "additionalProperties": False,
}
_HANGUL = re.compile(r"[가-힣]")


def needs_korean_summary(inc: Incident) -> bool:
    """한국어 요약이 없거나 너무 짧거나, 한글 비중이 낮아 사실상 영문 소스 요약인 카드가 대상.
    예: 'DeFiLlama: X (BSC) — Oracle Manipulation, 손실 $1,000' 은 한글 2자뿐이라 다시 쓴다."""
    ko = (inc.summary_ko or "").strip()
    if len(ko) < 25:
        return True
    body = re.sub(r"\s+", "", ko)
    return (len(_HANGUL.findall(body)) / max(1, len(body))) < 0.2


def _summary_card(inc: Incident) -> str:
    card = {"project": inc.project or inc.title, "incident_date": inc.incident_date, "incident_type": inc.incident_type,
            "chains": inc.chains, "amount_usd": inc.amount_usd, "amount_text": inc.amount_text,
            "attack_method": (inc.attack_method_en or inc.attack_method_ko or "")[:200],
            "source": inc.source, "title": inc.title[:160], "summary_en": (inc.summary_en or inc.summary_ko or "")[:600]}
    return "## 카드\n" + json.dumps(card, ensure_ascii=False)


def run_summarize(store: Store, provider: LLMProvider, data_dir: str, limit: int = 0, max_tokens: int = 1200,
                  workers: int = 3, force: bool = False) -> dict:
    """한국어 요약이 없는 카드(주로 백필)에 summary_ko/attack_method_ko 를 채운다. 이미 한국어가 있으면 건너뛰므로 여러 번 돌려도 안전하다."""
    from concurrent.futures import ThreadPoolExecutor
    from .store import incident_from_dict
    cards = [incident_from_dict(json.loads(r[0])) for r in
             store.conn.execute("SELECT json FROM incidents WHERE relevant=1 ORDER BY incident_date DESC").fetchall()]
    todo = [c for c in cards if force or needs_korean_summary(c)]
    if limit:
        todo = todo[:limit]
    summary = {"candidates": len(todo), "done": 0, "errors": 0, "skipped": 0, "days": set()}

    def ask(inc: Incident):
        try:
            return inc, provider.complete_json(SUMMARY_SYSTEM, _summary_card(inc), SUMMARY_SCHEMA, max_tokens)
        except Exception as e:
            log.error("summarize LLM 실패 %s: %s", inc.uid, str(e)[:160])
            return inc, None

    with ThreadPoolExecutor(max_workers=max(1, workers)) as ex:
        for k, (inc, out) in enumerate(ex.map(ask, todo), 1):
            if not out or not (out.get("summary_ko") or "").strip():
                summary["errors" if out is None else "skipped"] += 1
                continue
            ko = clean_text(out["summary_ko"]).strip()
            if not _HANGUL.search(ko):
                summary["skipped"] += 1
                continue
            inc.summary_ko = ko
            am = clean_text(out.get("attack_method_ko") or "").strip()
            if am and not (inc.attack_method_ko or "").strip():
                inc.attack_method_ko = am
            inc.enrich_note = (inc.enrich_note + " · " if inc.enrich_note else "") + "summary_ko(LLM)"
            _save_retry(store, inc)
            summary["done"] += 1
            summary["days"].add((inc.collected_at or "")[:10])
            if k % 50 == 0:
                log.info("한국어 요약 %d/%d (성공 %d · 실패 %d)", k, len(todo), summary["done"], summary["errors"])
    summary["days"] = sorted(summary["days"])
    return summary


def run_review(store: Store, http: Http, provider: LLMProvider, data_dir: str, limit: int = 0, max_tokens: int = 8000,
               min_conf: float = 0.8, include_irrelevant: bool = False, cards: Optional[List[Incident]] = None, skip_reviewed: bool = False) -> dict:
    """카드에 '새 사건인가' 를 묻는다. 제외 판정은 confidence ≥ min_conf 일 때만 적용. 결과는 data/review_log.jsonl.
    cards 를 주면 그 카드만(매시간 수집의 신규 카드), skip_reviewed 면 이미 판정 기록이 있는 카드는 건너뛴다."""
    from .store import incident_from_dict
    log_path = os.path.join(data_dir, "review_log.jsonl")
    if cards is None:
        q = "SELECT json FROM incidents ORDER BY collected_at" if include_irrelevant else "SELECT json FROM incidents WHERE relevant=1 ORDER BY collected_at"
        cards = [incident_from_dict(json.loads(r[0])) for r in store.conn.execute(q).fetchall()]
    if skip_reviewed and os.path.exists(log_path):
        seen = set()
        with open(log_path, encoding="utf-8") as f:
            for line in f:
                try:
                    seen.add(json.loads(line).get("uid"))
                except Exception:
                    pass
        cards = [c for c in cards if c.uid not in seen]
    if include_irrelevant:
        # 키워드 필터로 걸러진 잡음은 빼고, 사람이 손으로 제외했거나 규칙/LLM 이 뒤늦게 제외한 카드만 다시 판정한다(복구 검증용)
        cards = [c for c in cards if not c.relevant and re.search(r"재검토|재검증|회고성|LLM 판정|relabel|review", c.relevance_reason or "")]
    summary = {"checked": 0, "excluded": 0, "restored": 0, "amount_cleared": 0, "low_confidence": 0, "categories": {}, "days": set(), "errors": 0}
    with open(log_path, "a", encoding="utf-8") as lf:
        for k, inc in enumerate(cards):
            if limit and k >= limit:
                break
            summary["checked"] += 1
            text = fetch_text(http, inc, max_chars=8000)
            try:
                out = provider.complete_json(REVIEW_SYSTEM, _review_card(inc, text), REVIEW_SCHEMA, max_tokens)
            except Exception as e:
                log.error("review LLM 실패 %s: %s", inc.uid, str(e)[:200])
                out = None
            if not out:
                summary["errors"] += 1
                log.warning("[review] %s | LLM 이 JSON 을 내놓지 않음(토큰 부족/거부)", (inc.project or inc.title)[:40])
                continue
            cat = out.get("category", "other")
            conf = float(out.get("confidence") or 0)
            # 하네스 규칙이 LLM 판정보다 우선한다:
            #  (1) 사건일이 게시일보다 1년 이상 이전이면 회고 기사  (2) 가상자산이 수단·대상이 아니면 일반 범죄
            #  (3) 법집행·제재 카테고리인데 카드와 원문 어디에도 가상자산 단어가 없으면 일반 범죄
            blob = " ".join([inc.title or "", inc.summary_ko or "", inc.summary_en or "", inc.attack_method_ko or "", text or ""])
            if is_stale_reference(inc.incident_date, inc.published_at, inc.incident_type):
                out = dict(out, is_new_incident=False, category="retrospective", confidence=max(conf, 0.9), reason="규칙: 사건일이 게시일보다 1년 이상 이전 · " + (out.get("reason") or ""))
            elif out.get("crypto_involved") is False or (cat in ("new_enforcement", "sanctions", "laundering_report") and not CRYPTO_WORDS.search(blob)):
                out = dict(out, is_new_incident=False, category="general_crime_no_crypto", confidence=max(conf, 0.9), reason="규칙: 가상자산이 사건의 수단·대상이 아님 · " + (out.get("reason") or ""))
            elif cat in ("new_enforcement", "sanctions") and out.get("crypto_is_core") is False:
                # (4) 법집행·제재인데 가상자산이 범죄의 핵심이 아니면(횡령금 현금화 경로·배경 언급) 원장 대상이 아니다 — 사용자 지시 "해킹사건만"
                out = dict(out, is_new_incident=False, category="crypto_incidental", confidence=max(conf, 0.9), reason="규칙: 가상자산이 범죄의 핵심이 아님(현금화 경로·배경) · " + (out.get("reason") or ""))
            cat = out.get("category", "other")
            conf = float(out.get("confidence") or 0)
            summary["categories"][cat] = summary["categories"].get(cat, 0) + 1
            changed = []
            if out.get("is_new_incident") is False:
                if conf >= min_conf and cat in EXCLUDE_CATEGORIES:
                    if inc.relevant:
                        inc.relevant = False
                        inc.relevance_reason = f"LLM 판정: {cat} — {out.get('reason', '')}"[:220]
                        changed.append("relevant→false")
                        summary["excluded"] += 1
                else:
                    summary["low_confidence"] += 1
            elif out.get("is_new_incident") is True and not inc.relevant and conf >= min_conf and include_irrelevant:
                inc.relevant = True
                inc.relevance_reason = f"LLM 판정: {cat}"
                changed.append("relevant→true")
                summary["restored"] += 1
            if out.get("amount_is_loss") is False and conf >= min_conf and inc.amount_usd and inc.relevant:
                inc.amount_text = inc.amount_text or f"${inc.amount_usd:,.0f}"
                inc.amount_usd = None
                changed.append("amount_usd→null (not a loss)")
                summary["amount_cleared"] += 1
            if changed:
                inc.enrich_note = (inc.enrich_note + " | " if inc.enrich_note else "") + "review " + datetime.now().strftime("%m-%d") + ": " + ",".join(changed)
                _save_retry(store, inc)
                summary["days"].add(inc.collected_at[:10])
            log.info("[review] %-34s | %-24s | new=%s conf=%.2f | %s", (inc.project or inc.title)[:34], cat, out.get("is_new_incident"), conf, ",".join(changed) or "-")
            lf.write(json.dumps({"ts": datetime.now().isoformat(timespec="seconds"), "uid": inc.uid, "project": inc.project, "source": inc.source,
                                 "day": inc.collected_at[:10], "out": out, "changed": changed}, ensure_ascii=False) + "\n")
    summary["days"] = sorted(summary["days"])
    return summary


# ---------------------------------------------------------------------------
# 교차 감사(audit): 최근 병합 사건 목록을 한 번에 LLM 에 보여 중복·금액·유형·날짜·이름 문제를 찾고,
# 확신도 0.85 이상의 '같은 사건' 판정은 merge_decisions 캐시에 넣어 다음 병합에서 자동으로 합쳐지게 한다.
# ---------------------------------------------------------------------------
def _obj(props, req):
    return {"type": "object", "properties": props, "required": req, "additionalProperties": False}


_NUM = {"type": "number"}
_S = {"type": "string"}
AUDIT_SCHEMA = _obj({
    "duplicates": {"type": "array", "items": _obj({"uids": {"type": "array", "items": _S}, "representative": _S, "confidence": _NUM, "evidence": _S}, ["uids", "representative", "confidence", "evidence"])},
    "wrong_amount": {"type": "array", "items": _obj({"uid": _S, "suggested_amount_usd": {"anyOf": [_NUM, {"type": "null"}]}, "confidence": _NUM, "evidence": _S}, ["uid", "suggested_amount_usd", "confidence", "evidence"])},
    "wrong_type": {"type": "array", "items": _obj({"uid": _S, "suggested_type": _S, "confidence": _NUM, "evidence": _S}, ["uid", "suggested_type", "confidence", "evidence"])},
    "wrong_date": {"type": "array", "items": _obj({"uid": _S, "suggested_date": {"anyOf": [_S, {"type": "null"}]}, "confidence": _NUM, "evidence": _S}, ["uid", "suggested_date", "confidence", "evidence"])},
    "not_incident": {"type": "array", "items": _obj({"uid": _S, "category": _S, "confidence": _NUM, "evidence": _S}, ["uid", "category", "confidence", "evidence"])},
    "naming": {"type": "array", "items": _obj({"uid": _S, "suggested_name": _S, "confidence": _NUM, "evidence": _S}, ["uid", "suggested_name", "confidence", "evidence"])},
    "overall": _S,
}, ["duplicates", "wrong_amount", "wrong_type", "wrong_date", "not_incident", "naming", "overall"])


def mentions_amount(text: str, amount: Optional[float]) -> bool:
    """근거 문장에 카드의 금액이 있는가: '$121,000' · '121,000' · '$121K' · '$0.12M' · '$118 M' 같은 표기를 ±1.5% 로 비교."""
    if not text or not amount:
        return False
    for m in re.finditer(r"\$?\s?(\d[\d,]*(?:\.\d+)?)\s*(K|M|B|million|billion|thousand)?\b", text, flags=re.I):
        try:
            v = float(m.group(1).replace(",", ""))
        except ValueError:
            continue
        unit = (m.group(2) or "").lower()
        v *= {"k": 1e3, "thousand": 1e3, "m": 1e6, "million": 1e6, "b": 1e9, "billion": 1e9}.get(unit, 1)
        if v > 0 and abs(v - amount) / amount <= 0.015:  # 3% 면 $118K 와 $121K 가 같다고 본다 → 1.5%
            return True
    return False


def run_audit(store: Store, provider: LLMProvider, data_dir: str, days: int = 30, max_tokens: int = 8000, min_conf: float = 0.85, apply: bool = True) -> dict:
    """최근 days 일 병합 사건을 LLM 에 한 번에 보여 교차 검토. 자동 반영: 중복(merge_decisions), 사건 아님(제외 카테고리만), 금액 null 화, 이름·유형·날짜."""
    from datetime import date, timedelta
    from .dedupe import LLMJudge
    from .merge import mark_followups, merge_incidents
    judge = LLMJudge(None, store)
    today = date.today()
    lo = (today - timedelta(days=days)).isoformat()
    days_list = [r[0] for r in store.conn.execute("SELECT DISTINCT substr(collected_at,1,10) d FROM incidents WHERE relevant=1 AND substr(collected_at,1,10)>=? ORDER BY d", (lo,))]
    history: List[Incident] = []
    merged: List[Incident] = []
    for d in days_list:
        m = [i for i in merge_incidents(store.incidents_collected_on(d), judge) if i.relevant]
        mark_followups(m, history, judge)
        history += m
        merged += m
    listing = [{
        "uid": i.uid, "project": i.project or i.title, "type": i.incident_type, "event_date": i.incident_date, "reported": (i.published_at or "")[:10],
        "amount_usd": i.amount_usd, "amount_text": (i.amount_text or "")[:40], "chains": i.chains[:3],
        "sources": sorted({i.source, *[m.get("source") for m in i.merged_from if m.get("source")]}),
        "followup_of": (i.followup_of or {}).get("project") if i.followup_of else None,
        "summary": (i.summary_ko or i.summary_en or "")[:160],
    } for i in merged]
    def ask(items: List[dict]) -> Optional[dict]:
        user = f"최근 {days}일 사건 {len(items)}건:\n" + json.dumps(items, ensure_ascii=False)
        return provider.complete_json(AUDIT_SYSTEM, user, AUDIT_SCHEMA, max_tokens)

    # gpt-oss 는 카드가 60건을 넘으면 추론 토큰이 폭주해 JSON 이 잘린다 → 추론 수준을 낮추고, 그래도 안 되면 겹치는 두 구간으로 나눠 묻는다
    old_think = getattr(provider, "think", None)
    if isinstance(old_think, (bool, str)):
        provider.think = "low"
    try:
        out = ask(listing)
        if not out and len(listing) > 30:
            half = len(listing) // 2 + 8
            parts = [x for x in (ask(listing[:half]), ask(listing[len(listing) - half:])) if x]
            if parts:
                out = {}
                for key in ("duplicates", "wrong_amount", "wrong_type", "wrong_date", "not_incident", "naming"):
                    seen = set()
                    merged_items = []
                    for part in parts:
                        for it in (part.get(key) or []):
                            sig = json.dumps(it, ensure_ascii=False, sort_keys=True)
                            if sig not in seen:
                                seen.add(sig)
                                merged_items.append(it)
                    out[key] = merged_items
                out["overall"] = " / ".join(str(part.get("overall") or "") for part in parts if part.get("overall"))
                out["_chunked"] = True
    finally:
        if isinstance(old_think, (bool, str)):
            provider.think = old_think
    if not out:
        return {"error": "LLM 이 JSON 을 내놓지 않음", "listed": len(listing)}
    by_uid = {i.uid: i for i in merged}
    applied = {"duplicates": 0, "not_incident": 0, "amount": 0, "naming": 0, "type": 0, "date": 0}
    applied_ids: Dict[str, set] = {k: set() for k in ("duplicates", "not_incident", "wrong_amount", "wrong_type", "wrong_date")}
    conf_of = lambda it: float(it.get("confidence") or 0)
    if apply:
        for g in out.get("duplicates") or []:
            uids = [u for u in g.get("uids") or [] if u in by_uid]
            linked = {(by_uid[u].followup_of or {}).get("uid") for u in uids if by_uid[u].followup_of}
            if len(uids) >= 2 and conf_of(g) >= min_conf and not linked & set(uids):
                rep = g.get("representative") if g.get("representative") in uids else uids[0]
                for u in uids:
                    if u != rep:
                        store.set_merge_decision(rep, u, True, "audit: " + (g.get("evidence") or "")[:160])
                applied["duplicates"] += 1
                applied_ids["duplicates"].add(tuple(sorted(uids)))
        for it in out.get("not_incident") or []:
            inc = by_uid.get(it.get("uid"))
            if inc and conf_of(it) >= min_conf and it.get("category") in EXCLUDE_CATEGORIES:
                inc.relevant = False
                inc.relevance_reason = ("LLM 교차감사: " + str(it.get("category")) + " — " + (it.get("evidence") or ""))[:220]
                _save_retry(store, inc)
                applied["not_incident"] += 1
                applied_ids["not_incident"].add(inc.uid)
        for it in out.get("wrong_amount") or []:
            inc = by_uid.get(it.get("uid"))
            # 법집행 카드의 금액은 '제재·수사 금액'으로 따로 집계하므로 지우지 않는다. 근거가 카드의 금액을 언급해야 한다(다른 카드 요약을 잘못 대입한 경우 차단).
            if (inc and conf_of(it) >= min_conf and it.get("suggested_amount_usd") is None and inc.amount_usd
                    and inc.incident_type not in ("sanctions_designation", "law_enforcement_action", "laundering_report")
                    and mentions_amount(it.get("evidence") or "", inc.amount_usd)):
                inc.amount_text = inc.amount_text or ("$" + format(inc.amount_usd, ",.0f"))
                inc.amount_usd = None
                inc.enrich_note = (inc.enrich_note or "") + " | audit: amount not a loss"
                _save_retry(store, inc)
                applied["amount"] += 1
                applied_ids["wrong_amount"].add(inc.uid)
        # 이름 제안은 LLM 이 장황한 설명형 이름을 내놓는 경우가 많아 자동 반영하지 않는다(보고서에서 사람이 판단).
        for it in out.get("wrong_type") or []:
            inc = by_uid.get(it.get("uid"))
            st = it.get("suggested_type")
            # 유형은 '해킹으로 잘못 분류된 법집행·피싱' 같은 hack_exploit 출발만 자동 반영(그 외는 보고). 확신도 0.9 이상.
            if inc and st in INCIDENT_TYPES and conf_of(it) >= max(min_conf, 0.9) and st != inc.incident_type and inc.incident_type == "hack_exploit":
                inc.enrich_note = (inc.enrich_note or "") + " | audit: type " + inc.incident_type + "->" + st
                inc.incident_type = st
                _save_retry(store, inc)
                applied["type"] += 1
                applied_ids["wrong_type"].add(inc.uid)
        for it in out.get("wrong_date") or []:
            inc = by_uid.get(it.get("uid"))
            nd = _iso(it.get("suggested_date"))
            # 날짜는 비어 있을 때만 채운다(기존 날짜를 근거 없이 바꾸는 일이 있었다). 게시일 이후 날짜는 거부.
            if inc and nd and conf_of(it) >= min_conf and (not inc.published_at or nd <= inc.published_at[:10]) and not inc.incident_date:
                inc.enrich_note = (inc.enrich_note or "") + " | audit: date " + str(inc.incident_date) + "->" + nd
                inc.incident_date = nd
                _save_retry(store, inc)
                applied["date"] += 1
                applied_ids["wrong_date"].add(inc.uid)
    # 사람이 볼 보고서: 자동 반영 여부와 낮은 확신도 항목까지 전부
    def name(u):
        return (by_uid[u].project or by_uid[u].title) if u in by_uid else str(u)
    lines = ["# 교차 감사 " + today.isoformat() + " — 최근 " + str(days) + "일 " + str(len(listing)) + "건", "", out.get("overall", ""), ""]
    for key, title in (("duplicates", "중복 의심"), ("not_incident", "사건 아님"), ("wrong_amount", "금액 의심"), ("wrong_type", "유형 의심"), ("wrong_date", "날짜 의심"), ("naming", "이름 제안")):
        items = out.get(key) or []
        lines.append("")
        lines.append("## " + title + " (" + str(len(items)) + ")")
        for it in items:
            conf = conf_of(it)
            auto_ok = (tuple(sorted(u for u in (it.get("uids") or []) if u in by_uid)) in applied_ids["duplicates"]) if key == "duplicates" else (it.get("uid") in applied_ids.get(key, set()))
            tag = "자동 반영" if auto_ok else "검토 필요"
            if key == "duplicates":
                lines.append("- [" + tag + " " + format(conf, ".2f") + "] " + " ↔ ".join(name(u) for u in it.get("uids") or []) + " — " + (it.get("evidence") or ""))
            else:
                sug = it.get("suggested_amount_usd") if key == "wrong_amount" else it.get("suggested_type") if key == "wrong_type" else it.get("suggested_date") if key == "wrong_date" else it.get("suggested_name") if key == "naming" else it.get("category")
                lines.append("- [" + tag + " " + format(conf, ".2f") + "] " + name(it.get("uid")) + " → " + str(sug) + " — " + (it.get("evidence") or ""))
    os.makedirs(os.path.join(data_dir, "audits"), exist_ok=True)
    path = os.path.join(data_dir, "audits", today.isoformat() + ".md")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    with open(os.path.join(data_dir, "audits", today.isoformat() + ".json"), "w", encoding="utf-8") as f:
        json.dump({"listing": listing, "out": out, "applied": applied}, f, ensure_ascii=False, indent=1)
    return {"listed": len(listing), "found": {k: len(out.get(k) or []) for k in ("duplicates", "not_incident", "wrong_amount", "wrong_type", "wrong_date", "naming")}, "applied": applied, "report": path}
