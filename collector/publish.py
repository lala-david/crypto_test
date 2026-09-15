"""결과물을 git commit & push (GitHub로 브리핑 전달)."""
from __future__ import annotations

import logging
import os
import subprocess
from typing import List

log = logging.getLogger("collector.publish")


def _git(root: str, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=root, capture_output=True, text=True, encoding="utf-8", errors="ignore")


def commit_and_push(root: str, message: str, paths: List[str], remote: str = "origin", push: bool = True) -> bool:
    if not os.path.isdir(os.path.join(root, ".git")):
        log.warning("git 저장소가 아니라 push 생략 (git init && git remote add origin <url> 먼저)")
        return False
    existing = [p for p in paths if os.path.exists(os.path.join(root, p))]
    if not existing:
        return False
    r = _git(root, "add", "-A", "--", *existing)
    if r.returncode != 0:
        log.error("git add 실패: %s", r.stderr[:300])
        return False
    if _git(root, "diff", "--cached", "--quiet").returncode == 0:
        log.info("변경 사항 없음 → commit 생략")
        return False
    r = _git(root, "-c", "user.name=crypto-incident-bot", "-c", "user.email=bot@users.noreply.github.com",
             "commit", "-m", message)
    if r.returncode != 0:
        log.error("git commit 실패: %s", (r.stderr or r.stdout)[:300])
        return False
    log.info("commit: %s", message)
    if not push:
        return True
    # 원격에 다른 커밋(예: Actions, 다른 PC)이 있으면 먼저 rebase
    r = _git(root, "pull", "--rebase", "--autostash", remote)
    if r.returncode != 0:
        log.warning("git pull --rebase 실패(계속 push 시도): %s", (r.stderr or r.stdout)[:300])
    r = _git(root, "push", remote, "HEAD")
    if r.returncode != 0:
        log.error("git push 실패: %s", (r.stderr or r.stdout)[:400])
        return False
    log.info("push 완료 → %s", remote)
    return True
