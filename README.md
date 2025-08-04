# Notificas - Comunicaciones Certificadas con Blockchain

Sistema de mensajería certificada que utiliza tecnología blockchain para garantizar la autenticidad e inmutabilidad de las comunicaciones.

## 🚀 Configuración del Proyecto

### Para GitHub Codespaces

Si estás trabajando en **GitHub Codespaces**, ejecuta este comando para configurar automáticamente las variables de entorno de Firebase:

```bash
./setup-env.sh
```

Luego inicia el servidor de desarrollo:

```bash
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

3. Configura las variables de entorno:
```bash
cp .env.example .env.local
```

4. Edita el archivo `.env.local` con tus credenciales de Firebase.

5. Inicia el servidor de desarrollo:
```bash
npm run dev
```

## 🔧 Variables de Entorno Requeridas

El proyecto requiere las siguientes variables de Firebase:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

## 🌐 Tecnologías

- **Next.js 15** - Framework React con App Router
- **Firebase** - Autenticación y base de datos
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

## 🔐 Seguridad

- Las credenciales de Firebase se mantienen en `.env.local`
- El archivo `.env.local` está incluido en `.gitignore` por seguridad
- Usa el script `setup-env.sh` solo en entornos de desarrollo
