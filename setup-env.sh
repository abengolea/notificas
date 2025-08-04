#!/bin/bash

# Script para configurar variables de entorno de Firebase en Codespaces
# Firebase Environment Setup Script for Codespaces

echo "🔧 Configurando variables de entorno de Firebase..."

# Crear archivo .env.local con las credenciales de Firebase
cat > .env.local << 'EOF'
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCJmjAFcVQMNtTICexEHkzFwgUbGv2zctE
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=notificas-f9953.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=notificas-f9953
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=notificas-f9953.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=367222498482
NEXT_PUBLIC_FIREBASE_APP_ID=1:367222498482:web:770552748b0b7ab28ad5ab
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-8JGSBZ7BE8
EOF

echo "✅ Archivo .env.local creado exitosamente"
echo "📋 Variables de Firebase configuradas:"
echo "   - NEXT_PUBLIC_FIREBASE_API_KEY"
echo "   - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" 
echo "   - NEXT_PUBLIC_FIREBASE_PROJECT_ID"
echo "   - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
echo "   - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
echo "   - NEXT_PUBLIC_FIREBASE_APP_ID"
echo "   - NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID"
echo ""
echo "🚀 Puedes ejecutar 'npm run dev' para iniciar el servidor"
echo "💡 Recuerda: El archivo .env.local no se sube al repositorio por seguridad"