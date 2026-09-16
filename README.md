# 가상자산 해킹·범죄 지갑 동향 수집기 / Crypto Hack & Illicit Wallet Monitor

rekt.news, DeFiLlama, SlowMist, DeFiHackLabs, ZachXBT, ScamSniffer, TRM Labs, Chainalysis, OFAC, 미 법무부(DOJ),
Cointelegraph, 보안뉴스 등에서 가상자산 해킹·탈취·제재·기소 사건을 매시간 모아 LLM으로
**사건 배경 / 공격 수법 / 요약 / 자금 흐름 / 금액 / 지갑 주소(역할)** 를 한국어·영어 사건 카드로 만들고,
하루치 브리핑을 날짜별로 정리해 저장소에 남깁니다.

**📌 브리핑 보기: [briefings/README.md](briefings/README.md)** (날짜별 인덱스) · 상세 리포트: `reports/YYYY-MM/YYYY-MM-DD.ko.md` / `.en.md`


## 1. 소스 (2026-09-15 벤치마킹)

| 소스 | 접근 방식 | 제공 정보 | 지갑 주소 | 주기 |
|---|---|---|---|---|
| rekt.news | RSS 전부 500 → 홈 HTML 목록 + 글 본문 | 사건 서사, 금액, 수법, 공격자 주소·tx | ◎ | 1h |
| DeFiLlama Hacks | `api.llama.fi/hacks` JSON (1,269건) | 일자, 금액, 체인, 분류, 기법, 회수액 | ✕ | 1h |
| SlowMist Hacked | `hacked.slowmist.io` HTML (2,266건, 20/페이지) | 대상, 설명, 손실액, 수법, 참조 링크 (소액·CEX·지갑 포함) | ✕ | 2h |
| ZachXBT (Telegram) | `t.me/s/investigations` 공개 미리보기 | 조사 게시글 — 공격자/세탁 주소 다수 | ◎ | 2h |
| DeFiHackLabs | README 사고 목록 + PoC `.sol` 헤더 | 사고명·기법·손실, 공격자 EOA·공격 tx·피해 계약 | ◎ | 3h |
| ScamSniffer | `scam-database/blacklist/address.json` diff | 신규 피싱/드레이너 주소 (EVM) | ◎ | 12h |
| TRM Labs / Chainalysis | 블로그 RSS + 본문 | 제재·수사·자금세탁 분석 | △ | 12h |
| OFAC Recent Actions | `/recent-actions/YYYYMMDD` HTML + Treasury 보도자료 | 제재 지정 엔티티·프로그램·`Digital Currency Address` | ◎ 공식 | 6h |
| OFAC SDN XML | `SDN.XML`(≈29MB) 스냅샷 diff | 전체 제재 디지털자산 주소(≈1,050개) | ◎ 공식 | 24h |
| DOJ | `api/v1/press_releases.json` | 기소·체포·압수·몰수·선고 (crypto+crime 키워드 필터) | △ | 3h |
| Cointelegraph hacks/scams, 보안뉴스, 블록미디어, 토큰포스트, SEC 소송 | RSS (`extra_rss`) | 뉴스 보강 (키워드 필터) | ✕ | 6h |

제외: ChainLight Lumos(갱신 정체), Elliptic/CertiK/PeckShield/Immunefi(피드 없음 또는 정체), Chainabuse/Forta/de.fi(API 키 필요), X/Twitter(유료).
피드 URL만 있으면 `config.yaml > sources.extra_rss` 에 어떤 소스든 추가할 수 있습니다.

참고한 GitHub 프로젝트: [DeFiHackLabs](https://github.com/SunWeb3Sec/DeFiHackLabs), [DeFi-Hack-Chronicle](https://github.com/DeFiHackLabs/DeFi-Hack-Chronicle)(사고별 JSON + 주소 역할 스키마), [web3-hacks](https://github.com/jtzircuit/web3-hacks)(30분 cron → 커밋), [0xB10C OFAC 목록](https://github.com/0xB10C/ofac-sanctioned-digital-currency-addresses)(일별 cron → `lists` 브랜치), [scam-database](https://github.com/scamsniffer/scam-database).

## 2. 파이프라인

```
run.py  (매시간)
 ├─ schedule.intervals 로 이번 시간에 돌 소스만 선택
 ├─ 수집 → uid(소스|ID)로 신규 판정 (data/state.json 에 본 항목 보존)
 ├─ LLM 사건 카드 (한/영): prompts.py 의 zero-shot 규칙 + few-shot 예시 2개, JSON 스키마 강제
 │    공급자: Ollama(LAN, 기본) → 실패 시 OpenRouter → (선택) Claude
 │    모델이 낸 주소는 원문에 실재할 때만 채택 + 정규식(base58check 검증) 주소 병합
 ├─ 소스 간 같은 사건 병합 (merge.py): 주소/tx 공유 또는 정규화 이름 일치+사건일 ±3일 → 대표 카드 1장 (주소·출처 합침)
 ├─ crimial_hunter 대조 (crimial.py): master_all.csv 등 36만 주소와 대조 → "기존 블랙리스트 재등장" 표시
 ├─ 일일 브리핑 (한/영, 신규 사건이 생긴 실행에서만 갱신)
 ├─ reports/YYYY-MM/YYYY-MM-DD.ko|en.md, briefings/YYYY-MM/YYYY-MM-DD.md + briefings/README.md(날짜 인덱스), data/*.csv|jsonl|state.json
 ├─ crimial_hunter 표준 스키마 CSV 내보내기 → ../experience/scam-address-data/sources/news_collector.csv
 └─ github.push: true 면 git commit & push
```

### 홈페이지 (정적 대시보드, `docs/`)
- `docs/index.html` + `app.js` + `style.css` 가 `docs/data/*.json`(매 실행 `collector/site.py` 가 생성)을 읽어 그립니다. 빌드 도구 없음.
- 구성: KPI 타일(오늘/7일 사건, 7일 금액, 7일 주소, OFAC 주소) → 날짜별 브리핑(한/영 전환) → 필터(기간·유형·체인·소스·검색·후속 숨김) → 차트 3개(일별 신규, 유형별, 체인별 피해액; 표로 보기 제공) → 사건 표 → 행 클릭 시 상세 카드(배경·수법·요약·자금흐름·주소(탐색기 링크/복사)·출처·리포트 링크). 다크 모드 지원.
- 데이터: `incidents.json`(최근 90일 병합 사건), `archive/YYYY-MM.json`(월별 전체), `briefings.json`, `meta.json`.
- 호스팅: GitHub Pages(저장소 Settings > Pages > main `/docs`; Free 플랜은 공개 저장소만), Cloudflare Pages 등 정적 호스트 어디든. 로컬 확인은 `cd docs && python -m http.server 8765` 후 `http://localhost:8765`.

### 알림 — Teams / Telegram (`collector/notify.py`)
- 새로 병합된 사건마다 카드 1개(심각도 이모지, 체인·일자·금액, 두 문장 요약, 수법, 주소 최대 3개, 블랙리스트 재등장, 출처·리포트 링크)를 보내고, 그날 첫 브리핑이 생기면 브리핑 1개를 보냅니다. 수집 오류도 알립니다. 두 채널을 동시에 켤 수 있습니다.
- 중복 방지: 대표 카드와 병합된 카드의 uid 를 채널별로 `alerts_sent` 에 기록해, 다음 시간에 재병합되거나 다른 소스가 같은 사건을 다시 보도해도 다시 보내지 않습니다. 후속 보도는 "후속 (첫 보도 MM-DD)" 로 표시됩니다.
- **Teams** (권장, 관리자 승인 불필요): 채널 → `…` → **Workflows** → "웹훅 요청을 받으면 채널에 게시(Post to a channel when a webhook request is received)" → 만들어진 URL 을 `teams_webhook.txt`(git 제외) 또는 `TEAMS_WEBHOOK_URL` 에 → `python -m collector.notify --test --channel teams`. 메시지는 Adaptive Card 로 올라갑니다(제목, 체인/일자/금액/출처 표, 요약, 수법, 주소, 링크 버튼).
- **Telegram**: `@BotFather` 토큰 → `telegram_bot_token.txt` 또는 `TELEGRAM_BOT_TOKEN` → 봇에게 메시지/채널 관리자 추가 → `python -m collector.notify --setup` 으로 chat id → `config.yaml > telegram.chat_id` → `--test --channel telegram`.
- 옵션(채널별): `min_amount_usd`(소액 사건 생략, 제재·수사는 항상), `max_per_run`, `daily_briefing`, `alert_on_errors`. `--no-alert` 로 실행 시 생략.

### crimial_hunter(scam-address-data) 연동
- 대조: `config.yaml > crimial_hunter.lookup_files` (기본 master_all.csv + OFAC·법집행 소스)를 읽어, 새 사건 주소가 이미 블랙리스트에 있으면 리포트 주소 표 "이전 등장" 열과 카드의 "기존 블랙리스트 재등장" 줄, 브리핑 불릿에 표시.
- 내보내기: 공격자·세탁·제재 역할 주소를 `address, chain, category, source, label, detail, ref_date` 스키마로 `sources/news_collector.csv` 에 씀 (EVM 계열은 ETH, TRX→TRON; category는 exploit / rugpull / phishing_drainer / scam_scamming / laundering / sanctions / enforcement; source는 `news_<소스>`).
  ScamSniffer·OFAC SDN diff 주소는 그쪽에 이미 있는 소스라 제외. 마스터에 편입하려면 `scripts/build_master.py` 파일 목록에 `("news_collector.csv", None)` 추가.

사건 카드 필드: `project, incident_type, incident_date, chains, amount_usd, amount_text, background_ko/en,
attack_method_ko/en, summary_ko/en, fund_flow_ko/en, actors, addresses[{chain, address, role, note}], tx_hashes, url, source`
역할(role): attacker / laundering / victim / sanctioned / unknown.

```
run.py                     진입점 (run_daily.py 는 호환용)
config.yaml                주기·LLM·소스·키워드(체인 150여 개 포함)·GitHub
collector/
  sources/                 소스 어댑터 12종 (rekt, defillama, slowmist, zachxbt, defihacklabs, scamsniffer, ofac, doj, chainalysis_trm(+generic RSS) …)
  prompts.py               사건 카드·브리핑 프롬프트 (few_shot | zero_shot)
  llm.py                   Ollama / OpenAI 호환(OpenRouter, vLLM) / Claude 공급자
  enrich.py, briefing.py   카드 생성·병합, 일일 브리핑
  merge.py, dedupe.py      소스 간 사건 병합(규칙 + LLM 판정), 후속 보도 표시
  crimial.py, site.py, notify.py   crimial_hunter 연동, 대시보드 데이터, Teams/Telegram 알림
  addresses.py, keywords.py  주소·tx 정규식+체크섬, 단어경계 키워드
  store.py, report.py, publish.py
data/  state.json(본 항목·SDN·스냅샷)  incidents.jsonl  addresses.csv  ofac_sdn_addresses.csv  briefings/  (collector.db·cache·logs 는 git 제외)
reports/YYYY-MM/YYYY-MM-DD.ko.md, .en.md   상세 리포트
briefings/YYYY-MM/YYYY-MM-DD.md, briefings/README.md   날짜별 브리핑 + 인덱스
.github/workflows/collect.yml   GitHub Actions 매시간 실행(OpenRouter)
tests/test_pipeline.py
```

## 3. 실행

```bat
pip install -r requirements.txt
python run.py --force              :: 첫 실행: 모든 소스 즉시 수집 (lookback_days 만큼 과거)
python run.py                      :: 이후: 주기가 된 소스만
python run.py --provider openrouter --reprocess --limit 3   :: 공급자 바꿔 테스트
python run.py --no-llm             :: 규칙 기반만
python -m pytest -q tests          :: 단위 테스트
```

LLM 설정(`config.yaml > llm`): 기본 `ollama` (`http://192.168.150.225:11434`, `gpt-oss:120b`, num_ctx 32K), 실패 시 `openrouter`
(`OPENROUTER_API_KEY` 또는 `../vllm/openrouter.txt`). `prompt_style: few_shot | zero_shot`.
비교(Tectonic 기사 1건): gpt-oss:120b 81s — 주소 역할 구분·자금흐름 정확 / qwen3-30b 37s — 역할 뭉뚱그림 / gemini-3.8-flash ~10s.

### 매시간 자동 실행 (이 PC)
```powershell
powershell -ExecutionPolicy Bypass -File install_task.ps1 -EveryHours 1
```

### GitHub 로 받기
1. 저장소 만들기 → `git init && git remote add origin <url>` (이 폴더에서)
2. 로컬 실행 결과를 올리려면 `config.yaml > github.push: true` (매 실행 후 commit & push)
3. 또는 GitHub Actions 만으로 돌리려면 저장소 Secrets 에 `OPENROUTER_API_KEY` 등록 → `.github/workflows/collect.yml` 이 매시간 실행·커밋 (로컬 PC 불필요, 단 LAN Ollama 는 사용 불가)

`briefings/README.md`(날짜 인덱스)와 `briefings/YYYY-MM/`, `reports/YYYY-MM/`이 매일 갱신됩니다.

## 4. 운영 메모
- 처음 실행은 `lookback_days`(7일) 과거를 훑고 이후에는 본 항목을 건너뜁니다. OFAC SDN·ScamSniffer 는 첫 실행에서 기준선만 만들고 다음부터 신규만 보고합니다.
- 같은 사건을 여러 소스가 다루면 리포트에서 서로 링크되고, 이전 사건·SDN에 있던 주소가 다시 나오면 "이전 등장" 열에 표시됩니다.
- 모델이 반환한 주소는 원문에 없으면 버립니다(환각 방지). rekt 후원 주소 등은 `ignore_addresses`.
- 키워드는 단어 경계 매칭(`ether`가 `whether`에 안 걸림), 한국어는 `*` 접두 매칭. YAML에서 `0x…` 주소는 반드시 따옴표.
