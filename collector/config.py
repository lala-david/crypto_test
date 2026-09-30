"""설정 로딩: .env 파일 → 환경변수 → config.yaml 의 ${VAR} 치환.

다른 서버에 그대로 올려도 config.yaml 을 고치지 않고 환경변수만으로 동작하게 한다.
  - `.env` (저장소 루트, git 제외)를 읽어 없는 환경변수만 채운다.
  - config.yaml 안의 `${VAR}` 또는 `${VAR:-기본값}` 을 실제 값으로 바꾼다. 값이 없고 기본값도 없으면 빈 문자열.
"""
from __future__ import annotations

import os
import re
from typing import Any, Optional

import yaml

_VAR = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}")


def load_env(root: str, filename: str = ".env") -> int:
    """루트의 .env 를 읽어 아직 없는 환경변수를 채운다. 반환: 새로 설정한 개수."""
    path = os.path.join(root, filename)
    if not os.path.isfile(path):
        return 0
    n = 0
    with open(path, encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key, val = key.strip(), val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val
                n += 1
    return n


def expand(value: Any) -> Any:
    """문자열(및 중첩 dict/list) 안의 ${VAR} / ${VAR:-기본값} 치환."""
    if isinstance(value, str):
        def sub(m: re.Match) -> str:
            return os.environ.get(m.group(1)) or (m.group(2) if m.group(2) is not None else "")
        out = _VAR.sub(sub, value)
        # "true"/"false"/숫자로 쓴 환경변수가 문자열로 남지 않게 (yaml 가 이미 형 변환한 경우는 여기 안 옴)
        if out != value and out.lower() in ("true", "false"):
            return out.lower() == "true"
        return out
    if isinstance(value, dict):
        return {k: expand(v) for k, v in value.items()}
    if isinstance(value, list):
        return [expand(v) for v in value]
    return value


def load_config(path: str, root: Optional[str] = None) -> dict:
    """config.yaml 을 읽고 .env·환경변수를 반영해 돌려준다."""
    root = root or os.path.dirname(os.path.abspath(path))
    load_env(root)
    with open(path, encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}
    return expand(cfg)
