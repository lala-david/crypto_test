"""미 법무부(DOJ) 보도자료 JSON API — 가상자산 관련 기소·압수·몰수·선고."""
from __future__ import annotations

import html as htmlmod
from typing import List

from ..keywords import any_keyword, keyword_hit
from ..models import RawItem
from ..textextract import fragment_to_text
from .base import Source, SourceContext, to_date_str

API = "https://www.justice.gov/api/v1/press_releases.json"

# DOJ는 일반 범죄 보도자료가 대부분이라 crypto 키워드는 더 엄격하게 본다 (단어 경계 매칭)
_STRICT_CRYPTO = [
    "cryptocurrency", "cryptocurrencies", "crypto", "bitcoin", "ethereum", "ether", "stablecoin", "tether",
    "usdt", "usdc", "virtual currency", "virtual asset", "digital asset", "digital currency", "blockchain",
    "crypto wallet", "cryptocurrency wallet", "defi", "nft", "cryptocurrency mixer", "tornado cash", "solana",
    "binance", "coinbase", "kraken", "okx", "bybit", "kucoin", "htx", "huobi",
]


class DojSource(Source):
    name = "doj"

    def collect(self, ctx: SourceContext) -> List[RawItem]:
        max_pages = int(self.cfg.get("max_pages", 10))
        items: List[RawItem] = []
        scanned = 0
        for page in range(max_pages):
            try:
                data = ctx.http.get_json(API, params={"pagesize": 50, "page": page, "sort": "date", "direction": "DESC"})
            except Exception as e:
                ctx.log.warning("doj API 페이지 %d 실패: %s", page, e)
                break
            results = data.get("results") or []
            if not results:
                break
            stop = False
            for r in results:
                scanned += 1
                d = to_date_str(r.get("date"))
                if d and d < ctx.since.isoformat():
                    stop = True
                    break
                title = htmlmod.unescape(r.get("title") or "").strip()
                body_html = r.get("body") or ""
                body = fragment_to_text(body_html)
                teaser = htmlmod.unescape(r.get("teaser") or "").strip()
                blob = f"{title}\n{teaser}\n{body}"
                if not any_keyword(blob, _STRICT_CRYPTO):
                    continue
                if not keyword_hit(blob, ctx.keywords):
                    continue
                url = r.get("url") or ""
                comps = [c.get("name") for c in (r.get("component") or []) if c.get("name")]
                items.append(
                    RawItem(
                        source=self.name, source_id=r.get("uuid") or url, url=url, title=title, published_at=d,
                        text=body, summary_hint=teaser, tags=comps, needs_llm=True,
                        structured={"press_release_number": r.get("number")},
                    )
                )
            if stop:
                break
        ctx.log.info("doj: %d건 스캔, 가상자산 관련 %d건", scanned, len(items))
        return items
