$ErrorActionPreference = "Stop"

$backendRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$localMongoHost = "127.0.0.1"
$localMongoPort = 27018
$remoteMongoHost = "127.0.0.1"
$remoteMongoPort = 27017
$sshUser = "crm"
$sshHost = "72.60.97.58"
$sshPort = 2424

function Test-LocalMongoPort {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $asyncResult = $client.BeginConnect($localMongoHost, $localMongoPort, $null, $null)
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

if (-not (Test-LocalMongoPort)) {
  Write-Host "Mongo tunnel not detected on $localMongoHost`:$localMongoPort."
  Write-Host "Launching SSH tunnel window. Enter VPS password there."

  $sshCommand = "ssh -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -N -L $localMongoPort`:$remoteMongoHost`:$remoteMongoPort -p $sshPort $sshUser@$sshHost"

  Start-Process -FilePath powershell -ArgumentList @(
    "-NoProfile",
    "-NoExit",
    "-Command",
    $sshCommand
  )

  $maxAttempts = 25
  for ($i = 0; $i -lt $maxAttempts; $i++) {
    Start-Sleep -Seconds 1
    if (Test-LocalMongoPort) {
      break
    }
  }
}

if (-not (Test-LocalMongoPort)) {
  Write-Error "Mongo tunnel did not become ready on $localMongoHost`:$localMongoPort. Start tunnel manually and retry."
  exit 1
}

Write-Host "Mongo tunnel is ready on $localMongoHost`:$localMongoPort"
Set-Location $backendRoot

$envFilePath = Join-Path $backendRoot ".env"
$mongoUri = ""
if (Test-Path -LiteralPath $envFilePath) {
  $mongoUriLine = Get-Content -LiteralPath $envFilePath |
    Where-Object { $_ -match "^\s*MONGO_URI\s*=" } |
    Select-Object -First 1
  if ($mongoUriLine) {
    $mongoUri = ($mongoUriLine -replace "^\s*MONGO_URI\s*=\s*", "").Trim()
  }
}

if ($env:MONGO_TUNNEL_URI) {
  $env:MONGO_URI = $env:MONGO_TUNNEL_URI
} elseif ($mongoUri -match "^mongodb://127\.0\.0\.1:27017/") {
  $env:MONGO_URI = $mongoUri -replace "127\.0\.0\.1:27017", "$localMongoHost`:$localMongoPort"
} else {
  Write-Warning "MONGO_URI was not switched automatically. Set MONGO_TUNNEL_URI to your authenticated 127.0.0.1:$localMongoPort URI if this backend cannot connect."
}

npx nodemon src/server.js
