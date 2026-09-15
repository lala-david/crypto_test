"""일일 마크다운 리포트(한/영) + README 최신 브리핑 갱신."""
from __future__ import annotations

import os
import re
from collections import Counter, defaultdict
from datetime import datetime
from typing import Dict, List, Optional

from .models import INCIDENT_TYPE_KO, ROLE_KO, Incident

MAX_ADDR_ROWS = 50  # 리포트 표에 보여줄 주소 상한 (전체는 addresses.csv)

SOURCE_LABEL = {
    "rekt": "rekt.news",
    "lumos": "ChainLight Lumos",
    "defillama": "DeFiLlama Hacks",
    "trm": "TRM Labs",
    "chainalysis": "Chainalysis",
    "ofac": "OFAC Recent Actions",
    "ofac_sdn": "OFAC SDN (diff)",
    "doj": "US DOJ",
    "slowmist": "SlowMist Hacked",
    "zachxbt": "ZachXBT (Telegram)",
    "scamsniffer": "ScamSniffer",
    "defihacklabs": "DeFiHackLabs",
}
SOURCE_LABEL_KO = {**SOURCE_LABEL, "doj": "미 법무부(DOJ)"}

INCIDENT_TYPE_EN = {
    "hack_exploit": "Hack / Exploit",
    "private_key_compromise": "Key Compromise",
    "rug_pull": "Rug Pull",
    "phishing_social_engineering": "Phishing / Social Eng.",
    "scam_fraud": "Scam / Fraud",
    "ransomware": "Ransomware",
    "sanctions_designation": "Sanctions",
    "law_enforcement_action": "Law Enforcement",
    "laundering_report": "Laundering Report",
    "other": "Other",
}
ROLE_EN = {"attacker": "attacker", "laundering": "laundering", "victim": "victim", "sanctioned": "sanctioned", "unknown": "unknown"}

T = {
    "ko": dict(
        title="가상자산 해킹·범죄 지갑 동향 일일 리포트", generated="생성 시각", counts="신규 수집 {n}건 중 관련 사건 {r}건, 참고(무관) {x}건",
        briefing="오늘의 브리핑", by_source="소스별 신규 건수", src="소스", collected="수집", relevant="관련 사건",
        summary="사건 요약", none="_신규 관련 사건 없음_",
        cols="| # | 사건 | 유형 | 사건일 | 체인 | 피해/관련 금액 | 주소 수 | 출처 |", details="사건 상세",
        original="원문", date="사건일", unknown="미상", chain="체인", amount="금액", actors="관련 주체", tags="태그",
        also="다른 출처", rule="_규칙 기반 추출 결과 (LLM 요약 없음: {note})_", rehit="기존 블랙리스트 재등장",
        background="사건 배경", method="공격/범죄 수법", summ="요약", flow="자금 흐름", addrs="지갑 주소 ({n})",
        addr_cols="| 체인 | 주소 | 역할 | 비고 | 이전 등장 |", more="| … | _외 {n}개 — 전체 목록은 data/addresses.csv_ | | | |",
        txs="트랜잭션 ({n})", irrelevant="참고: 관련 없음으로 분류된 항목", errors="수집 오류",
    ),
    "en": dict(
        title="Crypto Hack & Illicit Wallet Daily Report", generated="Generated", counts="{n} new items collected: {r} relevant incidents, {x} not relevant",
        briefing="Today's Briefing", by_source="New items by source", src="Source", collected="Collected", relevant="Relevant",
        summary="Incident Summary", none="_No new relevant incidents_",
        cols="| # | Incident | Type | Date | Chains | Amount | Addresses | Source |", details="Incident Details",
        original="Source", date="Incident date", unknown="unknown", chain="Chains", amount="Amount", actors="Actors", tags="Tags",
        also="Other sources", rule="_Rule-based extraction (no LLM summary: {note})_", rehit="Known blacklist re-hits",
        background="Background", method="Attack / Modus Operandi", summ="Summary", flow="Fund Flow", addrs="Wallet addresses ({n})",
        addr_cols="| Chain | Address | Role | Note | Seen before |", more="| … | _{n} more — full list in data/addresses.csv_ | | | |",
        txs="Transactions ({n})", irrelevant="Appendix: items classified as not relevant", errors="Collection errors",
    ),
}


def _src(s: str, lang: str) -> str:
    return (SOURCE_LABEL_KO if lang == "ko" else SOURCE_LABEL).get(s, s)


def _type(t: str, lang: str) -> str:
    return (INCIDENT_TYPE_KO if lang == "ko" else INCIDENT_TYPE_EN).get(t, t)


def _role(r: str, lang: str) -> str:
    return (ROLE_KO if lang == "ko" else ROLE_EN).get(r, r)


def _money(v: Optional[float], text: str = "") -> str:
    if v is None:
        return text or "-"
    if v >= 1e9:
        s = f"${v/1e9:,.2f}B"
    elif v >= 1e6:
        s = f"${v/1e6:,.2f}M"
    elif v >= 1e3:
        s = f"${v/1e3:,.1f}K"
    else:
        s = f"${v:,.0f}"
    t = (text or "").strip()
    if not t:
        return s
    # amount_text 가 같은 숫자를 다르게 쓴 것뿐이면(예: "$ 26,800") 중복 표기 생략
    digits = re.sub(r"[^\d.]", "", t)
    try:
        if digits and abs(float(digits) - v) < 1 or t == s:
            return s
    except ValueError:
        pass
    return f"{s} ({t})"


def _explorer(chain: str, addr: str) -> str:
    c = chain.upper()
    if c in ("ETH", "USDT", "USDC") and addr.startswith("0x"):
        return f"https://etherscan.io/address/{addr}"
    if c == "TRX" or (c == "USDT" and addr.startswith("T")):
        return f"https://tronscan.org/#/address/{addr}"
    if c == "BTC":
        return f"https://mempool.space/address/{addr}"
    if c == "BSC":
        return f"https://bscscan.com/address/{addr}"
    if c == "ARB":
        return f"https://arbiscan.io/address/{addr}"
    if c == "SOL":
        return f"https://solscan.io/account/{addr}"
    if c == "LTC":
        return f"https://blockchair.com/litecoin/address/{addr}"
    if c == "POLYGON":
        return f"https://polygonscan.com/address/{addr}"
    if c == "BASE":
        return f"https://basescan.org/address/{addr}"
    return ""


def _esc(s: str) -> str:
    return (s or "").replace("|", "\\|").replace("\n", " ").strip()


def summary_table(relevant: List[Incident], lang: str, link: bool = True) -> List[str]:
    t = T[lang]
    L = [t["cols"], "|---:|---|---|---|---|---|---:|---|"]
    for n, i in enumerate(relevant, 1):
        name = _esc(i.project or i.title)
        cell = f"[{name}](#{n})" if link else f"[{name}]({i.url})"
        src = _src(i.source, lang) + (f" +{len(i.merged_from)}" if i.merged_from else "")
        L.append(f"| {n} | {cell} | {_type(i.incident_type, lang)} | {i.incident_date or '-'} | {_esc(', '.join(i.chains)) or '-'} | "
                 f"{_esc(_money(i.amount_usd, i.amount_text))} | {len(i.addresses)} | {src} |")
    return L


def build_markdown(day: str, incidents: List[Incident], stats: Dict[str, int], errors: List[str],
                   address_hits: Dict[str, Dict] | None = None, llm_note: str = "",
                   briefing: Optional[dict] = None, lang: str = "ko") -> str:
    t = T[lang]
    relevant = [i for i in incidents if i.relevant]
    irrelevant = [i for i in incidents if not i.relevant]
    relevant.sort(key=lambda i: (i.incident_date or i.published_at or "", i.published_at), reverse=True)

    L: List[str] = []
    L.append(f"# {t['title']} — {day}")
    L.append("")
    L.append(f"{t['generated']}: {datetime.now().strftime('%Y-%m-%d %H:%M')}  ")
    L.append(t["counts"].format(n=len(incidents), r=len(relevant), x=len(irrelevant)))
    if llm_note:
        L.append(f"  \n> {llm_note}")
    L.append("")

    if briefing:
        L.append(f"## {t['briefing']}")
        L.append("")
        head = briefing.get(f"headline_{lang}") or ""
        if head:
            L.append(f"**{head}**")
            L.append("")
        L.append(briefing.get(f"briefing_{lang}") or briefing.get("briefing_ko") or "")
        L.append("")

    L.append(f"## {t['by_source']}")
    L.append("")
    L.append(f"| {t['src']} | {t['collected']} | {t['relevant']} |")
    L.append("|---|---:|---:|")
    by_src = Counter(i.source for i in incidents)
    by_src_rel = Counter(i.source for i in relevant)
    for s, n in sorted(by_src.items(), key=lambda x: -x[1]):
        L.append(f"| {_src(s, lang)} | {n} | {by_src_rel.get(s, 0)} |")
    for s in stats:
        if s not in by_src:
            L.append(f"| {_src(s, lang)} | 0 | 0 |")
    L.append("")

    L.append(f"## {t['summary']}")
    L.append("")
    if not relevant:
        L.append(t["none"])
    else:
        L.extend(summary_table(relevant, lang))
    L.append("")

    L.append(f"## {t['details']}")
    L.append("")
    for n, i in enumerate(relevant, 1):
        L.append(f'<a id="{n}"></a>')
        L.append(f"### {n}. {i.project or i.title} — {_type(i.incident_type, lang)}")
        L.append("")
        L.append(f"- **{t['original']}**: [{_esc(i.title)}]({i.url}) ({_src(i.source, lang)}, {i.published_at})")
        L.append(f"- **{t['date']}**: {i.incident_date or t['unknown']}  |  **{t['chain']}**: {', '.join(i.chains) or t['unknown']}  |  **{t['amount']}**: {_money(i.amount_usd, i.amount_text)}")
        if i.actors:
            L.append(f"- **{t['actors']}**: {', '.join(i.actors)}")
        if i.tags:
            L.append(f"- **{t['tags']}**: {', '.join(i.tags)}")
        if i.merged_from:
            L.append(f"- **{t['also']}**: " + ", ".join(f"[{_src(o['source'], lang)}]({o['url']})" for o in i.merged_from))
        if i.blacklist_hits:
            srcs = sorted({s for h in i.blacklist_hits.values() for s in h.get("sources", [])})[:8]
            L.append(f"- **{t['rehit']}**: {len(i.blacklist_hits)} (crimial_hunter: {', '.join(srcs)})")
        if not i.enriched:
            L.append("- " + t["rule"].format(note=i.enrich_note))
        L.append("")
        for key, label in (("background", t["background"]), ("attack_method", t["method"]), ("summary", t["summ"]), ("fund_flow", t["flow"])):
            val = i.text(key, lang)
            if val:
                L.append(f"**{label}**  \n{val}")
                L.append("")
        if i.addresses:
            L.append(f"**{t['addrs'].format(n=len(i.addresses))}**")
            L.append("")
            L.append(t["addr_cols"])
            L.append("|---|---|---|---|---|")
            for a in i.addresses[:MAX_ADDR_ROWS]:
                link = _explorer(a.chain, a.address)
                addr_md = f"[`{a.address}`]({link})" if link else f"`{a.address}`"
                hits: List[str] = []
                if address_hits:
                    h = address_hits.get(i.uid, {}).get(a.address)
                    if h:
                        hits += sorted({f"{_src(x.get('source', ''), lang)}:{x.get('project') or ''}" for x in h})
                bh = i.blacklist_hits.get(a.address)
                if bh:
                    hits.append("crimial_hunter:" + "|".join(bh.get("sources", [])[:3]) + (" [" + ",".join(bh.get("categories", [])[:2]) + "]" if bh.get("categories") else ""))
                hit = "; ".join(hits)[:140]
                L.append(f"| {a.chain} | {addr_md} | {_role(a.role, lang)} | {_esc(a.note)} | {_esc(hit)} |")
            if len(i.addresses) > MAX_ADDR_ROWS:
                L.append(t["more"].format(n=len(i.addresses) - MAX_ADDR_ROWS))
            L.append("")
        if i.tx_hashes:
            L.append(f"**{t['txs'].format(n=len(i.tx_hashes))}**: " + ", ".join(f"`{x[:10]}…{x[-6:]}`" for x in i.tx_hashes[:8])
                     + (" …" if len(i.tx_hashes) > 8 else ""))
            L.append("")
        L.append("---")
        L.append("")

    if irrelevant:
        L.append(f"## {t['irrelevant']}")
        L.append("")
        for i in irrelevant:
            L.append(f"- [{_esc(i.title)}]({i.url}) ({_src(i.source, lang)}, {i.published_at}) — {_esc(i.relevance_reason)[:120]}")
        L.append("")

    if errors:
        L.append(f"## {t['errors']}")
        L.append("")
        for e in errors:
            L.append(f"- {e}")
        L.append("")

    return "\n".join(L)


def report_path(report_dir: str, day: str, lang: str) -> str:
    return os.path.join(report_dir, day[:7], f"{day}.{lang}.md")


def write_report(report_dir: str, day: str, content: str, lang: str) -> str:
    path = report_path(report_dir, day, lang)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return path


# ---------------------------------------------------------------------------
# 날짜별 브리핑 페이지 + 인덱스
# ---------------------------------------------------------------------------
def build_briefing_page(day: str, briefing: Optional[dict], incidents: List[Incident], report_dir_rel: str = "../../reports") -> str:
    relevant = sorted([i for i in incidents if i.relevant], key=lambda i: (i.incident_date or i.published_at or ""), reverse=True)
    L: List[str] = [f"# {day} 가상자산 해킹·범죄 브리핑 / Crypto Hack Briefing", ""]
    L.append(f"수집 {len(incidents)}건 → 사건 {len(relevant)}건 · 생성 {datetime.now().strftime('%Y-%m-%d %H:%M')}  ")
    L.append(f"상세 리포트 / Full report: [한국어]({report_dir_rel}/{day[:7]}/{day}.ko.md) · [English]({report_dir_rel}/{day[:7]}/{day}.en.md) · [주소 CSV](../../data/addresses.csv)")
    L.append("")
    if briefing:
        L += ["## 🇰🇷 브리핑", "", f"**{briefing.get('headline_ko', '')}**", "", briefing.get("briefing_ko", ""), ""]
        L += ["## 🇺🇸 Briefing", "", f"**{briefing.get('headline_en', '')}**", "", briefing.get("briefing_en", ""), ""]
    else:
        L += ["_브리핑 없음 (LLM 비활성 또는 신규 사건 없음)_", ""]
    if relevant:
        L += ["## 사건 목록 / Incidents", ""] + summary_table(relevant, "ko", link=False) + [""]
    return "\n".join(L)


def briefing_page_path(brief_dir: str, day: str) -> str:
    return os.path.join(brief_dir, day[:7], f"{day}.md")


def write_briefing_page(brief_dir: str, day: str, content: str) -> str:
    path = briefing_page_path(brief_dir, day)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return path


def write_briefing_index(brief_dir: str, entries: List[dict]) -> str:
    """entries: [{day, headline_ko, headline_en, total, relevant}] → briefings/README.md (월별 섹션, 최신 먼저)."""
    entries = sorted(entries, key=lambda e: e["day"], reverse=True)
    L: List[str] = ["# 일일 브리핑 아카이브 / Daily Briefing Archive", ""]
    if entries:
        e = entries[0]
        L.append(f"최신 / Latest: **[{e['day']}]({e['day'][:7]}/{e['day']}.md)** — {e.get('headline_ko', '')}")
        L.append("")
    months: Dict[str, List[dict]] = defaultdict(list)
    for e in entries:
        months[e["day"][:7]].append(e)
    for month in sorted(months, reverse=True):
        L += [f"## {month}", "", "| 날짜 | 헤드라인 (KO) | Headline (EN) | 사건 | 리포트 |", "|---|---|---|---:|---|"]
        for e in months[month]:
            d = e["day"]
            L.append(f"| [{d}]({month}/{d}.md) | {_esc(e.get('headline_ko', ''))} | {_esc(e.get('headline_en', ''))} | "
                     f"{e.get('relevant', 0)}/{e.get('total', 0)} | [KO](../reports/{month}/{d}.ko.md) · [EN](../reports/{month}/{d}.en.md) |")
        L.append("")
    path = os.path.join(brief_dir, "README.md")
    os.makedirs(brief_dir, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(L))
    return path


START, END = "<!-- BRIEFING:START -->", "<!-- BRIEFING:END -->"


def update_readme_briefing(readme_path: str, day: str, briefing: Optional[dict], incidents: List[Incident]) -> None:
    """README.md 의 마커 사이를 오늘 브리핑(한/영)으로 교체. 마커가 없으면 첫 H1 아래에 삽입."""
    relevant = sorted([i for i in incidents if i.relevant], key=lambda i: (i.incident_date or i.published_at or ""), reverse=True)
    # README 표는 같은 사건(프로젝트명 기준)을 한 번만: 주소가 많고 LLM 카드가 있는 항목을 우선
    best: Dict[str, Incident] = {}
    for i in sorted(relevant, key=lambda i: (i.enriched, len(i.addresses), len(i.summary_ko)), reverse=True):
        best.setdefault(i.group_key or i.uid, i)
    relevant = sorted(best.values(), key=lambda i: (i.incident_date or i.published_at or ""), reverse=True)
    block: List[str] = [START, f"## 📌 최신 브리핑 / Latest Briefing — {day}", ""]
    if briefing:
        block += [f"**{briefing.get('headline_ko','')}**", "", briefing.get("briefing_ko", ""), "",
                  f"**{briefing.get('headline_en','')}**", "", briefing.get("briefing_en", ""), ""]
    if relevant:
        block += ["### 사건 목록 / Incidents", ""] + summary_table(relevant[:15], "ko", link=False) + [""]
    block += [f"전체 리포트 / Full reports: [KO](reports/ko/{day}.md) · [EN](reports/en/{day}.md) · "
              f"[주소 CSV](data/addresses.csv) · [OFAC SDN CSV](data/ofac_sdn_addresses.csv)", "", END]
    new_block = "\n".join(block)

    text = ""
    if os.path.exists(readme_path):
        with open(readme_path, encoding="utf-8") as f:
            text = f.read()
    if START in text and END in text:
        text = re.sub(re.escape(START) + r".*?" + re.escape(END), lambda _: new_block, text, flags=re.S)
    else:
        m = re.search(r"^# .*$", text, flags=re.M)
        if m:
            text = text[: m.end()] + "\n\n" + new_block + "\n" + text[m.end():]
        else:
            text = new_block + "\n\n" + text
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(text)
