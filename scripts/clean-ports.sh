#!/bin/bash

echo "🧹 Limpiando puertos ocupados en Firebase Studio..."

# Matar procesos de Next.js
echo "🔪 Matando procesos de Next.js..."
pkill -9 -f "next dev" 2>/dev/null || echo "No hay procesos Next.js corriendo"

# Matar procesos en puertos específicos
echo "🔌 Liberando puertos 9002, 9003..."
pkill -9 -f "node.*9002" 2>/dev/null || echo "Puerto 9002 libre"
pkill -9 -f "node.*9003" 2>/dev/null || echo "Puerto 9003 libre"

# Esperar un momento
sleep 2

# Verificar que estén libres
echo "✅ Verificando puertos..."
if ps aux | grep -E "(9002|9003)" | grep -v grep; then
    echo "⚠️ Algunos procesos aún corriendo"
else
    echo "✅ Todos los puertos liberados"
fi

echo "🚀 ¡Listo! Puedes iniciar tu servidor ahora."