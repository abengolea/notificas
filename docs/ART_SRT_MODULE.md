# Módulo ART / adhesión a notificaciones electrónicas

Herramientas técnicas para que una ART o empleador autoasegurado gestione adhesiones voluntarias a un sistema de notificación electrónica compatible con la **lógica** de la Resolución SRT 82/2020.

**Este documento no afirma que Notificas esté autorizada por la SRT.** No constituye dictamen jurídico ni certificación de cumplimiento normativo.

El módulo está **desactivado por defecto**. La producción actual no cambia hasta activar el feature flag.

## Auditoría de reutilización

| Existente | Uso en este módulo |
|-----------|--------------------|
| `organizations` | Tenant ART (`orgId`). Tipo opcional `art`. |
| API v1 + API keys + scopes | `/api/v1/art/*` |
| Webhooks HMAC + Cloud Tasks | Eventos `art.*` |
| Cloud Tasks | Alta masiva (`/api/internal/art/bulk-fanout`) |
| Resend | OTP e invitaciones transaccionales (mecanismo de correo ya usado) |
| `evidence_snapshots` / bucket WORM | Copia lacrada `art-{adhesionId}` |
| `issued_documents` + `/verify` | Constancia PDF + QR |
| Polygon | Ancla de eventos jurídicamente relevantes (adhesión, revocación, identidad, cambio de contacto) |
| Hash SHA-256 / Merkle helpers | Cadena `previousHash` → `eventHash` |
| Panel empresa | Sección “Adhesiones electrónicas” |
| Feature flag estilo `MCP_ENABLED` | `ART_MODULE_ENABLED` |

No se duplicó el sistema de usuarios, envíos certificados, WhatsApp de campañas ni la API de notificaciones ordinarias.

## Activación

En el entorno (nunca en el código):

```
ART_MODULE_ENABLED=true
NEXT_PUBLIC_ART_MODULE_ENABLED=true   # opcional; el menú también consulta /api/art/status?orgId=
ART_PILOT_MODE=true
ART_GENERAL_RELEASE_ENABLED=false     # default. Nunca abrir a todas las orgs sin esto.
ART_ALLOWED_ORGS=<orgId de ART DEMO NOTIFICAS>
ART_PILOT_EMAIL_ALLOWLIST=...
ART_PILOT_PHONE_ALLOWLIST=...
ART_PILOT_MAX_RECIPIENTS=10
ART_PILOT_MAX_CAMPAIGN_RECIPIENTS=10
EVIDENCE_RETENTION_YEARS=5
```

Comportamiento fail-closed:

- `ART_MODULE_ENABLED` distinto de true → ART 404. El frontend (`NEXT_PUBLIC_ART_MODULE_ENABLED`) no autoriza.
- `MODULE=true` + `ART_PILOT_MODE=true` → solo `ART_ALLOWED_ORGS` y allowlists de destinatarios. Otras orgs: **403 `ART_MODULE_NOT_AVAILABLE`**.
- `MODULE=true` + `PILOT=false` + `ART_GENERAL_RELEASE_ENABLED` distinto de true → **cerrado para todos** (403 `ART_MODULE_NOT_AVAILABLE`). No significa “abrir a todos”.
- `MODULE=true` + `PILOT=false` + `ART_GENERAL_RELEASE_ENABLED=true` → funcionamiento general.

Destinatarios fuera de allowlist (en piloto): **403 `PILOT_RECIPIENT_NOT_ALLOWED`** (no se envía nada).

Sin estas variables de módulo:

- `/api/v1/art/*` y `/api/empresa/art/*` responden 404
- `/adherir/[token]` y `/adhesion/manage/[token]` responden 404 en API
- El menú empresa no muestra “Adhesiones electrónicas”
- Las notificaciones ordinarias de clientes no cambian
- `notification_type=SRT_ART` no se envía como electrónico (módulo off → no elegible)

Opcional:

```
ART_INVITE_TTL_HOURS=336
ART_OTP_TTL_MINUTES=10
ART_OTP_MAX_ATTEMPTS=5
```

## Concepto

Una persona **no** queda habilitada porque exista un teléfono en una lista.

Habilitación = evento de **adhesión** (`ADHESION_ACCEPTED`) con:

- ART + trabajador + canal
- contacto validado (OTP)
- identidad según configuración
- aceptación positiva (checkbox + botón)
- términos versionados + hash
- IP, user-agent, sesión

Estados: `pending` → `identity_pending` → `identity_verified` / `adhesion_pending` → `active` | `rejected` | `revoked` | `suspended` | `requires_conventional_channel`.

## Colecciones Firestore (nuevas, no destructivas)

Todas con reglas **deny** al cliente (solo Admin SDK):

- `art_configs`
- `art_recipients`
- `art_invitations` (doc id = SHA-256 del token)
- `art_manage_tokens`
- `art_terms_versions`
- `art_audit_events` (cadena previousHash/eventHash)
- `art_otp_challenges` (hash del código, nunca el OTP en claro)
- `art_contact_history`
- `art_bulk_jobs` / `art_bulk_rows`
- `art_evidence`
- `art_rate_limits`

Índices: ver `firestore.indexes.json` (grupo `art_*`).

## Flujo del trabajador

1. La ART crea el perfil (`POST /api/v1/art/recipients` o panel).
2. Se genera link ` /adherir/{token} ` (token largo, aleatorio, con vencimiento; no lleva DNI/CUIL).
3. Pasos: datos → OTP (email, mecanismo disponible) → identidad abstracta → checkbox + “ACEPTAR Y ADHERIRME”.
4. Constancia PDF + JSON. Gestión/revocación: `/adhesion/manage/{token}`.

OTP por WhatsApp/SMS queda modelado (`channel`) pero no implementado: Meta no tiene template AUTH en el producto y no hay SMS.

## IdentityProvider

```ts
interface IdentityProvider {
  startVerification(...)
  checkVerification(...)
  normalizeResult(...)
}
```

Implementado: `ART_PREVALIDATED` / `MANUAL` (`ManualOrPrevalidatedIdentityProvider`).

Stubs que **lanzan** `IdentityProviderNotConfiguredError`: `RENAPER`, `DIDIT`.

No se almacenan imágenes ni biometría. El resultado normalizado incluye `faceMatchVerified` / `livenessVerified` siempre en `false` en este proveedor.

## Regla SRT_ART

Si `notification_type=SRT_ART` (API) o `campaign.notificationType=SRT_ART` (campaña):

Antes de enviar se exige adhesión activa, identidad según config, contacto verificado, no revocada/suspendida.

Si no cumple: **no envía** como notificación electrónica SRT. Respuesta:

```json
{
  "eligibleForElectronicNotification": false,
  "reason": "REVOKED",
  "conventionalChannelRequired": true
}
```

`reason`: `NO_ADHESION` | `REVOKED` | `IDENTITY_NOT_VERIFIED` | `CONTACT_NOT_VERIFIED` | `SUSPENDED` | `MODULE_DISABLED` | `OTHER`.

Las notificaciones `ORDINARY` (default) no pasan por esta regla.

## API v1

Auth: Bearer `ntf_live_` / `ntf_test_` (igual que el resto). Scopes `art:read` / `art:write` (las keys con `notifications:*` siguen pudiendo usarla).

| Método | Ruta |
|--------|------|
| POST | `/api/v1/art/recipients` |
| GET | `/api/v1/art/recipients` |
| POST | `/api/v1/art/recipients/bulk` |
| GET | `/api/v1/art/recipients/{id}` |
| GET | `/api/v1/art/recipients/{id}/eligibility` |
| POST | `/api/v1/art/recipients/{id}/invite` |
| GET | `/api/v1/art/recipients/{id}/adhesion` |
| GET | `/api/v1/art/recipients/{id}/evidence` |

Webhooks (mismos endpoints HMAC):

- `art.adhesion.created`
- `art.adhesion.activated`
- `art.adhesion.revoked`
- `art.identity.verified`
- `art.identity.failed`
- `art.contact.changed`
- `art.recipient.requires_conventional_channel`

## Configuración por ART (`art_configs/{orgId}`)

Defaults: teléfono no exigido por OTP (OTP productivo = email), email obligatorio, identidad obligatoria, liveness off, prevalidación ART permitida, revalidar al cambiar teléfono/email, **retención metadata/UI 5 años** (`EVIDENCE_RETENTION_YEARS`, default 5). Esto **no modifica** el Object Lock del bucket WORM `notificas-f9953-evidence` (retención actual: 5 años). No se afirma cumplimiento normativo universal por ese plazo. `identityProvider=ART_PREVALIDATED`.

En piloto las constancias incluyen `TEST MODE: PRODUCTION PILOT` y `PRUEBA INTERNA NOTIFICAS`. Términos: “TERMINOS DE ADHESIÓN - PRUEBA INTERNA NOTIFICAS”.

## Seguridad

- Tokens públicos `base64url` 32 bytes, hasheados en Firestore
- OTP hasheado, TTL, máximo de intentos, rate limit por IP
- Multi-tenant: toda lectura filtra `orgId`
- Sin DNI/CUIL en URLs
- Sin biometría
- Secretos solo por env

## RENAPER / Didit (pendiente)

Implementar `RenaperIdentityProvider` / `DiditIdentityProvider` con las mismas interfaces, sin persistir raw biometrics, y setear `identityProvider` en la config de la ART.

## Checkpoint de deploy

No desplegar a producción en este cambio hasta confirmación explícita. El rollback principal es `ART_MODULE_ENABLED=false`. No usar `ART_PILOT_MODE=false` como rollback: eso no abre ni cierra de forma segura (queda fail-closed salvo `ART_GENERAL_RELEASE_ENABLED=true`). Las evidencias ya escritas en WORM permanecen 5 años.
