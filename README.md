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

### 홈페이지 — Incident Ledger (로컬 백엔드 + 정량 대시보드, `server.py` + `docs/`)
- 실행: `python server.py` → http://localhost:8765 (작업 스케줄러 `CryptoIncidentSite` 가 로그온 시 `pythonw server.py` 로 자동 시작; 등록은 `install_site_task.ps1`, LAN 공개는 `-Lan`). 로그는 `logs/server.log`.
- 백엔드는 Starlette + uvicorn(FastAPI 는 설치된 starlette 1.6 과 충돌). SQLite `data/collector.db` 를 직접 읽어 병합·후속·블랙리스트 대조까지 계산하고, incidents 테이블의 (건수, 최신 collected_at) 서명이 바뀌면 캐시를 다시 만듭니다. 수집기가 돌면 페이지가 자동으로 최신이 됩니다.
- API(JSON, 목록은 `/api`): `/api/meta`, `/api/incidents?days=30|all&type=&chain=&source=&q=&hide_followups=&page=&size=&sort=date|day|amount|name|type|chain|sources&dir=asc|desc`, `/api/incidents/{uid}`(+related), `/api/briefings`, `/api/briefings/{day|latest}`, `/api/stats?days=…&type=&chain=`, `/api/addresses/lookup?q=`, `/api/search?q=`.
- 집계 규칙: 후속 보도(`followup_of`)는 건수에만 포함하고 금액 합계·순위·비중에서는 제외합니다(같은 사건 이중 계산 방지).
- 페이지: `index.html` 개요(Incident Report 카드: 상위 3개 유형 주간 건수 영역 차트 → AnimatedCard 3장: 유형·체인·주소 역할 도넛(호버 시 상위 6 알약) → 검색+기간 → 사건 표 20행: 사건·금액·사건일·유형 배지·체인·출처 게이지) · `incidents.html` 사건 표(검색·기간·후속 제외·페이지; 유형·체인 필터와 정렬은 **표 머리글**에서 — 아래 '컬럼 헤더' 참고) · `stats.html` 통계(사건일 기준 고정; 시계열 금액/건수 → 유형·주소 역할·체인은 **순위 막대 목록**(라벨 | 건수·비중·금액 숫자 열 고정 폭 | 전체 대비 비중 막대; 역할 막대의 줄무늬 = 블랙리스트 일치, 오른쪽 `BL n`). 체인은 2건 이상만 막대로, 1건 체인은 오른쪽 칩 격자(아이콘·이름·금액)로 전부 보이고 unknown(오프체인 사건)은 마지막에 흐리게) · `briefings.html` 날짜별 브리핑 · `addresses.html` 지갑 주소(기간·역할·체인·종류별 수집 주소 목록, 온체인 종류 EOA/CA·토큰·풀 + 라벨 + 조회: 사건 카드·OFAC SDN·crimial_hunter 동시 대조; API `/api/addresses`) · `incident.html?id=` 사건 케이스(LUMOS 스타일 패널 — 목록에서 행을 누르면 오른쪽 슬라이드 패널 `?case=<uid>`, 단독 페이지도 동일: 큰 금액 → 사건일·보고일·유형·체인·수법·사건 코드 → 요약 → 경과 타임라인(발생·최초 보도·후속·블랙리스트·주소 검증) → 자금 흐름 표(주소·tx, 종류·역할·탐색기 링크) → 출처·관련 사건 → 자세히). 한/영, 다크(기본)/라이트.
- 프런트는 빌드 없는 바닐라 JS(`common.js`: API·i18n·SVG 차트). 유형 9색은 색약 시뮬레이션 검증을 통과한 팔레트이며 항상 점+라벨을 함께 표기합니다.
- `collector/site.py` 는 매 실행 `docs/data/*.json` 스냅샷을 남깁니다(GitHub 에서 데이터만 볼 때 용도). GitHub Pages 는 private+Free 플랜이라 쓰지 않습니다.

### 브리핑 형식 (`collector/briefing.py`, structured-v2)
- 제목·순서·불릿 골격·사건명·금액·날짜·체인은 **코드가 조립**하고, LLM 은 사건별 한 줄 설명(25~45자)과 시사점 한 문장만 씁니다(`prompts.briefing_lines_system_prompt`). 그래서 매일 같은 골격이고 숫자·날짜가 카드 값과 항상 일치합니다.
- 골격: `9월 18일 브리핑 · 신규 5건 · 피해 $7.8M · 제재·수사 $245M · 후속 2건` → `- **[사건명](url)** · 체인 · 유형 · **$금액** · 사건일 — 한 줄 설명 (BL n)` (금액 내림차순) → `- **소액·미상 N건** — 이름 $금액…` → `- **후속 N건** — 이름(첫 보도 M.D)…` → `- **시사점** — 한 문장`.
- 날짜는 사건일(법집행은 발표일) `M.D`. 과거 브리핑을 새 형식으로 다시 쓰려면 `python run.py --rebuild-day 2026-09-15 --rebrief --no-push`.

### 후속 보도와 중복
같은 사건을 다른 출처가 며칠 뒤 다시 보도하면(`followup_of`) 대시보드는 **원 사건 한 행**으로만 보여 줍니다. 후속 카드는 원 사건에 접혀(`followups[]`) 출처·주소·tx·블랙리스트가 합쳐지고, 목록에는 `후속 N` 배지, 케이스 패널의 경과 타임라인에 보도일·출처가 나옵니다. 금액은 대표 카드 하나가 아니라 **출처 합의**로 정합니다(`merge.consensus_amount`: ±5% 로 묶어 가장 많은 출처가 말한 값, 동수면 더 늦은 보도 = 정정치). 같은 날 여러 출처(Bitget 7건)도, 원 사건+후속(Flamincome 3건)도 같은 규칙입니다. 브리핑의 '당일 사건' 표는 그날 들어온 카드를 그대로(후속 태그 포함) 보여 줍니다.

### 대시보드 아이콘·로고
- 로고 `docs/logo.svg`(보라 육각 방패 + 원장 줄 3개 + 노란 균열), 파비콘 `favicon-32.png`·`favicon.ico`·`apple-touch-icon.png` 는 headless Chrome 으로 SVG 를 512px 렌더 후 PIL 로 축소.
- 유형 10종·역할 5종 아이콘은 `docs/icons.js` 의 **플랫 2톤 엠블럼**(24×24 직접 그림: 유형색 면 + 오른쪽 어두운 면(-30%) + 흰 포인트(번개·체크·눈·금지 바) + 플랫 금색 코인·강철). 그라데이션·글로우·하이라이트는 쓰지 않습니다. 사건 이름 앞 육각 타일은 색 테 1.5px + 어두운 안쪽(`.avatar`, `::before`). 체인 아이콘도 같은 파일의 `CHAIN_ICONS`(브랜드색 원 + 흰 마크, 35종 직접 그림; 없는 체인은 이름 첫 글자 모노그램, `unknown` 은 회색 ?) — 외부 로고 PNG 는 쓰지 않습니다. 표에서는 **아이콘만** 보이고 이름은 마우스를 올리면 즉시 툴팁(`data-tip`, 위임 핸들러)으로, 목록은 최대 4개 + `+N`(툴팁에 나머지 이름), 케이스 패널·상세 페이지는 **전부** 표시(헤더 아이콘 + 핵심 값의 이름 알약). 새 체인이 나오면 `CHAIN_ICONS` 에 `{c: 색, g: 마크}` 를 추가하고 `service.CHAIN_ALIAS` 에 별칭(예: XRP → XRP Ledger)을 넣습니다.
- **컬럼 헤더 컨트롤**(`common.js` thSort/thFilter/bindHead/openMenu): 사건·금액·사건일·출처·tx 수 머리글은 클릭하면 정렬(↕/↑/↓, 금액·날짜·건수는 내림차순부터), 유형·체인·종류·역할 머리글은 클릭하면 필터 메뉴(아이콘·건수, 8개 넘으면 검색창; 선택값은 머리글에 알약 + × 해제). 사건·개요·지갑 주소 표는 서버(`sort`·`dir` 파라미터), 브리핑 '당일 사건' 표는 클라이언트(`applyCtl`)에서 처리. 툴바의 유형·체인·정렬 select 는 이 머리글 컨트롤로 대체해 없앴습니다.
- 지갑 주소 표는 주소를 `앞 6자…뒤 4자` 로 축약(전체는 툴팁, 복사 버튼은 전체 복사)하고 열 폭을 고정해 가로 스크롤이 없습니다. 금액이 없는 사건은 한/영 모두 `unknown` 으로 표기(브리핑의 '소액·unknown N건' 도 같은 기준).
- 등급 칩(S ≥ $100M · A ≥ $10M · B ≥ $1M · C ≥ $100K · D), 상단 자원 카운터(사건·피해액·주소, 수집 시작 이후 누적) — `docs/hud.js`.

### 데이터 재검증·재레이블링 (`collector/relabel.py`, `python run.py --relabel`)
- 규칙 QA 로 의심 카드를 고릅니다: 사건일 없음/게시일 이후/수집일과 같음, 금액이 원문에 없음, 원문에 금액이 있는데 카드엔 없음, 온체인 유형인데 체인 없음, 이름이 제목 그대로, 유형 의심(법집행 단어).
- 걸린 카드는 원문을 다시 가져와(HTTP 캐시) 로컬 LLM 에 '현재 카드 + 원문' 을 주고 핵심 필드를 확정하게 합니다(`prompts.RELABEL_SYSTEM`, JSON 스키마). **모든 수정에는 원문 그대로의 근거 구절이 필요**하고, 하네스가 근거가 원문에 실제로 있는지·날짜가 게시일 이전인지·금액 숫자가 근거와 맞는지 검사해 통과한 수정만 적용합니다.
- 결과는 `data/relabel_log.jsonl` (before/after/근거/거부 이유). `--relabel-all` 은 규칙에 걸리지 않은 카드도 검증, `--relabel-only relevance_suspect` 처럼 특정 플래그만 재검증. 바뀐 날짜는 `--rebuild-day` 로 재생성.
- **매시간 자동 판정**: 수집 직후 새 카드에 대해 위 판정을 바로 실행합니다(카드당 ~5초). 이미 판정한 카드는 `--review` 에서 건너뛰고, `--review-force` 로 다시 판정할 수 있습니다.
- **교차 감사** `python run.py --audit`: 최근 30일 병합 사건 목록 전체를 한 번에 LLM 에 보여 카드 하나씩 볼 때는 안 보이는 문제를 찾습니다 — 이름이 다른 중복, 피해액이 아닌 금액(회수·요구·단속 총액), 유형·날짜 오류, 두루뭉술한 이름, 사건 아님. 확신도 0.85 이상만 자동 반영(중복은 `merge_decisions` 캐시에 넣어 다음 병합에서 합쳐짐)하고, 전체 결과는 `data/audits/YYYY-MM-DD.md` 로 남겨 사람이 봅니다.
- **지갑 주소 온체인 검증** `python run.py --addrcheck` (`collector/addrcheck.py`, 매시간 신규 카드에도 자동): 형식·체크섬(EIP-55, bech32, base58check) → EVM 은 11개 체인(Ethereum·BSC·Base·Arbitrum·HyperEVM·Polygon·Optimism·Avalanche·Cronos·Sonic·Linea)에 getCode/nonce/balance 를 조회해 실제 활동 체인과 EOA/CA 를 정하고, CA 는 eth_call 로 토큰·LP/V3/Balancer 풀·볼트·aToken/cToken·라우터·NFT·Safe 멀티시그·프록시(EIP-1967)를 판별합니다. BTC 는 mempool.space, Tron 은 trongrid, Solana 는 RPC. EIP-7702 위임 코드(0xef0100+주소)는 EOA 로 판정합니다. 탐색기 교차 검증: Blockscout(Ethereum·Base·Polygon·Arbitrum·Optimism — 검증된 컨트랙트 이름·구현체·토큰·scam 플래그·총 tx 수, 자기파괴 컨트랙트 감지)와 Sourcify(BSC·HyperEVM·Cronos 등 — 검증된 컨트랙트 이름). 결과는 `data/address_labels.json` 에 캐시되고 대시보드 주소 표의 **종류/라벨** 열에 표시됩니다. 카드 교정은 사실만: 체인 정정, 주소 자리에 들어간 tx 해시 → `tx_hashes` 이동(64자) 또는 제거(40자로 잘린 것), 어느 체인에도 흔적이 없는 '컨트랙트' 제거, 체크섬 표기 교정, 토큰·풀·라우터 컨트랙트에 붙은 attacker 역할 → unknown. 보고서 `data/audits/addresses-<날짜>.md`. OKLink 라벨은 `../vllm/oklink.txt`(또는 `OKLINK_API_KEY`)에 키를 두면 address-summary/entity-label 로 보강합니다(선택). `--addrcheck-force` 는 캐시 무시.
- 판정 하네스 규칙(LLM 보다 우선): 사건일이 게시일보다 1년 이상 이전이면 회고 기사, 가상자산이 수단·대상이 아니면 일반 범죄, 법집행·제재 카드인데 카드·원문 어디에도 가상자산 단어가 없으면 일반 범죄. DOJ 페이지는 HTML 재수집이 안 되므로(빈 본문) 원문 없는 카드에는 삭제성 판정을 적용하지 않습니다.
- **사건 여부 판정** `python run.py --review`: 모든 카드에 대해 로컬 LLM 이 '원장에 올릴 새 사건인가'를 같은 기준(`prompts.REVIEW_SYSTEM`: new_attack / new_enforcement / sanctions / laundering_report 는 올림, exchange_self_report / court_procedure / retrospective / general_crime_no_crypto / market_or_opinion 은 제외)으로 판정합니다. 제외는 확신도 0.8 이상일 때만 적용하고, 금액이 피해액이 아니면(차단 실적·거래량) amount_usd 를 비웁니다. 기록은 `data/review_log.jsonl`. `--review-all` 은 사람·규칙이 제외한 카드만 다시 판정해 잘못 제외됐으면 복구합니다.
- 하네스 안전장치: 원문이 없거나 사건을 다루지 않으면(JS 렌더링 목록 페이지 등) '관련 없음'·금액 삭제·유형 변경 같은 삭제성 판단은 받지 않고, $5B 이상이거나 '처리량·거래량' 성격의 금액은 피해액으로 받지 않습니다. 첫 실행(2026-09-18)에서 80장 중 25장 검증, 18장 수정(사건일 14, 금액 6, 체인 5), 하네스가 2건을 잘못 통과시켜 규칙을 보강했습니다.

### LLM 이 죽었을 때 (pending_llm)
- 매시간 실행에서 LLM 공급자가 실패하면(LAN Ollama 연결 불가 → OpenRouter 폴백 → 키 한도 403 등) LLM 이 필요한 항목은 **카드로 올리지 않습니다**. `relevant=False`, `enrich_note=pending_llm` 로 저장되고 `items.status='pending_llm'` 이라 다음 수집에서 신규로 다시 잡혀 재처리됩니다(`store.seen_uids` 가 pending 을 제외). `--no-llm` 처럼 애초에 LLM 을 쓰지 않는 실행만 규칙 기반 카드를 그대로 씁니다. 2026-09-29 09:48 실행이 이 경로를 타지 못해 제목 그대로의 '기타' 카드 12건이 올라간 사고가 계기입니다.
- LLM 이 유형을 `other` 로 돌려준 카드는 구체적 가상자산 범죄 사건이 아니라고 보고 제외합니다(일반 산업 뉴스·정책·제품 소식). 유형 9종(해킹·개인키·러그풀·피싱·사기·랜섬웨어·제재·수사·세탁)만 원장에 남습니다.
- 원장 범위는 **가상자산 자체가 대상·핵심 수단인 사건**입니다(2026-09-29 사용자 지시 "해킹사건만"). 신규 카드 판정(`relabel.run_review`)이 `crypto_is_core` 를 묻고, 법집행·제재인데 false 면(은행 횡령금의 코인 현금화, 코인 사업가를 도운 공직자 사건, 마약 대금 코인 결제) `crypto_incidental` 로 제외합니다. 같은 이름·같은 금액(±5%)·7일 이내 카드는 유형 계열이 달라도 한 사건으로 병합(DOJ 몰수 보도자료 ↔ 뉴스의 피싱 카드).

### 무엇을 '신규 사건'으로 세나
- 센다: 새 해킹·키 탈취·러그풀·피싱·사기·랜섬웨어 보도, 새 제재 지정, 새 기소·선고·압수·몰수, 자금세탁 분석 보고.
- 세지 않는다(relevant=false): 거래소 자체 보안 보고(차단·동결 실적, 보험기금), 기존 사건의 공판 일정·보석 뉴스, 1년 이상 지난 사건의 회고 기사, 가상자산이 언급되지 않는 일반 범죄 보도자료(PPP 대출 사기 등). 프롬프트(`CARD_NOT_INCIDENT`)와 재검증 규칙(`stale_reference`, `relevance_suspect`) 양쪽에 있습니다.
- 같은 대상에 대한 보도가 14일 안에 이어지면 후속 보도(followup_of)로 묶여 신규에서 빠집니다(예: Revolut 정보 유출 → 협박). 후속은 건수에만 '후속'으로 따로 보입니다.
- 금액이 $100K 미만인 소형 익스플로잇(DeFiHackLabs·SlowMist 카탈로그)도 신규로 세지만 브리핑에서는 "소액·미상" 한 줄로 묶입니다.

### 날짜 기준
- 대시보드 기본은 **사건일 기준**(`basis=event`: 공격은 incident_date, 제재·수사는 발표일). 첫 수집일에 과거 사건이 한꺼번에 들어와 "수집일 기준"으로는 09-15 에 몰려 보이는 문제를 피합니다. 상단 토글로 수집일 기준으로 바꿀 수 있습니다.

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

### 과거 사건 백필 (2020년 ~)
```
python run.py --backfill --sources defillama,defihacklabs --since 2020-01-01 --no-push
```
- 구조화 소스(DeFiLlama hacks API 2020~ 1,199건, DeFiHackLabs README + `past/<연도>/README.md` 845건 — PoC .sol 에서 체인·공격자/피해 주소·공격 tx 를 함께 뽑음)를 LLM 없이 카드로 저장합니다. 2026-09-29 실행 결과 병합 후 약 1,630건, 피해액 약 $21B, 주소 약 3,000개. 수집 시각을 **사건일**로 두어 '오늘 카드'에 섞이지 않고, 판정·주소 검증·브리핑·리포트·알림·푸시는 생략합니다. 이미 있는 항목(uid)은 건너뛰므로 다시 실행해도 안전합니다.
- 대시보드는 수집일(=사건일) 단위로 병합하고 후속 보도는 14일 창 안에서만 찾습니다(`service.FOLLOWUP_DAYS`). 통계 시계열은 기간이 60일을 넘으면 주별, 200일을 넘으면 월별로 묶습니다. 상단 카운터는 '전체 사건 수'입니다.
- 백필 카드의 요약은 소스 필드(분류·수법·손실)로만 채워지며 한국어 요약은 없습니다. 상위 사건에 LLM 요약을 붙이려면 `python run.py --relabel-all --limit N` 류의 재처리를 별도로 돌립니다.

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
