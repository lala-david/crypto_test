"""OFAC — (1) Recent Actions 페이지의 디지털자산 주소 포함 제재 지정, (2) SDN XML 전체 diff."""
from __future__ import annotations

import os
import re
import xml.etree.ElementTree as ET
from typing import Dict, List

from bs4 import BeautifulSoup

from ..addresses import OFAC_CHAIN_MAP, infer_chain
from ..models import Address, RawItem
from ..textextract import html_to_text
from .base import Source, SourceContext, to_date_str

BASE = "https://ofac.treasury.gov"
LIST_URL = BASE + "/recent-actions"
SDN_XML_URL = "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML"

_DCA_RE = re.compile(r"Digital Currency Address\s*-\s*([A-Z0-9]+)\s+([A-Za-z0-9]+)")
_PROGRAM_RE = re.compile(r"\[([A-Z0-9\-]+)\]")


def _entity_name(line: str) -> str:
    """'XINBI GUARANTEE (Chinese Simplified: ...) (a.k.a. ...), Burma; ...' → 'XINBI GUARANTEE'
    'ANWEN TECHNOLOGY CO., LTD., Prince International Plaza ...' → 'ANWEN TECHNOLOGY CO., LTD.'
    'DOE, John (a.k.a. ...), DOB ...' → 'DOE, John'"""
    head = re.split(r"\s\(|;", line, 1)[0]
    parts = [p.strip() for p in head.split(",")]
    name = ", ".join(parts[:2]) if len(parts) > 2 else head.strip()
    return name.strip(" ,")[:80]


def _chain(code: str, addr: str) -> str:
    c = OFAC_CHAIN_MAP.get(code.upper(), code.upper())
    if c in ("USDT", "USDC"):
        return infer_chain(addr, c)
    return c


class OfacRecentActionsSource(Source):
    name = "ofac"

    def collect(self, ctx: SourceContext) -> List[RawItem]:
        html = ctx.http.get_text(LIST_URL)
        soup = BeautifulSoup(html, "lxml")
        dates: List[str] = []
        for a in soup.select('a[href^="/recent-actions/"]'):
            m = re.search(r"/recent-actions/(\d{8})", a["href"])
            if m and m.group(1) not in dates:
                dates.append(m.group(1))
        items: List[RawItem] = []
        for d8 in sorted(dates, reverse=True):
            day = f"{d8[:4]}-{d8[4:6]}-{d8[6:]}"
            if day < ctx.since.isoformat():
                continue
            url = f"{LIST_URL}/{d8}"
            try:
                page = ctx.http.get_text(url, cache_ttl_hours=24)
            except Exception as e:
                ctx.log.warning("ofac 페이지 로드 실패 %s: %s", url, e)
                continue
            if "Digital Currency Address" not in page:
                continue
            ps = BeautifulSoup(page, "lxml")
            title_el = ps.find("h1") or ps.find("h2")
            title = title_el.get_text(" ", strip=True) if title_el else f"OFAC Recent Action {day}"
            text = html_to_text(page, selectors=["main", "article", "body"])

            # 개별 엔티티(줄 단위) 파싱: 주소가 있는 줄만. 엔트리는 <br><br> 로 구분되어 있고 '.&nbsp;' 로 끝난다
            entities: List[dict] = []
            addrs: List[Address] = []
            for line in text.split("\n"):
                if "Digital Currency Address" not in line:
                    continue
                amended = " -to- " in line
                if amended:  # 변경(amendment) 항목은 'OLD -to- NEW' 형식 → 새 항목만 사용
                    line = line.split(" -to- ", 1)[1]
                name = _entity_name(line) + (" (변경)" if amended else "")
                programs = sorted(set(_PROGRAM_RE.findall(line)))
                found = []
                for code, addr in _DCA_RE.findall(line):
                    ch = _chain(code, addr)
                    found.append({"chain": ch, "address": addr})
                    addrs.append(Address(chain=ch, address=addr, role="sanctioned",
                                         note=f"OFAC SDN {name} {' '.join('['+p+']' for p in programs)}".strip()))
                entities.append({"name": name, "programs": programs, "addresses": found})

            # Treasury 보도자료 본문(배경 설명)도 붙인다
            press_text = ""
            for a in ps.select('a[href*="home.treasury.gov/news/press-releases"]'):
                try:
                    pr = ctx.http.get_text(a["href"], cache_ttl_hours=24 * 7)
                    press_text += "\n\n[Treasury 보도자료: " + a["href"] + "]\n" + html_to_text(pr)
                    break
                except Exception as e:
                    ctx.log.warning("treasury 보도자료 로드 실패: %s", e)
            items.append(
                RawItem(
                    source=self.name, source_id=d8, url=url, title=title, published_at=day,
                    text=text + press_text,
                    structured={"entities": entities, "chains": sorted({a.chain for a in addrs}),
                                "incident_type": "sanctions_designation",
                                "name": ", ".join(e["name"] for e in entities)[:120]},
                    addresses=addrs, tags=sorted({p for e in entities for p in e["programs"]}), needs_llm=True,
                )
            )
        ctx.log.info("ofac: 최근 조치 %d일 중 디지털자산 주소 포함 %d건", len(dates), len(items))
        return items


class OfacSdnDiffSource(Source):
    """SDN.XML 전체를 받아 이전 스냅샷 대비 신규 디지털자산 주소를 찾는다. 첫 실행은 기준선만 만든다."""

    name = "ofac_sdn"

    def collect(self, ctx: SourceContext) -> List[RawItem]:
        path = os.path.join(ctx.store.data_dir, "cache", "SDN.XML")
        ctx.http.download(SDN_XML_URL, path)
        known = ctx.store.sdn_known()
        baseline = len(known) == 0

        rows: List[tuple] = []
        by_entity: Dict[str, dict] = {}
        publish_date = ""
        ns = ""
        for _, el in ET.iterparse(path, events=("end",)):
            tag = el.tag
            if "}" in tag:
                ns, tag = tag.split("}", 1)
                ns = ns + "}"
            if tag == "Publish_Date":
                publish_date = to_date_str(el.text)
            if tag != "sdnEntry":
                continue
            uid = (el.findtext(ns + "uid") or "").strip()
            last = (el.findtext(ns + "lastName") or "").strip()
            first = (el.findtext(ns + "firstName") or "").strip()
            name = (first + " " + last).strip()
            programs = [p.text for p in el.iter(ns + "program") if p.text]
            for idn in el.iter(ns + "id"):
                t = (idn.findtext(ns + "idType") or "")
                if not t.startswith("Digital Currency Address"):
                    continue
                code = t.split("-", 1)[-1].strip()
                addr = (idn.findtext(ns + "idNumber") or "").strip()
                if not addr:
                    continue
                ch = _chain(code, addr)
                if (ch, addr) in known:
                    continue
                rows.append((ch, addr, uid, name, ",".join(programs)))
                ent = by_entity.setdefault(uid, {"name": name, "programs": programs, "addresses": []})
                ent["addresses"].append(Address(chain=ch, address=addr, role="sanctioned",
                                                note=f"OFAC SDN {name} [{', '.join(programs)}]"))
            el.clear()

        ctx.store.sdn_add(rows)
        ctx.log.info("ofac_sdn: SDN %s 기준 디지털자산 주소 신규 %d개 (누적 %d)%s",
                     publish_date, len(rows), ctx.store.sdn_count(), " — 첫 실행: 기준선 생성" if baseline else "")
        if baseline:
            return []

        items: List[RawItem] = []
        for uid, ent in by_entity.items():
            addrs = ent["addresses"]
            items.append(
                RawItem(
                    source=self.name, source_id=f"{uid}|{publish_date}",
                    url=f"https://sanctionssearch.ofac.treas.gov/Details.aspx?id={uid}",
                    title=f"OFAC SDN 신규 디지털자산 주소: {ent['name']} [{', '.join(ent['programs'])}]",
                    published_at=publish_date, text="",
                    structured={"name": ent["name"], "programs": ent["programs"], "incident_type": "sanctions_designation",
                                "chains": sorted({a.chain for a in addrs}), "incident_date": publish_date,
                                "summary": f"OFAC SDN 목록({publish_date})에 {ent['name']} 관련 디지털자산 주소 {len(addrs)}개가 새로 확인됨. 프로그램: {', '.join(ent['programs'])}"},
                    addresses=addrs, tags=list(ent["programs"]), needs_llm=False,
                )
            )
        return items
