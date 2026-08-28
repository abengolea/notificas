# API pública v1 de Notificas

Infraestructura B2B para generar y consultar notificaciones digitales certificadas y trazables desde sistemas de terceros (CRM, ERP, cobranzas, estudios jurídicos, agentes).

La API **no duplica** la lógica de envío. Reutiliza `mail`, Cloud Function `sendEmail`, campañas, evidencia, PDFs, hashes y estados existentes.

Flujo:

```
Sistema del cliente → API Notificas → canal (WhatsApp / email)
  → evidencia (snapshot, constancia, Polygon) → webhook / GET → sistema del cliente
```

## Arquitectura

- Next.js 15 App Router, rutas en `/api/v1/*` (versionables: un futuro `/api/v2` no rompe v1).
- Autenticación por API Key de empresa (`organizations/{orgId}`).
- Tenant = organización. Toda consulta filtra por `orgId` de la clave. Un ID ajeno responde **404**, no 403, para no filtrar existencia.
- Envío individual: `createMailDocumentAdmin` + worker interno que llama `invokeSendEmail` (misma CF que el compose y las campañas).
- Lotes: crea una `campaigns` con `apiSource=public_api` y reutiliza fanout + Cloud Tasks + worker.
- Sandbox (`ntf_test_…`): no despacha a Meta/Resend salvo allowlist. Usa el flag `simulated` ya existente.
- Webhooks salientes: HMAC-SHA256, reintentos con backoff vía Cloud Tasks, mismo `event_id`.

Colecciones (solo Admin SDK; Firestore rules `allow read, write: if false`):

| Colección | Uso |
|-----------|-----|
| `api_keys` | metadatos + hash de la clave |
| `api_notifications` | índice público → `mailId` |
| `api_batches` | índice público → `campaignId` |
| `api_idempotency` | Idempotency-Key por org+ambiente |
| `api_audit_logs` | traza sin secretos |
| `api_rate_limits` | ventanas por API Key |
| `webhook_endpoints` | URLs + secret cifrado |
| `webhook_events` / `webhook_deliveries` | eventos y reintentos |

## Autenticación

Header:

```
Authorization: Bearer ntf_live_xxxxxxxx
```

o `ntf_test_xxxxxxxx` para sandbox.

**Nunca** se guarda la clave completa. Se persiste: `id`, `prefix` visible, `keyHash` (SHA-256 con pepper), `orgId`, scopes, ambiente, estado, fechas.

### Cómo generar una API Key

1. Panel admin: `/admin/api-keys` (sesión del panel).
2. Script:

```bash
npx tsx scripts/create-api-key.ts --orgId ORG_ID --name "CRM cobranzas" --env live
```

El secret se muestra **una sola vez**.

### Cómo revocarla

- Panel admin → Revocar.
- `DELETE /api/admin/api-keys?keyId=key_…&orgId=…`
- Script: `npx tsx scripts/create-api-key.ts --revoke key_… --orgId ORG_ID`

Una clave revocada responde `401` con `code: revoked_api_key`.

## Endpoints

Ver OpenAPI en `/openapi/v1.yaml` y UI en `/docs/api`. Widget/SDK para sitios: `/docs/api/embed` (`https://notificas.com.ar/sdk/v1/notificas.js`).

| Método | Endpoint | Función |
|--------|----------|---------|
| GET | `/api/v1/me` | Cuenta y ambiente de la clave |
| POST | `/api/v1/notifications` | Crear notificación |
| GET | `/api/v1/notifications` | Listar (cursor) |
| GET | `/api/v1/notifications/{id}` | Consultar |
| GET | `/api/v1/notifications/{id}/certificate` | Constancia de envío (URL firmada 15 min) |
| POST | `/api/v1/batches` | Envío masivo asíncrono |
| GET | `/api/v1/batches/{id}` | Estado del lote |
| POST | `/api/v1/webhook-endpoints` | Registrar webhook |
| GET | `/api/v1/webhook-endpoints` | Listar |
| GET/PATCH/DELETE | `/api/v1/webhook-endpoints/{id}` | Gestionar / desactivar |

Workers internos (secret `CAMPAIGN_WORKER_SECRET`, no públicos):

- `POST /api/internal/public-api/send`
- `POST /api/internal/public-api/webhook-deliver`

## Idempotency

Header `Idempotency-Key` (1–256 chars). Misma empresa + ambiente + key + mismo body → respuesta original. Mismo key + body distinto → `409 idempotency_key_reused`.

## Estados (capa de normalización)

No se inventan hechos. Mapeo sobre `mail.delivery`, `mail.transport`, tracking WhatsApp y `campaign_messages`:

| API | Significado técnico |
|-----|---------------------|
| queued | Documentada, pendiente de despacho |
| processing | Envío en curso |
| sent | El proveedor aceptó el envío (SMTP/Meta) |
| delivered | Meta `delivered` o transporte `delivered` |
| read | Meta `read`, confirmación de lectura o apertura del lector |
| failed | Error de envío, bounce o fallo Meta |

La constancia de envío **no** es certificado de lectura, firma digital, documento público ni carta documento.

## Sandbox

Claves `ntf_test_`. No generan comunicaciones reales salvo que el destinatario esté en:

- `organizations.apiSandboxAllowlist.phones` / `.emails`
- o env `PUBLIC_API_SANDBOX_ALLOWLIST_PHONES` / `PUBLIC_API_SANDBOX_ALLOWLIST_EMAILS`

Respuestas incluyen `test_mode: true`.

## Webhooks

Eventos: `notification.queued|sent|delivered|read|failed`, `notification.certificate_ready`, `batch.completed`.

Firma:

```
signed_payload = event_id + "." + timestamp + "." + rawBody
notificas-signature: v1=<HMAC_SHA256_hex(secret, signed_payload)>
```

Headers: `notificas-id`, `notificas-timestamp`, `notificas-signature`.

Rechazar si `|now - timestamp| > 300s` (replay). Los reintentos reenvían el **mismo** `id` de evento.

Backoff (segundos): 0, 60, 300, 1800, 7200, 21600, 86400. Se reintenta en timeout, red y HTTP 5xx/408/429.

SSRF: se bloquean localhost, IPs privadas, metadata cloud; HTTPS obligatorio en live/producción.

## Rate limits

Por API Key (no globales), ventana 60s, configurable:

| Bucket | Env | Default |
|--------|-----|---------|
| general | `PUBLIC_API_RATE_LIMIT_GENERAL` | 120 |
| notifications | `PUBLIC_API_RATE_LIMIT_NOTIFICATIONS` | 30 |
| batches | `PUBLIC_API_RATE_LIMIT_BATCHES` | 5 |

HTTP 429 + `Retry-After`.

## Trazabilidad / auditoría

Cada request tiene `X-Request-Id`. `api_audit_logs` guarda: apiKeyId, orgId, path, status, duración, notification/batch id. **Nunca** Authorization, secrets ni bodies crudos.

Cadena: `X-Request-Id` → `api_notifications.requestId` → `mail.requestId` → WAMID / Message-ID → evidencia.

## Variables de entorno

Ver `.env.example`. Nuevas (opcionales; hay fallback a secretos ya existentes):

- `PUBLIC_API_KEY_PEPPER`
- `PUBLIC_API_ENCRYPTION_KEY` (AES-GCM de `whsec_`)
- `PUBLIC_API_RATE_LIMIT_*`
- `PUBLIC_API_SANDBOX_ALLOWLIST_PHONES`
- `PUBLIC_API_SANDBOX_ALLOWLIST_EMAILS`

No hace falta agregar secretos nuevos a `apphosting.yaml` para el primer deploy. Si querés pepper/cifrado dedicados, creá los secretos en Secret Manager y referencialos después.

## Deploy

1. Merge a `main` (o la rama de App Hosting).
2. `firebase deploy --only firestore:indexes,firestore:rules`
3. App Hosting rebuild (el backend `notificas` ya apunta a este repo).
4. Generar una API Key de prueba desde `/admin/api-keys`.
5. Probar `GET https://notificas.com.ar/api/v1/me` y `GET https://notificas.com.ar/docs/api`.

Índices nuevos tardan en habilitarse; el listado puede fallar hasta que Firestore los construya.

## Insertar la API en una web (SDK)

Script público: `https://notificas.com.ar/sdk/v1/notificas.js`.

**No pongas `ntf_live_…` en el HTML.** El widget o el cliente JS deben usar `proxyUrl` hacia un backend tuyo que agregue `Authorization: Bearer`. Una clave `ntf_live_` en el navegador lanza error salvo `allowBrowserKey: true` (solo para pruebas internas).

Widget (copy-paste):

```html
<div
  data-notificas-embed
  data-proxy-url="/api/notificas"
  data-channel="whatsapp"
  data-template="notificacion_deuda_180_dias"
></div>
<script src="https://notificas.com.ar/sdk/v1/notificas.js" async></script>
```

Cliente:

```js
const client = Notificas.create({ proxyUrl: "/api/notificas" });
await client.sendCertifiedNotification({
  channel: "whatsapp",
  recipient: { name: "Ana Pérez", phone: "+5491112345678" },
  template: "notificacion_deuda_180_dias",
  variables: { nombre: "Ana Pérez", monto: "128400" },
});
```

El proxy reenvía `/api/notificas/*` → `https://notificas.com.ar/api/v1/*`. Ejemplos:

- `docs/examples/nextjs-proxy-route.ts`
- `docs/examples/express-proxy.js`
- `docs/examples/embed.html`

Demo sin API: `Notificas.embed("#el", { demo: true })` o `data-demo="true"`.

## Preparado para agentes / iPaaS

El contrato de `POST /notifications` es deliberadamente plano (`channel`, `recipient`, `template`, `variables`, `reference`, `metadata`) para un tool tipo `send_certified_notification` en Meta Business Agents, OpenAI, MCP, Zapier, Make o n8n. No hay adaptadores de esos vendors en este cambio.
