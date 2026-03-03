# Guía de Seguridad - Notificas

## 🚨 Reglas Críticas

### NUNCA hagas esto
- ❌ Hardcodear `POLYGON_PRIVATE_KEY` en ningún archivo
- ❌ Commitear `.env`, `.env.local` o archivos con credenciales
- ❌ Subir `apphosting.yaml` con valores reales en lugar de `${{ secrets.* }}`
- ❌ Compartir claves privadas por chat, email o medios inseguros
- ❌ Usar la misma clave en desarrollo y producción

### SIEMPRE haz esto
- ✅ Usar `./setup-firebase-secrets.sh` para producción (lee de `.env.local`)
- ✅ Mantener `.env.local` en `.gitignore`
- ✅ Rotar `POLYGON_PRIVATE_KEY` si crees que pudo filtrarse
- ✅ Usar wallet dedicada para la app (no tu wallet personal principal)

---

## 📁 Archivos Sensibles

| Archivo | ¿En Git? | Contenido |
|---------|-----------|-----------|
| `.env.local` | ❌ No | Todas las credenciales locales |
| `.env` | ❌ No | Variables de entorno |
| `apphosting.yaml` | ✅ Sí | Solo referencias `${{ secrets.X }}` |
| `setup-firebase-secrets.sh` | ✅ Sí | Sin credenciales, lee de .env.local |

---

## 🔐 Flujo de Producción

1. **Desarrollo:** Configura `.env.local` con tus credenciales (nunca se sube)
2. **Primer deploy:** Ejecuta `./setup-firebase-secrets.sh` (lee de `.env.local`, sube a Cloud Secret Manager)
3. **Deploy:** `firebase deploy --only apphosting`
4. **Rotación:** Si rotas una clave, vuelve a ejecutar `setup-firebase-secrets.sh`

---

## ⚠️ Si una clave se filtra

1. **POLYGON_PRIVATE_KEY:** Genera nueva wallet, mueve fondos, actualiza en `.env.local` y en Firebase secrets
2. **Firebase:** Rota credenciales en Firebase Console
3. **Revisa logs:** Busca accesos no autorizados

---

## 📋 Checklist Pre-Deploy

- [ ] `apphosting.yaml` no contiene claves en texto plano
- [ ] `.env.local` existe y tiene todas las variables
- [ ] Ejecutaste `./setup-firebase-secrets.sh` al menos una vez
- [ ] La wallet de Polygon tiene solo el mínimo de POL necesario
