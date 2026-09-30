# 다른 서버에 올리기

이 저장소만 clone 하면 수집기·API·대시보드가 그대로 돈다. 서버마다 다른 값(LLM 주소, 키, 경로)은 **`.env` 하나**로만 바꾼다.
`config.yaml` 은 그대로 두는 것을 권한다 — 안의 `${VAR:-기본값}` 자리가 `.env`/환경변수로 채워진다.

---

## 1. 필요한 것

| 항목 | 버전 | 필요한 이유 | 없으면 |
|---|---|---|---|
| Python | 3.10 이상 | 수집기·API 서버 | 필수 |
| Node.js | 20 이상 | React 대시보드 **빌드**할 때만 | 빌드된 `site/` 가 저장소에 있으므로 안 써도 됨 |
| Ollama 등 LLM | — | 사건 요약·브리핑·중복 판정 | 수집은 되지만 요약 없이 보류(`pending_llm`)됨 |
| git | — | 결과 자동 커밋(선택) | `github.push: false` 로 두면 불필요 |

디스크는 데이터 포함 약 300MB, 메모리는 1GB면 충분하다(LLM 은 별도 서버 권장).

```bash
git clone https://github.com/lala-david/crypto_test.git news && cd news
python -m venv .venv && . .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                               # 값 채우기(아래 2번)
python -m pytest -q                                # 44개 통과하면 정상
```

## 2. `.env` — 채워야 하는 값

**LLM 하나는 반드시 필요하다.** 없으면 카드가 요약 없이 보류되고 브리핑이 폴백 문장으로 나온다.

```dotenv
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434     # LLM 서버 주소(같은 머신이면 이 값)
OLLAMA_MODEL=gpt-oss:120b                  # ollama pull 로 미리 받아둘 것
```

- 작은 서버라면 `OLLAMA_MODEL=gpt-oss:20b` 또는 `qwen3:8b` 로 시작해도 된다(요약 품질은 떨어짐).
- OpenRouter 를 쓰려면 `LLM_PROVIDER=openrouter` + `OPENROUTER_API_KEY=sk-or-...`.
- Ollama 가 죽으면 `fallback_provider`(기본 openrouter)로 넘어간다. 폴백 키가 없으면 그 시간 항목은 다음 실행에서 자동 재처리된다.

**선택 값**

| 변수 | 쓰임 | 없으면 |
|---|---|---|
| `OKLINK_API_KEY` | 주소 라벨(거래소·믹서 이름) | 온체인 검증은 그대로 되고 라벨만 비어 있음 |
| `TEAMS_WEBHOOK_URL` | 새 사건·브리핑 Teams 알림 | 알림만 건너뜀 |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | 텔레그램 알림 | 〃 (기본 비활성) |
| `CRIMIAL_REPO_DIR` | 블랙리스트 대조용 `scam-address-data` 경로 | 대조 건너뜀 |
| `CONTACT_EMAIL` | 수집 시 User-Agent 연락처 | 기본값 사용 |
| `GIT_REMOTE` | 결과 자동 push 대상 | `origin` |

## 3. 데이터 복원

`data/collector.db` 는 git 에 올리지 않는다(용량·충돌). 대신 **`data/incidents.jsonl` 과 `data/state.json` 이 저장소에 있고, 첫 실행 때 DB 가 비어 있으면 자동으로 복원된다.** 별도 작업이 필요 없다.

```bash
python -c "from collector.store import Store; s=Store('data'); print(s.conn.execute('select count(*) from incidents').fetchone())"
```
3,000건 이상 나오면 복원된 것이다. `data/address_labels.json`(온체인 검증 캐시)과 `docs/data/*.json`(대시보드 스냅샷)도 저장소에 있으므로 새 서버에서 다시 검증할 필요가 없다.

## 4. 실행

### 수집 (매시간)
```bash
python run.py                 # 주기가 된 소스만 수집 → 병합 → 요약 → 리포트·브리핑 → 스냅샷
python run.py --no-push       # git push 없이
```
- Linux(cron): `0 * * * * cd /srv/news && .venv/bin/python run.py >> logs/collect.log 2>&1`
- systemd timer 나 Windows 작업 스케줄러도 동일하게 `run.py` 를 시간마다 부르면 된다.

### 대시보드 서버
```bash
python server.py --port 8765            # http://<서버>:8765
python server.py --port 8765 --lan       # 0.0.0.0 바인딩(같은 네트워크·리버스 프록시에서 접속)
```
- `site/`(React 빌드)가 있으면 그것을 서빙하고, 옛 바닐라 화면은 `/legacy` 에 남는다.
- systemd 예시:
  ```ini
  [Unit]
  Description=Incident Ledger API
  [Service]
  WorkingDirectory=/srv/news
  ExecStart=/srv/news/.venv/bin/python server.py --port 8765 --lan
  Restart=always
  [Install]
  WantedBy=multi-user.target
  ```

### 프런트를 고칠 때만
```bash
cd web && npm install && npm run build     # → ../site (+ docs/data 스냅샷 복사)
```

## 5. 정적 배포(백엔드 없이)

`site/` 폴더를 그대로 아무 정적 호스팅(GitHub Pages·Netlify·S3·nginx)에 올리면 된다.
백엔드가 없으면 앱이 자동으로 **스냅샷 모드**로 바뀌어 `site/data/*.json` 으로 목록·통계·주소 화면을 브라우저에서 계산한다(상단에 `SNAPSHOT` 표시).
데이터를 갱신하려면 수집 서버에서 `npm run build` 를 다시 돌려 `site/` 를 배포하면 된다.

## 6. 긴 작업(선택)

```bash
python run.py --backfill --sources defillama,defihacklabs,slowmist,rekt --since 2020-01-01 --pages 200 --no-push
python run.py --summarize      # 한국어 요약이 빠진 카드 채우기(재실행 안전)
python run.py --addrcheck      # 지갑 주소 온체인 검증(EOA/CA·토큰·활동 체인)
python run.py --rebuild-day 2026-09-29 --rebrief --no-push   # 특정 날짜 리포트·브리핑 재생성
```
백필과 요약은 이미 끝나 저장소에 반영돼 있으므로 새 서버에서 다시 돌릴 필요는 없다.

## 7. 점검

```bash
curl http://localhost:8765/api/meta          # 수집 현황
curl "http://localhost:8765/api/stats?days=all" | head -c 300
tail -f data/logs/$(date +%F).log            # 수집 로그
```
- 요약이 안 붙으면: 로그에 `LLM 공급자` 줄과 403/연결 오류 확인 → `.env` 의 LLM 주소·키.
- 화면이 비면: `site/index.html` 존재 확인, 없으면 `cd web && npm run build`.
