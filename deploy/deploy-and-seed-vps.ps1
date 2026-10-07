# Push main to GitHub, deploy it on the Samvid OS VPS, then load the demo data.
# You will be asked for the VPS password twice (deploy, then the database tunnel).
param([switch]$SkipSeed)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
Set-Location $repoRoot
Start-Transcript -Path (Join-Path $repoRoot "deploy-vps.log") -Force | Out-Null

$sshUser = "samvid"
$sshHost = "72.60.97.58"
$sshPort = 2424

try {
  Write-Host "==> 1/3 Pushing main to GitHub"
  $ErrorActionPreference = "Continue"
  git push origin main
  if ($LASTEXITCODE -ne 0) { throw "git push failed - check your GitHub login and try again." }

  Write-Host ""
  Write-Host "==> 2/3 Deploying on the VPS (type the VPS password when asked)"
  $script = [IO.File]::ReadAllText((Join-Path $repoRoot "deploy\vps-deploy.sh")) -replace "`r`n", "`n"
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($script))
  ssh -t -p $sshPort "$sshUser@$sshHost" "echo $b64 | base64 -d > /tmp/samvid-vps-deploy.sh && bash /tmp/samvid-vps-deploy.sh"
  if ($LASTEXITCODE -ne 0) { throw "Deploy did not finish (exit code $LASTEXITCODE) - see the messages above." }

  if (-not $SkipSeed) {
    Write-Host ""
    Write-Host "==> 3/3 Loading demo data"
    & (Join-Path $repoRoot "backend\scripts\seed-demo-vps.ps1")
  }
  Write-Host ""
  Write-Host "ALL DONE"
} catch {
  Write-Host "FAILED: $($_.Exception.Message)"
} finally {
  Stop-Transcript | Out-Null
}
