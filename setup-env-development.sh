#!/bin/bash

# Script para configurar variables de entorno SOLO para desarrollo local
# Development-only environment setup script
# ⚠️  NO USAR EN PRODUCCIÓN - Solo para desarrollo local y Codespaces

echo "🔧 Configurando variables de entorno para desarrollo local..."
echo "⚠️  ATENCIÓN: Este script contiene valores reales solo para desarrollo"

# Crear archivo .env.local con las credenciales reales para desarrollo
cat > .env.local << 'EOF'
# Firebase Configuration - SOLO PARA DESARROLLO LOCAL
# Valores reales extraídos para desarrollo - NO usar en producción
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCJmjAFcVQMNtTICexEHkzFwgUbGv2zctE
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=notificas-f9953.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=notificas-f9953
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=notificas-f9953.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=367222498482
NEXT_PUBLIC_FIREBASE_APP_ID=1:367222498482:web:770552748b0b7ab28ad5ab
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-8JGSBZ7BE8

# Polygon Mainnet - Red real con POL
# Chain ID: 137 | Currency: POL | Explorer: https://polygonscan.com
# Obtén POL en Binance u otros exchanges
POLYGON_PRIVATE_KEY="tu_clave_privada_sin_0x"
POLYGON_PROVIDER_URL="https://polygon-bor-rpc.publicnode.com"
POLYGON_WALLET_ADDRESS="0xTU_DIRECCION_DESTINO"
EOF

echo "✅ Archivo .env.local creado para desarrollo local"
echo "📋 Variables de Firebase configuradas:"
echo "   - NEXT_PUBLIC_FIREBASE_API_KEY"
echo "   - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" 
echo "   - NEXT_PUBLIC_FIREBASE_PROJECT_ID"
echo "   - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
echo "   - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
echo "   - NEXT_PUBLIC_FIREBASE_APP_ID"
echo "   - NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID"
echo ""
echo "🔗 Variables de Polygon Mainnet agregadas:"
echo "   - POLYGON_PRIVATE_KEY (⚠️  CONFIGURAR)"
echo "   - POLYGON_PROVIDER_URL (Polygon Mainnet)"
echo "   - POLYGON_WALLET_ADDRESS (⚠️  CONFIGURAR)"
echo ""
echo "⚠️  IMPORTANTE: Configura tus claves de Polygon Mainnet antes de usar blockchain:"
echo "   1. Edita .env.local con tu clave privada"
echo "   2. Agrega tu dirección de wallet"
echo "   3. Obtén POL (ej. desde Binance) y retira a tu wallet"
echo "   4. Verifica transacciones en: https://polygonscan.com"
echo ""
echo "🚀 Puedes ejecutar 'npm run dev' para iniciar el servidor"
echo "🔗 Prueba Polygon Mainnet en: http://localhost:9003/test-polygon"
echo "🔐 En producción, Firebase App Hosting usa secretos seguros"
echo "💡 El archivo .env.local no se sube al repositorio (.gitignore)"