$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "Stopping old dev servers on ports 5000 and 19021..."
foreach ($port in @(5000, 19021)) {
  $lines = netstat -ano | findstr LISTENING | findstr ":$port "
  foreach ($line in $lines) {
    $procId = ($line -split "\s+")[-1]
    if ($procId -match "^\d+$") {
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
  }
}

Write-Host "Starting backend (http://127.0.0.1:5000)..."
Start-Process -FilePath powershell -ArgumentList @(
  "-NoProfile",
  "-NoExit",
  "-Command",
  "cd `"$($root)\backend`"; npm run start"
) -WorkingDirectory (Join-Path $root "backend")

Write-Host "Waiting for backend health..."
$backendReady = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/health" -Method Get -TimeoutSec 2
    if ($health.ok -eq $true) {
      $backendReady = $true
      break
    }
  } catch {
    # keep waiting
  }
}
if (-not $backendReady) {
  Write-Warning "Backend health check did not pass in time. Mobile web will still start."
}

Write-Host "Starting mobile web (http://localhost:19021)..."
Start-Process -FilePath powershell -ArgumentList @(
  "-NoProfile",
  "-NoExit",
  "-Command",
  "cd `"$($root)\mobile`"; npm run web"
) -WorkingDirectory (Join-Path $root "mobile")

Write-Host ""
Write-Host "Mobile web booting. Open: http://localhost:19021"
