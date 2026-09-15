"""키워드 매칭.

- 기본: 단어 전체 일치 + 흔한 어미(s/es/ed/ing/er/ers) 허용. 'ether'가 'whether'·'Etherton'에, 'defi'가 'definition'에 걸리지 않는다.
- 키워드 끝에 '*'를 붙이면 접두 일치 (예: 'designat*' → designated/designation).
"""
from __future__ import annotations

import re
from functools import lru_cache
from typing import Iterable

_SUFFIX = r"(?:s|es|ed|ing|er|ers)?"


@lru_cache(maxsize=64)
def _compile(keys: tuple) -> re.Pattern:
    parts = []
    for k in keys:
        k = (k or "").strip().lower()
        if not k:
            continue
        if k.endswith("*"):
            parts.append(r"\b" + re.escape(k[:-1]))
        else:
            parts.append(r"\b" + re.escape(k) + _SUFFIX + r"\b")
    return re.compile("|".join(parts), re.I) if parts else re.compile(r"(?!x)x")


def any_keyword(text: str, keys: Iterable[str]) -> bool:
    return bool(_compile(tuple(keys)).search(text or ""))


def first_keyword(text: str, keys: Iterable[str]) -> str:
    m = _compile(tuple(keys)).search(text or "")
    return m.group(0) if m else ""


def keyword_hit(text: str, keywords: dict) -> bool:
    """(crypto 계열 ∪ chains 목록) 1개 이상 AND crime 계열 1개 이상."""
    crypto = list(keywords.get("crypto", [])) + list(keywords.get("chains", []))
    return any_keyword(text, crypto) and any_keyword(text, keywords.get("crime", []))
