# 로컬 대시보드 서버를 로그온 시 자동 시작하는 작업으로 등록 (창 없이 pythonw 로 실행)
# 사용: powershell -ExecutionPolicy Bypass -File install_site_task.ps1 [-Port 8765] [-Lan]
param(
    [int]$Port = 8765,
    [switch]$Lan,
    [string]$TaskName = "CryptoIncidentSite"
)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = (Get-Command python).Source
$pythonw = Join-Path (Split-Path $python) "pythonw.exe"
if (-not (Test-Path $pythonw)) { $pythonw = $python }
$args = "serve_site.py --port $Port" + $(if ($Lan) { " --lan" } else { "" })
$action = New-ScheduledTaskAction -Execute $pythonw -Argument $args -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew -StartWhenAvailable
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName
Write-Host "등록·시작 완료: $TaskName -> http://localhost:$Port/  $(if ($Lan) { '(LAN 공개)' } else { '(localhost 전용)' })"
Write-Host "중지: Stop-ScheduledTask -TaskName $TaskName   삭제: Unregister-ScheduledTask -TaskName $TaskName -Confirm:`$false"
