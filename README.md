# 가상자산 해킹·범죄 지갑 동향 수집기 / Crypto Hack & Illicit Wallet Monitor

rekt.news, DeFiLlama, SlowMist, DeFiHackLabs, ZachXBT, ScamSniffer, TRM Labs, Chainalysis, OFAC, 미 법무부(DOJ),
Cointelegraph, 보안뉴스 등에서 가상자산 해킹·탈취·제재·기소 사건을 매시간 모아 LLM으로
**사건 배경 / 공격 수법 / 요약 / 자금 흐름 / 금액 / 지갑 주소(역할)** 를 한국어·영어 사건 카드로 만들고,
하루치 브리핑을 써서 `README.md`(아래 블록)와 `reports/`에 남깁니다. GitHub에 push 하면 그대로 매일 브리핑이 됩니다.

<!-- BRIEFING:START -->
## 📌 최신 브리핑 / Latest Briefing — 2026-09-15

**Liquid Network에서 $320M 탈취, OFAC의 자금세탁 마켓플레이스 제재 등 오늘 신규 26건**

- **[Liquid Network](https://www.chainalysis.com/blog/320m-exploit-liquid-network/)**(Liquid, Bitcoin, 9월 6일) — 공격자가 기밀 트랜잭션 검증 캐시의 결함을 악용해 검증을 우회하고 담보 없이 L-BTC를 발행해 실제 BTC를 인출했습니다. 예치금 중 약 4,000 BTC($320M)가 무단 인출되었으나, 공격자가 자칭 화이트햇이라 밝히며 3,400 BTC를 반환했습니다. 현재 남은 600 BTC(약 $47M)에 대해 반환 협의가 진행 중입니다.
- **[Tectonic](https://rekt.news/tectonic-rekt)**(Cronos, 8월 30일) — 공격자가 98회에 걸친 순환 대출로 유동성이 낮은 TONIC 가격을 끌어올려 담보 가치를 195배 부풀린 뒤 대출 풀에서 자산을 가로챘습니다. Cronos 검증인들이 블록체인을 중단하고 10,961개 블록을 롤백(블록체인을 이전 상태로 되돌림)해 $111.2M를 복구했으나, $9.19M는 이미 이더리움으로 브리지되어 토네이도 캐시(자금 추적을 어렵게 하는 믹서)로 유입됐습니다. 기존 블랙리스트 주소 5개 재등장.
- **[Nomic nBTC Bridge](https://x.com/osmosis/status/2097623097696251926)**(Osmosis, Nomic, 9월 9일) — Nomic의 커스텀 포워딩 메커니즘 버그로 nBTC가 이중지불되며 담보 없는 바우처가 Osmosis로 전송됐습니다. 이 공격으로 약 $3.15M의 손실이 발생했습니다. Osmosis 팀은 공격자 지갑에 있던 22.65 BTC를 온체인에서 긴급 동결하고 거버넌스 투표를 통해 몰수 및 커뮤니티 풀 보전을 추진하고 있습니다.
- **[Xinbi Guarantee](https://www.chainalysis.com/blog/ofac-sanctions-xinbi-cybercriminal-crypto-marketplace/)**(Tron, Ethereum, BSC, 9월 9일) — 미 재무부 해외자산통제국(OFAC)이 텔레그램 기반 보증 마켓플레이스 Xinbi Guarantee와 연계 기술사들을 제재 목록에 올렸습니다. 북한 해커 조직과 사이버 범죄자들의 해킹 자금 세탁 창구로 쓰인 혐의이며, 트론·이더리움·BSC 체인 전반의 주소 186개가 등재됐습니다. 미 당국은 플랫폼 관련 지갑에서 $52M 이상의 가상자산을 압수하거나 동결했습니다. 기존 블랙리스트 주소 133개 재등장.
- **[Malone Lam](https://www.justice.gov/usao-dc/pr/singaporean-ringleader-245-million-cryptocurrency-racketeering-enterprise-pleads-guilty)**(9월 9일) — 22세 싱가포르인 Malone Lam이 $245M 이상의 가상자산을 탈취하고 세탁한 조직범죄 공모 혐의에 대해 유죄를 인정했습니다. 소셜 엔지니어링(사기 유도 기법)과 피해자 주거지 무단 침입을 병행해 지갑 속 자산을 강탈했습니다. 탈취 자금은 슈퍼카 구매와 호화 생활에 쓰였으며 현재 선고 심리가 예정되어 있습니다.
- **[Revolut](https://t.me/investigations/363)**(Bitcoin, 9월 11일) — Revolut가 가짜 정부 기관의 정보 요청을 걸러내지 못해 고액 자산가 이용자들의 개인정보가 유출됐습니다. 신분증 사본과 계좌 내역, 비트코인 거래 내역이 외부로 노출됐습니다. 피해를 입은 이용자들에게는 경고 안내가 발송됐습니다.
- **소액 사건** — BeatXswap(BSC, $77.5K, V3 풀 현물 가격 조작), ORB(BSC, $32.6K, 재진입 소각 루프), Spiral(Ethereum, $26.8K, Uniswap V4 현물가 조작 및 tx.origin 우회), WealthManagementV2(BSC, $26.4K, 유출된 오너 키로 이자 승수 조작), OrderFactory(Ethereum, 약 24.7 ETH), EtherFiAtomicQueue(Ethereum, 약 15.45 ETH), OMNI404(Ethereum, $5.9K).
- **시사점** — 단일 유동성 풀의 현물가를 담보 평가나 베스팅 계산에 그대로 사용한 프로토콜들이 연이어 가격 조작 공격을 받았습니다. 아울러 해킹 자금을 세탁해 주던 텔레그램 기반 장외 인프라에 대한 사법 당국의 전방위 제재가 본격화되고 있습니다.

**Liquid Network loses $320M to an exploit; OFAC sanctions cybercrime marketplace Xinbi. 26 new incidents today**

- **[Liquid Network](https://www.chainalysis.com/blog/320m-exploit-liquid-network/)** (Liquid, Bitcoin, Sep 6) — An attacker exploited a flaw in confidential transaction verification caching to bypass checks and mint unbacked L-BTC, withdrawing real BTC via peg-out. Roughly 4,000 BTC ($320M) was drained, though the self-proclaimed white-hat attacker returned 3,400 BTC. Negotiations are ongoing for the remaining 600 BTC (about $47M).
- **[Tectonic](https://rekt.news/tectonic-rekt)** (Cronos, Aug 30) — The attacker used 98 looping borrow cycles to pump the thinly traded TONIC price, inflating collateral value by 195 times to borrow $120.4M across nine lending pools. Cronos validators halted the chain and rolled back 10,961 blocks to recover $111.2M, but $9.19M had already bridged to Ethereum and entered Tornado Cash (a mixer that obscures fund trails). 5 addresses already on our blacklist.
- **[Nomic nBTC Bridge](https://x.com/osmosis/status/2097623097696251926)** (Osmosis, Nomic, Sep 9) — A bug in Nomic's custom forwarding mechanism allowed double-spending of nBTC, sending unbacked vouchers to Osmosis. The exploit caused roughly $3.15M in losses. Osmosis validators froze 22.65 BTC in the attacker's wallet and are holding a governance vote to confiscate the funds and reimburse users via the community pool.
- **[Xinbi Guarantee](https://www.chainalysis.com/blog/ofac-sanctions-xinbi-cybercriminal-crypto-marketplace/)** (Tron, Ethereum, BSC, Sep 9) — The U.S. OFAC sanctioned Telegram-based escrow marketplace Xinbi Guarantee and affiliated tech firms for laundering funds for cybercriminals and DPRK-linked groups. A total of 186 addresses across Tron, Ethereum, and BSC were designated. U.S. authorities seized or froze over $52M in crypto linked to the platform. 133 addresses already on our blacklist.
- **[Malone Lam](https://www.justice.gov/usao-dc/pr/singaporean-ringleader-245-million-cryptocurrency-racketeering-enterprise-pleads-guilty)** (Sep 9) — Malone Lam, a 22-year-old Singaporean national, pleaded guilty to racketeering conspiracy involving the theft and laundering of over $245M in cryptocurrency. The group targeted wealthy holders using social engineering combined with home invasions to seize wallet access. Stolen funds were spent on supercars and luxury living, and Lam is currently awaiting sentencing.
- **[Revolut](https://t.me/investigations/363)** (Bitcoin, Sep 11) — Revolut failed to identify fraudulent government requests, leading to the leak of personally identifiable information (PII) of high-net-worth users. The exposed data included ID copies, bank statements, and full transaction histories including Bitcoin. Impacted customers have received warning notifications.
- **Smaller incidents** — BeatXswap (BSC, $77.5K, V3 spot-price manipulation), ORB (BSC, $32.6K, reentrancy burn loop), Spiral (Ethereum, $26.8K, Uniswap V4 spot-price manipulation and tx.origin bypass), WealthManagementV2 (BSC, $26.4K, leaked owner key used to manipulate interest multipliers), OrderFactory (Ethereum, ~24.7 ETH), EtherFiAtomicQueue (Ethereum, ~15.45 ETH), OMNI404 (Ethereum, $5.9K).
- **Takeaway** — Protocols relying directly on single-pool spot prices for collateral valuation or vesting operations were repeatedly exploited by flash-loan manipulation. Meanwhile, law enforcement is aggressively sanctioning Telegram-based OTC infrastructure used to launder cybercrime proceeds.

### 사건 목록 / Incidents

| # | 사건 | 유형 | 사건일 | 체인 | 피해/관련 금액 | 주소 수 | 출처 |
|---:|---|---|---|---|---|---:|---|
| 1 | [Spiral](https://x.com/SlowMist_Team/status/2099410818244968850) | 해킹/익스플로잇 | 2026-09-14 | Ethereum | $26.8K | 0 | SlowMist Hacked |
| 2 | [YamFinance](https://github.com/SunWeb3Sec/DeFiHackLabs/blob/main/src/test/2026-09/YamFinance_exp.sol) | 해킹/익스플로잇 | 2026-09-12 | Ethereum | $121.0K (~$121K (48.085 WETH + 763.101 UMA)) | 7 | DeFiHackLabs |
| 3 | [Chainflip](https://x.com/Chainflip/status/2099080597281145040) | 해킹/익스플로잇 | 2026-09-12 | Tron | $736.4K | 0 | SlowMist Hacked +1 |
| 4 | [ORB](https://github.com/SunWeb3Sec/DeFiHackLabs/blob/main/src/test/2026-09/ORB_exp.sol) | 해킹/익스플로잇 | 2026-09-11 | BSC | $32.6K (~44.9-45 BNB (~$32,610.72)) | 47 | DeFiHackLabs +2 |
| 5 | [Symbiosis](https://x.com/symbiosis_fi/status/2098384161673285716) | 해킹/익스플로잇 | 2026-09-11 | Ethereum, BSC, Rootstock, Bitcoin | $775.0K | 0 | SlowMist Hacked +3 |
| 6 | [Dominion](https://x.com/Dominion_Market/status/2098327452497924553) | 개인키 탈취 | 2026-09-11 | Solana | $238.0K | 0 | SlowMist Hacked +1 |
| 7 | [Revolut](https://t.me/investigations/363) | 피싱/소셜엔지니어링 | 2026-09-11 | Bitcoin | - | 0 | ZachXBT (Telegram) |
| 8 | [ORBToken](https://x.com/SlowMist_Team/status/2098662550019694645) | 해킹/익스플로잇 | 2026-09-11 | - | $32.6K | 0 | SlowMist Hacked |
| 9 | [Xinbi Guarantee](https://www.chainalysis.com/blog/ofac-sanctions-xinbi-cybercriminal-crypto-marketplace/) | 제재 지정 | 2026-09-09 | Tron, Ethereum, BSC | $52.00M (more than $52 million) | 186 | Chainalysis +4 |
| 10 | [BeatXswap](https://github.com/SunWeb3Sec/DeFiHackLabs/blob/main/src/test/2026-09/BeatXswap_exp.sol) | 해킹/익스플로잇 | 2026-09-09 | BSC | $77.5K (~$63.7K USDT net profit (2,984,557 BTX / ~$77.5K drained from two vesting reserves)) | 15 | DeFiHackLabs +2 |
| 11 | [OMNI404](https://github.com/SunWeb3Sec/DeFiHackLabs/blob/main/src/test/2026-09/OMNI404_exp.sol) | 해킹/익스플로잇 | 2026-09-09 | Ethereum | $5.9K (2.427 WETH (run() leg reproduced here; ~3.02 ETH across the full 4-tx block)) | 7 | DeFiHackLabs +1 |
| 12 | [EnsoFinance](https://github.com/SunWeb3Sec/DeFiHackLabs/blob/main/src/test/2026-09/EnsoFinance_exp.sol) | 해킹/익스플로잇 | 2026-09-09 | Ethereum | ~5.6 ETH (5.277 ETH realized in this PoC after slippage selling looted UNI/AAVE/MKR back to WETH) | 6 | DeFiHackLabs |
| 13 | [EtherFiAtomicQueue](https://github.com/SunWeb3Sec/DeFiHackLabs/blob/main/src/test/2026-09/EtherFiAtomicQueue_exp.sol) | 해킹/익스플로잇 | 2026-09-09 | Ethereum | ~15.45 ETH (9 real victims' standing liquidETH allowances drained) | 6 | DeFiHackLabs |
| 14 | [Nomic nBTC Bridge](https://x.com/osmosis/status/2097623097696251926) | 해킹/익스플로잇 | 2026-09-09 | Osmosis, Nomic | $3.15M | 0 | SlowMist Hacked +1 |
| 15 | [Zentra Finance](https://x.com/ZentraFinance/status/2098415552293195831) | 해킹/익스플로잇 | 2026-09-09 | Citrea | $140.0K | 0 | SlowMist Hacked +1 |

전체 리포트 / Full reports: [KO](reports/ko/2026-09-15.md) · [EN](reports/en/2026-09-15.md) · [주소 CSV](data/addresses.csv) · [OFAC SDN CSV](data/ofac_sdn_addresses.csv)

<!-- BRIEFING:END -->

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
 ├─ reports/ko|en/YYYY-MM-DD.md, README 브리핑 블록, data/*.csv|jsonl|state.json
 ├─ crimial_hunter 표준 스키마 CSV 내보내기 → ../experience/scam-address-data/sources/news_collector.csv
 └─ github.push: true 면 git commit & push
```

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
  merge.py, crimial.py     소스 간 사건 병합, crimial_hunter 대조·내보내기
  addresses.py, keywords.py  주소·tx 정규식+체크섬, 단어경계 키워드
  store.py, report.py, publish.py
data/  state.json(본 항목·SDN·스냅샷)  incidents.jsonl  addresses.csv  ofac_sdn_addresses.csv  briefings/  (collector.db·cache·logs 는 git 제외)
reports/ko|en/YYYY-MM-DD.md, latest_ko.md, latest_en.md
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

README 상단 브리핑 블록과 `reports/`가 매일 갱신되므로 저장소 첫 화면이 곧 일일 브리핑입니다.

## 4. 운영 메모
- 처음 실행은 `lookback_days`(7일) 과거를 훑고 이후에는 본 항목을 건너뜁니다. OFAC SDN·ScamSniffer 는 첫 실행에서 기준선만 만들고 다음부터 신규만 보고합니다.
- 같은 사건을 여러 소스가 다루면 리포트에서 서로 링크되고, 이전 사건·SDN에 있던 주소가 다시 나오면 "이전 등장" 열에 표시됩니다.
- 모델이 반환한 주소는 원문에 없으면 버립니다(환각 방지). rekt 후원 주소 등은 `ignore_addresses`.
- 키워드는 단어 경계 매칭(`ether`가 `whether`에 안 걸림), 한국어는 `*` 접두 매칭. YAML에서 `0x…` 주소는 반드시 따옴표.
