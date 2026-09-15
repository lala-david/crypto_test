"""HTTP 유틸: 재시도, UA, 디스크 캐시."""
from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from typing import Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

log = logging.getLogger("collector.http")

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/128.0 Safari/537.36 crypto-incident-collector/0.1"
)


class Http:
    def __init__(self, cache_dir: str, timeout: int = 40):
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)
        self.timeout = timeout
        self.session = requests.Session()
        retry = Retry(
            total=3,
            backoff_factor=1.5,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=("GET",),
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)
        self.session.headers.update({"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9,ko;q=0.8"})

    # ---- cache helpers -------------------------------------------------
    def _cache_path(self, url: str) -> str:
        return os.path.join(self.cache_dir, hashlib.sha1(url.encode()).hexdigest())

    def _cache_get(self, url: str, ttl_hours: Optional[float]) -> Optional[bytes]:
        if ttl_hours is None:
            return None
        p = self._cache_path(url)
        if not os.path.exists(p):
            return None
        age_h = (time.time() - os.path.getmtime(p)) / 3600
        if age_h > ttl_hours:
            return None
        with open(p, "rb") as f:
            return f.read()

    def _cache_put(self, url: str, content: bytes) -> None:
        with open(self._cache_path(url), "wb") as f:
            f.write(content)

    # ---- public --------------------------------------------------------
    def get_bytes(self, url: str, cache_ttl_hours: Optional[float] = None, params: dict | None = None,
                  headers: dict | None = None) -> bytes:
        cached = self._cache_get(url, cache_ttl_hours)
        if cached is not None:
            return cached
        r = self.session.get(url, timeout=self.timeout, params=params, headers=headers)
        if r.status_code >= 400:
            raise requests.HTTPError(f"{r.status_code} for {url}")
        if cache_ttl_hours is not None:
            self._cache_put(url, r.content)
        return r.content

    def get_text(self, url: str, cache_ttl_hours: Optional[float] = None, params: dict | None = None,
                 headers: dict | None = None) -> str:
        b = self.get_bytes(url, cache_ttl_hours, params, headers)
        return b.decode("utf-8", errors="ignore")

    def get_json(self, url: str, cache_ttl_hours: Optional[float] = None, params: dict | None = None):
        return json.loads(self.get_text(url, cache_ttl_hours, params))

    def download(self, url: str, path: str) -> str:
        """대용량 파일 스트리밍 다운로드 (OFAC SDN XML 등)."""
        tmp = path + ".part"
        with self.session.get(url, timeout=self.timeout, stream=True) as r:
            r.raise_for_status()
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(chunk_size=1 << 16):
                    if chunk:
                        f.write(chunk)
        os.replace(tmp, path)
        return path
