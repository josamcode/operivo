# Starts Opervio in the background (production build) on http://localhost:4100.
# Logs: %USERPROFILE%\Opervio\logs\server.log    Stop: scripts\stop.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
  docker compose up -d | Out-Null
  pnpm --filter @opervio/server run db:deploy | Out-Null
  pnpm --filter @opervio/web run build | Out-Null
  $logs = Join-Path $env:USERPROFILE 'Opervio\logs'
  New-Item -ItemType Directory -Force $logs | Out-Null
  $server = Join-Path $root 'apps\server'
  Start-Process -WindowStyle Hidden -FilePath 'cmd.exe' -WorkingDirectory $server `
    -ArgumentList '/c', "npx tsx src/index.ts >> `"$logs\server.log`" 2>&1"
  for ($i = 0; $i -lt 60; $i++) {
    try { Invoke-RestMethod http://127.0.0.1:4100/api/bootstrap -TimeoutSec 2 | Out-Null; break } catch { Start-Sleep -Seconds 1 }
  }
  Write-Output 'Opervio is running at http://localhost:4100'
} finally {
  Pop-Location
}
