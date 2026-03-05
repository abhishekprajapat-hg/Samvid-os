$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "Stopping old dev servers on ports 5000 and 5173..."
foreach ($port in @(5000, 5173)) {
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

Start-Sleep -Seconds 3

Write-Host "Starting frontend (http://localhost:5173)..."
Start-Process -FilePath powershell -ArgumentList @(
  "-NoProfile",
  "-NoExit",
  "-Command",
  "cd `"$($root)\frontend`"; npm run dev"
) -WorkingDirectory (Join-Path $root "frontend")

Write-Host ""
Write-Host "Web app booting. Open: http://localhost:5173/login/admin"
