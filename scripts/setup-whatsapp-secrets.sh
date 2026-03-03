#!/bin/bash

# Configurar secrets de WhatsApp para Cloud Functions (Secret Manager)
# Ejecutar desde la raíz del proyecto: ./scripts/setup-whatsapp-secrets.sh

echo "🔐 Configurando secrets de WhatsApp para Cloud Functions..."

if ! command -v firebase &> /dev/null; then
    echo "❌ Error: Firebase CLI no está instalado"
    echo "Instálalo con: npm install -g firebase-tools"
    exit 1
fi

echo "🔑 Verificando autenticación..."
if ! firebase projects:list &> /dev/null; then
    echo "Ejecutando firebase login..."
    firebase login
fi

echo ""
echo "Configura WHATSAPP_ACCESS_TOKEN (token de Meta Cloud API):"
firebase functions:secrets:set WHATSAPP_ACCESS_TOKEN

echo ""
echo "Configura WHATSAPP_PHONE_NUMBER_ID (Phone Number ID de tu app en Meta):"
firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID

echo ""
echo "⚠️  IMPORTANTE: Meta exige TEMPLATES. Las variables NO pueden ir al inicio ni al final."
echo "   Ejemplo válido: 'Hola {{1}}, tienes notificación de {{2}}. Ver: {{3}}. Saludos.'"
echo "   Luego configura: firebase functions:config:set whatsapp.template_name=\"TU_TEMPLATE\""
echo "   O en .env de functions: WHATSAPP_TEMPLATE_NAME=TU_TEMPLATE"

echo ""
echo "✅ Secrets configurados en Secret Manager"
echo "📋 Desplegar funciones: firebase deploy --only functions:sendEmail"
