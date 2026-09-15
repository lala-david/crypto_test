# GitHub 저장소 연결 + 첫 push
# 사용: powershell -ExecutionPolicy Bypass -File setup_github.ps1 -Url https://github.com/<org>/<repo>.git [-Branch main]
param(
    [Parameter(Mandatory = $true)][string]$Url,
    [string]$Branch = "main"
)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
if (-not (Test-Path ".git")) { git init -b $Branch | Out-Null }
if (git remote | Select-String -Quiet "^origin$") { git remote set-url origin $Url } else { git remote add origin $Url }
git add -A
git -c user.name="crypto-incident-bot" -c user.email="bot@users.noreply.github.com" commit -m "init: crypto incident collector" 2>$null | Out-Null
git push -u origin $Branch
Write-Host ""
Write-Host "완료. 다음 중 하나로 매시간 갱신:"
Write-Host "  (A) 이 PC에서: config.yaml 의 github.push 를 true 로 바꾸고  install_task.ps1  실행"
Write-Host "  (B) GitHub Actions: 저장소 Settings > Secrets > Actions 에 OPENROUTER_API_KEY 등록 (collect.yml 이 매시간 실행)"
