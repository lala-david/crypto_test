"""Telegram 알림 — 새 사건 카드와 일일 브리핑을 봇으로 보낸다. 같은 사건은 한 번만(alerts_sent 테이블).

설정(config.telegram) 또는 환경변수:
  TELEGRAM_BOT_TOKEN   @BotFather 에서 만든 봇 토큰 (또는 telegram.bot_token_file 파일)
  TELEGRAM_ALERT_CHAT  채널 @handle 또는 숫자 chat id (봇이 채널 관리자여야 함)
둘 중 하나라도 없으면 조용히 건너뛴다.

  python -m collector.notify --setup   # 봇에게 메시지를 보낸 뒤 실행하면 chat id 를 알려준다
  python -m collector.notify --test    # 테스트 메시지 발송
"""
from __future__ import annotations

import html
import logging
import os
import re
import sys
from datetime import datetime
from typing import Iterable, List, Optional

import requests

from .models import INCIDENT_TYPE_KO, Incident

log = logging.getLogger("collector.notify")

API = "https://api.telegram.org/bot{token}/{method}"
MAX_LEN = 4000  # Telegram 한도 4096


def _esc(s: str) -> str:
    return html.escape(str(s or ""), quote=False)


def _money(v: Optional[float], text: str = "") -> str:
    if v is None:
        return text or "금액 미상"
    if v >= 1e9:
        return f"${v/1e9:,.2f}B"
    if v >= 1e6:
        return f"${v/1e6:,.1f}M"
    if v >= 1e3:
        return f"${v/1e3:,.0f}K"
    return f"${v:,.0f}"


def _severity(i: Incident) -> str:
    if i.incident_type == "sanctions_designation":
        return "🛑"
    if i.incident_type == "law_enforcement_action":
        return "⚖️"
    a = i.amount_usd or 0
    return "🔴" if a >= 10_000_000 else ("🟠" if a >= 1_000_000 else "🟡")


def _first_sentences(text: str, n: int = 2, limit: int = 320) -> str:
    parts = re.split(r"(?<=[.!?。다])\s+", (text or "").strip())
    out = " ".join(parts[:n]).strip()
    return (out[: limit - 1] + "…") if len(out) > limit else out


def format_incident(i: Incident, repo_url: str = "", day: str = "") -> str:
    head = f"{_severity(i)} <b>{_esc(i.project or i.title)}</b> · {_esc(INCIDENT_TYPE_KO.get(i.incident_type, i.incident_type))}"
    if i.followup_of:
        head += f" · <i>후속 (첫 보도 {_esc(i.followup_of.get('day', '')[5:])})</i>"
    meta = " · ".join(x for x in [
        ", ".join(i.chains) if i.chains else "",
        i.incident_date or "",
        _money(i.amount_usd, i.amount_text),
    ] if x)
    lines = [head, _esc(meta)]
    summ = _first_sentences(i.summary_ko or i.summary_en)
    if summ:
        lines.append(_esc(summ))
    if i.attack_method_ko:
        lines.append("🔧 " + _esc(_first_sentences(i.attack_method_ko, 1, 200)))
    if i.addresses:
        top = [a for a in i.addresses if a.role in ("attacker", "laundering", "sanctioned")][:3] or i.addresses[:3]
        addr_lines = [f"<code>{_esc(a.address)}</code> ({_esc(a.role)})" for a in top]
        more = len(i.addresses) - len(top)
        lines.append(f"👛 주소 {len(i.addresses)}개\n" + "\n".join(addr_lines) + (f"\n… 외 {more}개" if more > 0 else ""))
    if i.blacklist_hits:
        lines.append(f"⚠️ 기존 블랙리스트 주소 {len(i.blacklist_hits)}개 재등장")
    links = [f'<a href="{_esc(i.url)}">{_esc(i.source)}</a>'] + [
        f'<a href="{_esc(m.get("url", ""))}">{_esc(m.get("source", ""))}</a>' for m in i.merged_from[:4] if m.get("url")
    ]
    lines.append("🔗 " + " · ".join(links))
    if repo_url and day:
        lines.append(f'📄 <a href="{_esc(repo_url)}/blob/main/reports/{day[:7]}/{day}.ko.md">상세 리포트</a>')
    return "\n".join(lines)


def format_briefing(day: str, briefing: dict, n_new: int, n_follow: int, repo_url: str = "") -> str:
    body = briefing.get("briefing_ko", "")
    # 마크다운 → 텔레그램 HTML (굵게, 링크만)
    body = _esc(body)
    body = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", body)
    body = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r'<a href="\2">\1</a>', body)
    body = re.sub(r"^- ", "• ", body, flags=re.M)
    head = f"📰 <b>{_esc(day)} 가상자산 해킹·범죄 브리핑</b>\n<b>{_esc(briefing.get('headline_ko', ''))}</b>\n사건 {n_new + n_follow}건 (신규 {n_new}, 후속 {n_follow})\n\n"
    tail = f'\n\n📄 <a href="{_esc(repo_url)}/blob/main/briefings/{day[:7]}/{day}.md">전체 브리핑</a>' if repo_url else ""
    return head + body + tail


def _chunks(text: str, limit: int = MAX_LEN) -> List[str]:
    if len(text) <= limit:
        return [text]
    out, cur = [], ""
    for para in text.split("\n"):
        if len(cur) + len(para) + 1 > limit:
            out.append(cur)
            cur = para
        else:
            cur = (cur + "\n" + para) if cur else para
    if cur:
        out.append(cur)
    return out


class TelegramNotifier:
    def __init__(self, cfg: dict, root: str):
        self.cfg = cfg or {}
        self.enabled = bool(self.cfg.get("enabled", False))
        self.token = os.environ.get(self.cfg.get("bot_token_env") or "TELEGRAM_BOT_TOKEN", "")
        tf = self.cfg.get("bot_token_file")
        if not self.token and tf:
            p = tf if os.path.isabs(tf) else os.path.join(root, tf)
            if os.path.exists(p):
                with open(p, encoding="utf-8") as f:
                    self.token = f.read().strip()
        self.chat = str(self.cfg.get("chat_id") or os.environ.get(self.cfg.get("chat_env") or "TELEGRAM_ALERT_CHAT", "")).strip()
        self.repo_url = (self.cfg.get("github_url") or "").rstrip("/")
        self.min_amount = float(self.cfg.get("min_amount_usd", 0) or 0)
        self.max_per_run = int(self.cfg.get("max_per_run", 10))
        if self.enabled and not (self.token and self.chat):
            log.info("telegram: 토큰/채팅 미설정 → 알림 건너뜀 (TELEGRAM_BOT_TOKEN, TELEGRAM_ALERT_CHAT)")
            self.enabled = False

    # ---- low level -----------------------------------------------------
    def send(self, text: str) -> bool:
        ok = True
        for chunk in _chunks(text):
            try:
                r = requests.post(API.format(token=self.token, method="sendMessage"),
                                  json={"chat_id": self.chat, "text": chunk, "parse_mode": "HTML",
                                        "disable_web_page_preview": True}, timeout=20)
                if r.status_code != 200:
                    log.warning("telegram sendMessage %s: %s", r.status_code, r.text[:200])
                    # HTML 파싱 실패 시 평문으로 재시도
                    r2 = requests.post(API.format(token=self.token, method="sendMessage"),
                                       json={"chat_id": self.chat, "text": re.sub(r"<[^>]+>", "", chunk),
                                             "disable_web_page_preview": True}, timeout=20)
                    ok = ok and r2.status_code == 200
            except requests.RequestException as e:
                log.warning("telegram 전송 실패: %s", e)
                ok = False
        return ok

    def get_updates(self) -> list:
        r = requests.get(API.format(token=self.token, method="getUpdates"), timeout=20)
        r.raise_for_status()
        return r.json().get("result", [])

    # ---- high level ----------------------------------------------------
    def alert_incidents(self, store, incidents: Iterable[Incident], day: str) -> int:
        """새로 병합된 사건마다 1회 알림. 대표 uid 와 병합 멤버 uid 모두 기록해 재병합돼도 다시 보내지 않는다."""
        if not self.enabled:
            return 0
        sent = 0
        candidates = [i for i in incidents if i.relevant]
        candidates.sort(key=lambda i: -(i.amount_usd or 0))
        for inc in candidates:
            uids = [inc.uid] + [m.get("uid") for m in inc.merged_from if m.get("uid")]
            if any(store.alert_sent(u) for u in uids):
                continue
            if self.min_amount and (inc.amount_usd or 0) < self.min_amount and inc.incident_type not in (
                    "sanctions_designation", "law_enforcement_action"):
                continue
            if sent >= self.max_per_run:
                break
            if self.send(format_incident(inc, self.repo_url, day)):
                for u in uids:
                    store.mark_alert_sent(u, "incident")
                sent += 1
        if sent:
            log.info("telegram: 사건 알림 %d건 발송", sent)
        return sent

    def alert_briefing(self, store, day: str, briefing: Optional[dict], incidents: Iterable[Incident]) -> bool:
        """그날 첫 브리핑이 생기면 한 번 보낸다."""
        if not self.enabled or not briefing or not self.cfg.get("daily_briefing", True):
            return False
        key = f"briefing:{day}"
        if store.alert_sent(key):
            return False
        rel = [i for i in incidents if i.relevant]
        n_follow = sum(1 for i in rel if i.followup_of)
        if self.send(format_briefing(day, briefing, len(rel) - n_follow, n_follow, self.repo_url)):
            store.mark_alert_sent(key, "briefing")
            log.info("telegram: 일일 브리핑 발송 (%s)", day)
            return True
        return False

    def alert_errors(self, errors: List[str]) -> None:
        if self.enabled and errors and self.cfg.get("alert_on_errors", True):
            self.send("⚠️ <b>수집기 오류</b>\n" + "\n".join(f"• {_esc(e)[:200]}" for e in errors[:8]))


def main() -> int:
    import yaml

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    with open(os.path.join(root, "config.yaml"), encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    tcfg = dict(cfg.get("telegram") or {})
    tcfg["enabled"] = True
    n = TelegramNotifier(tcfg, root)
    if "--setup" in sys.argv:
        if not n.token:
            print("TELEGRAM_BOT_TOKEN 이 없습니다. @BotFather 에서 봇을 만들고 토큰을 환경변수 또는 telegram_bot_token.txt 에 넣으세요.")
            return 1
        ups = n.get_updates()
        chats = {}
        for u in ups:
            m = u.get("message") or u.get("channel_post") or u.get("my_chat_member", {}) or {}
            c = m.get("chat") or {}
            if c.get("id"):
                chats[c["id"]] = f"{c.get('type')} {c.get('title') or c.get('username') or c.get('first_name')}"
        if not chats:
            print("아직 업데이트가 없습니다. 봇에게 메시지를 보내거나(개인 채팅) 봇을 채널 관리자로 추가한 뒤 다시 실행하세요.")
        for cid, desc in chats.items():
            print(f"chat_id={cid}  ({desc})")
        return 0
    if "--test" in sys.argv:
        if not n.enabled:
            print("토큰 또는 chat 이 없어 보낼 수 없습니다.", "token:", bool(n.token), "chat:", n.chat or "(없음)")
            return 1
        ok = n.send("✅ crypto-incident-collector 테스트 메시지 " + datetime.now().strftime("%Y-%m-%d %H:%M"))
        print("sent:", ok)
        return 0 if ok else 1
    print(__doc__)
    return 0


if __name__ == "__main__":
    sys.exit(main())
