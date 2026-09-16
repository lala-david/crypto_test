"""SQLite 저장소 + JSON 상태(state.json) + JSONL/CSV 내보내기.

collector.db 는 로컬 캐시(git 제외). git으로 옮겨 다니는 상태는 data/state.json(본 항목·SDN 스냅샷·소스 실행시각)과
data/incidents.jsonl(사건 카드)이며, DB가 비어 있으면 이 두 파일에서 복원한다. → GitHub Actions 등 매번 새 환경에서도 이어서 실행 가능.
"""
from __future__ import annotations

import csv
import json
import os
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, Iterable, List, Optional, Set, Tuple

from .models import Address, Incident, RawItem

SCHEMA = """
CREATE TABLE IF NOT EXISTS items (
  uid TEXT PRIMARY KEY,
  source TEXT, source_id TEXT, url TEXT, title TEXT, published_at TEXT,
  first_seen_at TEXT, status TEXT
);
CREATE TABLE IF NOT EXISTS incidents (
  uid TEXT PRIMARY KEY,
  source TEXT, published_at TEXT, incident_date TEXT, project TEXT,
  incident_type TEXT, amount_usd REAL, relevant INTEGER, enriched INTEGER,
  collected_at TEXT, json TEXT
);
CREATE TABLE IF NOT EXISTS addresses (
  chain TEXT, address TEXT, uid TEXT, role TEXT, note TEXT,
  source TEXT, project TEXT, incident_date TEXT, first_seen_at TEXT,
  PRIMARY KEY (chain, address, uid)
);
CREATE TABLE IF NOT EXISTS sdn_snapshot (
  chain TEXT, address TEXT, entity_uid TEXT, entity_name TEXT, programs TEXT,
  first_seen_at TEXT,
  PRIMARY KEY (chain, address)
);
CREATE TABLE IF NOT EXISTS list_snapshot (
  name TEXT, value TEXT, first_seen_at TEXT, PRIMARY KEY (name, value)
);
CREATE TABLE IF NOT EXISTS source_runs (
  name TEXT PRIMARY KEY, last_run_at TEXT, last_count INTEGER
);
CREATE TABLE IF NOT EXISTS merge_decisions (
  uid_a TEXT, uid_b TEXT, same INTEGER, reason TEXT, decided_at TEXT, PRIMARY KEY (uid_a, uid_b)
);
CREATE TABLE IF NOT EXISTS runs (
  run_at TEXT, since TEXT, collected INTEGER, new_items INTEGER, enriched INTEGER, errors TEXT
);
CREATE INDEX IF NOT EXISTS idx_inc_date ON incidents(incident_date);
CREATE INDEX IF NOT EXISTS idx_addr ON addresses(address);
"""


class Store:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)
        self.db_path = os.path.join(data_dir, "collector.db")
        self.state_path = os.path.join(data_dir, "state.json")
        self.jsonl_path = os.path.join(data_dir, "incidents.jsonl")
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA)
        self.conn.commit()
        self._restore_if_empty()

    # ---- state 복원/저장 ------------------------------------------------
    def _restore_if_empty(self) -> None:
        n_items = self.conn.execute("SELECT COUNT(*) FROM items").fetchone()[0]
        if n_items == 0 and os.path.exists(self.state_path):
            with open(self.state_path, encoding="utf-8") as f:
                st = json.load(f)
            self.conn.executemany("INSERT OR IGNORE INTO items VALUES (?,?,?,?,?,?,?,?)", st.get("seen", []))
            self.conn.executemany("INSERT OR IGNORE INTO sdn_snapshot VALUES (?,?,?,?,?,?)", st.get("sdn", []))
            self.conn.executemany("INSERT OR IGNORE INTO source_runs VALUES (?,?,?)", st.get("source_runs", []))
            self.conn.executemany("INSERT OR IGNORE INTO list_snapshot VALUES (?,?,?)", st.get("lists", []))
            self.conn.executemany("INSERT OR IGNORE INTO merge_decisions VALUES (?,?,?,?,?)", st.get("merge_decisions", []))
            self.conn.commit()
        n_inc = self.conn.execute("SELECT COUNT(*) FROM incidents").fetchone()[0]
        if n_inc == 0 and os.path.exists(self.jsonl_path):
            with open(self.jsonl_path, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        self.save_incident(incident_from_dict(json.loads(line)), commit=False)
                    except Exception:
                        continue
            self.conn.commit()

    def export_state(self) -> str:
        st = {
            "saved_at": datetime.now().isoformat(timespec="seconds"),
            "seen": [list(r) for r in self.conn.execute("SELECT uid, source, source_id, url, title, published_at, first_seen_at, status FROM items")],
            "sdn": [list(r) for r in self.conn.execute("SELECT chain, address, entity_uid, entity_name, programs, first_seen_at FROM sdn_snapshot")],
            "source_runs": [list(r) for r in self.conn.execute("SELECT name, last_run_at, last_count FROM source_runs")],
            "lists": [list(r) for r in self.conn.execute("SELECT name, value, first_seen_at FROM list_snapshot")],
            "merge_decisions": [list(r) for r in self.conn.execute("SELECT uid_a, uid_b, same, reason, decided_at FROM merge_decisions")],
        }
        with open(self.state_path, "w", encoding="utf-8") as f:
            json.dump(st, f, ensure_ascii=False)
        return self.state_path

    # ---- source schedule ------------------------------------------------
    def source_due(self, name: str, interval_hours: float) -> bool:
        r = self.conn.execute("SELECT last_run_at FROM source_runs WHERE name=?", (name,)).fetchone()
        if not r or not r[0]:
            return True
        try:
            last = datetime.fromisoformat(r[0])
        except ValueError:
            return True
        return datetime.now() - last >= timedelta(hours=interval_hours) - timedelta(minutes=5)

    def mark_source_run(self, name: str, count: int) -> None:
        self.conn.execute("INSERT OR REPLACE INTO source_runs (name, last_run_at, last_count) VALUES (?,?,?)",
                          (name, datetime.now().isoformat(timespec="seconds"), count))
        self.conn.commit()

    # ---- items ---------------------------------------------------------
    def seen_uids(self) -> Set[str]:
        return {r[0] for r in self.conn.execute("SELECT uid FROM items")}

    def mark_item(self, item: RawItem, status: str) -> None:
        self.conn.execute(
            "INSERT OR REPLACE INTO items (uid, source, source_id, url, title, published_at, first_seen_at, status) "
            "VALUES (?,?,?,?,?,?,COALESCE((SELECT first_seen_at FROM items WHERE uid=?),?),?)",
            (item.uid, item.source, item.source_id, item.url, item.title, item.published_at,
             item.uid, datetime.now().isoformat(timespec="seconds"), status),
        )
        self.conn.commit()

    # ---- incidents -----------------------------------------------------
    def save_incident(self, inc: Incident, commit: bool = True) -> None:
        self.conn.execute(
            "INSERT OR REPLACE INTO incidents (uid, source, published_at, incident_date, project, incident_type, "
            "amount_usd, relevant, enriched, collected_at, json) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (inc.uid, inc.source, inc.published_at, inc.incident_date, inc.project, inc.incident_type,
             inc.amount_usd, int(inc.relevant), int(inc.enriched), inc.collected_at,
             json.dumps(inc.to_dict(), ensure_ascii=False)),
        )
        self.conn.execute("DELETE FROM addresses WHERE uid=?", (inc.uid,))
        now = datetime.now().isoformat(timespec="seconds")
        for a in inc.addresses:
            self.conn.execute(
                "INSERT OR REPLACE INTO addresses (chain, address, uid, role, note, source, project, incident_date, first_seen_at) "
                "VALUES (?,?,?,?,?,?,?,?,?)",
                (a.chain, a.address, inc.uid, a.role, a.note, inc.source, inc.project, inc.incident_date, now),
            )
        if commit:
            self.conn.commit()

    def incidents_collected_between(self, start_day: str, end_day: str) -> List[Incident]:
        """start_day ≤ collected_at 날짜 ≤ end_day 인 카드."""
        rows = self.conn.execute(
            "SELECT json FROM incidents WHERE substr(collected_at,1,10) BETWEEN ? AND ? ORDER BY collected_at",
            (start_day, end_day),
        ).fetchall()
        return [incident_from_dict(json.loads(r[0])) for r in rows]

    # ---- 같은 사건 판정 캐시 -------------------------------------------
    def merge_decision(self, uid_a: str, uid_b: str) -> Optional[bool]:
        r = self.conn.execute("SELECT same FROM merge_decisions WHERE uid_a=? AND uid_b=?", (uid_a, uid_b)).fetchone()
        return None if r is None else bool(r[0])

    def set_merge_decision(self, uid_a: str, uid_b: str, same: bool, reason: str = "") -> None:
        self.conn.execute("INSERT OR REPLACE INTO merge_decisions VALUES (?,?,?,?,?)",
                          (uid_a, uid_b, int(same), reason, datetime.now().isoformat(timespec="seconds")))
        self.conn.commit()

    def incidents_collected_on(self, day: str) -> List[Incident]:
        rows = self.conn.execute(
            "SELECT json FROM incidents WHERE substr(collected_at,1,10)=? ORDER BY incident_date DESC", (day,)
        ).fetchall()
        return [incident_from_dict(json.loads(r[0])) for r in rows]

    def known_address_hits(self, addresses: Iterable[Address]) -> Dict[Tuple[str, str], List[dict]]:
        """이전 사건/제재 목록에 이미 등장한 주소인지 조회 (재등장 알림용)."""
        hits: Dict[Tuple[str, str], List[dict]] = {}
        for a in addresses:
            rows = self.conn.execute(
                "SELECT uid, source, project, incident_date, role FROM addresses WHERE address=? COLLATE NOCASE",
                (a.address,),
            ).fetchall()
            sdn = self.conn.execute(
                "SELECT entity_name, programs FROM sdn_snapshot WHERE address=? COLLATE NOCASE", (a.address,)
            ).fetchall()
            lst = [dict(r) for r in rows] + [{"source": "ofac_sdn", "project": r[0], "programs": r[1]} for r in sdn]
            if lst:
                hits[a.key()] = lst
        return hits

    # ---- OFAC SDN snapshot --------------------------------------------
    def sdn_known(self) -> Set[Tuple[str, str]]:
        return {(r[0], r[1]) for r in self.conn.execute("SELECT chain, address FROM sdn_snapshot")}

    def sdn_count(self) -> int:
        return self.conn.execute("SELECT COUNT(*) FROM sdn_snapshot").fetchone()[0]

    def sdn_add(self, rows: Iterable[tuple]) -> None:
        now = datetime.now().isoformat(timespec="seconds")
        self.conn.executemany(
            "INSERT OR IGNORE INTO sdn_snapshot (chain, address, entity_uid, entity_name, programs, first_seen_at) "
            "VALUES (?,?,?,?,?,?)",
            [(c, a, u, n, p, now) for (c, a, u, n, p) in rows],
        )
        self.conn.commit()

    # ---- 일반 목록 스냅샷 (scamsniffer 등 diff 소스) ----------------------
    def snapshot_known(self, name: str) -> Set[str]:
        return {r[0] for r in self.conn.execute("SELECT value FROM list_snapshot WHERE name=?", (name,))}

    def snapshot_add(self, name: str, values: Iterable[str]) -> None:
        now = datetime.now().isoformat(timespec="seconds")
        self.conn.executemany("INSERT OR IGNORE INTO list_snapshot (name, value, first_seen_at) VALUES (?,?,?)",
                              [(name, v, now) for v in values])
        self.conn.commit()

    # ---- runs & export -------------------------------------------------
    def log_run(self, since: str, collected: int, new_items: int, enriched: int, errors: List[str]) -> None:
        self.conn.execute(
            "INSERT INTO runs (run_at, since, collected, new_items, enriched, errors) VALUES (?,?,?,?,?,?)",
            (datetime.now().isoformat(timespec="seconds"), since, collected, new_items, enriched, "\n".join(errors)),
        )
        self.conn.commit()

    def export_jsonl(self, path: Optional[str] = None) -> str:
        path = path or self.jsonl_path
        rows = self.conn.execute("SELECT json FROM incidents ORDER BY incident_date DESC, published_at DESC").fetchall()
        with open(path, "w", encoding="utf-8") as f:
            for r in rows:
                f.write(r[0] + "\n")
        return path

    def export_addresses_csv(self, path: Optional[str] = None) -> str:
        path = path or os.path.join(self.data_dir, "addresses.csv")
        rows = self.conn.execute(
            "SELECT a.chain, a.address, a.role, a.note, a.source, a.project, a.incident_date, a.first_seen_at, "
            "json_extract(i.json, '$.url') FROM addresses a LEFT JOIN incidents i ON a.uid=i.uid "
            "ORDER BY a.first_seen_at DESC"
        ).fetchall()
        with open(path, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f)
            w.writerow(["chain", "address", "role", "note", "source", "project", "incident_date", "first_seen_at", "url"])
            for r in rows:
                w.writerow(list(r))
        return path

    def export_sdn_csv(self, path: Optional[str] = None) -> str:
        path = path or os.path.join(self.data_dir, "ofac_sdn_addresses.csv")
        rows = self.conn.execute(
            "SELECT chain, address, entity_uid, entity_name, programs, first_seen_at FROM sdn_snapshot ORDER BY entity_name"
        ).fetchall()
        with open(path, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f)
            w.writerow(["chain", "address", "entity_uid", "entity_name", "programs", "first_seen_at"])
            for r in rows:
                w.writerow(list(r))
        return path


def incident_from_dict(d: dict) -> Incident:
    d = dict(d)
    d["addresses"] = [Address(**a) for a in d.get("addresses", [])]
    known = set(Incident.__dataclass_fields__.keys())
    return Incident(**{k: v for k, v in d.items() if k in known})
