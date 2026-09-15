"""수집 → 신규 판정 → LLM 사건 카드(한/영) → 브리핑 → 리포트 → (git push)

매시간 실행해도 된다. 소스마다 config.schedule.intervals 에 정한 주기가 안 됐으면 건너뛴다.

  python run.py                       # 주기가 된 소스만 수집
  python run.py --force               # 모든 소스 즉시 수집
  python run.py --sources rekt,doj    # 일부 소스만 (주기 무시)
  python run.py --since 2026-09-01    # 기준일 지정
  python run.py --provider openrouter # LLM 공급자 바꿔서 (ollama | openrouter | claude)
  python run.py --no-llm              # 규칙 기반만
  python run.py --reprocess --limit 3 # 이미 본 항목 다시 처리(테스트)
  python run.py --no-push             # git push 생략
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from typing import Dict, List

import yaml

from collector.briefing import write_briefing
from collector.crimial import CrimialHunter
from collector.enrich import Enricher, build_incident
from collector.http import Http
from collector.llm import build_provider
from collector.merge import merge_incidents
from collector.models import Incident, RawItem
from collector.publish import commit_and_push
from collector.report import build_markdown, update_readme_briefing, write_report
from collector.sources import SourceContext, build_sources
from collector.store import Store

ROOT = os.path.dirname(os.path.abspath(__file__))


def setup_logging(log_dir: str) -> logging.Logger:
    os.makedirs(log_dir, exist_ok=True)
    fmt = "%(asctime)s %(levelname)s %(name)s: %(message)s"
    handlers = [logging.StreamHandler(sys.stdout),
                logging.FileHandler(os.path.join(log_dir, f"{date.today().isoformat()}.log"), encoding="utf-8")]
    logging.basicConfig(level=logging.INFO, format=fmt, handlers=handlers)
    for noisy in ("urllib3", "httpx", "openai", "anthropic"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    return logging.getLogger("collector")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=os.path.join(ROOT, "config.yaml"))
    ap.add_argument("--since", help="YYYY-MM-DD (기본: 오늘 - lookback_days)")
    ap.add_argument("--sources", help="쉼표로 구분한 소스 이름 (주기 무시)")
    ap.add_argument("--force", action="store_true", help="소스 주기 무시하고 전부 수집")
    ap.add_argument("--provider", help="LLM 공급자 override: ollama | openrouter | claude")
    ap.add_argument("--no-llm", action="store_true")
    ap.add_argument("--no-briefing", action="store_true")
    ap.add_argument("--no-push", action="store_true")
    ap.add_argument("--reprocess", action="store_true", help="이미 처리한 항목도 다시 처리")
    ap.add_argument("--limit", type=int, default=0, help="처리할 신규 항목 상한(테스트)")
    args = ap.parse_args()

    with open(args.config, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    data_dir = os.path.join(ROOT, cfg.get("data_dir", "data"))
    report_dir = os.path.join(ROOT, cfg.get("report_dir", "reports"))
    log = setup_logging(os.path.join(data_dir, "logs"))

    since = date.fromisoformat(args.since) if args.since else date.today() - timedelta(days=int(cfg.get("lookback_days", 7)))
    today = date.today().isoformat()
    log.info("=== 수집 시작: since=%s ===", since)

    store = Store(data_dir)
    http = Http(os.path.join(data_dir, "cache"))
    ctx = SourceContext(http=http, store=store, since=since, keywords=cfg.get("keywords", {}), log=log)

    # 0) 대상 소스 결정 (주기)
    sched = cfg.get("schedule") or {}
    intervals: Dict[str, float] = sched.get("intervals") or {}
    default_iv = float(sched.get("default_interval_hours", 6))
    sources = build_sources(cfg)
    if args.sources:
        wanted = {s.strip() for s in args.sources.split(",")}
        sources = [s for s in sources if s.name in wanted or s.name.split(":")[0] in wanted]
    elif not args.force:
        skipped = [s.name for s in sources if not store.source_due(s.name, float(intervals.get(s.name, default_iv)))]
        sources = [s for s in sources if s.name not in skipped]
        if skipped:
            log.info("주기 미도래로 건너뜀: %s", ", ".join(skipped))
    if not sources:
        log.info("이번 시간에 수집할 소스 없음")
        return 0

    # 1) 수집
    collected: List[RawItem] = []
    stats: Dict[str, int] = {}
    errors: List[str] = []
    for src in sources:
        try:
            items = src.collect(ctx)
            stats[src.name] = len(items)
            collected.extend(items)
            store.mark_source_run(src.name, len(items))
        except Exception as e:  # 한 소스가 죽어도 나머지는 진행
            log.exception("소스 %s 수집 실패", src.name)
            errors.append(f"{src.name}: {e}")
            stats[src.name] = 0

    # 2) 신규 판정
    seen = set() if args.reprocess else store.seen_uids()
    uniq: Dict[str, RawItem] = {}
    for i in collected:
        if i.uid not in seen:
            uniq.setdefault(i.uid, i)
    new_items = sorted(uniq.values(), key=lambda i: i.published_at, reverse=True)
    if args.limit:
        new_items = new_items[: args.limit]
    log.info("수집 %d건, 신규 %d건", len(collected), len(new_items))

    # 3) LLM 사건 카드
    llm_cfg = dict(cfg.get("llm", {}))
    provider = None if args.no_llm else build_provider(llm_cfg, args.provider)
    enricher = Enricher(provider, llm_cfg)
    if provider:
        log.info("LLM 공급자: %s", provider.describe())
    kw = cfg.get("keywords", {})
    ignore_addrs = cfg.get("ignore_addresses") or []
    run_incidents: List[Incident] = []

    def process(item: RawItem) -> Incident:
        out, note = None, ""
        if item.needs_llm and enricher.enabled:
            out = enricher.enrich(item)
            if out is None:
                note = enricher.disabled_reason or "LLM 응답 없음(거부/오류) → 규칙 기반"
        elif item.needs_llm:
            note = enricher.disabled_reason or "LLM 비활성"
        return build_incident(item, out, enricher.model, kw, note=note, ignore_addresses=ignore_addrs)

    workers = max(1, int(llm_cfg.get("workers", 2))) if enricher.enabled else 4
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for item, inc in zip(new_items, ex.map(process, new_items)):
            store.mark_item(item, "enriched" if inc.enriched else "rule_based")
            store.save_incident(inc)
            run_incidents.append(inc)
            log.info("[%s] %s | relevant=%s enriched=%s addrs=%d", inc.source, inc.title[:60], inc.relevant,
                     inc.enriched, len(inc.addresses))

    # 4) 오늘 누적 사건 → 소스 간 같은 사건 병합 → 주소 재등장·블랙리스트 대조
    incidents = merge_incidents(store.incidents_collected_on(today) or run_incidents)
    log.info("리포트 대상: 카드 %d건 → 병합 후 %d건", len(store.incidents_collected_on(today) or run_incidents), len(incidents))
    crimial = CrimialHunter(cfg.get("crimial_hunter") or {}, ROOT)
    for inc in incidents:
        inc.blacklist_hits = crimial.hits(inc.addresses)
    address_hits: Dict[str, Dict] = {}
    for inc in incidents:
        hits = store.known_address_hits(inc.addresses)
        if hits:
            address_hits[inc.uid] = {}
            for a in inc.addresses:
                h = [x for x in hits.get(a.key(), []) if x.get("uid") != inc.uid]
                if inc.source.startswith("ofac"):
                    h = [x for x in h if x.get("source") != "ofac_sdn"]
                if h:
                    address_hits[inc.uid][a.address] = h

    # 5) 브리핑 (신규 관련 사건이 생겼을 때만 새로 씀)
    brief_dir = os.path.join(data_dir, "briefings")
    os.makedirs(brief_dir, exist_ok=True)
    brief_path = os.path.join(brief_dir, f"{today}.json")
    briefing = None
    if os.path.exists(brief_path):
        with open(brief_path, encoding="utf-8") as f:
            briefing = json.load(f)
    new_relevant = [i for i in run_incidents if i.relevant]
    if not args.no_briefing and (briefing is None or new_relevant or args.force):
        b = write_briefing(provider, today, incidents, max_tokens=int(llm_cfg.get("max_tokens", 8000)),
                           prompt_style=llm_cfg.get("prompt_style", "few_shot"))
        if b:
            briefing = b
            with open(brief_path, "w", encoding="utf-8") as f:
                json.dump(briefing, f, ensure_ascii=False, indent=1)

    # 6) 리포트/README/내보내기
    llm_note = ""
    if not enricher.enabled:
        llm_note = "LLM 비활성: " + (enricher.disabled_reason or "config 또는 --no-llm") + " — 배경/수법/요약 없이 정규식 추출만 반영"
    paths = []
    for lang in ("ko", "en"):
        md = build_markdown(today, incidents, stats, errors, address_hits=address_hits, llm_note=llm_note,
                            briefing=briefing, lang=lang)
        paths.append(write_report(report_dir, today, md, lang))
    update_readme_briefing(os.path.join(ROOT, "README.md"), today, briefing, incidents)
    store.export_jsonl()
    store.export_addresses_csv()
    store.export_sdn_csv()
    store.export_state()
    crimial.export(store)
    store.log_run(since.isoformat(), len(collected), len(new_items), sum(1 for i in run_incidents if i.enriched), errors)

    # 7) GitHub push
    gh = cfg.get("github") or {}
    # 신규 항목이 있을 때만 커밋 (생성 시각만 바뀐 리포트로 매시간 커밋이 쌓이는 것 방지)
    if gh.get("push") and not args.no_push and (new_items or args.force):
        msg = f"collect {datetime.now().strftime('%Y-%m-%d %H:%M')} (+{len(new_relevant)} incidents)"
        commit_and_push(ROOT, msg, gh.get("paths") or ["reports", "data", "README.md"], remote=gh.get("remote", "origin"))

    rel = sum(1 for i in incidents if i.relevant)
    log.info("=== 완료: 이번 실행 신규 %d건, 오늘 누적 %d건(관련 %d건) → %s ===", len(new_items), len(incidents), rel, paths[0])
    print(f"\n리포트: {paths[0]} / {paths[1]}\n이번 실행 신규 {len(new_items)}건 / 오늘 누적 {len(incidents)}건(관련 {rel}건) / 오류 {len(errors)}건")
    return 0


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    sys.exit(main())
