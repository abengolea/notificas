# Notificas LinkedIn Assistant — Extensión Chrome

Extensión Manifest V3 que conecta el CRM LinkedIn de Notificas con linkedin.com para **preparar** invitaciones y mensajes. **Nunca envía automáticamente.**

## Instalación (Load unpacked)

1. Generá un token en el servidor Notificas:
   ```bash
   openssl rand -hex 32
   ```
2. Agregá a `.env.local`:
   ```
   LINKEDIN_ASSISTANT_TOKEN=el_token_generado
   LINKEDIN_ASSISTANT_CONNECTION_REVIEW_DAYS=4
   ```
3. Iniciá Notificas: `npm run dev` (puerto 9006 por defecto).
4. En Chrome: `chrome://extensions` → **Modo desarrollador** → **Cargar descomprimida**.
5. Seleccioná la carpeta `chrome-extension/` de este repo.
6. Abrí **Opciones** de la extensión:
   - **URL API:** `http://localhost:9006`
   - **Token:** el valor de `LINKEDIN_ASSISTANT_TOKEN`

## Flujo diario

1. Abrí la extensión → ves el próximo prospecto.
2. **ABRIR PERFIL Y PREPARAR** → abre LinkedIn, Conectar/Mensaje, inserta texto.
3. Revisá y hacé click manual en **Enviar** en LinkedIn.
4. **CONFIRMAR QUE LO ENVIÉ** → registra en el CRM.
5. **SIGUIENTE** → continúa con el siguiente prospecto.

## Seguridad

El módulo `lib/safety.js` define `FORBIDDEN_AUTO_ACTIONS` y bloquea clicks en botones de envío final. No existe código que haga click en Send/Enviar.

## Permisos

- `storage`, `tabs`, `activeTab`, `clipboardWrite`
- Host: `linkedin.com`, URL de Notificas configurada

## Tests

Desde la raíz del proyecto:

```bash
node --test chrome-extension/tests/extension.test.js
```
