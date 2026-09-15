"""RSS 기반 블로그 소스: TRM Labs, Chainalysis, 그리고 config로 추가하는 임의 RSS."""
from __future__ import annotations

import re
from typing import List

import feedparser

from ..models import RawItem
from ..textextract import html_to_text, meta_description
from .base import Source, SourceContext, keyword_hit, to_date_str


class RssBlogSource(Source):
    name = "rss"
    feed_url = ""
    selectors: List[str] = []
    require_keywords = True
    headers: dict | None = None

    def _fetch_article(self, ctx: SourceContext, url: str) -> tuple[str, str]:
        html = ctx.http.get_text(url, cache_ttl_hours=24 * 7, headers=self.headers)
        return html_to_text(html, selectors=self.selectors), meta_description(html)

    def collect(self, ctx: SourceContext) -> List[RawItem]:
        raw = ctx.http.get_bytes(self.feed_url, headers=self.headers)
        feed = feedparser.parse(raw)
        items: List[RawItem] = []
        total = 0
        for e in feed.entries:
            total += 1
            published = to_date_str(e.get("published") or e.get("updated") or "")
            if not published or published < ctx.since.isoformat():
                continue
            link = re.sub(r"[?&](utm_[a-z]+|ref|source)=[^&#]*", "", e.get("link") or "").rstrip("?&")
            title = re.sub(r"\s*\|\s*(TRM Labs|Chainalysis)\s*$", "", (e.get("title") or "").strip())
            summary = (e.get("summary") or "").strip()
            if self.require_keywords and not keyword_hit(f"{title}\n{summary}", ctx.keywords):
                continue
            try:
                text, desc = self._fetch_article(ctx, link) if getattr(self, "fetch_article", True) else ("", "")
            except Exception as ex:
                ctx.log.warning("%s 본문 로드 실패 %s: %s", self.name, link, ex)
                text, desc = "", ""
            if self.require_keywords and not keyword_hit(f"{title}\n{summary}\n{text[:6000]}", ctx.keywords):
                continue
            tags = [t.get("term") for t in e.get("tags", []) if t.get("term")]
            items.append(
                RawItem(
                    source=self.name, source_id=link or title, url=link, title=title, published_at=published,
                    text=text or summary, summary_hint=desc or summary[:500], tags=tags, needs_llm=True,
                )
            )
        ctx.log.info("%s: 피드 %d건 중 기간·키워드 통과 %d건", self.name, total, len(items))
        return items


class TrmSource(RssBlogSource):
    name = "trm"
    feed_url = "https://www.trmlabs.com/resources/blog/rss.xml"
    selectors = ["main", "article"]


class ChainalysisSource(RssBlogSource):
    name = "chainalysis"
    feed_url = "https://www.chainalysis.com/blog/feed/"
    selectors = [".single-post__content", ".post-content", "article"]


class GenericRssSource(RssBlogSource):
    """config.sources.extra_rss 항목용."""

    def __init__(self, cfg: dict):
        super().__init__(cfg)
        self.name = "rss:" + cfg.get("name", "extra")
        self.feed_url = cfg["url"]
        self.selectors = cfg.get("selectors") or ["article", "main"]
        self.require_keywords = bool(cfg.get("require_keywords", True))
        self.headers = {"User-Agent": cfg["user_agent"]} if cfg.get("user_agent") else None
        self.fetch_article = bool(cfg.get("fetch_article", True))
