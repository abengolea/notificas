#!/bin/bash

# Script para configurar secretos en Firebase App Hosting
# SEGURO: Lee de .env.local (nunca hardcodear credenciales en este script)
# Ejecutar: ./setup-firebase-secrets.sh

set -e

echo "🔐 Configurando secretos de Firebase App Hosting..."
echo ""

# Verificar Firebase CLI
if ! command -v firebase &> /dev/null; then
    echo "❌ Error: Firebase CLI no está instalado"
    echo "Instálalo con: npm install -g firebase-tools"
    exit 1
fi

# Verificar autenticación
echo "🔑 Verificando autenticación de Firebase..."
if ! firebase projects:list &> /dev/null; then
    echo "🔐 No estás autenticado. Ejecutando firebase login..."
    firebase login
fi

# Cargar .env.local si existe
ENV_FILE=".env.local"
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: No existe .env.local"
    echo "Ejecuta primero: ./setup-env-development.sh"
    echo "Luego edita .env.local con tus credenciales reales"
    exit 1
fi

echo "📂 Leyendo credenciales de .env.local..."

# Función para obtener variable de .env.local (sin source para evitar inyección)
get_env() {
    grep -E "^${1}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" | head -1 || echo ""
}

# Firebase (desde .env.local)
FIREBASE_API_KEY=$(get_env "NEXT_PUBLIC_FIREBASE_API_KEY")
FIREBASE_AUTH_DOMAIN=$(get_env "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN")
FIREBASE_PROJECT_ID=$(get_env "NEXT_PUBLIC_FIREBASE_PROJECT_ID")
FIREBASE_STORAGE_BUCKET=$(get_env "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET")
FIREBASE_MESSAGING_SENDER_ID=$(get_env "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID")
FIREBASE_APP_ID=$(get_env "NEXT_PUBLIC_FIREBASE_APP_ID")
FIREBASE_MEASUREMENT_ID=$(get_env "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID")

# Polygon (desde .env.local - NUNCA imprimir)
POLYGON_PRIVATE_KEY=$(get_env "POLYGON_PRIVATE_KEY")
POLYGON_WALLET_ADDRESS=$(get_env "POLYGON_WALLET_ADDRESS")

# Validar que existan los valores críticos
MISSING=""
[ -z "$FIREBASE_API_KEY" ] && MISSING="$MISSING NEXT_PUBLIC_FIREBASE_API_KEY"
[ -z "$POLYGON_PRIVATE_KEY" ] && MISSING="$MISSING POLYGON_PRIVATE_KEY"
[ -z "$POLYGON_WALLET_ADDRESS" ] && MISSING="$MISSING POLYGON_WALLET_ADDRESS"

if [ -n "$MISSING" ]; then
    echo "❌ Faltan variables en .env.local:$MISSING"
    echo "Edita .env.local con tus credenciales antes de ejecutar este script"
    exit 1
fi

# Configurar secretos
echo "📤 Subiendo secretos a Firebase App Hosting..."

echo "$FIREBASE_API_KEY" | firebase apphosting:secrets:set FIREBASE_API_KEY
echo "$FIREBASE_AUTH_DOMAIN" | firebase apphosting:secrets:set FIREBASE_AUTH_DOMAIN
echo "$FIREBASE_PROJECT_ID" | firebase apphosting:secrets:set FIREBASE_PROJECT_ID
echo "$FIREBASE_STORAGE_BUCKET" | firebase apphosting:secrets:set FIREBASE_STORAGE_BUCKET
echo "$FIREBASE_MESSAGING_SENDER_ID" | firebase apphosting:secrets:set FIREBASE_MESSAGING_SENDER_ID
echo "$FIREBASE_APP_ID" | firebase apphosting:secrets:set FIREBASE_APP_ID
echo "$FIREBASE_MEASUREMENT_ID" | firebase apphosting:secrets:set FIREBASE_MEASUREMENT_ID

echo "$POLYGON_PRIVATE_KEY" | firebase apphosting:secrets:set POLYGON_PRIVATE_KEY
echo "$POLYGON_WALLET_ADDRESS" | firebase apphosting:secrets:set POLYGON_WALLET_ADDRESS

echo ""
echo "✅ Todos los secretos configurados correctamente"
echo "🔐 Almacenados de forma segura en Cloud Secret Manager"
echo ""
echo "📋 Secretos configurados:"
echo "   - FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID"
echo "   - FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID"
echo "   - FIREBASE_APP_ID, FIREBASE_MEASUREMENT_ID"
echo "   - POLYGON_PRIVATE_KEY, POLYGON_WALLET_ADDRESS"
echo ""
echo "🚀 Deploy: firebase deploy --only apphosting"
