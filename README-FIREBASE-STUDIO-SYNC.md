# 🔄 Firebase Studio Auto-Sync

**Sincronización automática GitHub → Firebase Studio local**

Cada vez que hagas `git push` a GitHub, tu Firebase Studio se actualizará automáticamente.

## 🚀 Cómo Usar

### **Opción 1: Automático + Servidor de desarrollo**
```bash
npm run firebase-studio-start
```
- ✅ Inicia tu app en desarrollo (puerto 9002)
- ✅ Inicia el webhook server (puerto 3001)
- ✅ Sincronización automática activa

### **Opción 2: Solo sincronización**
```bash
npm run firebase-studio-sync
```
- ✅ Solo el webhook server
- ✅ Para usar con servidor externo

### **Opción 3: Sincronización manual**
```bash
npm run sync-manual
```
- ✅ Pull manual desde GitHub
- ✅ Instala dependencias si es necesario

## 📋 Verificar Estado

```bash
# Ver si el sync está funcionando
npm run sync-status

# O directamente:
curl http://localhost:3001/status
```

## 🔧 Cómo Funciona

1. **Haces push a GitHub** → GitHub Action se activa
2. **GitHub Action** → Deploya a Firebase Hosting
3. **GitHub Action** → Envía webhook a tu Firebase Studio (localhost:3001)
4. **Firebase Studio** → Recibe webhook y ejecuta:
   - `git pull origin main`
   - `npm install` (si package.json cambió)
   - Reinicia servidor de desarrollo

## ⚙️ Configuración Automática

El sistema ya está 100% configurado:

- ✅ **Script de sync**: `scripts/sync-from-github.js`
- ✅ **GitHub Workflow**: `.github/workflows/firebase-deploy.yml`
- ✅ **Scripts npm**: En `package.json`
- ✅ **Dependencias**: `concurrently` instalado

## 🌐 Endpoints Disponibles

```bash
# Webhook (recibe notificaciones de GitHub)
POST http://localhost:3001/webhook

# Status del servicio
GET http://localhost:3001/status
```

## 🔄 Flujo Completo

```
┌─────────────────┐    git push     ┌─────────────────┐
│   TU CÓDIGO     │ ──────────────> │     GITHUB      │
│   (local)       │                 │   (repository)  │
└─────────────────┘                 └─────────────────┘
                                             │
                                             │ GitHub Action
                                             ▼
                                    ┌─────────────────┐
                                    │ FIREBASE HOSTING│
                                    │   (deployed)    │
                                    └─────────────────┘
                                             │
                                             │ webhook
                                             ▼
┌─────────────────┐   auto-sync    ┌─────────────────┐
│ FIREBASE STUDIO │ <────────────── │   WEBHOOK       │
│   (localhost)   │                 │ (localhost:3001)│
└─────────────────┘                 └─────────────────┘
```

## 🛟 Solución de Problemas

### **El webhook no funciona:**
```bash
# Verificar que el servidor esté corriendo
npm run sync-status

# Si no responde, reiniciar:
npm run firebase-studio-sync
```

### **Errores de Git:**
```bash
# Verificar repositorio
git status
git remote -v

# Sincronización manual
npm run sync-manual
```

### **Puerto 3001 ocupado:**
```bash
# Ver qué proceso está usando el puerto
lsof -i :3001

# Matar proceso si es necesario
pkill -f "sync-from-github"
```

## 🎯 Comandos Rápidos

```bash
# Iniciar todo (desarrollo + sync)
npm run firebase-studio-start

# Ver logs del servidor de desarrollo
tail -f firebase-studio-dev.log

# Probar webhook manualmente
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -d '{"repository":"test","branch":"main","commit":"abc123"}'
```

## ✅ Verificación de Funcionamiento

1. **Iniciar el servicio:**
   ```bash
   npm run firebase-studio-start
   ```

2. **Hacer un cambio en tu código**

3. **Push a GitHub:**
   ```bash
   git add .
   git commit -m "Test auto-sync"
   git push origin main
   ```

4. **Verificar en Firebase Studio:**
   - Los cambios aparecen automáticamente
   - El servidor se reinicia si es necesario
   - No necesitas hacer nada manualmente

¡Tu Firebase Studio ahora se sincroniza automáticamente con cada push! 🎉