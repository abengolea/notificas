# MCP de Notificas

Capa **Remote MCP** (Model Context Protocol) sobre la API y los servicios internos existentes. No reimplementa créditos, envíos, evidencia ni campañas. ChatGPT, Claude y otros clientes MCP hablan con Notificas; Notificas sigue hablando con Meta, Resend, Firebase y Polygon.

## 1. Arquitectura

```
ChatGPT / Claude / cliente MCP
        │  OAuth 2.1 + PKCE
        ▼
POST https://notificas.com.ar/mcp   (Streamable HTTP, JSON-RPC)
        │  identidad, scopes, tenant, rate limit, auditoría
        ▼
Servicios internos / API pública v1
        │
        ▼
WhatsApp Meta · Resend · Firestore · evidencia · constancias
```

El MCP **no** llama a Meta ni a Resend. Un envío MCP usa `createPublicNotification` (mismo `mail`, worker, créditos y constancia que la API y la web), con `apiSource: "mcp"`.

Feature flag: si `MCP_ENABLED` no es `true`, `POST /mcp` responde 503 y los `.well-known` de OAuth responden 404. El healthcheck sigue público.

## 2. Endpoint

| Método | URL | Uso |
|--------|-----|-----|
| `POST` | `/mcp` | Streamable HTTP (JSON-RPC). Requiere `Authorization: Bearer` OAuth. |
| `GET` | `/mcp` | 405 (esta versión no abre SSE). |
| `DELETE` | `/mcp` | Cierra sesión de transporte (204). |
| `GET` | `/mcp/health` | Health público, sin secretos. |
| `GET` | `/.well-known/oauth-protected-resource` | RFC 9728 |
| `GET` | `/.well-known/oauth-protected-resource/mcp` | RFC 9728 (path del recurso) |
| `GET` | `/.well-known/oauth-authorization-server` | RFC 8414 |
| `POST` | `/oauth/register` | Dynamic Client Registration (RFC 7591) |
| `GET` | `/oauth/authorize` | Consentimiento (login Firebase) |
| `POST` | `/oauth/consent` | Emite authorization code |
| `POST` | `/oauth/token` | Authorization code + refresh (PKCE S256) |
| `POST` | `/oauth/revoke` | Revocación |

URL de producción prevista: `https://notificas.com.ar/mcp`.

## 3. Autenticación

No se entregan API Keys `ntf_live_` / `ntf_test_` a ChatGPT ni Claude. El endpoint MCP las rechaza.

Flujo:

1. El cliente descubre el resource server (`/.well-known/oauth-protected-resource`).
2. Descubre el authorization server (`/.well-known/oauth-authorization-server`).
3. Se registra (DCR) si hace falta.
4. Abre `/oauth/authorize` (PKCE S256 obligatorio).
5. El usuario inicia sesión con **Firebase Auth** (misma cuenta que la web).
6. Elige la **empresa** (tenant). El `orgId` lo confirma el backend con `getOrgIfMember`; no se confía en IDs enviados por el modelo.
7. Autoriza scopes. Notificas emite un authorization code de un solo uso.
8. El cliente canjea code + `code_verifier` por access token + refresh token.
9. `POST /mcp` lleva `Authorization: Bearer ntf_atk_…`.

Tokens opacos, hasheados en Firestore. Nunca se guardan tokens OAuth en auditoría. Access ~1 h, refresh ~30 días (configurable). Audience / `resource` = `{MCP_BASE_URL}/mcp` (RFC 8707).

La allowlist `MCP_ALLOWED_USERS` (uid o email) aplica **después** del login: se puede probar con una cuenta antes de abrir el MCP.

## 4. Scopes

| Scope | Permite |
|-------|---------|
| `account:read` | `get_account`, `get_balance` |
| `notifications:read` | `get_notification`, `get_delivery_status` |
| `notifications:prepare` | `estimate_notification`, `prepare_whatsapp`, `prepare_email` |
| `notifications:send` | `send_whatsapp`, `send_email` |
| `campaigns:read` | `get_campaign_status` |
| `campaigns:create` | `create_campaign_draft` (no envía) |
| `certificates:read` | `get_certificate`, `verify_notification` |

No hay un scope `*`. Un token sin `notifications:send` no puede enviar.

## 5. Tools

| Tool | Read/Write | Consume créditos | Side effect |
|------|------------|------------------|-------------|
| `get_account` | Read | No | No |
| `get_balance` | Read | No | No |
| `estimate_notification` | Prepare | No | No |
| `prepare_whatsapp` | Prepare | No | No |
| `prepare_email` | Prepare | No | No |
| `create_campaign_draft` | Prepare | No | No (solo borrador) |
| `get_notification` | Read | No | No |
| `get_delivery_status` | Read | No | No |
| `get_campaign_status` | Read | No | No |
| `get_certificate` | Read | No | No |
| `verify_notification` | Read | No | No |
| `send_whatsapp` | Write | Sí | Sí (Meta vía worker interno) |
| `send_email` | Write | Sí | Sí (Resend vía worker interno) |

**No existen** `send_campaign`, `send_bulk`, `send_to_all` ni equivalentes. Un intento responde `FEATURE_NOT_AVAILABLE`.

Anotaciones MCP: read/prepare → `readOnlyHint: true`. Write → `readOnlyHint: false`, `openWorldHint: true`, `idempotentHint: true`.

## 6. Ejemplos

Health:

```bash
curl -s https://notificas.com.ar/mcp/health
```

Initialize (con access token):

```bash
curl -s https://notificas.com.ar/mcp \
  -H "Authorization: Bearer ntf_atk_…" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

`tools/call` de lectura:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": { "name": "get_balance", "arguments": {} }
}
```

Envío (máximo 1 destinatario):

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "send_whatsapp",
    "arguments": {
      "recipientPhone": "+5491112345678",
      "templateName": "notificacion_deuda_180_dias",
      "variables": { "nombre": "Ana Pérez", "monto": "128400" },
      "idempotencyKey": "cobranza-ana-2026-08-28"
    }
  }
}
```

## 7. Errores

Las tools devuelven `isError: true` y un cuerpo:

```json
{ "error": { "code": "INSUFFICIENT_CREDITS", "message": "…", "request_id": "req_…" } }
```

Códigos: `UNAUTHORIZED`, `FORBIDDEN`, `INSUFFICIENT_SCOPE`, `INSUFFICIENT_CREDITS`, `INVALID_RECIPIENT`, `INVALID_TEMPLATE`, `MISSING_TEMPLATE_VARIABLE`, `NOTIFICATION_NOT_FOUND`, `CAMPAIGN_NOT_FOUND`, `RATE_LIMITED`, `DUPLICATE_REQUEST`, `VALIDATION_ERROR`, `FEATURE_NOT_AVAILABLE`, `PROVIDER_ERROR`, `MCP_DISABLED`. Sin stack traces.

Un `notificationId` o `campaignId` de otro tenant responde **not found**, no 403.

## 8. Seguridad

- Identidad OAuth + Firebase Auth. Tenant derivado de la membresía, no del prompt.
- Allowlist de usuarios además del feature flag.
- Datos de destinatarios, CSV y templates se tratan como no confiables; no alteran autorización.
- Secretos de Meta, Resend, Firebase Admin y Polygon nunca salen por MCP.
- Constancias: URL firmada ~15 minutos. No se exponen paths de Storage.
- Prompt injection: las decisions de saldo, tenant y envío están en backend.

## 9. Rate limiting

Ventana 60 s, por usuario y por tenant, independiente de Cloud Run:

| Bucket | Usuario (default) | Tenant (default) |
|--------|-------------------|------------------|
| read | 60 | 120 |
| prepare | 20 | 40 |
| write | 5 | 10 |

Variables: `MCP_RATE_LIMIT_*`. Write es deliberadamente más bajo.

## 10. Idempotencia

`send_whatsapp` y `send_email` exigen `idempotencyKey`. Se reutiliza `api_idempotency` con ambiente `mcp`, TTL 24 h, misma huella de cuerpo. Reintentos de ChatGPT/Claude con la misma clave no duplican el envío (`DUPLICATE_REQUEST` si el cuerpo cambia).

## 11. Cómo probar localmente

1. En `.env.local`:

```
MCP_ENABLED=true
MCP_ALLOW_ALL=true
MCP_BASE_URL=http://localhost:9006
```

En lugar de `MCP_ALLOW_ALL`, preferí `MCP_ALLOWED_USERS=tu_uid,tu@email.com`.

2. `npm run dev` (puerto 9006).
3. `curl http://localhost:9006/mcp/health`
4. Registrar un cliente:

```bash
curl -s http://localhost:9006/oauth/register \
  -H "Content-Type: application/json" \
  -d "{\"client_name\":\"local-test\",\"redirect_uris\":[\"http://localhost:9006/dev/oauth-callback\"]}"
```

5. Abrir `/oauth/authorize?client_id=…&redirect_uri=…&response_type=code&code_challenge=…&code_challenge_method=S256&scope=account:read%20notifications:read`.
6. Iniciar sesión, autorizar, canjear el code en `POST /oauth/token`.
7. `POST /mcp` con el access token.

Sin `MCP_ENABLED=true`, `/mcp` no funciona (salvo health).

## 12. Staging

App Hosting backend `notificas-stagin`. Definir en la consola (no hace falta tocar `apphosting.yaml` para el primer ensayo):

- `MCP_ENABLED=true`
- `MCP_ALLOWED_USERS` con tu email/uid
- `MCP_BASE_URL` = URL pública de staging (HTTPS)

Desplegar reglas de Firestore (colecciones OAuth/MCP solo Admin SDK). Rebuild de App Hosting.

## 13. Claude (Custom Connector)

1. Claude → Connectors → Add custom connector.
2. URL: `https://notificas.com.ar/mcp` (o staging).
3. Claude descubre OAuth, abre el consentimiento de Notificas, el usuario autoriza.
4. Probar `get_account` y `get_balance` antes de cualquier send.

No hace falta un backend distinto para Claude.

## 14. ChatGPT

El mismo MCP sirve para OpenAI Apps / Connectors cuando el producto acepte Remote MCP + OAuth.

Pendiente de publicación (no bloquea el desarrollo):

- Crear la app en el portal vigente de OpenAI.
- Completar branding, privacy policy y review.
- Verificar que el redirect de OAuth de OpenAI quede registrado (DCR o pre-registro).
- No hace falta Apps SDK en este backend: MCP alcanza para esta etapa.

## 15. Variables de entorno nuevas

Ninguna es un secreto de proveedor. Los tokens OAuth se firman/hashean con el pepper ya existente (`ADMIN_SESSION_SECRET` / `PUBLIC_API_KEY_PEPPER`).

| Variable | Default | Efecto |
|----------|---------|--------|
| `MCP_ENABLED` | off | Habilita `/mcp` y OAuth discovery |
| `MCP_ALLOWED_USERS` | vacío (niega a todos) | uid o emails separados por coma |
| `MCP_ALLOW_ALL` | off | Solo desarrollo; ignora allowlist |
| `MCP_BASE_URL` | `NEXT_PUBLIC_APP_URL` | Issuer y resource URL |
| `MCP_RATE_LIMIT_READ` | 60 | |
| `MCP_RATE_LIMIT_PREPARE` | 20 | |
| `MCP_RATE_LIMIT_WRITE` | 5 | |
| `MCP_RATE_LIMIT_TENANT_READ` | 120 | |
| `MCP_RATE_LIMIT_TENANT_PREPARE` | 40 | |
| `MCP_RATE_LIMIT_TENANT_WRITE` | 10 | |
| `MCP_OAUTH_ACCESS_TTL_SECONDS` | 3600 | |
| `MCP_OAUTH_REFRESH_TTL_SECONDS` | 2592000 | |

No subir secretos al repo. No hace falta API key de Meta/Resend nueva.

## 16. Deploy

1. Merge a la rama de App Hosting.
2. `firebase deploy --only firestore:rules` (colecciones `oauth_*` y `mcp_*` quedan bloqueadas al cliente).
3. Rebuild App Hosting. **No** se eliminan functions ni rutas existentes.
4. En consola, setear `MCP_ENABLED` y `MCP_ALLOWED_USERS` solo cuando vayas a probar.
5. Verificar `GET /mcp/health` y que `POST /mcp` sin token sea 401 con `WWW-Authenticate`.

Este cambio **no** se auto-despliega desde este trabajo.

## 17. Rollback

1. Quitar `MCP_ENABLED` o ponerlo en `false` en App Hosting → el MCP deja de atender (503). La web, API v1, campañas, Meta, Resend y créditos no cambian.
2. Si hiciera falta, revertir el commit. Las colecciones OAuth pueden quedar; no afectan el producto.

## 18. Limitaciones actuales

- Un destinatario por `send_*`. Sin envío masivo desde el agente.
- Campañas: solo `draft`. La confirmación es humana en la UI.
- Hasta 200 destinatarios inline en el draft; listas grandes vía `recipientListId`.
- OAuth es el authorization server de Notificas (Firebase Auth en el consentimiento), no un IdP externo.
- Streamable HTTP en esta versión responde JSON (sin SSE). Compatible con clientes que POST-ean JSON-RPC.
- No hay UI de Apps SDK / widget ChatGPT.
- `get_notification` cubre IDs públicos `ntf_…` y documentos `mail` de la empresa; no lista el buzón completo.
- Créditos: 1 envío = 1 crédito, igual que API/web. No hay tarifa paralela.
- SSE GET no implementado; si un cliente lo exige, ampliar después.
