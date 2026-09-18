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
from collector.dedupe import LLMJudge
from collector.merge import mark_followups, merge_incidents
from collector.models import Incident, RawItem
from collector.notify import build_notifiers
from collector.publish import commit_and_push
from collector.site import export_site
from collector.report import (build_briefing_page, build_markdown, write_briefing_index, write_briefing_page,
                              write_report)
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
    ap.add_argument("--no-alert", action="store_true", help="Telegram 알림 생략")
    ap.add_argument("--rebrief", action="store_true", help="브리핑을 다시 생성 (--rebuild-day 와 함께 과거 날짜도 가능)")
    ap.add_argument("--rebuild-day", help="YYYY-MM-DD: 수집 없이 그날의 병합/리포트/브리핑 페이지만 다시 생성")
    ap.add_argument("--relabel", action="store_true", help="기존 카드 재검증: 규칙 QA 로 걸린 카드를 원문과 함께 LLM 에 재확인해 고친다")
    ap.add_argument("--relabel-all", action="store_true", help="--relabel 을 규칙에 걸리지 않은 카드에도 적용")
    ap.add_argument("--relabel-only", help="쉼표로 구분한 QA 플래그: 이 플래그에 걸린 카드만 재검증 (예: relevance_suspect)")
    ap.add_argument("--review", action="store_true", help="모든 카드에 대해 로컬 LLM 으로 '새 사건인가' 판정(확신도 0.8 이상 제외만 적용)")
    ap.add_argument("--review-all", action="store_true", help="--review 를 이미 제외된 카드에도 적용(복구 가능)")
    args = ap.parse_args()

    with open(args.config, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    data_dir = os.path.join(ROOT, cfg.get("data_dir", "data"))
    report_dir = os.path.join(ROOT, cfg.get("report_dir", "reports"))
    log = setup_logging(os.path.join(data_dir, "logs"))

    since = date.fromisoformat(args.since) if args.since else date.today() - timedelta(days=int(cfg.get("lookback_days", 7)))
    today = args.rebuild_day or date.today().isoformat()
    today_date = date.fromisoformat(today)
    log.info("=== %s: since=%s ===", "리포트 재생성 " + today if args.rebuild_day else "수집 시작", since)

    store = Store(data_dir)
    http = Http(os.path.join(data_dir, "cache"))

    if args.review or args.review_all:
        from collector.relabel import run_review
        llm_cfg0 = dict(cfg.get("llm", {}))
        prov = build_provider(llm_cfg0, args.provider)
        log.info("=== 사건 여부 판정 시작 (LLM: %s) ===", prov.describe())
        summ = run_review(store, http, prov, data_dir, limit=args.limit, include_irrelevant=args.review_all, max_tokens=int(llm_cfg0.get("max_tokens", 8000)))
        log.info("판정 결과: %s", json.dumps(summ, ensure_ascii=False))
        store.export_jsonl(); store.export_state()
        print(json.dumps(summ, ensure_ascii=False))
        return 0

    if args.relabel or args.relabel_all or args.relabel_only:
        from collector.relabel import run_relabel
        llm_cfg0 = dict(cfg.get("llm", {}))
        prov = None if args.no_llm else build_provider(llm_cfg0, args.provider)
        log.info("=== 재검증 시작 (LLM: %s) ===", prov.describe() if prov else "없음 — 규칙 QA 만")
        summ = run_relabel(store, http, prov, data_dir, only_flagged=not args.relabel_all, limit=args.limit,
                           max_tokens=min(4000, int(llm_cfg0.get("max_tokens", 8000))),
                           only_flags={f.strip() for f in args.relabel_only.split(",") if f.strip()} if args.relabel_only else None)
        log.info("재검증 결과: %s", json.dumps(summ, ensure_ascii=False))
        store.export_jsonl(); store.export_state()
        if summ["days"]:
            log.info("바뀐 카드가 있는 날짜: %s → 각각 `python run.py --rebuild-day <날짜> --rebrief --no-push` 로 재생성", ", ".join(summ["days"]))
        print(json.dumps(summ, ensure_ascii=False))
        return 0
    ctx = SourceContext(http=http, store=store, since=since, keywords=cfg.get("keywords", {}), log=log)

    # 0) 대상 소스 결정 (주기)
    sched = cfg.get("schedule") or {}
    intervals: Dict[str, float] = sched.get("intervals") or {}
    default_iv = float(sched.get("default_interval_hours", 6))
    sources = build_sources(cfg)
    if args.rebuild_day:
        sources = []
    elif args.sources:
        wanted = {s.strip() for s in args.sources.split(",")}
        sources = [s for s in sources if s.name in wanted or s.name.split(":")[0] in wanted]
    elif not args.force:
        skipped = [s.name for s in sources if not store.source_due(s.name, float(intervals.get(s.name, default_iv)))]
        sources = [s for s in sources if s.name not in skipped]
        if skipped:
            log.info("주기 미도래로 건너뜀: %s", ", ".join(skipped))
    if not sources and not args.rebuild_day:
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

    # 4) 오늘 누적 사건 → 소스 간 같은 사건 병합(규칙 + LLM 판정) → 이전 14일 사건의 후속 보도 표시 → 주소 대조
    # 같은-사건 판정은 가벼운 모델로 (config.llm.<provider>.dedupe_model), 없으면 본 모델
    dedupe_model = (llm_cfg.get(args.provider or llm_cfg.get("provider") or "ollama") or {}).get("dedupe_model")
    judge_provider = build_provider(llm_cfg, args.provider, model_override=dedupe_model) if (provider and dedupe_model) else provider
    judge = LLMJudge(judge_provider, store, max_calls=int(llm_cfg.get("dedupe_max_calls", 20)))
    todays_cards = store.incidents_collected_on(today) or run_incidents
    incidents = merge_incidents(todays_cards, judge)
    hist_start = (today_date - timedelta(days=int(cfg.get("followup_days", 14)))).isoformat()
    hist_end = (today_date - timedelta(days=1)).isoformat()
    history = merge_incidents(store.incidents_collected_between(hist_start, hist_end))
    n_follow = mark_followups(incidents, [h for h in history if h.relevant], judge)
    log.info("리포트 대상: 카드 %d건 → 병합 후 %d건 (후속 보도 %d, LLM 판정 호출 %d)", len(todays_cards), len(incidents), n_follow, judge.calls)
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
    if not args.no_briefing and (args.rebrief or (not args.rebuild_day and (briefing is None or new_relevant or args.force))):
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
    # 날짜별 브리핑 페이지 + 인덱스 (briefings/YYYY-MM/YYYY-MM-DD.md, briefings/README.md)
    briefing_dir = os.path.join(ROOT, cfg.get("briefing_dir", "briefings"))
    write_briefing_page(briefing_dir, today, build_briefing_page(today, briefing, incidents))
    entries = []
    for fn in sorted(os.listdir(brief_dir)):
        if not fn.endswith(".json"):
            continue
        d = fn[:-5]
        with open(os.path.join(brief_dir, fn), encoding="utf-8") as f:
            b = json.load(f)
        day_inc = merge_incidents(store.incidents_collected_on(d)) if d != today else incidents
        entries.append({"day": d, "headline_ko": b.get("headline_ko", ""), "headline_en": b.get("headline_en", ""),
                        "total": len(day_inc), "relevant": sum(1 for i in day_inc if i.relevant)})
    write_briefing_index(briefing_dir, entries)
    site_dir = os.path.join(ROOT, cfg.get("site_dir", "docs"))
    try:
        meta = export_site(store, site_dir, recent_days=int(cfg.get("site_recent_days", 90)), judge=judge, crimial=crimial)
        log.info("사이트 데이터 내보내기: 사건 %d건, %d일 → %s/data", meta["incidents_total"], meta["days"], site_dir)
    except Exception:
        log.exception("사이트 데이터 내보내기 실패")
    store.export_jsonl()
    store.export_addresses_csv()
    store.export_sdn_csv()
    store.export_state()
    crimial.export(store)
    store.log_run(since.isoformat(), len(collected), len(new_items), sum(1 for i in run_incidents if i.enriched), errors)

    # 7) 알림 (Teams / Telegram): 사건별 1회 + 그날 첫 브리핑 1회 + 수집 오류
    if not args.no_alert and not args.rebuild_day:
        for notifier in build_notifiers(cfg, ROOT):
            notifier.alert_incidents(store, incidents, today)
            notifier.alert_briefing(store, today, briefing, incidents)
            notifier.alert_errors(errors)
        store.export_state()

    # 8) GitHub push
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
