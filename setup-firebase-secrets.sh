#!/bin/bash

# Script para configurar secretos en Firebase App Hosting
# Setup Firebase App Hosting Secrets

echo "🔐 Configurando secretos de Firebase App Hosting..."

# Verificar que Firebase CLI esté instalado
if ! command -v firebase &> /dev/null; then
    echo "❌ Error: Firebase CLI no está instalado"
    echo "Instálalo con: npm install -g firebase-tools"
    exit 1
fi

# Verificar que estés autenticado
echo "🔑 Verificando autenticación de Firebase..."
if ! firebase projects:list &> /dev/null; then
    echo "🔐 No estás autenticado. Ejecutando firebase login..."
    firebase login
fi

# Configurar secretos uno por uno
echo "📝 Configurando secretos de Firebase..."

# API Key
echo "Configurando FIREBASE_API_KEY..."
echo "AIzaSyCJmjAFcVQMNtTICexEHkzFwgUbGv2zctE" | firebase apphosting:secrets:set FIREBASE_API_KEY

# Auth Domain  
echo "Configurando FIREBASE_AUTH_DOMAIN..."
echo "notificas-f9953.firebaseapp.com" | firebase apphosting:secrets:set FIREBASE_AUTH_DOMAIN

# Project ID
echo "Configurando FIREBASE_PROJECT_ID..."
echo "notificas-f9953" | firebase apphosting:secrets:set FIREBASE_PROJECT_ID

# Storage Bucket
echo "Configurando FIREBASE_STORAGE_BUCKET..."
echo "notificas-f9953.firebasestorage.app" | firebase apphosting:secrets:set FIREBASE_STORAGE_BUCKET

# Messaging Sender ID
echo "Configurando FIREBASE_MESSAGING_SENDER_ID..."
echo "367222498482" | firebase apphosting:secrets:set FIREBASE_MESSAGING_SENDER_ID

# App ID
echo "Configurando FIREBASE_APP_ID..."
echo "1:367222498482:web:770552748b0b7ab28ad5ab" | firebase apphosting:secrets:set FIREBASE_APP_ID

# Measurement ID
echo "Configurando FIREBASE_MEASUREMENT_ID..."
echo "G-8JGSBZ7BE8" | firebase apphosting:secrets:set FIREBASE_MEASUREMENT_ID

echo ""
echo "✅ Todos los secretos de Firebase han sido configurados"
echo "🔐 Los valores están almacenados de forma segura en Firebase"
echo "📋 Lista de secretos configurados:"
echo "   - FIREBASE_API_KEY"
echo "   - FIREBASE_AUTH_DOMAIN"
echo "   - FIREBASE_PROJECT_ID" 
echo "   - FIREBASE_STORAGE_BUCKET"
echo "   - FIREBASE_MESSAGING_SENDER_ID"
echo "   - FIREBASE_APP_ID"
echo "   - FIREBASE_MEASUREMENT_ID"
echo ""
echo "🚀 Ahora puedes hacer deploy con: firebase deploy --only hosting"
echo "💡 Para desarrollo local, sigue usando ./setup-env-from-apphosting.sh"