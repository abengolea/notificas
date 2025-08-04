# Notificas - Comunicaciones Certificadas con Blockchain

Sistema de mensajería certificada que utiliza tecnología blockchain para garantizar la autenticidad e inmutabilidad de las comunicaciones.

## 🚀 Configuración del Proyecto

### Para GitHub Codespaces (Desarrollo)

Si estás trabajando en **GitHub Codespaces**, usa el script todo-en-uno:

```bash
./start-dev-clean.sh
```

**Solución de problemas rápida:**
Si tienes errores de variables de Firebase, este script:
- ✅ Configura `.env.local` automáticamente  
- ✅ Exporta variables al entorno
- ✅ Limpia cachés de Next.js
- ✅ Reinicia el servidor limpio

### Para Desarrollo Local

1. Clona el repositorio:
```bash
git clone https://github.com/abengolea/notificas.git
cd notificas
```

2. Instala las dependencias:
```bash
npm install
```

3. Configura las variables de entorno para desarrollo:
```bash
./setup-env-development.sh
```

4. Inicia el servidor de desarrollo:
```bash
npm run dev
```

## 🔐 Configuración de Seguridad

### 🏭 Producción - Firebase App Hosting

Para **producción**, las credenciales se almacenan como **secretos seguros** en Firebase:

```bash
# Solo necesario una vez por proyecto
./setup-firebase-secrets.sh
```

El archivo `apphosting.yaml` usa referencias seguras:
```yaml
env:
  NEXT_PUBLIC_FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: ${{ secrets.FIREBASE_AUTH_DOMAIN }}
  # ... más secretos
```

### 🛠️ Desarrollo - Variables Locales

Para **desarrollo local**, usa valores reales en `.env.local`:
- ✅ Archivo ignorado por Git (`.gitignore`)
- ✅ Solo para entorno de desarrollo
- ✅ Generado automáticamente por scripts

## 🔧 Variables de Entorno

### Secretos de Producción (Firebase)
- `FIREBASE_API_KEY` - Secreto seguro
- `FIREBASE_AUTH_DOMAIN` - Secreto seguro  
- `FIREBASE_PROJECT_ID` - Secreto seguro
- `FIREBASE_STORAGE_BUCKET` - Secreto seguro
- `FIREBASE_MESSAGING_SENDER_ID` - Secreto seguro
- `FIREBASE_APP_ID` - Secreto seguro
- `FIREBASE_MEASUREMENT_ID` - Secreto seguro

### Variables de Desarrollo (.env.local)
- `NEXT_PUBLIC_FIREBASE_API_KEY` - Valor real para desarrollo
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` - Valor real para desarrollo
- ... (generadas automáticamente)

## 🌐 Tecnologías

- **Next.js 15** - Framework React con App Router
- **Firebase App Hosting** - Deploy seguro con secretos
- **Firebase Auth & Firestore** - Autenticación y base de datos
- **Tailwind CSS** - Estilos y componentes UI
- **TypeScript** - Tipado estático
- **Blockchain** - Certificación inmutable de comunicaciones

## 📝 Estructura del Proyecto

```
src/
├── app/                 # Páginas (App Router)
├── components/          # Componentes reutilizables  
├── hooks/              # Custom hooks
├── lib/                # Configuraciones y utilidades
└── ai/                 # Integración con IA

Scripts/
├── setup-env-development.sh      # Desarrollo local/Codespaces
├── setup-firebase-secrets.sh     # Configurar secretos producción
└── setup-env-from-apphosting.sh  # Script legacy (deprecated)
```

## 🚀 Despliegue

### Firebase App Hosting (Recomendado)

1. **Configurar secretos** (solo una vez):
```bash
./setup-firebase-secrets.sh
```

2. **Deploy**:
```bash
firebase deploy --only apphosting
```

### Deploy Tradicional
```bash
npm run build
firebase deploy --only hosting
```

## 🔐 Seguridad - Mejores Prácticas

### ✅ Producción
- **Secretos en Firebase** - Nunca hardcodeados
- **Variables con referencias** - `${{ secrets.NAME }}`
- **Auditoría de acceso** - Firebase console

### ✅ Desarrollo  
- **Archivos `.env*` en `.gitignore`** - No se suben al repo
- **Scripts locales únicamente** - Solo para desarrollo
- **Separación clara** - Desarrollo ≠ Producción

### ❌ Nunca Hagas
- ❌ Hardcodear credenciales en código
- ❌ Subir archivos `.env*` al repositorio
- ❌ Usar credenciales de producción en desarrollo
- ❌ Compartir secretos por medios inseguros

## 🔧 Troubleshooting

### Error: Variables de Firebase faltantes
```bash
# Para desarrollo
./setup-env-development.sh

# Para producción  
./setup-firebase-secrets.sh
```

### Error: Firebase CLI no autenticado
```bash
firebase login
firebase projects:list
```
