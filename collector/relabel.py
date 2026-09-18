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
from .models import INCIDENT_TYPES, Incident
from .prompts import RELABEL_SYSTEM
from .store import Store
from .textextract import html_to_text

log = logging.getLogger("collector.relabel")

ATTACK_ONCHAIN = {"hack_exploit", "private_key_compromise", "rug_pull", "phishing_social_engineering"}
LEGAL = {"sanctions_designation", "law_enforcement_action", "laundering_report"}
LEGAL_WORDS = re.compile(r"\b(indict|indicted|sentenc|charged|charges|plead|guilty|ofac|sanction|seiz|forfeit|arrest|extradit|convict|doj|prosecut)\w*", re.I)
ATTACK_WORDS = re.compile(r"\b(exploit|hack|hacked|drain|drained|rug|flash.?loan|reentrancy|oracle|private key|compromis)\w*", re.I)
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
def fetch_text(http: Http, inc: Incident, max_chars: int = 30000) -> str:
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
    # 금액
    new_a = out.get("amount_usd")
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
    if new_p and new_p != inc.project and len(new_p) <= 60 and new_p.lower() != (inc.title or "").strip().lower():
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
