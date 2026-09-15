"""ScamSniffer scam-database — 피싱/드레이너 EVM 주소 목록을 스냅샷 diff 해서 신규 주소만 항목으로."""
from __future__ import annotations

from datetime import date
from typing import List

from ..models import Address, RawItem
from .base import Source, SourceContext

URL = "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/address.json"


class ScamSnifferSource(Source):
    name = "scamsniffer"

    def collect(self, ctx: SourceContext) -> List[RawItem]:
        data = ctx.http.get_json(URL)
        addrs = sorted({str(a).strip().lower() for a in data if isinstance(a, str) and a.startswith("0x") and len(a) == 42})
        known = ctx.store.snapshot_known(self.name)
        baseline = len(known) == 0
        new = [a for a in addrs if a not in known]
        ctx.store.snapshot_add(self.name, new)
        ctx.log.info("scamsniffer: 전체 %d, 신규 %d%s", len(addrs), len(new), " — 첫 실행: 기준선 생성" if baseline else "")
        if baseline or not new:
            return []
        today = date.today().isoformat()
        max_show = int(self.cfg.get("max_addresses_per_item", 500))
        return [
            RawItem(
                source=self.name, source_id=f"{today}|{len(new)}", url="https://github.com/scamsniffer/scam-database",
                title=f"ScamSniffer 신규 피싱/드레이너 주소 {len(new)}개", published_at=today, text="",
                structured={"name": "ScamSniffer phishing blacklist", "incident_date": today, "chains": ["Ethereum"],
                            "incident_type": "phishing_social_engineering",
                            "summary": f"ScamSniffer 블랙리스트에 피싱/드레이너 주소 {len(new)}개가 새로 추가됨 (EVM).",
                            "summary_en": f"{len(new)} new phishing/drainer addresses were added to the ScamSniffer blacklist (EVM)."},
                addresses=[Address(chain="ETH", address=a, role="attacker", note="ScamSniffer phishing/drainer") for a in new[:max_show]],
                tags=["phishing", "drainer"], needs_llm=False,
            )
        ]
