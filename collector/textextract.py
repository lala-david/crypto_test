"""HTML → 본문 텍스트 추출."""
from __future__ import annotations

import re
from typing import Iterable, Optional

from bs4 import BeautifulSoup

_NOISE_TAGS = ["script", "style", "noscript", "nav", "header", "footer", "iframe", "svg", "form", "button"]


def _soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "lxml")


def meta_description(html: str) -> str:
    s = _soup(html)
    for attr, val in (("property", "og:description"), ("name", "description"), ("name", "twitter:description")):
        m = s.find("meta", attrs={attr: val})
        if m and m.get("content"):
            return m["content"].strip()
    return ""


def meta_published(html: str) -> str:
    s = _soup(html)
    for attr, val in (("property", "article:published_time"), ("name", "article:published_time"), ("name", "date")):
        m = s.find("meta", attrs={attr: val})
        if m and m.get("content"):
            return m["content"].strip()
    t = s.find("time")
    if t:
        return (t.get("datetime") or t.get_text(" ", strip=True)).strip()
    return ""


def _largest_text_block(s: BeautifulSoup):
    best, best_score = None, 0.0
    for el in s.find_all(["article", "main", "div", "section"]):
        ps = el.find_all("p")
        if len(ps) < 3:
            continue
        p_len = sum(len(p.get_text()) for p in ps)
        total = len(el.get_text())
        score = p_len - 0.15 * (total - p_len)  # 래퍼(부모)보다 실제 본문 컨테이너를 선호
        if score > best_score:
            best, best_score = el, score
    return best


def html_to_text(html: str, selectors: Optional[Iterable[str]] = None, drop_paragraph_patterns: Iterable[str] = ()) -> str:
    s = _soup(html)
    for t in s(_NOISE_TAGS):
        t.decompose()
    node = None
    for sel in selectors or []:
        node = s.select_one(sel)
        if node is not None:
            break
    if node is None:
        node = _largest_text_block(s) or s.body or s

    for br in node.find_all("br"):  # <br> 로 나뉜 항목(OFAC 등)을 줄로 분리
        br.replace_with("\n")

    drop_res = [re.compile(p, re.I) for p in drop_paragraph_patterns]
    lines = []
    blocks = node.find_all(["p", "li", "h1", "h2", "h3", "h4", "blockquote", "pre", "td", "th"])
    if not blocks:
        blocks = [node]
    for block in blocks:
        raw = re.sub(r"[ \t\r\f\v]+", " ", block.get_text(" "))
        for txt in (l.strip() for l in raw.split("\n")):
            if not txt:
                continue
            if any(r.search(txt) for r in drop_res):
                continue
            lines.append(txt)
    text = "\n".join(lines)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def fragment_to_text(html_fragment: str) -> str:
    """API가 주는 본문 HTML 조각(DOJ 등)을 텍스트로."""
    s = _soup(html_fragment)
    return re.sub(r"\n{3,}", "\n\n", s.get_text("\n", strip=True)).strip()
