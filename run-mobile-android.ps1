$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$avdName = "Pixel_7_API_35"
$appId = "com.theofficeonrent.crm"
$metroPort = 8081
$apiPort = 5000

$sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$adb = Join-Path $sdk "platform-tools\adb.exe"
$emulator = Join-Path $sdk "emulator\emulator.exe"
$mobile = Join-Path $root "mobile"

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

function Get-AttachedDevice {
  $lines = & $adb devices 2>$null
  foreach ($line in $lines) {
    if ($line -match "^(emulator-\d+)\s+device") {
      return $Matches[1]
    }
  }
  return $null
}

# --- MongoDB + backend -------------------------------------------------------
# The mobile app talks to the same local API the web app uses. run-web.ps1 owns
# starting those; here we only check and warn, so the two scripts can coexist.

if (-not (Test-LocalPort -HostName "127.0.0.1" -Port 27017)) {
  Write-Warning "MongoDB is not listening on 127.0.0.1:27017. Run run-web.ps1 first, or start mongod."
}

if (-not (Test-LocalPort -HostName "127.0.0.1" -Port $apiPort)) {
  Write-Host "Backend not running. Starting it on http://127.0.0.1:$apiPort ..."
  Start-Process -FilePath powershell -ArgumentList @(
    "-NoProfile",
    "-NoExit",
    "-Command",
    "cd `"$($root)\backend`"; npm run start"
  ) -WorkingDirectory (Join-Path $root "backend")

  Start-Sleep -Seconds 5
}

# --- Emulator ----------------------------------------------------------------
# Start-Process (not a child of this shell) so the emulator owns its own window.
# Without that the side toolbar and host keyboard do not receive input.

$device = Get-AttachedDevice

if (-not $device) {
  Write-Host "Starting emulator $avdName ..."
  Start-Process -FilePath $emulator -ArgumentList @("-avd", $avdName, "-gpu", "host") -WorkingDirectory (Split-Path $emulator)

  & $adb wait-for-device

  Write-Host "Waiting for Android to finish booting..."
  for ($i = 0; $i -lt 60; $i++) {
    $booted = (& $adb shell getprop sys.boot_completed 2>$null) -replace "\s", ""
    if ($booted -eq "1") { break }
    Start-Sleep -Seconds 5
  }

  $device = Get-AttachedDevice
}

if (-not $device) {
  throw "No emulator attached. Open Device Manager in Android Studio and start $avdName manually."
}

Write-Host "Emulator ready: $device"

# --- Port bridges ------------------------------------------------------------
# Reset on every run: reverse tunnels do not survive an emulator restart.

& $adb reverse --remove-all 2>$null | Out-Null
& $adb reverse "tcp:$apiPort" "tcp:$apiPort" | Out-Null
& $adb reverse "tcp:$metroPort" "tcp:$metroPort" | Out-Null

# --- Metro -------------------------------------------------------------------

if (Test-LocalPort -HostName "127.0.0.1" -Port $metroPort) {
  Write-Host "Metro already running on port $metroPort. Reusing it."
} else {
  Write-Host "Starting Metro on port $metroPort ..."
  Start-Process -FilePath powershell -ArgumentList @(
    "-NoProfile",
    "-NoExit",
    "-Command",
    "cd `"$mobile`"; " +
    "`$env:EXPO_PUBLIC_USE_LOCAL_API='true'; " +
    "`$env:EXPO_PUBLIC_LOCAL_API_PORT='$apiPort'; " +
    "npx expo start --dev-client --localhost --port $metroPort"
  ) -WorkingDirectory $mobile

  for ($i = 0; $i -lt 30; $i++) {
    if (Test-LocalPort -HostName "127.0.0.1" -Port $metroPort) { break }
    Start-Sleep -Seconds 2
  }
}

# --- App ---------------------------------------------------------------------
# Only rebuild when the dev client is missing. A JS-only change needs neither a
# rebuild nor a reinstall: save the file and Fast Refresh picks it up.

$installed = (& $adb shell pm list packages $appId 2>$null) -match $appId

if (-not $installed) {
  Write-Host ""
  Write-Host "$appId is not installed. Building the dev client (15-25 min)..."
  Write-Host "Single ABI + in-process Kotlin keeps this within available RAM."

  Push-Location (Join-Path $mobile "android")
  try {
    & .\gradlew.bat app:assembleDebug `
      -PreactNativeArchitectures=x86_64 `
      -Pkotlin.compiler.execution.strategy=in-process `
      --no-parallel --max-workers=2 --build-cache --console=plain `
      -x lint -x test

    if ($LASTEXITCODE -ne 0) { throw "Gradle build failed with exit code $LASTEXITCODE" }
  } finally {
    Pop-Location
  }

  $apk = Join-Path $mobile "android\app\build\outputs\apk\debug\app-debug.apk"
  Write-Host "Installing $apk ..."
  & $adb install -r -d $apk
}

# Launch through the dev-client deep link, not the launcher icon. A plain
# launch reuses the last session and comes up blank when the emulator has been
# restarted; passing the Metro URL forces the dev client to reconnect.
# 10.0.2.2 is the emulator's alias for the host machine.

$metroUrl = [uri]::EscapeDataString("http://10.0.2.2:$metroPort")

Write-Host "Launching $appId against Metro ..."
& $adb shell am force-stop $appId | Out-Null
Start-Sleep -Seconds 2
& $adb shell am start -a android.intent.action.VIEW `
  -d "exp+the-office-on-rent://expo-development-client/?url=$metroUrl" | Out-Null

Write-Host ""
Write-Host "App is starting on $device."
Write-Host "  First load after a cold boot shows a white screen for up to ~90s"
Write-Host "  while Metro bundles and the session is restored. That is normal."
Write-Host "  Edit anything under mobile\src and save - Fast Refresh applies it in ~1-2s."
Write-Host "  Still stuck after 2 min? Press Ctrl+M in the emulator, then Reload."
