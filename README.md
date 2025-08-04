# Notificas - Comunicaciones Certificadas con Blockchain

Sistema de mensajería certificada que utiliza tecnología blockchain para garantizar la autenticidad e inmutabilidad de las comunicaciones.

## 🚀 Configuración del Proyecto

### Para GitHub Codespaces (Recomendado)

Si estás trabajando en **GitHub Codespaces**, usa el nuevo método que sincroniza con `apphosting.yaml`:

```bash
./setup-env-from-apphosting.sh
npm install
npm run dev
```

### Método Alternativo (Script tradicional)

```bash
./setup-env.sh
npm install
npm run dev
```

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

3. Configura las variables de entorno (elige uno):

**Opción A - Desde apphosting.yaml (Recomendado):**
```bash
./setup-env-from-apphosting.sh
```

**Opción B - Manual:**
```bash
cp .env.example .env.local
# Edita .env.local con tus credenciales
```

4. Inicia el servidor de desarrollo:
```bash
npm run dev
```

## 🔧 Configuración de Variables de Entorno

### Firebase App Hosting (`apphosting.yaml`)

Las variables de entorno están centralizadas en `apphosting.yaml` para:
- ✅ **Consistencia** entre desarrollo y producción
- ✅ **Single source of truth** para configuración
- ✅ **Despliegue automático** en Firebase App Hosting

### Variables Requeridas

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

## 🌐 Tecnologías

- **Next.js 15** - Framework React con App Router
- **Firebase App Hosting** - Deploy y configuración
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
```

## 🚀 Despliegue

### Firebase App Hosting

El proyecto está configurado para desplegarse automáticamente en Firebase App Hosting:

```bash
firebase deploy --only hosting
```

Las variables de entorno se configuran automáticamente desde `apphosting.yaml`.

## 🔐 Seguridad

- Las credenciales están en `apphosting.yaml` para producción
- El archivo `.env.local` se genera automáticamente para desarrollo
- Archivos `.env*` están en `.gitignore` por seguridad
- Variables públicas (`NEXT_PUBLIC_*`) son seguras para el cliente
