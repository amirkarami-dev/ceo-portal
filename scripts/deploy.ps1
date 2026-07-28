# scripts/deploy.ps1 — deploy the full CEO Portal stack to the production server (185.206.94.116).
#
# This box has normal internet, so images are BUILT FROM SOURCE on the server and the stack
# attaches to the box's pre-existing shared Traefik (external "traefik" network, ACME DNS-01
# "myresolver"). It is isolated by its own /data/apps/ceo-portal folder + unique container/router names,
# so it never disturbs kurdvahedgas-web / sms-service / v2ray on the same host.
#
# Safe to re-run: deploy/.env and the OpenIddict signing cert are generated once and preserved.
#
#   pwsh -File scripts/deploy.ps1            # uses $env:CEO_SERVER_PASS for the password
[CmdletBinding()]
param(
  [string]$ServerIp   = "185.206.94.116",
  [string]$ServerUser = "ubuntu",
  [string]$ServerPass = $env:CEO_SERVER_PASS,
  [string]$HostKey    = "SHA256:avswocM1nU3e0FnKQsQDoKSfs6mb/dkRG/8r7iTLEps",
  [string]$AppPath    = "/data/apps/ceo-portal",
  [string]$Compose    = "deploy/docker-compose.newserver.yml"
)
$ErrorActionPreference = "Stop"
$plink = "C:\Program Files\PuTTY\plink.exe"
$pscp  = "C:\Program Files\PuTTY\pscp.exe"
$RepoRoot = Split-Path -Parent $PSScriptRoot

if (-not $ServerPass) { throw "Set the server password via -ServerPass or `$env:CEO_SERVER_PASS" }

function Remote([string]$cmd) {
  & $plink -batch -hostkey $HostKey -pw $ServerPass "$ServerUser@$ServerIp" $cmd
  if ($LASTEXITCODE -ne 0) { throw "remote command failed ($LASTEXITCODE): $cmd" }
}
function Push([string]$local, [string]$remote) {
  & $pscp -batch -hostkey $HostKey -pw $ServerPass $local "${ServerUser}@${ServerIp}:$remote"
  if ($LASTEXITCODE -ne 0) { throw "pscp failed ($LASTEXITCODE): $local -> $remote" }
}

Write-Host "==> 1/6  Packaging tracked source (git archive HEAD)"
$tar = Join-Path $env:TEMP "ceo-portal-src.tar.gz"
git -C $RepoRoot archive --format=tar.gz -o $tar HEAD
if ($LASTEXITCODE -ne 0) { throw "git archive failed" }

Write-Host "==> 2/6  Preparing $AppPath"
Remote "echo '$ServerPass' | sudo -S mkdir -p $AppPath/deploy $AppPath/scripts && echo '$ServerPass' | sudo -S chown -R ${ServerUser}:${ServerUser} $AppPath"

Write-Host "==> 3/6  Uploading source + compose + provisioner"
Push $tar "/tmp/ceo-portal-src.tar.gz"
# Remove only source trees (NOT deploy/.env or deploy/certs) so renamed/removed files can't survive.
Remote "cd $AppPath && rm -rf src mabhas19-web mabhas19-mobile analytics-web mun-sanandaj-web packages tests docs 'Directory.Build.props' 'Directory.Packages.props' *.slnx package.json package-lock.json && tar -xzf /tmp/ceo-portal-src.tar.gz -C $AppPath && rm -f /tmp/ceo-portal-src.tar.gz"
Push (Join-Path $RepoRoot "deploy\docker-compose.newserver.yml") "$AppPath/deploy/docker-compose.newserver.yml"
Push (Join-Path $RepoRoot "scripts\remote-provision.sh")          "$AppPath/scripts/remote-provision.sh"

Write-Host "==> 4/6  Generating .env + signing cert (idempotent)"
Remote "cd $AppPath && bash scripts/remote-provision.sh"
$volumeMigrationGuard = @'
if docker volume inspect mabhas19_mssqldata >/dev/null 2>&1 && ! docker volume inspect ceo-portal_mssqldata >/dev/null 2>&1; then
  echo 'Legacy SQL volume exists but CEO Portal SQL volume is missing. Run the documented stopped-volume migration first.' >&2
  exit 1
fi
if docker volume inspect mabhas19_miniodata >/dev/null 2>&1 && ! docker volume inspect ceo-portal_miniodata >/dev/null 2>&1; then
  echo 'Legacy MinIO volume exists but CEO Portal MinIO volume is missing. Run the documented stopped-volume migration first.' >&2
  exit 1
fi
'@
Remote $volumeMigrationGuard

Write-Host "==> 5/6  Building images from source (no cache, one at a time - 4 GB box)"
# Reclaim build-cache space FIRST: Docker's containerd image store lives on the small ~23 GB
# root disk (not the 49 GB /data), so a --no-cache build otherwise fails with
# "no space left on device". (Moving containerd's root to /data would fix it permanently but
# needs a containerd+docker restart = every container on the shared box restarts.)
Remote "docker builder prune -af"
foreach ($svc in @("api", "auth", "mabhas19-web", "portal-web", "analytics-web", "mun-sanandaj-web", "landing-panel", "admin-web", "kurdnezam-web", "status")) {
  Write-Host "    building $svc ..."
  Remote "cd $AppPath && docker compose -f $Compose --env-file deploy/.env build --no-cache $svc"
}

Write-Host "==> 6/6  Starting the stack (force-recreate)"
Remote "cd $AppPath && docker compose -f $Compose --env-file deploy/.env up -d --force-recreate"
Remote "cd $AppPath && docker compose -f $Compose ps"

Write-Host ""
Write-Host "Deployed. Once the ArvanCloud origins for auth.myceo.ir + s3.myceo.ir also"
Write-Host "points at $ServerIp (SSL mode = Full, origin port 443), verify the live hosts:"
Write-Host "  https://mabhas19.myceo.ir   https://api.myceo.ir/scalar   https://auth.myceo.ir/.well-known/openid-configuration"
