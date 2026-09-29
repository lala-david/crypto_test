"""LLM으로 사건 카드(배경·수법·요약·자금흐름·주소 역할, 한/영) 생성. 실패 시 규칙 기반 폴백."""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Iterable, List, Optional

from pydantic import BaseModel, Field, ValidationError

from .addresses import extract_addresses, extract_tx_hashes, infer_chain, merge_addresses
from .llm import LLMProvider, clean_text
from .prompts import card_system_prompt
from .models import INCIDENT_TYPES, ROLES, Address, Incident, RawItem

log = logging.getLogger("collector.enrich")


# ---------------------------------------------------------------------------
# 출력 스키마
# ---------------------------------------------------------------------------
class AddressOut(BaseModel):
    chain: str = ""
    address: str
    role: str = "unknown"
    note: str = ""


class EnrichOut(BaseModel):
    relevant: bool
    relevance_reason: str = ""
    incident_type: str = "other"
    project: str = ""
    incident_date: Optional[str] = None
    chains: List[str] = Field(default_factory=list)
    amount_usd: Optional[float] = None
    amount_text: str = ""
    attack_method_ko: str = ""
    background_ko: str = ""
    summary_ko: str = ""
    fund_flow_ko: str = ""
    attack_method_en: str = ""
    background_en: str = ""
    summary_en: str = ""
    fund_flow_en: str = ""
    actors: List[str] = Field(default_factory=list)
    addresses: List[AddressOut] = Field(default_factory=list)
    tx_hashes: List[str] = Field(default_factory=list)


_STR = {"type": "string"}
JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "relevant": {"type": "boolean"},
        "relevance_reason": _STR,
        "incident_type": {"type": "string", "enum": list(INCIDENT_TYPES)},
        "project": _STR,
        "incident_date": {"anyOf": [{"type": "string"}, {"type": "null"}]},
        "chains": {"type": "array", "items": _STR},
        "amount_usd": {"anyOf": [{"type": "number"}, {"type": "null"}]},
        "amount_text": _STR,
        "attack_method_ko": _STR,
        "background_ko": _STR,
        "summary_ko": _STR,
        "fund_flow_ko": _STR,
        "attack_method_en": _STR,
        "background_en": _STR,
        "summary_en": _STR,
        "fund_flow_en": _STR,
        "actors": {"type": "array", "items": _STR},
        "addresses": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "chain": _STR,
                    "address": _STR,
                    "role": {"type": "string", "enum": list(ROLES)},
                    "note": _STR,
                },
                "required": ["chain", "address", "role", "note"],
                "additionalProperties": False,
            },
        },
        "tx_hashes": {"type": "array", "items": _STR},
    },
    "required": [
        "relevant", "relevance_reason", "incident_type", "project", "incident_date", "chains", "amount_usd",
        "amount_text", "attack_method_ko", "background_ko", "summary_ko", "fund_flow_ko",
        "attack_method_en", "background_en", "summary_en", "fund_flow_en", "actors", "addresses", "tx_hashes",
    ],
    "additionalProperties": False,
}



def build_user_prompt(item: RawItem, max_chars: int) -> str:
    text = item.text or ""
    truncated = False
    if len(text) > max_chars:
        text = text[:max_chars]
        truncated = True
        log.warning("[%s] 본문 %d자 → %d자로 잘라서 전달: %s", item.source, len(item.text), max_chars, item.url)
    parts = [f"출처: {item.source}", f"제목: {item.title}", f"게시일: {item.published_at}", f"URL: {item.url}"]
    if item.tags:
        parts.append("태그: " + ", ".join(item.tags))
    if item.summary_hint:
        parts.append("요약(메타): " + item.summary_hint)
    if item.structured:
        parts.append("구조화 데이터: " + json.dumps(item.structured, ensure_ascii=False)[:4000])
    if item.addresses:
        parts.append("소스가 명시한 주소: " + json.dumps([a.__dict__ for a in item.addresses], ensure_ascii=False)[:4000])
    parts.append("\n본문:\n" + text + ("\n[본문이 길어 일부 잘림]" if truncated else ""))
    return "\n".join(parts)


class Enricher:
    """공급자(provider)에 사건 카드 생성을 위임. 공급자가 없거나 죽으면 스스로 비활성화."""

    def __init__(self, provider: Optional[LLMProvider], cfg: dict):
        self.provider = provider
        self.enabled = provider is not None
        self.max_chars = int(cfg.get("max_chars", 60000))
        self.max_tokens = int(cfg.get("max_tokens", 8000))
        self.system_prompt = card_system_prompt(cfg.get("prompt_style", "few_shot"))
        self.disabled_reason = "" if provider else "LLM 공급자 없음(config.llm 확인)"
        self.model = provider.describe() if provider else ""
        self._consecutive_errors = 0

    def enrich(self, item: RawItem) -> Optional[EnrichOut]:
        if not self.enabled:
            return None
        try:
            data = self.provider.complete_json(self.system_prompt, build_user_prompt(item, self.max_chars),
                                               JSON_SCHEMA, self.max_tokens)
        except Exception as e:
            self._consecutive_errors += 1
            log.error("LLM 호출 실패(%d회 연속): %s", self._consecutive_errors, str(e)[:300])
            if self._consecutive_errors >= 3:
                self.enabled = False
                self.disabled_reason = "LLM 호출 연속 실패: " + str(e)[:120]
            return None
        self._consecutive_errors = 0
        if not data:
            return None
        try:
            return EnrichOut.model_validate(data)
        except ValidationError as e:
            log.error("출력 검증 실패: %s", str(e)[:300])
            return None


# ---------------------------------------------------------------------------
# 규칙 기반 폴백 + 병합
# ---------------------------------------------------------------------------
_AMOUNT_RE = re.compile(r"\$\s?([\d][\d,]*(?:\.\d+)?)\s*(billion|million|thousand|bn|mn|[bmk])?\b", re.I)


def guess_amount_usd(text: str) -> Optional[float]:
    best = None
    for m in _AMOUNT_RE.finditer(text or ""):
        try:
            v = float(m.group(1).replace(",", ""))
        except ValueError:
            continue
        unit = (m.group(2) or "").lower()
        if unit in ("billion", "bn", "b"):
            v *= 1e9
        elif unit in ("million", "mn", "m"):
            v *= 1e6
        elif unit in ("thousand", "k"):
            v *= 1e3
        if best is None or v > best:
            best = v
    return best


def keyword_relevant(item: RawItem, kw_cfg: dict) -> bool:
    from .keywords import keyword_hit

    return keyword_hit(f"{item.title}\n{item.summary_hint}\n{item.text[:5000]}", kw_cfg)


_ATTACK_FAMILY = {"hack_exploit", "private_key_compromise", "rug_pull", "phishing_social_engineering", "scam_fraud", "ransomware"}


def is_stale_reference(incident_date, published_at, incident_type, max_days: int = 365) -> bool:
    """사건일이 게시일보다 1년 이상 이전인 공격 기사 = 과거 사건을 되짚는 회고 기사(예: 2026-09 에 나온 Bybit 2025-02 해킹 기사)."""
    if not incident_date or not published_at or incident_type not in _ATTACK_FAMILY:
        return False
    try:
        d0 = datetime.strptime(incident_date[:10], "%Y-%m-%d")
        d1 = datetime.strptime(published_at[:10], "%Y-%m-%d")
    except ValueError:
        return False
    return (d1 - d0).days > max_days


def chains_from_text(text: str, kw_cfg: dict, limit: int = 3) -> List[str]:
    """본문에서 체인 이름(config keywords.chains)을 단어 경계로 찾아 등장 순서대로 돌려준다. 카드 chains 가 비었을 때의 폴백."""
    names = [str(c) for c in (kw_cfg or {}).get("chains", []) if c]
    found: List[str] = []
    low = text or ""
    for n in sorted(names, key=len, reverse=True):
        nl = n.lower().rstrip("*")
        if len(nl) < 3:
            continue
        m = re.search(r"(?<![a-z0-9])" + re.escape(nl) + r"(?![a-z0-9])", low, re.I)
        if m:
            found.append((m.start(), n.rstrip("*")))
    out: List[str] = []
    for _, n in sorted(found):
        if n not in out:
            out.append(n)
    return out[:limit]


PENDING_REASON = "LLM 미처리(공급자 실패) — 다음 실행에서 재시도"


def backfill_stamp(inc: Incident, item: RawItem) -> Incident:
    """과거 사건 백필용: 수집 시각을 사건일(없으면 게시일)로 두어 '오늘 카드'에 섞이지 않게 하고, 구조화 소스(확정 사고 목록)의 항목은 관련 사건으로 확정한다."""
    day = (inc.incident_date or (item.published_at or "")[:10] or inc.collected_at[:10])[:10]
    inc.collected_at = f"{day}T00:00:00"
    if "backfill" not in inc.tags:
        inc.tags = list(inc.tags) + ["backfill"]
    if (item.structured or {}).get("incident_type"):
        inc.relevant = True
        inc.relevance_reason = inc.relevance_reason or "backfill: 구조화 소스(확정 사고 목록)"
    return inc


def finalize_unenriched(inc: Incident, item: RawItem, llm_expected: bool) -> bool:
    """LLM 이 필요한 항목인데 LLM 이 실패해 규칙 기반으로만 만들어진 카드는 공개하지 않는다(relevant=False).
    True 를 돌려주면 호출자가 항목을 pending_llm 으로 표시해 다음 실행에서 다시 처리한다. --no-llm 처럼 애초에 LLM 을 안 쓰는 실행은 해당 없음."""
    if not llm_expected or not item.needs_llm or inc.enriched:
        return False
    inc.relevant = False
    inc.relevance_reason = PENDING_REASON
    inc.enrich_note = (inc.enrich_note + " · " if inc.enrich_note else "") + "pending_llm"
    return True


def build_incident(item: RawItem, out: Optional[EnrichOut], model: str, kw_cfg: dict, note: str = "",
                   ignore_addresses: Optional[Iterable[str]] = None) -> Incident:
    """LLM 결과(있으면) + 정규식 추출 + 소스 구조화 필드를 합쳐 Incident 생성."""
    now = datetime.now().isoformat(timespec="seconds")
    s = item.structured or {}
    ignore = {str(a).lower() for a in (ignore_addresses or [])}
    text_for_regex = f"{item.title}\n{item.summary_hint}\n{item.text}"
    regex_addrs = [a for a in extract_addresses(text_for_regex, hint_chains=s.get("chains")) if a.address.lower() not in ignore]
    regex_txs = extract_tx_hashes(text_for_regex)

    inc = Incident(
        uid=item.uid, source=item.source, source_id=item.source_id, url=item.url, title=item.title,
        published_at=item.published_at, collected_at=now, tags=list(item.tags), structured=s,
    )

    if out is not None:
        llm_addrs: List[Address] = []
        haystack = text_for_regex.lower() + json.dumps([a.__dict__ for a in item.addresses]).lower()
        for a in out.addresses:
            addr = (a.address or "").strip()
            if not addr or addr.lower() not in haystack:
                log.warning("본문에 없는 주소를 모델이 반환 → 무시: %s", addr[:20])
                continue
            if addr.lower() in ignore:
                continue
            role = a.role if a.role in ROLES else "unknown"
            llm_addrs.append(Address(chain=infer_chain(addr, a.chain), address=addr, role=role, note=a.note or ""))
        inc.relevant = out.relevant
        inc.relevance_reason = out.relevance_reason
        inc.incident_type = out.incident_type if out.incident_type in INCIDENT_TYPES else "other"
        if inc.relevant and inc.incident_type == "other":
            # 해킹·탈취·러그풀·피싱·사기·랜섬웨어·제재·수사 어느 유형에도 안 들어가면 '구체적 사건'이 아니다(일반 산업 뉴스·정책·제품 소식)
            inc.relevant = False
            inc.relevance_reason = ("유형 미분류(other): 구체적 가상자산 범죄 사건 아님 · " + (out.relevance_reason or ""))[:220]
        inc.project = out.project or s.get("name", "")
        inc.incident_date = out.incident_date or s.get("incident_date")
        inc.chains = out.chains or list(s.get("chains", []))
        if is_stale_reference(inc.incident_date, item.published_at, inc.incident_type):
            inc.relevant = False
            inc.relevance_reason = "회고성 기사: 사건일이 게시일보다 1년 이상 이전 (신규 사건 아님)"
        if not inc.chains and inc.incident_type in ("hack_exploit", "private_key_compromise", "rug_pull", "phishing_social_engineering"):
            inc.chains = chains_from_text(" ".join([item.title or "", out.summary_en or "", out.attack_method_en or "", (item.text or "")[:6000]]), kw_cfg)
        inc.amount_usd = out.amount_usd if out.amount_usd is not None else s.get("amount_usd")
        inc.amount_text = out.amount_text
        inc.attack_method_ko, inc.attack_method_en = clean_text(out.attack_method_ko), clean_text(out.attack_method_en)
        inc.background_ko, inc.background_en = clean_text(out.background_ko), clean_text(out.background_en)
        inc.summary_ko, inc.summary_en = clean_text(out.summary_ko), clean_text(out.summary_en)
        inc.fund_flow_ko, inc.fund_flow_en = clean_text(out.fund_flow_ko), clean_text(out.fund_flow_en)
        inc.amount_text = clean_text(inc.amount_text)
        inc.actors = out.actors
        inc.addresses = merge_addresses(item.addresses, llm_addrs, regex_addrs)
        inc.tx_hashes = sorted(set(item.tx_hashes) | set(regex_txs) | {t.lower() for t in out.tx_hashes if t})
        inc.enriched = True
        inc.enrich_model = model
        inc.enrich_note = note
    else:
        inc.relevant = True if not item.needs_llm else keyword_relevant(item, kw_cfg)
        inc.incident_type = s.get("incident_type", "other")
        inc.project = s.get("name", "") or item.title
        inc.incident_date = s.get("incident_date")
        inc.chains = list(s.get("chains", []))
        inc.amount_usd = s.get("amount_usd") if s.get("amount_usd") is not None else guess_amount_usd(text_for_regex[:8000])
        inc.amount_text = s.get("amount_text", "")
        inc.attack_method_ko = inc.attack_method_en = s.get("attack_method", "")
        inc.summary_ko = s.get("summary", "") or item.summary_hint
        inc.summary_en = s.get("summary_en", "") or item.summary_hint
        inc.fund_flow_ko = inc.fund_flow_en = s.get("fund_flow", "")
        inc.addresses = merge_addresses(item.addresses, regex_addrs)
        inc.tx_hashes = sorted(set(item.tx_hashes) | set(regex_txs))
        inc.enriched = False
        inc.enrich_note = note or "LLM 미사용(규칙 기반)"
    return inc
