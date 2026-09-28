"""하루치 사건 카드를 모아 한/영 브리핑을 쓴다 — 구조화 방식.

형식(제목·순서·불릿 골격·사건명·금액·날짜·체인)은 코드가 정하고, LLM 은 사건별 '한 줄 설명'과 '시사점'만 쓴다.
그래서 매일 같은 순서·같은 골격으로 나오고, 숫자와 날짜는 카드 값과 항상 일치한다.

골격:
  headline:  9월 18일 브리핑 · 신규 5건 · 피해 $7.8M            (법집행 금액이 있으면 " · 제재·수사 $245M" 덧붙임)
  - **[사건명](url)** · 체인 · 유형 · **$금액** · 사건일 — 한 줄 설명 (BL n)
  - **후속 N건** — 이름(첫 보도일) …
  - **소액·unknown N건** — 이름 $금액, 이름 금액 unknown …
  - **시사점** — 한 문장
"""
from __future__ import annotations

import json
import logging
import re
from datetime import date
from typing import Dict, List, Optional

from .llm import LLMProvider, clean_text
from .models import INCIDENT_TYPE_KO, Incident
from .prompts import briefing_lines_system_prompt

log = logging.getLogger("collector.briefing")

LEGAL = {"sanctions_designation", "law_enforcement_action", "laundering_report"}
MINOR_USD = 100_000
TYPE_EN = {"hack_exploit": "Hack", "private_key_compromise": "Key compromise", "rug_pull": "Rug pull", "phishing_social_engineering": "Phishing",
           "scam_fraud": "Scam", "ransomware": "Ransomware", "sanctions_designation": "Sanctions", "law_enforcement_action": "Enforcement",
           "laundering_report": "Laundering report", "other": "Other"}
TYPE_KO_SHORT = {"hack_exploit": "해킹", "private_key_compromise": "개인키 탈취", "rug_pull": "러그풀", "phishing_social_engineering": "피싱",
                 "scam_fraud": "사기", "ransomware": "랜섬웨어", "sanctions_designation": "제재", "law_enforcement_action": "수사·기소",
                 "laundering_report": "세탁 분석", "other": "기타"}

LINES_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {"type": "array", "items": {"type": "object", "properties": {"uid": {"type": "string"}, "line_ko": {"type": "string"}, "line_en": {"type": "string"}},
                                             "required": ["uid", "line_ko", "line_en"], "additionalProperties": False}},
        "insight_ko": {"type": "string"}, "insight_en": {"type": "string"},
    },
    "required": ["items", "insight_ko", "insight_en"], "additionalProperties": False,
}


# ---------------------------------------------------------------------------
# 포맷 도우미
# ---------------------------------------------------------------------------
def money(v: Optional[float]) -> str:
    if v is None:
        return ""
    if v >= 1e9:
        s = f"{v / 1e9:.2f}".rstrip("0").rstrip("."); return f"${s}B"
    if v >= 1e6:
        s = f"{v / 1e6:.1f}".rstrip("0").rstrip("."); return f"${s}M"
    if v >= 1e3:
        return f"${round(v / 1e3):,}K"
    return f"${round(v):,}"


def event_date(i: Incident) -> str:
    pub = (i.published_at or "")[:10] if re.match(r"^\d{4}-\d{2}-\d{2}", i.published_at or "") else ""
    return (pub or i.incident_date or "") if i.incident_type in LEGAL else (i.incident_date or pub or "")


def d_ko(d: str) -> str:
    return f"{int(d[5:7])}월 {int(d[8:10])}일" if d and len(d) >= 10 else "날짜 미상"


_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def d_en(d: str) -> str:
    if not d or len(d) < 10:
        return "date n/a"
    dt = date.fromisoformat(d[:10])
    return f"{_MON[dt.month - 1]} {dt.day}"


def md_short(d: str) -> str:
    return f"{int(d[5:7])}.{int(d[8:10])}" if d and len(d) >= 10 else "날짜 미상"


def _strip_line(s: str, project: str, max_len: int = 60) -> str:
    s = clean_text(s or "").strip().rstrip(".。 ")
    if project and s.lower().startswith(project.lower()):
        s = s[len(project):].lstrip(" -—:·,")
    s = re.sub(r"\s?\$[\d.,]+\s*[KMB]?\b", " ", s)  # 금액은 골격이 붙이므로 본문에서 제거(양쪽 공백은 하나로)
    # "약 1,530,000달러", "150만 달러", "1.5M USD", "462,730 dollars" 같은 표기도 제거 (골격의 $ 금액과 중복)
    s = re.sub(r"(?:약|around|about|approx\.?|roughly)?\s*\$?\d[\d,]*(?:\.\d+)?\s*(?:[KMB]|만|억|천만|백만)?\s*(?:달러|dollars?|USD|usd)(?:\s*(?:상당|어치|규모|worth))?", "\x00", s)
    s = re.sub(r"\x00\s*(?:가|이|을|를|은|는|의|로|으로)?(?=\s|$)", " ", s)  # 금액 뒤에 붙어 있던 조사("…달러가", "…상당의")도 함께 제거
    s = s.replace("\x00", " ")
    s = re.sub(r"약\s+(?=(?:규모|상당|어치|의\s))", "", s)
    s = re.sub(r"\s{2,}", " ", s).strip(" -—,·")
    # 로컬 LLM 이 한글 띄어쓰기를 통째로 빼먹는 경우 → 폴백 사용을 위해 빈 문자열
    if len(s) > 15 and re.search(r"[가-힣]", s) and s.count(" ") < len(s) / 15:
        return ""
    if len(s) > max_len:
        cut = max(s.rfind(",", 0, max_len), s.rfind(" ", 0, max_len))
        s = s[: cut if cut > max_len * 0.5 else max_len].rstrip(" ,") + "…"
    if len(s.strip("…. ")) < 6:  # 금액만 있던 줄은 제거 후 조각만 남는다 → 폴백 사용
        return ""
    return s


_TYPE_LINE_KO = {"private_key_compromise": "개인키 유출로 자산 탈취", "hack_exploit": "취약점을 이용한 자산 탈취", "phishing_social_engineering": "피싱으로 자산 탈취",
                 "rug_pull": "러그풀", "sanctions_designation": "제재 지정", "law_enforcement_action": "수사·기소", "laundering_report": "자금세탁 보고",
                 "ransomware": "랜섬웨어", "scam_fraud": "사기"}


def _fallback_line(i: Incident, lang: str) -> str:
    """LLM 한 줄이 없을 때: 카드의 수법/요약 첫 문장. 한국어 브리핑인데 한글이 없으면(규칙 기반 DeFiLlama 카드의 영문 분류) 유형별 한국어 문구로."""
    src = (i.attack_method_ko if lang == "ko" else i.attack_method_en) or (i.summary_ko if lang == "ko" else i.summary_en) or ""
    first = re.split(r"(?<=[.!?。])\s+", src.strip())[0] if src.strip() else ""
    out = _strip_line(first, i.project)[:80]
    if lang == "ko" and (len(out) < 6 or not re.search(r"[가-힣]", out)):
        return _TYPE_LINE_KO.get(i.incident_type, "추가 정보 없음")
    if lang == "en" and len(out) < 6:
        return "no further detail"
    return out


def _digest(cards: List[Incident]) -> str:
    return json.dumps([{
        "uid": i.uid, "project": i.project or i.title, "type": i.incident_type, "type_ko": INCIDENT_TYPE_KO.get(i.incident_type, i.incident_type),
        "method": i.attack_method_ko or i.attack_method_en, "summary": i.summary_ko or i.summary_en, "fund_flow": i.fund_flow_ko or i.fund_flow_en,
        "actors": i.actors[:5], "followup_of": (i.followup_of or {}).get("project") if i.followup_of else None,
    } for i in cards], ensure_ascii=False)


# ---------------------------------------------------------------------------
# 조립
# ---------------------------------------------------------------------------
def _bullet(i: Incident, line: str, lang: str) -> str:
    name = i.project or i.title
    link = f"**[{name}]({i.url})**" if i.url else f"**{name}**"
    chain = i.chains[0] if i.chains else ("체인 미상" if lang == "ko" else "chain n/a")
    typ = TYPE_KO_SHORT.get(i.incident_type, i.incident_type) if lang == "ko" else TYPE_EN.get(i.incident_type, i.incident_type)
    amt = money(i.amount_usd) or (i.amount_text or ("금액 unknown" if lang == "ko" else "amount n/a"))
    d = event_date(i)
    when = md_short(d) if lang == "ko" else d_en(d)
    parts = [link] + ([] if i.incident_type in LEGAL else [chain]) + [typ, f"**{amt}**", when]
    tail = f" (BL {len(i.blacklist_hits)})" if i.blacklist_hits else ""
    return f"- {' · '.join(parts)} — {line}{tail}"


def assemble(day: str, cards: List[Incident], lines: Dict[str, dict], insight_ko: str, insight_en: str) -> dict:
    new = [i for i in cards if not i.followup_of]
    follow = [i for i in cards if i.followup_of]
    major = sorted([i for i in new if (i.amount_usd or 0) >= MINOR_USD or i.incident_type in LEGAL and i.amount_usd], key=lambda i: -(i.amount_usd or 0))
    minor = [i for i in new if i not in major]
    minor.sort(key=lambda i: -(i.amount_usd or 0))
    loss = sum(i.amount_usd or 0 for i in new if i.incident_type not in LEGAL)
    legal = sum(i.amount_usd or 0 for i in new if i.incident_type in LEGAL)
    head_ko = f"{d_ko(day)} 브리핑 · 신규 {len(new)}건" + (f" · 피해 {money(loss)}" if loss else "") + (f" · 제재·수사 {money(legal)}" if legal else "") + (f" · 후속 {len(follow)}건" if follow else "")
    head_en = f"{d_en(day)} briefing · {len(new)} new" + (f" · loss {money(loss)}" if loss else "") + (f" · enforcement {money(legal)}" if legal else "") + (f" · {len(follow)} follow-ups" if follow else "")
    ko, en = [], []
    for i in major:
        l = lines.get(i.uid, {})
        ko.append(_bullet(i, _strip_line(l.get("line_ko", ""), i.project) or _fallback_line(i, "ko"), "ko"))
        en.append(_bullet(i, _strip_line(l.get("line_en", ""), i.project) or _fallback_line(i, "en"), "en"))
    if minor:
        item_ko = ", ".join(f"[{i.project or i.title}]({i.url}) {money(i.amount_usd) or (i.amount_text or '금액 unknown')}" for i in minor)
        item_en = ", ".join(f"[{i.project or i.title}]({i.url}) {money(i.amount_usd) or (i.amount_text or 'amount n/a')}" for i in minor)
        ko.append(f"- **소액·unknown {len(minor)}건** — {item_ko}")
        en.append(f"- **Smaller / unknown ({len(minor)})** — {item_en}")
    if follow:
        f_ko, f_en = [], []
        for i in follow:
            l = lines.get(i.uid, {})
            note_ko = _strip_line(l.get("line_ko", ""), i.project, 40); note_en = _strip_line(l.get("line_en", ""), i.project, 48)
            first = md_short((i.followup_of or {}).get("day") or "")
            # 후속 줄은 이름과 첫 보도일만 (수법 요약을 덧붙이면 줄이 길어지고 잘려서 읽히지 않는다 — 2026-09-21)
            del note_ko, note_en
            f_ko.append(f"[{i.project or i.title}]({i.url}) (첫 보도 {first})")
            f_en.append(f"[{i.project or i.title}]({i.url}) (first {first})")
        ko.append(f"- **후속 {len(follow)}건** — " + ", ".join(f_ko))
        en.append(f"- **Follow-ups ({len(follow)})** — " + ", ".join(f_en))
    if insight_ko:
        ko.append(f"- **시사점** — {clean_text(insight_ko).rstrip('.。 ')}.")
    if insight_en:
        en.append(f"- **Takeaway** — {clean_text(insight_en).rstrip('. ')}.")
    return {"headline_ko": head_ko, "headline_en": head_en, "briefing_ko": "\n".join(ko), "briefing_en": "\n".join(en),
            "counts": {"new": len(new), "followups": len(follow), "major": len(major), "minor": len(minor), "loss_usd": loss, "legal_usd": legal},
            "format": "structured-v2"}


def write_briefing(provider: Optional[LLMProvider], day: str, incidents: List[Incident], max_tokens: int = 4000,
                   prompt_style: str = "few_shot") -> Optional[dict]:
    cards = [i for i in incidents if i.relevant]
    if not cards:
        return {"headline_ko": f"{d_ko(day)} 브리핑 · 신규 사건 없음", "headline_en": f"{d_en(day)} briefing · no new incidents",
                "briefing_ko": "- 수집된 신규 관련 사건이 없습니다.", "briefing_en": "- No new relevant incidents were collected.", "format": "structured-v2"}
    lines: Dict[str, dict] = {}
    insight_ko = insight_en = ""
    if provider is not None:
        try:
            data = provider.complete_json(briefing_lines_system_prompt(prompt_style), f"날짜: {day}\n사건 카드 {len(cards)}건:\n{_digest(cards)}", LINES_SCHEMA, max_tokens)
        except Exception as e:
            log.error("브리핑 한 줄 생성 실패(폴백 사용): %s", str(e)[:300])
            data = None
        if data:
            for it in data.get("items") or []:
                if it.get("uid"):
                    lines[it["uid"]] = it
            insight_ko, insight_en = data.get("insight_ko", ""), data.get("insight_en", "")
    return assemble(day, cards, lines, insight_ko, insight_en)
