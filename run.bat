@echo off
rem 매시간 실행 (작업 스케줄러에서 호출). 소스별 주기는 config.yaml > schedule
cd /d "%~dp0"
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
"C:\Users\강성준\AppData\Local\Programs\Python\Python310\python.exe" run.py >> data\logs\run.out 2>&1
