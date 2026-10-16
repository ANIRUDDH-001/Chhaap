param(
    [string]$OllamaExe = 'D:\ollama\bin\ollama.exe',
    [string]$ModelsDir = 'D:\ollama\models',
    [switch]$SkipSetup
)
$ErrorActionPreference = 'Stop'
Write-Host 'Checking the local Chhaap services...'
$projectRoot = Split-Path $PSScriptRoot -Parent
$pythonExe = Join-Path $projectRoot '.venv\Scripts\python.exe'
$logRoot = Join-Path $projectRoot '.data\logs'
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
if (-not (Test-Path -LiteralPath $pythonExe)) { throw 'Create .venv and install backend/requirements.lock first; see README.' }
Push-Location $projectRoot
try {
    if (-not $SkipSetup) {
        & $pythonExe scripts/setup_local.py
        if ($LASTEXITCODE -ne 0) { throw 'Database setup failed' }
    }
    Write-Host 'Checking database migrations...'
    & $pythonExe -m chhaap.migrate
    if ($LASTEXITCODE -ne 0) { throw 'Database migration failed' }
    Write-Host 'Checking model, API and background services...'
    function Listening([int]$Port) {
        return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    }
    function Start-HiddenService([string]$Name, [string]$File, [string[]]$Arguments, [string]$WorkingDirectory) {
        $process = Start-Process -FilePath $File -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logRoot "$Name.out.log") -RedirectStandardError (Join-Path $logRoot "$Name.err.log")
        $process.Id | Set-Content (Join-Path $logRoot "$Name.pid")
    }
    if (-not (Listening 11435)) {
        if (Test-Path -LiteralPath $OllamaExe) {
            $env:OLLAMA_HOST = '127.0.0.1:11435'
            $env:OLLAMA_MODELS = $ModelsDir
            $env:OLLAMA_NUM_PARALLEL = '1'
            $env:OLLAMA_MAX_LOADED_MODELS = '1'
            Start-HiddenService 'ollama' $OllamaExe @('serve') $projectRoot
        } else { Write-Warning 'Ollama was not found. Manual quoting will work; configure the model to enable extraction.' }
    }
    if (-not (Listening 8767)) {
        Start-HiddenService 'api' $pythonExe @('-m','uvicorn','chhaap.api:app','--host','127.0.0.1','--port','8767','--reload','--reload-dir',"`"$(Join-Path $projectRoot 'backend\chhaap')`"") $projectRoot
    }
    foreach ($service in @('worker','retention')) {
        $existing = Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $pythonExe -and $_.CommandLine -match "-m chhaap\.$service(?:\s|$)" }
        if (-not $existing) {
            $arguments = @('-m',"chhaap.$service")
            if ($service -eq 'retention') { $arguments += '--loop' }
            Start-HiddenService $service $pythonExe $arguments $projectRoot
        }
    }
    if (-not (Listening 5175)) {
        $nodeExe = (Get-Command node.exe).Source
        Start-HiddenService 'web' $nodeExe @('node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5175','--strictPort') (Join-Path $projectRoot 'web')
    }
    Write-Host 'Checking the live application...'
    $readyProbe = @'
import time
import httpx
with httpx.Client(trust_env=False, timeout=2) as client:
    for attempt in range(20):
        try:
            result = client.get("http://127.0.0.1:5175/api/v1/ready")
            if result.status_code == 200 and result.json().get("database") == "ready":
                raise SystemExit(0)
        except (httpx.HTTPError, ValueError):
            pass
        time.sleep(0.5)
raise SystemExit(1)
'@
    $readyProbe | & $pythonExe -
    if ($LASTEXITCODE -ne 0) { throw "Services did not become ready. Inspect $logRoot" }
    Write-Host 'Chhaap is live: http://localhost:5175/'
    Write-Host "Services remain running after this command. Logs: $logRoot"
} finally { Pop-Location }
