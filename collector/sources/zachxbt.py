"""ZachXBT 텔레그램 공개 채널(t.me/s/investigations) — 조사 게시글에 공격자·세탁 주소가 자주 포함."""
from __future__ import annotations

import re
from typing import List

from bs4 import BeautifulSoup

from ..keywords import any_keyword
from ..models import RawItem
from .base import Source, SourceContext, to_date_str

URL = "https://t.me/s/{channel}"
_CRYPTO_HINT = ["crypto", "wallet", "address", "eth", "btc", "usdt", "usdc", "sol", "tron", "exchange", "stolen", "hack",
                "drain", "launder", "scam", "phish", "seized", "arrest", "freeze", "frozen", "0x", "bridge", "mixer"]


class ZachXbtSource(Source):
    name = "zachxbt"

    def collect(self, ctx: SourceContext) -> List[RawItem]:
        channel = self.cfg.get("channel", "investigations")
        max_pages = int(self.cfg.get("max_pages", 2))
        url = URL.format(channel=channel)
        items: List[RawItem] = []
        seen_ids = set()
        total = 0
        for _ in range(max_pages):
            html = ctx.http.get_text(url)
            soup = BeautifulSoup(html, "lxml")
            msgs = soup.select("div.tgme_widget_message_wrap")
            if not msgs:
                break
            oldest_id = None
            stop = False
            for m in msgs:
                total += 1
                post = m.select_one("[data-post]")
                pid = (post.get("data-post") if post else "") or ""
                mid = pid.split("/")[-1]
                if not mid.isdigit():
                    continue
                oldest_id = min(int(mid), oldest_id) if oldest_id is not None else int(mid)
                t = m.find("time")
                day = to_date_str(t.get("datetime") if t else "")
                if not day:
                    continue
                if day < ctx.since.isoformat():
                    stop = True
                    continue
                if mid in seen_ids:
                    continue
                seen_ids.add(mid)
                body = m.select_one(".tgme_widget_message_text")
                text = body.get_text("\n", strip=True) if body else ""
                if not text or not any_keyword(text, _CRYPTO_HINT):
                    continue
                title = re.sub(r"\s+", " ", text.split("\n", 1)[0])[:100]
                items.append(
                    RawItem(
                        source=self.name, source_id=mid, url=f"https://t.me/{channel}/{mid}", title=f"ZachXBT: {title}",
                        published_at=day, text=text, summary_hint=text[:300], tags=["telegram"], needs_llm=True,
                    )
                )
            if stop or oldest_id is None:
                break
            url = URL.format(channel=channel) + f"?before={oldest_id}"
        ctx.log.info("zachxbt: 게시글 %d개 중 기간 내 %d건", total, len(items))
        return items
