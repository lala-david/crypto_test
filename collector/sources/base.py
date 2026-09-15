from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from typing import List

from dateutil import parser as dtparser

from ..http import Http
from ..models import RawItem
from ..store import Store


@dataclass
class SourceContext:
    http: Http
    store: Store
    since: date          # 이 날짜(포함) 이후 게시물만
    keywords: dict
    log: logging.Logger


class Source:
    name = "base"

    def __init__(self, cfg: dict | None = None):
        self.cfg = cfg or {}

    def collect(self, ctx: SourceContext) -> List[RawItem]:  # pragma: no cover
        raise NotImplementedError


def to_date_str(value) -> str:
    """다양한 날짜 표현 → YYYY-MM-DD. 실패 시 ''."""
    if value is None or value == "":
        return ""
    try:
        if isinstance(value, (int, float)):
            from datetime import datetime, timezone

            return datetime.fromtimestamp(float(value), tz=timezone.utc).strftime("%Y-%m-%d")
        s = str(value).strip()
        if s.startswith("$D"):
            s = s[2:]
        return dtparser.parse(s).strftime("%Y-%m-%d")
    except Exception:
        return ""


from ..keywords import keyword_hit  # noqa: E402  (재수출)
