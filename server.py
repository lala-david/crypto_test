"""로컬 백엔드 + 정적 프런트 서버 (Starlette + uvicorn, 의존성 최소).

  python server.py                 # http://localhost:8765  (localhost 전용)
  python server.py --lan --port 8765

API (모두 JSON):
  GET /api                      엔드포인트 목록
  GET /api/meta
  GET /api/incidents?days=30|all&from=&to=&type=&chain=&source=&q=&hide_followups=0&basis=event|collected&page=1&size=20&sort=day|amount|date
  GET /api/incidents/{uid}
  GET /api/briefings            GET /api/briefings/{day}
  GET /api/stats?days=30&type=&chain=&source=&q=
  GET /api/addresses?days=30&role=attacker|laundering|sanctioned|victim|unknown&chain=&q=&page=&size=
  GET /api/addresses/lookup?q=  GET /api/search?q=
정적 파일: docs/ (index.html, incidents.html, …)
"""
from __future__ import annotations

import argparse
import os
import re
import sys

import yaml
from starlette.applications import Starlette
from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

from collector.service import DataService

ROOT = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(ROOT, "docs")

with open(os.path.join(ROOT, "config.yaml"), encoding="utf-8") as f:
    CFG = yaml.safe_load(f)
svc = DataService(ROOT, CFG)

LIGHT_DROP = {"background_ko", "background_en", "attack_method_en", "fund_flow_ko", "fund_flow_en", "tx_hashes", "blacklist_detail"}


def J(data, status=200):
    return JSONResponse(data, status_code=status, headers={"Cache-Control": "no-store"})


def _p(req: Request, name: str, default=None):
    v = req.query_params.get(name)
    return v if v not in (None, "") else default


def _int(req: Request, name: str, default: int) -> int:
    try:
        return int(req.query_params.get(name, default))
    except (TypeError, ValueError):
        return default


def _filters(req: Request):
    return dict(days=_p(req, "days", "30"), from_=_p(req, "from"), to=_p(req, "to"), type_=_p(req, "type"), chain=_p(req, "chain"),
                source=_p(req, "source"), q=_p(req, "q"), hide_followups=bool(_int(req, "hide_followups", 0)),
                basis=("collected" if _p(req, "basis") == "collected" else "event"))


async def api_index(req: Request):
    return J({"endpoints": [r.path for r in app.routes if isinstance(r, Route)], "doc": __doc__})


async def meta(req: Request):
    svc.refresh()
    return J(svc.meta)


async def incidents(req: Request):
    rows = svc.filter(**_filters(req))
    sort = _p(req, "sort", "day")
    if sort == "amount":
        rows = sorted(rows, key=lambda r: -(r["amount_usd"] or 0))
    elif sort == "date":
        rows = sorted(rows, key=lambda r: (r.get("event_date") or r["day"]), reverse=True)
    size = max(1, min(_int(req, "size", 20), 200))
    page = max(1, _int(req, "page", 1))
    items = rows[(page - 1) * size:page * size]
    if _int(req, "light", 1):
        items = [{k: v for k, v in r.items() if k not in LIGHT_DROP} for r in items]
    base = [r for r in rows if not r["followup_of"]]
    return J({"total": len(rows), "new_total": len(base), "amount_total": sum(r["amount_usd"] or 0 for r in base),
              "page": page, "size": size, "items": items, "facets": svc.facets(rows)})


async def incident(req: Request):
    svc.refresh()
    r = svc.by_uid.get(req.path_params["uid"])
    if not r:
        raise HTTPException(404, "incident not found")
    return J({**r, "related": svc.related(r)})


async def briefings(req: Request):
    svc.refresh()
    return J([{k: v for k, v in b.items() if k not in ("briefing_ko", "briefing_en")} for b in svc.briefings])


async def briefing(req: Request):
    svc.refresh()
    day = req.path_params["day"]
    if day == "latest" and svc.briefings:
        day = svc.briefings[0]["day"]
    b = next((x for x in svc.briefings if x["day"] == day), None)
    if not b:
        raise HTTPException(404, "briefing not found")
    rows = [{k: v for k, v in r.items() if k not in LIGHT_DROP} for r in svc.incidents if r["day"] == day]
    return J({**b, "incidents": rows})


async def stats(req: Request):
    f = _filters(req)
    rows = svc.filter(**f)
    lo, hi = svc.range_bounds(f["days"], f["from_"], f["to"])
    return J({**svc.stats(rows, lo, hi, f["basis"]), "facets": svc.facets(rows)})


async def addresses(req: Request):
    f = _filters(req)
    role, chain, q = _p(req, "role"), _p(req, "chain"), _p(req, "q")
    size = max(1, min(_int(req, "size", 50), 500)); page = max(1, _int(req, "page", 1))
    res = svc.list_addresses(f["days"], f["from_"], f["to"], role=role, chain=chain, q=q, basis=f["basis"], limit=100000)
    items = res["items"][(page - 1) * size:page * size]
    return J({"total": res["total"], "page": page, "size": size, "items": items, "roles": res["roles"], "chains": res["chains"]})


async def lookup(req: Request):
    q = (_p(req, "q") or "").strip()
    if len(q) < 6:
        raise HTTPException(400, "query too short")
    return J(svc.lookup_address(q))


async def search(req: Request):
    return J(svc.suggest(_p(req, "q") or ""))


async def http_error(req: Request, exc: HTTPException):
    return J({"detail": exc.detail}, exc.status_code)


class NoStore:
    """모든 응답에 Cache-Control: no-store — 로컬 대시보드라 항상 최신 HTML/JS/CSS 를 보게 한다."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = [(k, v) for k, v in message.get("headers", []) if k.lower() != b"cache-control"]
                headers.append((b"cache-control", b"no-store, max-age=0"))
                message = {**message, "headers": headers}
            await send(message)
        await self.app(scope, receive, send_wrapper)



_ASSET_RE = re.compile(r'((?:src|href)=")([A-Za-z0-9_\-]+\.(?:js|css))(")')


def _versioned_html(name: str) -> str | None:
    """docs/<name>.html 을 읽어 로컬 .js/.css 참조에 ?v=<파일 mtime> 을 붙인다 → 파일이 바뀌면 URL 도 바뀌어 옛 캐시를 쓰지 않는다."""
    path = os.path.join(DOCS, name)
    if not os.path.isfile(path):
        return None
    html = open(path, encoding="utf-8").read()

    def sub(m):
        f = os.path.join(DOCS, m.group(2))
        v = int(os.path.getmtime(f)) if os.path.isfile(f) else 0
        return f"{m.group(1)}{m.group(2)}?v={v}{m.group(3)}"
    return _ASSET_RE.sub(sub, html)


async def page(req: Request):
    name = req.path_params.get("name") or "index"
    html = _versioned_html(f"{name}.html")
    if html is None:
        raise HTTPException(404, "not found")
    return HTMLResponse(html)

app = Starlette(routes=[
    Route("/api", api_index), Route("/api/meta", meta), Route("/api/incidents", incidents), Route("/api/incidents/{uid}", incident),
    Route("/api/briefings", briefings), Route("/api/briefings/{day}", briefing), Route("/api/stats", stats),
    Route("/api/addresses", addresses), Route("/api/addresses/lookup", lookup), Route("/api/search", search),
    Route("/", page), Route("/{name:str}.html", page),
    Mount("/", app=StaticFiles(directory=DOCS, html=True), name="static"),
], exception_handlers={HTTPException: http_error})
app = NoStore(app)

def main() -> int:
    import uvicorn

    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--lan", action="store_true", help="0.0.0.0 에 바인딩 (같은 네트워크에서 접속)")
    args = ap.parse_args()
    if sys.stdout is None or sys.stderr is None:  # pythonw(창 없이) 실행 시 표준 출력이 없다 → 로그 파일로
        os.makedirs(os.path.join(ROOT, "logs"), exist_ok=True)
        log = open(os.path.join(ROOT, "logs", "server.log"), "a", encoding="utf-8", buffering=1)
        sys.stdout = sys.stderr = log
    svc.refresh(force=True)
    host = "0.0.0.0" if args.lan else "127.0.0.1"
    print(f"[server] http://localhost:{args.port}/  api: /api  ({'LAN' if args.lan else 'localhost'})", flush=True)
    uvicorn.run(app, host=host, port=args.port, log_level="warning")
    return 0


if __name__ == "__main__":
    sys.exit(main())
