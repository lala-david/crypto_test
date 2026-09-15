# Windows 작업 스케줄러에 매시간 실행 작업 등록 (python.exe 를 직접 실행 — .bat 경유 시 한글 경로에서 실패 사례 있음)
# 사용: powershell -ExecutionPolicy Bypass -File install_task.ps1 [-EveryHours 1]
param(
    [int]$EveryHours = 1,
    [string]$TaskName = "CryptoIncidentCollector"
)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = (Get-Command python).Source
$action = New-ScheduledTaskAction -Execute $python -Argument "run.py" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddHours(8) -RepetitionInterval (New-TimeSpan -Hours $EveryHours)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Write-Host "등록 완료: $TaskName ($EveryHours 시간마다, $python run.py @ $root)"
Write-Host "로그: data\logs\YYYY-MM-DD.log"
Write-Host "삭제하려면: Unregister-ScheduledTask -TaskName $TaskName -Confirm:`$false"
