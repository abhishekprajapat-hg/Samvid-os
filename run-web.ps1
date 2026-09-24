$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Test-LocalPort {
  param(
    [string]$HostName,
    [int]$Port
  )

  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $asyncResult = $client.BeginConnect($HostName, $Port, $null, $null)
    $connected = $asyncResult.AsyncWaitHandle.WaitOne(1200, $false)
    if (-not $connected) {
      return $false
    }

    $client.EndConnect($asyncResult) | Out-Null
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

$mongoHost = "127.0.0.1"
$mongoPort = 27017
$mongoExe = "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe"
$mongoDataPath = Join-Path $root "backend\.mongo-data"
$mongoLogPath = Join-Path $root "backend\.mongo-log"

if (-not (Test-LocalPort -HostName $mongoHost -Port $mongoPort)) {
  if (Test-Path -LiteralPath $mongoExe) {
    if (-not (Test-Path -LiteralPath $mongoDataPath)) {
      New-Item -ItemType Directory -Path $mongoDataPath | Out-Null
    }

    if (-not (Test-Path -LiteralPath $mongoLogPath)) {
      New-Item -ItemType Directory -Path $mongoLogPath | Out-Null
    }

    Write-Host "Starting local MongoDB copy (127.0.0.1:27017)..."
    Start-Process -FilePath $mongoExe -ArgumentList @(
      "--dbpath",
      $mongoDataPath,
      "--bind_ip",
      $mongoHost,
      "--port",
      "$mongoPort",
      "--logpath",
      (Join-Path $mongoLogPath "mongod.log"),
      "--logappend",
      "--setParameter",
      "diagnosticDataCollectionEnabled=false"
    ) -WindowStyle Hidden

    Start-Sleep -Seconds 5
  }

  if (-not (Test-LocalPort -HostName $mongoHost -Port $mongoPort)) {
    Write-Warning "MongoDB is not listening on $mongoHost`:$mongoPort. Backend may fail until MongoDB is started."
  }
}

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
