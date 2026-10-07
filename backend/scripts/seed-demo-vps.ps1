# Loads the Samvid OS demo dataset into the VPS database, in its own company
# ("Samvid Demo Realty", logins @samviddemo.in, password 123456).
# Nothing outside that company is written. Undo with: -Remove
param([switch]$Remove)

$ErrorActionPreference = "Stop"
$backendRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$logPath = Join-Path (Split-Path -Parent $backendRoot) ($(if ($Remove) { "remove-demo-vps.log" } else { "seed-demo-vps.log" }))
Start-Transcript -Path $logPath -Force | Out-Null

$tunnelPort = 27018
$sshUser = "samvid"
$sshHost = "72.60.97.58"
$sshPort = 2424

function Test-TunnelPort {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect("127.0.0.1", $tunnelPort, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne(1200, $false)) { return $false }
    $client.EndConnect($async) | Out-Null
    return $true
  } catch { return $false } finally { $client.Close() }
}

try {
  if (-not (Test-TunnelPort)) {
    Write-Host "Opening the SSH tunnel to $sshHost. Type the VPS password in the new window and leave it open."
    $sshCommand = "ssh -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -N -L ${tunnelPort}:127.0.0.1:27017 -p $sshPort $sshUser@$sshHost"
    Start-Process -FilePath powershell -ArgumentList @("-NoProfile", "-NoExit", "-Command", $sshCommand)
    for ($i = 0; $i -lt 120 -and -not (Test-TunnelPort); $i++) { Start-Sleep -Seconds 1 }
  }
  if (-not (Test-TunnelPort)) { throw "The SSH tunnel did not come up on 127.0.0.1:$tunnelPort." }
  Write-Host "Tunnel is up."

  # The VPS connection string from backend\.env
  $envLine = Get-Content (Join-Path $backendRoot ".env") | Where-Object { $_ -match '^\s*MONGO_VPS_URI\s*=' } | Select-Object -First 1
  if (-not $envLine) { throw "MONGO_VPS_URI is missing from backend\.env" }
  $env:MONGO_URI = ($envLine -replace '^\s*MONGO_VPS_URI\s*=\s*', '').Trim().Trim('"')

  $env:DEMO_COMPANY_SLUG = "samvid-demo"
  $env:DEMO_COMPANY_NAME = "Samvid Demo Realty"
  $env:DEMO_EMAIL_DOMAIN = "samviddemo.in"
  $env:FEED_LOCAL_DEMO_DATA_ALLOW_SHARED = "true"

  Set-Location $backendRoot
  $ErrorActionPreference = "Continue"
  if ($Remove) {
    $env:CONFIRM_REMOVE_DEMO_COMPANY = "samvid-demo"
    node src/seeder/removeDemoCompany.cjs | Out-Host
  } else {
    Write-Host "Loading demo data - this takes a few minutes over the tunnel..."
    node src/seeder/feedLocalDemoData.cjs | Out-Host
  }
  if ($LASTEXITCODE -ne 0) { Write-Host "FAILED (exit code $LASTEXITCODE)" } else { Write-Host "SUCCESS" }
} catch {
  Write-Host "FAILED: $($_.Exception.Message)"
} finally {
  Stop-Transcript | Out-Null
}
