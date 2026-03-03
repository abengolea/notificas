@echo off
echo ========================================
echo 🧹 LIMPIANDO PROCESOS NODE.JS...
echo ========================================
taskkill /F /IM node.exe 2>nul
echo ✅ Procesos Node.js terminados
echo.
echo ⏳ Esperando 3 segundos para limpieza completa...
timeout /t 3 /nobreak >nul
echo.
echo 🚀 INICIANDO SERVIDOR LIMPIO...
echo ========================================
npm run dev
