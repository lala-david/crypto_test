"""rekt.news — 홈 목록 → 개별 글 본문(주소·tx 포함)."""
from __future__ import annotations

import json
import re
from typing import List, Optional

from bs4 import BeautifulSoup

from ..models import RawItem
from ..textextract import html_to_text, meta_description
from .base import Source, SourceContext, to_date_str

BASE = "https://rekt.news"
LEADERBOARD = BASE + "/leaderboard/"
_NEXT_DATA = re.compile(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.S)


def _lb_date(v: str) -> Optional[str]:
    """리더보드 날짜: M/D/YYYY 또는 M/D/YY. 형식이 아니면 None."""
    m = re.fullmatch(r"\s*(\d{1,2})/(\d{1,2})/(\d{2}|\d{4})\s*", v or "")
    if not m:
        return None
    mo, dy, yr = int(m.group(1)), int(m.group(2)), int(m.group(3))
    yr += 2000 if yr < 100 else 0
    if not (1 <= mo <= 12 and 1 <= dy <= 31 and 2009 <= yr <= 2100):
        return None
    return f"{yr:04d}-{mo:02d}-{dy:02d}"
_SKIP = {"/leaderboard", "/research", "/termAndConditions", "/tools", "/videos", "/login", "/"}
_DROP_PARAGRAPHS = (
    r"our Website or Services",
    r"Anon Author",
    r"REKT is not responsible",
    r"^Credit:\s",
    r"read this article also in",
    r"^donate \(",
    r"take no responsibility for the views",
)


class RektSource(Source):
    name = "rekt"

    def collect(self, ctx: SourceContext) -> List[RawItem]:
        max_articles = int(self.cfg.get("max_articles", 20))
        html = ctx.http.get_text(BASE + "/")
        soup = BeautifulSoup(html, "lxml")
        slugs: List[str] = []
        for a in soup.select("a[href]"):
            href = a["href"].split("?")[0].split("#")[0]
            if not re.fullmatch(r"/[a-z0-9-]+", href) or href in _SKIP:
                continue
            if href not in slugs:
                slugs.append(href)
        slugs = slugs[:max_articles]

        items: List[RawItem] = []
        for slug in slugs:
            url = BASE + slug
            try:
                page = ctx.http.get_text(url, cache_ttl_hours=24 * 7)
            except Exception as e:
                ctx.log.warning("rekt 글 로드 실패 %s: %s", url, e)
                continue
            s = BeautifulSoup(page, "lxml")
            t = s.find("time")
            published = to_date_str(t.get_text(" ", strip=True) if t else "")
            if not published:
                m = re.search(r"([A-Z][a-z]+day, [A-Z][a-z]+ \d{1,2}, \d{4})", page)
                published = to_date_str(m.group(1)) if m else ""
            if not published or published < ctx.since.isoformat():
                continue
            title = (s.title.get_text(" ", strip=True) if s.title else slug).replace("Rekt - ", "", 1).strip()
            tags = [a.get_text(" ", strip=True) for a in s.select('a[href^="/?tag="]')]
            text = html_to_text(page, selectors=["article", "main"], drop_paragraph_patterns=_DROP_PARAGRAPHS)
            items.append(
                RawItem(
                    source=self.name, source_id=slug, url=url, title=title, published_at=published,
                    text=text, summary_hint=meta_description(page), tags=sorted(set(tags)), needs_llm=True,
                )
            )
        ctx.log.info("rekt: 최근 글 %d개 중 기간 내 %d개", len(slugs), len(items))
        if self.cfg.get("leaderboard", True):
            items += self._leaderboard(ctx, skip_slugs={i.source_id for i in items})
        return items

    def _leaderboard(self, ctx: SourceContext, skip_slugs: set) -> List[RawItem]:
        """리더보드(피해액 순 전체 목록): 사건일·피해액이 구조화돼 있어 과거 사건 백필에 쓴다. 본문은 주소 추출용으로만 받는다(7일 캐시)."""
        try:
            html = ctx.http.get_text(LEADERBOARD, cache_ttl_hours=6)
            data = json.loads(_NEXT_DATA.search(html).group(1))
            rows = data["props"]["pageProps"]["leaderboard"]
        except Exception as e:
            ctx.log.warning("rekt 리더보드 로드 실패: %s", e)
            return []
        out: List[RawItem] = []
        for r in rows:
            rk = r.get("rekt") or {}
            slug = "/" + str(r.get("slug") or "").strip("/")
            day = _lb_date(str(rk.get("date") or ""))
            if not day or day < ctx.since.isoformat() or slug in skip_slugs or slug == "/":
                continue
            amount = rk.get("amount")
            tags = [t for t in (r.get("tags") or []) if t]
            name = (tags[0] if tags else re.split(r"\s+[-–]\s+", r.get("title") or "")[0]).strip()
            excerpt = (r.get("excerpt") or "").strip()
            text = ""
            try:
                page = ctx.http.get_text(BASE + slug, cache_ttl_hours=24 * 30)
                text = html_to_text(page, selectors=["article", "main"], drop_paragraph_patterns=_DROP_PARAGRAPHS)
            except Exception as e:
                ctx.log.warning("rekt 리더보드 본문 실패 %s: %s", slug, e)
            structured = {"name": name, "incident_date": day, "amount_usd": float(amount) if amount else None,
                          "incident_type": "hack_exploit", "audit": rk.get("audit") or "",
                          "summary": f"Rekt: {name} — {excerpt}"[:600]}
            out.append(RawItem(
                source=self.name, source_id=slug, url=BASE + slug, title=(r.get("title") or name).strip(),
                published_at=_lb_date(str(r.get("date") or "")) or day, text=text, summary_hint=excerpt[:300],
                structured=structured, tags=sorted(set(tags) | {"rekt_leaderboard"}), needs_llm=False,
            ))
        ctx.log.info("rekt 리더보드: 전체 %d건 중 기간 내 %d건", len(rows), len(out))
        return out
