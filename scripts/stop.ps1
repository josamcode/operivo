# Stops the background Opervio server started by scripts\start.ps1.
$conn = Get-NetTCPConnection -LocalPort 4100 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn) {
  taskkill /pid $conn.OwningProcess /T /F | Out-Null
  Write-Output 'Opervio stopped.'
} else {
  Write-Output 'Opervio is not running.'
}
