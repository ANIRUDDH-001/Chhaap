$ErrorActionPreference = 'Stop'
$chhaapRoot = Split-Path -Parent $PSScriptRoot
& "$chhaapRoot\.venv\Scripts\python.exe" "$PSScriptRoot\setup_local.py"
if ($LASTEXITCODE -ne 0) { throw 'Local database setup failed.' }
