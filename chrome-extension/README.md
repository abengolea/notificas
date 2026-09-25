# Notificas LinkedIn Assistant — Extensión Chrome

Extensión Manifest V3 que conecta el CRM LinkedIn de Notificas con linkedin.com para **preparar** invitaciones y mensajes. **Nunca envía automáticamente.**

La build de producción habla **solo** con `https://notificas.com.ar`. No usa localhost, tokens pegados a mano ni el MCP de ChatGPT.

## Instalación / reinstalación (producción)

1. En la raíz del repo: `npm run extension:build`
2. Chrome → `chrome://extensions` → **Modo desarrollador**
3. Si ya estaba cargada, **Quitar** la extensión anterior
4. **Cargar descomprimida** → carpeta `chrome-extension/`
5. Abrí el popup → iniciá sesión con el email/contraseña del panel admin de Notificas
6. Confirmá que diga **Entorno: Producción**

## Flujo diario

1. Abrí la extensión → ves el próximo prospecto.
2. **ABRIR PERFIL Y PREPARAR** → abre LinkedIn, Conectar/Mensaje, inserta texto.
3. Revisá y hacé click manual en **Enviar** en LinkedIn.
4. **CONFIRMAR QUE LO ENVIÉ** → registra en el CRM.
5. También podés registrar: conectado, respondió, interesado, no interesado.
6. **SIGUIENTE** → continúa con el siguiente prospecto.

Si la sesión vence: **Sesión vencida** → **Volver a iniciar sesión**.

## Desarrollo local

```bash
npm run extension:dev
npm run dev
```

La build de desarrollo puede usar `http://localhost:9006`. Volvé a `npm run extension:build` antes de instalar en un Chrome de trabajo.

## Autenticación

- Login: `POST /api/linkedin-assistant/auth/login`
- Access token: 30 minutos, audience `linkedin-assistant`, issuer `notificas`
- Refresh token: 14 días
- La extensión renueva sola y reintenta una vez
- Los secretos de firma quedan en el servidor (`ADMIN_SESSION_SECRET`)

## Seguridad

El módulo `lib/safety.js` define `FORBIDDEN_AUTO_ACTIONS` y bloquea clicks en botones de envío final. No existe código que haga click en Send/Enviar.

No hay API keys, service accounts ni secretos de firma dentro de la extensión.

## Tests

```bash
node --test chrome-extension/tests/extension.test.js
```
