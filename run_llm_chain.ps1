# 한국어 요약 → 온체인 주소 검증 → 사이트 데이터 재생성. 각 단계는 재실행 안전(이미 끝난 항목은 건너뜀).
$ErrorActionPreference = "Continue"
$py = "C:\Users\강성준\AppData\Local\Programs\Python\Python310\python.exe"
$root = "C:\Users\강성준\Desktop\app\news"
Set-Location $root
"[{0}] summarize 시작" -f (Get-Date -Format "HH:mm:ss") | Out-File -Append -Encoding utf8 logs\llm_chain.log
& $py run.py --summarize *>> logs\llm_chain.log
"[{0}] summarize 끝 → addrcheck 시작" -f (Get-Date -Format "HH:mm:ss") | Out-File -Append -Encoding utf8 logs\llm_chain.log
& $py run.py --addrcheck *>> logs\llm_chain.log
"[{0}] addrcheck 끝 → 사이트 데이터 재생성" -f (Get-Date -Format "HH:mm:ss") | Out-File -Append -Encoding utf8 logs\llm_chain.log
& $py -c "import sys,yaml;sys.path.insert(0,'.');from collector.store import Store;from collector.site import export_site;from collector.crimial import CrimialHunter;cfg=yaml.safe_load(open('config.yaml',encoding='utf-8'));print(export_site(Store('data'),'docs',recent_days=int(cfg.get('site_recent_days',90)),crimial=CrimialHunter(cfg.get('crimial_hunter') or {},'.'))['incidents_total'])" *>> logs\llm_chain.log
"[{0}] 전체 완료" -f (Get-Date -Format "HH:mm:ss") | Out-File -Append -Encoding utf8 logs\llm_chain.log
