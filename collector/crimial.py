"""crimial_hunter(scam-address-data) 연동.

- 대조: 저장소의 master_all.csv + 소스 CSV 몇 개를 읽어 주소 → {sources, categories, labels} 인덱스를 만들고,
  새 사건의 주소가 이미 블랙리스트에 있으면 표시한다 ("기존 블랙리스트 재등장").
- 내보내기: 이 수집기가 찾은 공격자·세탁·제재 주소를 표준 스키마
  (address, chain, category, source, label, detail, ref_date) CSV로 저장소 sources/ 에 쓴다 (+ data/export 사본).
  build_master.py 의 파일 목록에 ("news_collector.csv", None) 을 추가하면 마스터에 편입된다.
"""
from __future__ import annotations

import csv
import json
import logging
import os
from typing import Dict, Iterable, List, Optional

from .models import Address, Incident

log = logging.getLogger("collector.crimial")

# 우리 체인 코드 → crimial_hunter 체인 코드 (EVM 계열은 모두 ETH 로 관리됨)
_EVM = {"ETH", "BSC", "ARB", "POLYGON", "BASE", "AVAX", "OPTIMISM", "ETC", "USDT", "USDC", "BNB"}
_CHAIN_MAP = {"TRX": "TRON"}

_CATEGORY = {
    ("attacker", "hack_exploit"): "exploit",
    ("attacker", "private_key_compromise"): "exploit",
    ("attacker", "rug_pull"): "rugpull",
    ("attacker", "phishing_social_engineering"): "phishing_drainer",
    ("attacker", "scam_fraud"): "scam_scamming",
    ("attacker", "ransomware"): "ransomware",
    ("attacker", "law_enforcement_action"): "enforcement",
    ("attacker", "sanctions_designation"): "sanctions",
    ("laundering", None): "laundering",
    ("sanctioned", None): "sanctions",
}


def to_ch_chain(chain: str, address: str) -> str:
    c = (chain or "").upper()
    if c in _EVM or address.startswith("0x"):
        return "ETH"
    return _CHAIN_MAP.get(c, c)


def category_for(role: str, incident_type: str) -> str:
    return _CATEGORY.get((role, incident_type)) or _CATEGORY.get((role, None)) or "exploit"


class CrimialHunter:
    def __init__(self, cfg: dict, root: str):
        self.cfg = cfg or {}
        self.enabled = bool(self.cfg.get("enabled", False))
        rd = self.cfg.get("repo_dir", "../experience/scam-address-data")
        self.repo_dir = rd if os.path.isabs(rd) else os.path.normpath(os.path.join(root, rd))
        self.root = root
        self._index: Optional[Dict[str, dict]] = None
        if self.enabled and not os.path.isdir(self.repo_dir):
            log.warning("crimial_hunter 저장소 없음: %s → 연동 비활성", self.repo_dir)
            self.enabled = False

    # ---- 대조 인덱스 ---------------------------------------------------
    def _load(self) -> Dict[str, dict]:
        if self._index is not None:
            return self._index
        idx: Dict[str, dict] = {}
        files = self.cfg.get("lookup_files") or ["master_all.csv", "sources/ofac_sanctions_all.csv",
                                                  "sources/gov_law_enforcement_all.csv"]
        for rel in files:
            p = os.path.join(self.repo_dir, rel)
            if not os.path.exists(p):
                continue
            n = 0
            with open(p, encoding="utf-8", errors="ignore", newline="") as f:
                for row in csv.DictReader(f):
                    a = (row.get("address") or "").strip()
                    if not a:
                        continue
                    key = a.lower() if a.startswith("0x") else a
                    e = idx.setdefault(key, {"sources": set(), "categories": set(), "labels": set(), "chain": row.get("chain", "")})
                    for s in (row.get("sources") or row.get("source") or "").split("|"):
                        if s:
                            e["sources"].add(s)
                    for c in (row.get("categories") or row.get("category") or "").split("|"):
                        if c:
                            e["categories"].add(c)
                    lab = row.get("labels") or row.get("label") or row.get("entity_theme") or row.get("jurisdiction") or ""
                    for l in lab.split("|"):
                        if l:
                            e["labels"].add(l[:60])
                    n += 1
            log.info("crimial_hunter 대조 로드: %s %d행", rel, n)
        self._index = idx
        return idx

    def hits(self, addresses: Iterable[Address]) -> Dict[str, dict]:
        if not self.enabled:
            return {}
        idx = self._load()
        out: Dict[str, dict] = {}
        for a in addresses:
            key = a.address.lower() if a.address.startswith("0x") else a.address
            e = idx.get(key)
            if e:
                out[a.address] = {"sources": sorted(e["sources"])[:6], "categories": sorted(e["categories"])[:6],
                                  "labels": sorted(e["labels"])[:4]}
        return out

    # ---- 내보내기 ---------------------------------------------------------
    def export(self, store) -> Optional[str]:
        if not self.enabled:
            return None
        roles = set(self.cfg.get("roles") or ["attacker", "laundering", "sanctioned"])
        exclude = set(self.cfg.get("exclude_sources") or ["scamsniffer", "ofac_sdn"])
        rows = store.conn.execute(
            "SELECT a.chain, a.address, a.role, a.note, a.source, a.project, a.incident_date, i.json "
            "FROM addresses a JOIN incidents i ON a.uid=i.uid WHERE i.relevant=1 ORDER BY a.incident_date DESC"
        ).fetchall()
        seen = set()
        out_rows: List[List[str]] = []
        for chain, address, role, note, source, project, incident_date, js in rows:
            if role not in roles or source in exclude:
                continue
            d = json.loads(js)
            ch_chain = to_ch_chain(chain, address)
            key = (ch_chain, address.lower() if address.startswith("0x") else address)
            if key in seen:
                continue
            seen.add(key)
            detail = f"{d.get('title','')} | role={role}" + (f" | {note}" if note else "") + f" | {d.get('url','')}"
            out_rows.append([address, ch_chain, category_for(role, d.get("incident_type", "")),
                             f"news_{source.replace('rss:', '')}", (project or "")[:80], detail[:400].replace("\n", " "),
                             incident_date or (d.get("published_at") or "")[:10]])
        header = ["address", "chain", "category", "source", "label", "detail", "ref_date"]
        targets = []
        rel = self.cfg.get("export_file", "sources/news_collector.csv")
        targets.append(os.path.join(self.repo_dir, rel))
        copy = self.cfg.get("export_copy", "data/export/crimial_hunter_news_collector.csv")
        targets.append(copy if os.path.isabs(copy) else os.path.join(self.root, copy))
        for t in targets:
            os.makedirs(os.path.dirname(t), exist_ok=True)
            with open(t, "w", encoding="utf-8", newline="") as f:
                w = csv.writer(f)
                w.writerow(header)
                w.writerows(out_rows)
        log.info("crimial_hunter 내보내기: %d행 → %s", len(out_rows), targets[0])
        return targets[0]
