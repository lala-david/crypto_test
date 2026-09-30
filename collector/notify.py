"""알림 — 새 사건 카드와 일일 브리핑을 Teams(Workflows 웹훅) / Telegram(봇)으로 보낸다.
같은 사건은 채널별로 한 번만(alerts_sent 테이블, key = "<channel>:<uid>").

Teams 설정 (config.teams):
  채널 → … → Workflows → "웹훅 요청을 받으면 채널에 게시(Post to a channel when a webhook request is received)"
  → 생성된 URL 을 teams_webhook.txt(git 제외) 또는 환경변수 TEAMS_WEBHOOK_URL 에.
Telegram 설정 (config.telegram):
  @BotFather 토큰 → telegram_bot_token.txt 또는 TELEGRAM_BOT_TOKEN, chat id → config.telegram.chat_id 또는 TELEGRAM_ALERT_CHAT.

  python -m collector.notify --test [--channel teams|telegram]   # 테스트 메시지
  python -m collector.notify --setup                             # (telegram) chat id 확인
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


# ---------------------------------------------------------------------------
# 공통 서식
# ---------------------------------------------------------------------------
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


def _top_addresses(i: Incident, k: int = 3):
    top = [a for a in i.addresses if a.role in ("attacker", "laundering", "sanctioned")][:k] or i.addresses[:k]
    return top, max(0, len(i.addresses) - len(top))


def _report_url(repo_url: str, day: str) -> str:
    return f"{repo_url}/blob/main/reports/{day[:7]}/{day}.ko.md" if repo_url and day else ""


def _briefing_url(repo_url: str, day: str) -> str:
    return f"{repo_url}/blob/main/briefings/{day[:7]}/{day}.md" if repo_url and day else ""


# ---------------------------------------------------------------------------
# Telegram (HTML)
# ---------------------------------------------------------------------------
def _esc(s: str) -> str:
    return html.escape(str(s or ""), quote=False)


def format_incident(i: Incident, repo_url: str = "", day: str = "") -> str:
    head = f"{_severity(i)} <b>{_esc(i.project or i.title)}</b> · {_esc(INCIDENT_TYPE_KO.get(i.incident_type, i.incident_type))}"
    if i.followup_of:
        head += f" · <i>후속 (첫 보도 {_esc(i.followup_of.get('day', '')[5:])})</i>"
    meta = " · ".join(x for x in [", ".join(i.chains) if i.chains else "", i.incident_date or "", _money(i.amount_usd, i.amount_text)] if x)
    lines = [head, _esc(meta)]
    summ = _first_sentences(i.summary_ko or i.summary_en)
    if summ:
        lines.append(_esc(summ))
    if i.attack_method_ko:
        lines.append("🔧 " + _esc(_first_sentences(i.attack_method_ko, 1, 200)))
    if i.addresses:
        top, more = _top_addresses(i)
        lines.append(f"👛 주소 {len(i.addresses)}개\n" + "\n".join(f"<code>{_esc(a.address)}</code> ({_esc(a.role)})" for a in top)
                     + (f"\n… 외 {more}개" if more else ""))
    if i.blacklist_hits:
        lines.append(f"⚠️ 기존 블랙리스트 주소 {len(i.blacklist_hits)}개 재등장")
    links = [f'<a href="{_esc(i.url)}">{_esc(i.source)}</a>'] + [
        f'<a href="{_esc(m.get("url", ""))}">{_esc(m.get("source", ""))}</a>' for m in i.merged_from[:4] if m.get("url")]
    lines.append("🔗 " + " · ".join(links))
    if _report_url(repo_url, day):
        lines.append(f'📄 <a href="{_esc(_report_url(repo_url, day))}">상세 리포트</a>')
    return "\n".join(lines)


def format_briefing(day: str, briefing: dict, n_new: int, n_follow: int, repo_url: str = "") -> str:
    body = _esc(briefing.get("briefing_ko", ""))
    body = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", body)
    body = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r'<a href="\2">\1</a>', body)
    body = re.sub(r"^- ", "• ", body, flags=re.M)
    head = (f"📰 <b>{_esc(day)} 가상자산 해킹·범죄 브리핑</b>\n<b>{_esc(briefing.get('headline_ko', ''))}</b>\n"
            f"사건 {n_new + n_follow}건 (신규 {n_new}, 후속 {n_follow})\n\n")
    tail = f'\n\n📄 <a href="{_esc(_briefing_url(repo_url, day))}">전체 브리핑</a>' if repo_url else ""
    return head + body + tail


# ---------------------------------------------------------------------------
# Teams (Adaptive Card)
# ---------------------------------------------------------------------------
def _md(s: str) -> str:
    """Adaptive Card TextBlock 마크다운(굵게/링크/목록만) 에 안전한 텍스트."""
    return re.sub(r"[\r\t]", " ", str(s or ""))


def _card(body: list, actions: Optional[list] = None) -> dict:
    content = {
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json", "type": "AdaptiveCard", "version": "1.4",
        "msteams": {"width": "Full"}, "body": body,
    }
    if actions:
        content["actions"] = actions
    return {"type": "message", "attachments": [{"contentType": "application/vnd.microsoft.card.adaptive",
                                                "contentUrl": None, "content": content}]}


def teams_incident_card(i: Incident, repo_url: str = "", day: str = "") -> dict:
    title = f"{_severity(i)} {i.project or i.title} · {INCIDENT_TYPE_KO.get(i.incident_type, i.incident_type)}"
    if i.followup_of:
        title += f" · 후속 (첫 보도 {i.followup_of.get('day', '')[5:]})"
    facts = [f for f in [
        {"title": "체인", "value": ", ".join(i.chains)} if i.chains else None,
        {"title": "사건일", "value": i.incident_date} if i.incident_date else None,
        {"title": "금액", "value": _money(i.amount_usd, i.amount_text)},
        {"title": "출처", "value": ", ".join([i.source] + [m.get("source", "") for m in i.merged_from[:4]])},
    ] if f]
    body: list = [
        {"type": "TextBlock", "size": "Large", "weight": "Bolder", "text": _md(title), "wrap": True},
        {"type": "FactSet", "facts": facts},
    ]
    summ = _first_sentences(i.summary_ko or i.summary_en, 2, 400)
    if summ:
        body.append({"type": "TextBlock", "text": _md(summ), "wrap": True})
    if i.attack_method_ko:
        body.append({"type": "TextBlock", "text": "🔧 " + _md(_first_sentences(i.attack_method_ko, 1, 220)), "wrap": True, "isSubtle": True})
    if i.addresses:
        top, more = _top_addresses(i)
        addr_md = "\n\n".join(f"- {a.address} ({a.role})" for a in top) + (f"\n\n… 외 {more}개" if more else "")
        body.append({"type": "TextBlock", "text": f"**주소 {len(i.addresses)}개**\n\n{addr_md}", "wrap": True, "fontType": "Monospace", "size": "Small"})
    if i.blacklist_hits:
        body.append({"type": "TextBlock", "text": f"⚠️ 기존 블랙리스트 주소 {len(i.blacklist_hits)}개 재등장", "wrap": True, "color": "Warning"})
    actions = [{"type": "Action.OpenUrl", "title": f"원문 ({i.source})", "url": i.url}] if i.url else []
    for m in i.merged_from[:2]:
        if m.get("url"):
            actions.append({"type": "Action.OpenUrl", "title": m.get("source", "출처"), "url": m["url"]})
    if _report_url(repo_url, day):
        actions.append({"type": "Action.OpenUrl", "title": "상세 리포트", "url": _report_url(repo_url, day)})
    return _card(body, actions[:5])


def teams_briefing_card(day: str, briefing: dict, n_new: int, n_follow: int, repo_url: str = "") -> dict:
    body_md = briefing.get("briefing_ko", "")
    body_md = re.sub(r"^- ", "- ", body_md, flags=re.M).replace("\n- ", "\n\n- ")
    body: list = [
        {"type": "TextBlock", "size": "Large", "weight": "Bolder", "text": f"📰 {day} 가상자산 해킹·범죄 브리핑", "wrap": True},
        {"type": "TextBlock", "weight": "Bolder", "text": _md(briefing.get("headline_ko", "")), "wrap": True},
        {"type": "TextBlock", "text": f"사건 {n_new + n_follow}건 (신규 {n_new}, 후속 {n_follow})", "wrap": True, "isSubtle": True},
        {"type": "TextBlock", "text": _md(body_md), "wrap": True},
    ]
    actions = [{"type": "Action.OpenUrl", "title": "전체 브리핑", "url": _briefing_url(repo_url, day)}] if repo_url else []
    return _card(body, actions)


def teams_text_card(title: str, lines: List[str]) -> dict:
    return _card([{"type": "TextBlock", "weight": "Bolder", "text": _md(title), "wrap": True},
                  {"type": "TextBlock", "text": _md("\n\n".join(lines)), "wrap": True}])


# ---------------------------------------------------------------------------
# 채널 공통 로직
# ---------------------------------------------------------------------------
class BaseNotifier:
    channel = "base"

    def __init__(self, cfg: dict):
        self.cfg = cfg or {}
        self.enabled = bool(self.cfg.get("enabled", False))
        self.repo_url = (self.cfg.get("github_url") or "").rstrip("/")
        self.min_amount = float(self.cfg.get("min_amount_usd", 0) or 0)
        self.max_per_run = int(self.cfg.get("max_per_run", 10))

    # 하위 클래스 구현
    def send_incident(self, inc: Incident, day: str) -> bool:  # pragma: no cover
        raise NotImplementedError

    def send_briefing(self, day: str, briefing: dict, n_new: int, n_follow: int) -> bool:  # pragma: no cover
        raise NotImplementedError

    def send_text(self, title: str, lines: List[str]) -> bool:  # pragma: no cover
        raise NotImplementedError

    # 공통
    def _key(self, uid: str) -> str:
        return f"{self.channel}:{uid}"

    def alert_incidents(self, store, incidents: Iterable[Incident], day: str) -> int:
        """새로 병합된 사건마다 1회. 대표 uid 와 병합 멤버 uid 모두 기록해 재병합돼도 다시 보내지 않는다."""
        if not self.enabled:
            return 0
        sent = 0
        for inc in sorted([i for i in incidents if i.relevant], key=lambda i: -(i.amount_usd or 0)):
            uids = [inc.uid] + [m.get("uid") for m in inc.merged_from if m.get("uid")]
            if any(store.alert_sent(self._key(u)) for u in uids):
                continue
            if self.min_amount and (inc.amount_usd or 0) < self.min_amount and inc.incident_type not in (
                    "sanctions_designation", "law_enforcement_action"):
                continue
            if sent >= self.max_per_run:
                break
            if self.send_incident(inc, day):
                for u in uids:
                    store.mark_alert_sent(self._key(u), "incident")
                sent += 1
        if sent:
            log.info("%s: 사건 알림 %d건 발송", self.channel, sent)
        return sent

    def alert_briefing(self, store, day: str, briefing: Optional[dict], incidents: Iterable[Incident]) -> bool:
        if not self.enabled or not briefing or not self.cfg.get("daily_briefing", True):
            return False
        key = self._key(f"briefing:{day}")
        if store.alert_sent(key):
            return False
        rel = [i for i in incidents if i.relevant]
        n_follow = sum(1 for i in rel if i.followup_of)
        if self.send_briefing(day, briefing, len(rel) - n_follow, n_follow):
            store.mark_alert_sent(key, "briefing")
            log.info("%s: 일일 브리핑 발송 (%s)", self.channel, day)
            return True
        return False

    def alert_errors(self, errors: List[str]) -> None:
        if self.enabled and errors and self.cfg.get("alert_on_errors", True):
            self.send_text("⚠️ 수집기 오류", [f"• {e[:200]}" for e in errors[:8]])


class TeamsNotifier(BaseNotifier):
    """Teams Workflows 웹훅(Adaptive Card). 구형 Office 365 커넥터 URL 도 같은 payload 를 받는다."""

    channel = "teams"

    def __init__(self, cfg: dict, root: str):
        super().__init__(cfg)
        self.url = os.environ.get(self.cfg.get("webhook_env") or "TEAMS_WEBHOOK_URL", "").strip()
        wf = self.cfg.get("webhook_file")
        if not self.url and wf:
            p = wf if os.path.isabs(wf) else os.path.join(root, wf)
            if os.path.exists(p):
                with open(p, encoding="utf-8") as f:
                    self.url = f.read().strip()
        if self.enabled and not self.url:
            log.info("teams: 웹훅 URL 미설정 → 알림 건너뜀 (TEAMS_WEBHOOK_URL 또는 teams_webhook.txt)")
            self.enabled = False

    def post(self, payload: dict) -> bool:
        try:
            r = requests.post(self.url, json=payload, timeout=20)
            if r.status_code not in (200, 202):
                log.warning("teams webhook %s: %s", r.status_code, r.text[:200])
                return False
            return True
        except requests.RequestException as e:
            log.warning("teams 전송 실패: %s", e)
            return False

    def send_incident(self, inc, day):
        return self.post(teams_incident_card(inc, self.repo_url, day))

    def send_briefing(self, day, briefing, n_new, n_follow):
        return self.post(teams_briefing_card(day, briefing, n_new, n_follow, self.repo_url))

    def send_text(self, title, lines):
        return self.post(teams_text_card(title, lines))


class TelegramNotifier(BaseNotifier):
    channel = "telegram"
    API = "https://api.telegram.org/bot{token}/{method}"
    MAX_LEN = 4000

    def __init__(self, cfg: dict, root: str):
        super().__init__(cfg)
        self.token = os.environ.get(self.cfg.get("bot_token_env") or "TELEGRAM_BOT_TOKEN", "")
        tf = self.cfg.get("bot_token_file")
        if not self.token and tf:
            p = tf if os.path.isabs(tf) else os.path.join(root, tf)
            if os.path.exists(p):
                with open(p, encoding="utf-8") as f:
                    self.token = f.read().strip()
        self.chat = str(self.cfg.get("chat_id") or os.environ.get(self.cfg.get("chat_env") or "TELEGRAM_ALERT_CHAT", "")).strip()
        if self.enabled and not (self.token and self.chat):
            log.info("telegram: 토큰/채팅 미설정 → 알림 건너뜀 (TELEGRAM_BOT_TOKEN, TELEGRAM_ALERT_CHAT)")
            self.enabled = False

    def _chunks(self, text: str) -> List[str]:
        if len(text) <= self.MAX_LEN:
            return [text]
        out, cur = [], ""
        for para in text.split("\n"):
            if len(cur) + len(para) + 1 > self.MAX_LEN:
                out.append(cur)
                cur = para
            else:
                cur = (cur + "\n" + para) if cur else para
        if cur:
            out.append(cur)
        return out

    def send(self, text: str) -> bool:
        ok = True
        for chunk in self._chunks(text):
            try:
                r = requests.post(self.API.format(token=self.token, method="sendMessage"),
                                  json={"chat_id": self.chat, "text": chunk, "parse_mode": "HTML",
                                        "disable_web_page_preview": True}, timeout=20)
                if r.status_code != 200:
                    log.warning("telegram sendMessage %s: %s", r.status_code, r.text[:200])
                    r2 = requests.post(self.API.format(token=self.token, method="sendMessage"),
                                       json={"chat_id": self.chat, "text": re.sub(r"<[^>]+>", "", chunk),
                                             "disable_web_page_preview": True}, timeout=20)
                    ok = ok and r2.status_code == 200
            except requests.RequestException as e:
                log.warning("telegram 전송 실패: %s", e)
                ok = False
        return ok

    def get_updates(self) -> list:
        r = requests.get(self.API.format(token=self.token, method="getUpdates"), timeout=20)
        r.raise_for_status()
        return r.json().get("result", [])

    def send_incident(self, inc, day):
        return self.send(format_incident(inc, self.repo_url, day))

    def send_briefing(self, day, briefing, n_new, n_follow):
        return self.send(format_briefing(day, briefing, n_new, n_follow, self.repo_url))

    def send_text(self, title, lines):
        return self.send(f"<b>{_esc(title)}</b>\n" + "\n".join(_esc(l) for l in lines))


def build_notifiers(cfg: dict, root: str) -> List[BaseNotifier]:
    out: List[BaseNotifier] = []
    if (cfg.get("teams") or {}).get("enabled"):
        out.append(TeamsNotifier(cfg["teams"], root))
    if (cfg.get("telegram") or {}).get("enabled"):
        out.append(TelegramNotifier(cfg["telegram"], root))
    return [n for n in out if n.enabled]


# ---------------------------------------------------------------------------
def main() -> int:
    from .config import load_config

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cfg = load_config(os.path.join(root, "config.yaml"), root)
    channel = sys.argv[sys.argv.index("--channel") + 1] if "--channel" in sys.argv else "teams"
    if "--setup" in sys.argv:
        n = TelegramNotifier({**(cfg.get("telegram") or {}), "enabled": True}, root)
        if not n.token:
            print("TELEGRAM_BOT_TOKEN 이 없습니다. @BotFather 에서 봇을 만들고 토큰을 환경변수 또는 telegram_bot_token.txt 에 넣으세요.")
            return 1
        chats = {}
        for u in n.get_updates():
            m = u.get("message") or u.get("channel_post") or u.get("my_chat_member", {}) or {}
            c = m.get("chat") or {}
            if c.get("id"):
                chats[c["id"]] = f"{c.get('type')} {c.get('title') or c.get('username') or c.get('first_name')}"
        if not chats:
            print("아직 업데이트가 없습니다. 봇에게 메시지를 보내거나 봇을 채널 관리자로 추가한 뒤 다시 실행하세요.")
        for cid, desc in chats.items():
            print(f"chat_id={cid}  ({desc})")
        return 0
    if "--test" in sys.argv:
        sub = {**(cfg.get(channel) or {}), "enabled": True}
        n = TeamsNotifier(sub, root) if channel == "teams" else TelegramNotifier(sub, root)
        if not n.enabled:
            print(f"{channel}: 설정이 없어 보낼 수 없습니다 (README 의 설정 절차 참고).")
            return 1
        ok = n.send_text("✅ crypto-incident-collector 테스트", [f"{channel} 알림 연결 확인 " + datetime.now().strftime("%Y-%m-%d %H:%M")])
        print(f"{channel} sent:", ok)
        return 0 if ok else 1
    print(__doc__)
    return 0


if __name__ == "__main__":
    sys.exit(main())
