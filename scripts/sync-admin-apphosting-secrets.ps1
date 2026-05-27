# Sube ADMIN_PANEL_* desde .env.local a Firebase App Hosting (Secret Manager).
# Uso: .\scripts\sync-admin-apphosting-secrets.ps1
# Requiere: firebase CLI autenticado (firebase login)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$envFile = Join-Path $root ".env.local"

if (-not (Test-Path $envFile)) {
  Write-Error "No existe .env.local en $root"
}

function Get-EnvValue([string]$key) {
  $line = Get-Content $envFile | Where-Object { $_ -match "^\s*$([regex]::Escape($key))\s*=" } | Select-Object -First 1
  if (-not $line) { return $null }
  $v = $line -replace "^\s*$key\s*=\s*", ""
  if ($v.StartsWith('"') -and $v.EndsWith('"')) { $v = $v.Substring(1, $v.Length - 2) }
  if ($v.StartsWith("'") -and $v.EndsWith("'")) { $v = $v.Substring(1, $v.Length - 2) }
  return $v.Trim()
}

$email = Get-EnvValue "ADMIN_PANEL_EMAIL"
$pass = Get-EnvValue "ADMIN_PANEL_PASSWORD"
$secret = Get-EnvValue "ADMIN_SESSION_SECRET"

if (-not $email -or -not $pass -or -not $secret) {
  Write-Error "Faltan ADMIN_PANEL_EMAIL, ADMIN_PANEL_PASSWORD o ADMIN_SESSION_SECRET en .env.local"
}

Write-Host "Subiendo secretos del panel admin a App Hosting..."
$email | firebase apphosting:secrets:set ADMIN_PANEL_EMAIL
$pass | firebase apphosting:secrets:set ADMIN_PANEL_PASSWORD
$secret | firebase apphosting:secrets:set ADMIN_SESSION_SECRET

Write-Host "Otorgando acceso al backend notificas..."
firebase apphosting:secrets:grantaccess "ADMIN_PANEL_EMAIL,ADMIN_PANEL_PASSWORD,ADMIN_SESSION_SECRET" --backend notificas

Write-Host ""
Write-Host "Listo. Hace commit de apphosting.yaml (si cambió) y un rollout de App Hosting:"
Write-Host "  firebase deploy --only apphosting"
Write-Host "O esperá el deploy automático desde GitHub tras push a main."
