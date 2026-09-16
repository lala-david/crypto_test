"""로컬 대시보드 서버 — docs/ 를 정적으로 서빙 (기본 http://localhost:8765).

  python serve_site.py             # localhost 만 (IPv4+IPv6)
  python serve_site.py --lan       # 같은 네트워크의 다른 PC에서도 접속 (http://<이 PC IP>:8765)
  python serve_site.py --port 9000
데이터 파일은 매시간 수집이 갱신하므로 no-cache 헤더를 붙여 새로고침만 하면 최신이 보인다.
"""
from __future__ import annotations

import argparse
import os
import socket
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(ROOT, "docs")


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        if self.path.endswith((".json", ".html", "/")):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format, *args):  # noqa: A002 — 조용히
        pass


class V6Server(ThreadingHTTPServer):
    address_family = socket.AF_INET6


def serve(bind: str, port: int, v6: bool = False):
    cls = V6Server if v6 else ThreadingHTTPServer
    try:
        srv = cls((bind, port), partial(Handler, directory=DOCS))
    except OSError as e:
        print(f"[serve_site] {bind}:{port} 바인딩 실패: {e}", file=sys.stderr)
        return
    srv.serve_forever()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--lan", action="store_true", help="0.0.0.0 에 바인딩 (LAN 공개)")
    args = ap.parse_args()
    if not os.path.isdir(DOCS):
        print("docs/ 가 없습니다. run.py 를 한 번 실행하세요.", file=sys.stderr)
        return 1
    binds = [("0.0.0.0", False), ("::", True)] if args.lan else [("127.0.0.1", False), ("::1", True)]
    threads = [threading.Thread(target=serve, args=(b, args.port, v6), daemon=True) for b, v6 in binds]
    for t in threads:
        t.start()
    print(f"[serve_site] http://localhost:{args.port}/  ({'LAN 공개' if args.lan else 'localhost 전용'})  docs={DOCS}")
    try:
        for t in threads:
            t.join()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
