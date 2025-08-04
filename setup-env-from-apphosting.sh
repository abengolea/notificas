#!/bin/bash

# Script para extraer variables de entorno de apphosting.yaml y crear .env.local
# Extract environment variables from apphosting.yaml and create .env.local

echo "🔧 Extrayendo variables de entorno de apphosting.yaml..."

# Verificar si existe apphosting.yaml
if [ ! -f "apphosting.yaml" ]; then
    echo "❌ Error: No se encontró apphosting.yaml"
    exit 1
fi

# Crear archivo .env.local desde apphosting.yaml
echo "# Firebase Configuration - Extraído de apphosting.yaml" > .env.local

# Extraer variables usando yq o sed
if command -v yq &> /dev/null; then
    # Si yq está disponible, úsalo
    yq e '.runConfig.env | to_entries | .[] | .key + "=" + .value' apphosting.yaml >> .env.local
else
    # Método alternativo usando sed y awk
    grep -A 20 "env:" apphosting.yaml | \
    grep "NEXT_PUBLIC" | \
    sed 's/^[[:space:]]*//' | \
    sed 's/: "/=/' | \
    sed 's/"$//' >> .env.local
fi

echo "✅ Archivo .env.local creado desde apphosting.yaml"
echo "📋 Variables configuradas:"
cat .env.local

echo ""
echo "🚀 Ahora puedes ejecutar 'npm run dev'"
echo "💡 Las variables están sincronizadas con apphosting.yaml"