#!/bin/bash

# Script definitivo para iniciar desarrollo con variables de entorno
# Comprehensive development startup script with environment variables

echo "🚀 INICIANDO DESARROLLO CON CONFIGURACIÓN LIMPIA"
echo "=================================================="

# 1. Configurar variables de entorno
echo "1️⃣ Configurando variables de entorno..."
if [ ! -f ".env.local" ]; then
    echo "📝 Creando .env.local..."
    ./setup-env-development.sh
else
    echo "✅ .env.local ya existe"
fi

# 2. Exportar variables al entorno actual
echo "2️⃣ Exportando variables al entorno..."
export $(cat .env.local | grep -v '^#' | xargs)
echo "✅ Variables exportadas: $(cat .env.local | grep -c NEXT_PUBLIC) variables"

# 3. Matar procesos existentes
echo "3️⃣ Deteniendo procesos Next.js existentes..."
pkill -f "next dev" 2>/dev/null || true
sleep 2

# 4. Limpiar cachés
echo "4️⃣ Limpiando cachés..."
rm -rf .next
rm -rf node_modules/.cache 2>/dev/null || true
echo "✅ Cachés limpiados"

# 5. Verificar dependencias
echo "5️⃣ Verificando dependencias..."
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
else
    echo "✅ Dependencias presentes"
fi

# 6. Iniciar servidor
echo "6️⃣ Iniciando servidor de desarrollo..."
echo "🌐 La aplicación estará disponible en:"
echo "   - Local:   http://localhost:9003"
echo "   - Network: http://10.0.4.53:9003 (Codespaces)"
echo ""
echo "🔥 Iniciando con Turbopack..."

npm run dev