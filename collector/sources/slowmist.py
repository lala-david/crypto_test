"""SlowMist Hacked (hacked.slowmist.io) — 서버 렌더링 HTML 목록. 날짜·대상·설명·손실액·수법·참조링크."""
from __future__ import annotations

import re
from typing import List

from bs4 import BeautifulSoup

from ..models import RawItem
from .base import Source, SourceContext, to_date_str

URL = "https://hacked.slowmist.io/?c=&page={page}"

_METHOD_MAP = {
    "private key": "private_key_compromise",
    "rug": "rug_pull",
    "phishing": "phishing_social_engineering",
    "social": "phishing_social_engineering",
    "scam": "scam_fraud",
    "ransom": "ransomware",
}


def _amount(text: str):
    m = re.search(r"\$\s*([\d,]+(?:\.\d+)?)", text or "")
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", ""))
    except ValueError:
        return None


class SlowMistSource(Source):
    name = "slowmist"

    def collect(self, ctx: SourceContext) -> List[RawItem]:
        max_pages = int(self.cfg.get("max_pages", 2))
        items: List[RawItem] = []
        total = 0
        for page in range(1, max_pages + 1):
            html = ctx.http.get_text(URL.format(page=page))
            soup = BeautifulSoup(html, "lxml")
            lis = [li for li in soup.find_all("li") if li.select_one("span.time")]
            if not lis:
                break
            stop = False
            for li in lis:
                total += 1
                day = to_date_str(li.select_one("span.time").get_text(strip=True))
                if not day:
                    continue
                if day < ctx.since.isoformat():
                    stop = True
                    break
                h3 = li.find("h3")
                target = re.sub(r"^Hacked target:\s*", "", h3.get_text(" ", strip=True)) if h3 else "Unknown"
                desc, loss, method = "", "", ""
                for p in li.find_all("p"):
                    t = p.get_text(" ", strip=True)
                    if t.startswith("Description of the event:"):
                        desc = t.split(":", 1)[1].strip()
                    m1 = re.search(r"Amount of loss:\s*(.+?)(?:\s+Attack method:|$)", t)
                    m2 = re.search(r"Attack method:\s*(.+)$", t)
                    if m1:
                        loss = m1.group(1).strip()
                    if m2:
                        method = m2.group(1).strip()
                ref = li.select_one("p.link-reference a")
                ref_url = ref["href"] if ref and ref.get("href") else ""
                itype = "hack_exploit"
                for k, v in _METHOD_MAP.items():
                    if k in method.lower():
                        itype = v
                structured = {
                    "name": target, "incident_date": day, "amount_usd": _amount(loss), "amount_text": loss,
                    "attack_method": method, "incident_type": itype, "reference": ref_url,
                    "summary": f"SlowMist: {target} — {method}, loss {loss}. {desc}",
                }
                items.append(
                    RawItem(
                        source=self.name, source_id=f"{day}|{target}", url=ref_url or URL.format(page=1),
                        title=f"{target} — {method}" if method else target, published_at=day,
                        text=f"Hacked target: {target}\nDate: {day}\nAmount of loss: {loss}\nAttack method: {method}\n\n{desc}\n\nReference: {ref_url}",
                        summary_hint=desc[:300], structured=structured, tags=[t for t in (method,) if t], needs_llm=True,
                    )
                )
            if stop:
                break
        ctx.log.info("slowmist: %d건 중 기간 내 %d건", total, len(items))
        return items
