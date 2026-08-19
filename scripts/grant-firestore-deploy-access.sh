#!/bin/bash
#
# Otorga permisos IAM para desplegar Firestore (reglas + índices) con:
#   firebase deploy --only firestore
#
# Debe ejecutarse autenticado como titular del proyecto (p. ej. abengolea1@gmail.com):
#   gcloud auth login
#   ./scripts/grant-firestore-deploy-access.sh
#
# Configuración: firebase-deploy-access.json (proyectos, emails y roles).
# Para sumar más proyectos bajo el mismo titular, agregalos al array "projects".

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="${CONFIG_FILE:-$ROOT_DIR/firebase-deploy-access.json}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "❌ Error: gcloud CLI no está instalado."
  echo "   https://cloud.google.com/sdk/docs/install"
  exit 1
fi

if [ ! -f "$CONFIG_FILE" ]; then
  echo "❌ No existe $CONFIG_FILE"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Error: Node.js es necesario para leer $CONFIG_FILE"
  exit 1
fi

read_config() {
  node -e "
    const fs = require('fs');
    const cfg = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    const projects = (cfg.projects || []).filter(Boolean);
    const emails = (cfg.deployAdminEmails || []).map((e) => String(e).trim().toLowerCase()).filter(Boolean);
    const roles = (cfg.roles || ['roles/firebase.developAdmin', 'roles/datastore.indexAdmin']).filter(Boolean);
    const owner = String(cfg.projectOwnerEmail || '').trim().toLowerCase();
    if (!projects.length) {
      console.error('CONFIG_ERROR:projects vacío');
      process.exit(2);
    }
    if (!emails.length) {
      console.error('CONFIG_ERROR:deployAdminEmails vacío');
      process.exit(2);
    }
    console.log(JSON.stringify({ owner, projects, emails, roles }));
  " "$CONFIG_FILE"
}

CFG_JSON="$(read_config)"
OWNER_EMAIL="$(node -e "console.log(JSON.parse(process.argv[1]).owner)" "$CFG_JSON")"
PROJECTS="$(node -e "console.log(JSON.parse(process.argv[1]).projects.join(' '))" "$CFG_JSON")"
EMAILS="$(node -e "console.log(JSON.parse(process.argv[1]).emails.join(' '))" "$CFG_JSON")"
ROLES="$(node -e "console.log(JSON.parse(process.argv[1]).roles.join(' '))" "$CFG_JSON")"

ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -1 || true)"
if [ -z "$ACTIVE_ACCOUNT" ]; then
  echo "🔐 No hay cuenta activa en gcloud. Ejecutá: gcloud auth login"
  exit 1
fi

echo "🔑 Cuenta gcloud activa: $ACTIVE_ACCOUNT"
if [ -n "$OWNER_EMAIL" ] && [ "$ACTIVE_ACCOUNT" != "$OWNER_EMAIL" ]; then
  echo "⚠️  El titular configurado es $OWNER_EMAIL; continuá solo si tenés permisos de Owner/Admin en los proyectos."
fi

DISCOVER="${DISCOVER_PROJECTS:-0}"
if [ "$DISCOVER" = "1" ] && [ -n "$OWNER_EMAIL" ]; then
  echo "🔎 Buscando proyectos ACTIVE accesibles para $ACTIVE_ACCOUNT..."
  FOUND="$(gcloud projects list --filter="lifecycleState:ACTIVE" --format="value(projectId)" 2>/dev/null || true)"
  if [ -n "$FOUND" ]; then
    PROJECTS="$FOUND"
    echo "   Proyectos detectados: $PROJECTS"
  fi
fi

grant_role() {
  local project="$1"
  local email="$2"
  local role="$3"
  echo "   → $project | $email | $role"
  gcloud projects add-iam-policy-binding "$project" \
    --member="user:$email" \
    --role="$role" \
    --condition=None \
    --quiet >/dev/null
}

echo ""
echo "🚀 Otorgando acceso de deploy Firestore"
echo "   Proyectos: $PROJECTS"
echo "   Admins:    $EMAILS"
echo "   Roles:     $ROLES"
echo ""

for project in $PROJECTS; do
  echo "📦 Proyecto: $project"
  for email in $EMAILS; do
    for role in $ROLES; do
      grant_role "$project" "$email" "$role" || {
        echo "❌ Falló el binding en $project para $email ($role)"
        exit 1
      }
    done
  done
  echo ""
done

echo "✅ Listo. Verificá en Firebase Console → Configuración del proyecto → Usuarios y permisos."
echo "   Deploy de prueba (como $EMAILS):"
echo "   firebase login"
echo "   firebase deploy --only firestore --project notificas-f9953"
