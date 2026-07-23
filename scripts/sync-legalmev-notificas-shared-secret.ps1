# Configura NOTIFICAS_LEGALMEV_SHARED_SECRET en App Hosting (ambos proyectos).
# Uso (PowerShell): .\scripts\sync-legalmev-notificas-shared-secret.ps1
# Requiere: gcloud autenticado. Si ya existe el secreto, solo rota/actualiza la versión.
#
# Proyectos:
#   LegalMev  = caseclarity-hij0x  (backend: legalmev)
#   Notificas = notificas-f9953    (backend: notificas)

$ErrorActionPreference = "Stop"

$legalmevProject = "caseclarity-hij0x"
$notificasProject = "notificas-f9953"
$secretName = "NOTIFICAS_LEGALMEV_SHARED_SECRET"
$legalmevSa = "serviceAccount:firebase-app-hosting-compute@caseclarity-hij0x.iam.gserviceaccount.com"
$notificasSa = "serviceAccount:firebase-app-hosting-compute@notificas-f9953.iam.gserviceaccount.com"

$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$secret = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
$tmp = Join-Path $env:TEMP "lm-notif-shared-secret-rotate.txt"
Set-Content -Path $tmp -Value $secret -NoNewline

function Ensure-Secret([string]$project) {
  $exists = gcloud secrets describe $secretName --project=$project 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Creando $secretName en $project..."
    gcloud secrets create $secretName --project=$project --replication-policy=automatic | Out-Null
  }
  Write-Host "Agregando versión en $project..."
  Get-Content $tmp -Raw | gcloud secrets versions add $secretName --project=$project --data-file=- | Out-Null
}

Ensure-Secret $legalmevProject
Ensure-Secret $notificasProject

Write-Host "Otorgando secretAccessor a App Hosting..."
gcloud secrets add-iam-policy-binding $secretName --project=$legalmevProject --member=$legalmevSa --role="roles/secretmanager.secretAccessor" | Out-Null
gcloud secrets add-iam-policy-binding $secretName --project=$notificasProject --member=$notificasSa --role="roles/secretmanager.secretAccessor" | Out-Null

Remove-Item $tmp -Force -ErrorAction SilentlyContinue
Write-Host ""
Write-Host "Listo. Misma clave en ambos proyectos."
Write-Host "Asegurate de que apphosting.yaml referencie NOTIFICAS_LEGALMEV_SHARED_SECRET y redeploy:"
Write-Host "  - LegalMev: push a main (backend legalmev)"
Write-Host "  - Notificas: push a main (backend notificas)"
Write-Host "  En Notificas también: LEGALMEV_URL=https://www.legalmev.com.ar"
