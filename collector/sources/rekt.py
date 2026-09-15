"""rekt.news — 홈 목록 → 개별 글 본문(주소·tx 포함)."""
from __future__ import annotations

import re
from typing import List

from bs4 import BeautifulSoup

from ..models import RawItem
from ..textextract import html_to_text, meta_description
from .base import Source, SourceContext, to_date_str

BASE = "https://rekt.news"
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
        return items
