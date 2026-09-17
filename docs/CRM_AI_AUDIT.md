# Auditoría CRM comercial inteligente — Fase 0

**Estado:** Fase 0 APROBADA. Etapa 1 APROBADA. Etapa 2 (servicios/persistencia): `docs/crm/SERVICES.md`. Etapa 3.2 CERRADA (`CRM_COMPANIES_V1`). Etapa 4 (catálogos): `docs/crm/TAXONOMY.md`.

**Fecha:** 2026-09-17  
**Alcance:** CRM de marketing comercial de Notificas (panel admin), no el producto de notificaciones certificadas.  
**Criterio:** no perder información, no duplicar sistemas, no mezclar certificado con comercial, separar dominio / API / MCP.

Este documento es la auditoría previa a cualquier reescritura. No describe código ya implementado de la evolución: describe el estado actual y el plan para evolucionar el CRM existente.

---

## Estado actual

Notificas es una plataforma Next.js 15.2.9 (App Router) + React 18 + TypeScript, con Firebase (Auth, Firestore, Storage, Cloud Functions v2 / Cloud Run, Cloud Tasks, App Hosting). El producto principal certifica comunicaciones (email Resend + WhatsApp Meta + evidencia / Polygon).

El **CRM comercial ya existe**. No hay que inventarlo desde cero. Vive en:

| Capa | Ubicación |
|------|-----------|
| UI | `/admin/marketing` |
| API admin | `/api/admin/marketing/*` |
| Tracking público | `/api/marketing/{o,c,u}/[token]` |
| Dominio | `src/lib/marketing/` |
| Componentes | `src/components/admin/marketing/` |
| Colecciones | `marketing_*` (Firestore, denegadas al cliente) |

`PRODUCT.md` lo define con claridad: outreach desde `contacto@notificas.com.ar` a empresas prospecto, agrupado por país, con Resend de salida y Gmail de respuestas. **No consume créditos de clientes y no genera constancia fehaciente.**

### Qué hay hoy (funcional)

- Contactos con email, nombre, empresa (texto libre), cargo, país, notas, tags, etapa de engagement.
- Listas nominadas (`marketing_lists`) + catálogo virtual `country:XX` / `country:all`.
- Importación CSV (`email,nombre,empresa,cargo,pais,notas`) con deduplicación por email normalizado.
- Campañas: borrador → envío por tandas → pausa / cancelación.
- Envíos individuales (`marketing_sends`) + eventos (`marketing_events`).
- Etapas: `new → queued → sent → opened → clicked → replied`, más `bounced`, `unsubscribed`, `not_interested`.
- Dashboard por país (pipeline de engagement).
- Gmail OAuth solo lectura + matching de respuestas.
- Pixel de apertura, redirect de clic, baja.
- Webhook Resend reutilizado para marketing.
- Tests unitarios de CSV, países, etapas, tokens, matching Gmail, audiencias.

### Qué no hay (huecos vs. el CRM objetivo)

- Entidad **empresa** (solo string `company` en el contacto).
- Colección administrable de **países** (hoy hardcode en TypeScript; falta `US`).
- **Industrias / subindustrias** administrables.
- **Casos de uso** de Notificas como entidad.
- **Fuentes** de lead (ChatGPT, LinkedIn, CSV, etc.).
- Listas **dinámicas** por reglas.
- Membership relacional (hoy `listIds[]` dentro del contacto).
- Tags administrables / operaciones masivas.
- **Templates versionados** (el HTML vive en la campaña y se puede editar después de enviar).
- Snapshot del mensaje en cada envío.
- Timeline universal (los eventos actuales son solo de email).
- **Oportunidades** separadas del contacto.
- **Tareas / follow-ups**.
- Deduplicación de empresas y UI de fusión.
- Buscador global agrupado.
- Filter builder + búsquedas guardadas.
- Dashboard operativo (pipeline comercial, vencimientos, matriz país × rubro).
- API de dominio `/api/crm/*` y `/api/ai/*`.
- Tools MCP de CRM (el MCP actual es de **notificaciones certificadas de clientes**).
- Roles granulares de CRM (el admin es una cookie HMAC de un solo usuario).
- Feature flags `crm_v2` / `crm_ai` / `crm_mcp`.
- Soft delete, exportación CSV avanzada, wizard de importación de 7 pasos.

### Superficies que NO son este CRM

No confundir con:

| Superficie | Colecciones | Dueño |
|------------|-------------|--------|
| Agenda de destinatarios del producto | `contactos`, `contacts` | usuarios / orgs |
| Campañas certificadas | `campaigns`, `campaign_messages` | `orgId` |
| Listas de destinatarios del producto | `recipient_lists` | `orgId` |
| Módulo ART | `art_*` | `orgId` |
| API pública v1 | `api_*` | `orgId` |
| MCP de notificaciones | tools `send_email`, `send_whatsapp`, etc. | tenant de cliente |

El CRM comercial es **interno de Notificas** (panel admin). Los clientes de Notificas no deben verlo ni operarlo por MCP.

---

## Arquitectura actual

```
Admin UI  (/admin/marketing)
    │  cookie HttpOnly `notificas_admin_sess` (HMAC, 8 h)
    ▼
Next.js Route Handlers  (/api/admin/marketing/*)
    │  assertAdminSession
    ▼
src/lib/marketing/*   (lógica de dominio, aún acoplada a las rutas)
    │  Firebase Admin SDK
    ▼
Firestore  marketing_*   (rules: deny all client)

Paralelo de tracking (sin sesión admin):
  /api/marketing/o|c|u/[token]  →  HMAC token  →  events + stage
  /api/webhooks/resend          →  applyMarketingResendEvent

Paralelo de producto (NO es CRM):
  ChatGPT ──OAuth──► /mcp ──► servicios / API v1 ──► mail / créditos / evidencia
```

### Stack detectado

| Pieza | Estado |
|-------|--------|
| Next.js 15.2.9 App Router | Sí |
| React 18.3 + TypeScript 5 | Sí |
| Zod | Sí (validación de APIs y MCP) |
| Firebase Auth | Usuarios de producto; **no** el panel admin |
| Firestore + Admin SDK | Sí; el CRM **no escribe desde el cliente** |
| Cloud Functions / Cloud Run | Sí (`functions/`), webhooks y workers de producto |
| Cloud Tasks | Sí, colas de campañas **certificadas**, no de marketing |
| Envío marketing | HTTP Resend directo desde `send.ts` (tandas de 8, tick manual/API) |
| Gmail API | OAuth readonly, tokens cifrados en `marketing_settings/gmail` |
| Feature flags | `MCP_ENABLED`, `ART_*`. **No hay flags CRM** |
| Monorepo / packages | No. Un solo Next app. Tipos en `src/lib/marketing/types.ts` |

### Autenticación y permisos (hoy)

El panel admin **no es multi-usuario**:

- Credenciales: `ADMIN_PANEL_EMAIL` + `ADMIN_PANEL_PASSWORD` + `ADMIN_SESSION_SECRET`.
- Una sola identidad. Sin roles `sales` / `viewer` / `ai`.
- El CRM no está acotado por `orgId`. Es un dataset único de Notificas.

El MCP existente autentica **usuarios Firebase + membresía de empresa** (`orgId` derivado del backend). Ese modelo es correcto para notificaciones certificadas y **incorrecto** si se reutiliza sin cambio para el CRM comercial: un cliente autenticado en ChatGPT no debe listar prospectos de Notificas.

### Relación frontend / backend / datos

1. La UI de marketing llama APIs admin (no `onSnapshot` sobre `marketing_*`).
2. Las rules de Firestore deniegan lectura/escritura cliente de todas las colecciones `marketing_*`.
3. Parte de la lógica sigue en route handlers (overview, listado de contactos) en vez de servicios reutilizables.
4. El MCP de producto ya cumple el principio “no tocar Firestore directo”: llama servicios. El CRM todavía no tiene esa capa expuesta hacia MCP.

---

## Datos existentes

### Colecciones de marketing (fuente de verdad comercial actual)

Definidas en `src/lib/marketing/collections.ts`:

```
marketing_contacts
marketing_lists
marketing_campaigns
marketing_sends
marketing_events
marketing_settings          (doc `gmail`)
```

#### `marketing_contacts`

Identidad: `id = sha256("mkt:" + emailNormalizado).slice(0, 40)`.

Campos: `email`, `emailKey`, `name`, `company` (string), `title`, `country`, `notes`, `stage`, `stageManual`, `tags[]`, `source` (`csv` \| `manual`), `listIds[]`, `lastCampaignId`, `lastSendId`, `lastSentAt`, `lastOpenedAt`, `lastClickedAt`, `lastRepliedAt`, `createdAt`, `updatedAt`.

#### `marketing_lists`

`name`, `nameKey`, `country`, `contactCount`, `source`, timestamps. Las listas `country:XX` **no se persisten**; se calculan.

#### `marketing_campaigns`

`name`, `country`, `listId`, `listName`, `subject`, `htmlBody`, `textBody`, `fromEmail`, `fromName`, `status` (`draft` \| `sending` \| `paused` \| `sent` \| `cancelled`), `includeStages`, `contactCount`, `stats`, timestamps.

El HTML/asunto viven en el documento de campaña. Un PATCH posterior puede alterar `htmlBody` / `subject` **aunque la campaña ya se haya enviado**. Los envíos históricos no guardan copia del cuerpo.

#### `marketing_sends`

Un documento por destinatario: `campaignId`, `contactId`, `email`, `country`, `company`, `name`, `subject`, `status`, `resendEmailId`, `rfcMessageId`, `gmailThreadId`, `gmailMessageId`, contadores, `replySnippet`, errores, timestamps. **No hay `html`/`text` snapshot.**

#### `marketing_events`

Eventos de email: `sent`, `delivered`, `opened`, `clicked`, `replied`, `bounced`, `failed`, `unsubscribed`, `complained`. No cubren notas, reuniones, demos, cambios de etapa comercial ni acciones de IA.

#### `marketing_settings/gmail`

Tokens OAuth cifrados (`*Enc` se omiten al serializar). Estado de sync, `historyId`.

### Relación conceptual actual

```
País (código ISO hardcodeado)
  └ Contacto (email = identidad)
       ├ listIds[] ──► Lista nominada
       ├ company     ──► texto, no entidad
       └ stage       ──► engagement de email (no pipeline comercial)
            │
Campaña ──listId──► Lista nominada (obligatoria para enviar)
            │
         marketing_sends (1 por contacto × campaña)
            │
         marketing_events
```

Las campañas **no pueden** usar una lista virtual de país como audiencia de envío (`namedRecipientSource`). Hay que cargar un CSV nominado.

### Índices Firestore actuales (marketing)

En `firestore.indexes.json`:

- `marketing_sends`: `(campaignId, status)`, `(campaignId, createdAt DESC)`
- `marketing_contacts`: `(country, updatedAt DESC)`
- `marketing_events`: `(contactId, at DESC)`

Faltan índices para listas dinámicas, empresas, tareas, oportunidades, actividades genéricas, búsqueda, matriz país × industria.

### Colecciones de producto (no migrar al CRM)

`mail`, `users`, `organizations`, `campaigns`, `campaign_messages`, `recipient_lists`, `contactos`, `contacts`, `wa_templates`, `api_*`, `webhook_*`, `oauth_*`, `mcp_*`, `art_*`, `email_provider_events`, etc.

**Regla de oro:** no reutilizar los nombres `contacts`, `campaigns`, `companies` como colecciones top-level. Colisionan o colisionarán con el producto.

---

## Funciones reutilizables

Conservar y extender; no reescribir:

| Módulo | Por qué |
|--------|---------|
| `src/lib/marketing/*` | Dominio real del CRM. Renombrar conceptualmente a “CRM” en APIs, no borrar. |
| `normalizeEmail`, `contactIdForEmail`, parser CSV | Dedup de contactos ya correcto. |
| `countries.ts` + aliases | Base de normalización ISO; pasar de hardcode a catálogo + seed. |
| `stages.ts` + `nextStage` | Engagement de email. **No** reemplazarlo por etapa comercial. |
| `audience.ts` / `lists.ts` | Listas nominadas, elegibilidad, preview. Base de listas estáticas. |
| `send.ts` | Encolado + tick + Resend + From/Reply-To. Añadir snapshot. |
| `events.ts` + webhook Resend | Trazabilidad de envío. Ampliar a actividades, no sustituir. |
| `gmail.ts` + `reply-match.ts` | Respuestas reales. Extender a `email_replied` en timeline. |
| `tokens.ts` / tracking público | Pixel, clic, baja. |
| UI admin actual | Subnav, dashboard país, contactos, detalle, campañas. Evolucionar, no tirar. |
| `assertAdminSession` | Seguir protegiendo `/api/admin/marketing/*` durante la transición. |
| Zod | Validación de inputs (ya estándar). |
| Idempotencia `api_idempotency` | Patrón a reutilizar con `environment: "crm"` / `"mcp-crm"`. |
| MCP protocol stack (`src/mcp/`) | OAuth 2.1 PKCE, DCR, rate limit, audit, tool registry. **Reutilizar el adapter, no el catálogo de tools.** |
| `mcp_audit_logs` | Modelo de auditoría AI; especializar payload CRM. |
| Policy `FORBIDDEN_MCP_TOOLS` | Ya bloquea `send_campaign` / bulk en MCP de producto. Replicar para CRM V4. |
| Firestore rules deny-all de `marketing_*` | Mantener. Toda escritura por Admin SDK. |
| Tests `marketing/*.test.ts` | Ampliar, no descartar. |

---

## Problemas

### 1. Empresa no es entidad

`company` es un string. “Sancor”, “Sancor Seguros” y “SANCOR” son tres mundos. No hay país × industria × caso de uso a nivel cuenta. No hay vista 360.

### 2. Etapa de email ≠ etapa comercial

`stage` mezcla “nunca contactado” con “abrió el mail”. Un reply no debería pasar una oportunidad a “interesado”. Falta `commercialStageId` separado.

### 3. Identidad y escala

- Overview lee hasta **8000** contactos para armar el dashboard.
- Listado de contactos lee hasta **2000** y filtra en memoria (stage, lista, `q`).
- Audiencia: `SCAN_LIMIT = 5000`.
- Detalle de campaña: **500** sends.
- Sin cursor pagination real.

A decenas de miles de documentos esto es costoso e incompleto.

### 4. `listIds[]` creciente

Membresía embebida. Firestore limita el tamaño del documento. `array-contains` escala mal si un contacto entra en cientos de listas. Hace falta `marketing_list_memberships`.

### 5. Historial mutable

El cuerpo de la campaña se puede PATCH-ear después del envío. El send no guarda HTML/texto. En dos años no se puede responder “qué recibió exactamente este destinatario”.

### 6. Sin templates versionados

Cada campaña copia HTML a mano. No hay `messageTemplates` ni versiones inmutables.

### 7. Dedup incompleta

Contactos: excelente (email → id determinístico). Empresas: inexistente. Homónimos / mismo dominio: no. No hay cola de duplicados ni fusión asistida.

### 8. CSV pobre vs. el wizard pedido

Detecta columnas por alias, pero no hay mapeo manual, preview, país/rubro/caso/fuente en el flujo, ni detección de duplicados de empresa.

### 9. Lógica en rutas, no en servicios

`overview`, GET contacts, PATCH campaign están en route handlers. El MCP no puede reutilizarlos sin HTTP interno o duplicar queries.

### 10. Dos “MCP / IA” distintos

| | MCP actual | CRM deseado |
|--|------------|-------------|
| Usuario | Cliente de Notificas (Firebase + org) | Equipo comercial de Notificas |
| Datos | `mail`, créditos, campañas certificadas | `marketing_*` |
| Riesgo si se mezclan | Un token de cliente lee prospectos | Fuga comercial / tenant confusion |

### 11. Auth admin de un solo actor

No hay `ownerId`, roles, ni scopes `crm.contacts.read`. ChatGPT no puede “operar con permisos del usuario autenticado” porque el CRM no tiene usuarios.

### 12. Países hardcodeados

No hay `US`. Activar/desactivar un país implica deploy. Industrias y casos de uso ni siquiera existen.

### 13. Tags huérfanos

El campo existe en API; no hay taxonomía ni UI.

### 14. Costos Firestore

Dashboard = scan. No hay counters / `marketing_stats`. Cada apertura de “Por país” escala lineal con la base.

### 15. Naming pedido vs. naming real

Los nombres `contacts` / `campaigns` del brief **no se deben crear**. Chocarían con producto. Prefijo obligatorio: `marketing_*` (o `crm_*` nuevo, sin reciclar nombres del producto).

### 16. Cloud Tasks no usado en marketing

El envío avanza con `/tick` (UI o API). A volumen alto conviene cola, pero no mezclar con `campaign-notifications` del producto.

---

## Plan de migración

Estrategia: **aditivo + dual-write + cutover**, nunca big-bang.

### Principio

Los documentos actuales siguen siendo válidos. Se agregan campos y colecciones. Un job de migración deriva empresas, memberships y stats. La UI vieja sigue funcionando detrás de un flag hasta que la nueva la reemplace.

### Fase A — Modelo nuevo + compatibilidad (sin pérdida)

1. Extender `marketing_contacts` con campos opcionales (`companyId`, `normalizedEmail` ya cubierto por `emailKey`, `useCaseIds`, `doNotContact`, `unsubscribed`, `bounced`, `ownerId`, `commercialStageId`, `deletedAt`, …).
2. Mapear `stage` actual → engagement. Mapear `unsubscribed` / `bounced` también a flags booleanos.
3. Seguir escribiendo `listIds` y, en paralelo, `marketing_list_memberships`.
4. Seguir escribiendo `company` string y, en paralelo, `companyId` cuando exista.
5. Al enviar, persistir `messageSnapshot` en cada `marketing_send` **y** congelar `templateSnapshot` en la campaña. Dejar de permitir PATCH de cuerpo si `status !== draft`.
6. Feature flags: `crm_v2`, `crm_ai`, `crm_mcp`, `crm_bulk_actions`, `crm_dynamic_lists`.

### Fase B — Migración de datos

Job idempotente (script Admin SDK):

1. **Empresas:** agrupar contactos por `(normalizeCompanyName(company), country)` y, si hay, dominio del email (parte corporativa, no gmail/hotmail). Crear `marketing_companies`. Clasificar `exact` / `probable` / `possible`. No fusionar `probable`/`possible` automáticamente.
2. Asignar `companyId` a contactos. Conservar `company` original.
3. Materializar memberships desde `listIds`.
4. Seed `marketing_countries` desde `MARKETING_COUNTRIES` + `US`.
5. Seed inicial de industrias y casos de uso (contenido editable, no eternamente hardcode).
6. Backfill `emailKey` / flags de baja y rebote.
7. Contadores `marketing_stats` por país.
8. Dry-run + reporte de colisiones antes de escribir.

**No borrar** `marketing_*` actuales. **No copiar** `contactos` / `campaigns` de producto al CRM.

### Fase C — UI nueva (navegación CRM)

Misma zona `/admin/marketing` (o alias `/admin/crm`). Añadir Empresas, País, Industria, Casos de uso, Tareas, Oportunidades, sin apagar Contactos/Campañas.

### Fase D — API de dominio

`/api/crm/*` llama servicios. `/api/admin/marketing/*` se convierte en fachada de compatibilidad. `/api/ai/*` orquesta CRM, no Firestore.

### Fase E–G — MCP

Read-only → escritura baja → campañas draft → acciones sensibles con confirmación. Ver sección I / M.

---

## Riesgos

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| Pérdida de contactos / envíos / respuestas | Crítica | Solo campos aditivos. Backup. Migración idempotente. No delete de `marketing_sends` / campañas enviadas. |
| Duplicar empresas al derivar de strings | Alta | Clasificar, no auto-merge. UI de resolución. Conservar `company` original. |
| Colisión de nombres `contacts` / `campaigns` | Crítica | Prefijo `marketing_*`. Prohibido crear esas colecciones para CRM. |
| MCP de clientes accede al CRM | Crítica | Scopes y allowlist distintos. Tools CRM no listadas a tokens de producto. Tenant CRM ≠ `orgId` de cliente. |
| ChatGPT envía campaña | Crítica | V1/V2 sin send. V4 con preview + confirmation token. Reusar `FORBIDDEN_MCP_TOOLS`. |
| PATCH de HTML post-envío | Alta | Congelar cuerpo; snapshot por send. |
| Consultas caras / índices faltantes | Alta | Stats precomputados. Cursor pagination. Índices antes de queries nuevas. |
| `listIds` revienta el documento | Media | Membership collection; dual-write. |
| Admin de un solo usuario vs. “permisos del usuario MCP” | Alta | Operadores CRM allowlisteados (Firebase) con scopes. No impersonar Admin SDK global. |
| Confusión certificado vs. marketing en UI/MCP | Alta | Copy, colecciones, tools y scopes separados. `send_email` MCP actual **no** es marketing. |
| Idempotencia ausente en CRM | Alta | `X-Idempotency-Key` en escrituras AI, patrón `api_idempotency`. |
| Gmail / Resend secretos en audit AI | Alta | No loguear prompts ni tokens. Omitir `*Enc`. |
| Soft delete mal implementado | Media | Filtro `deletedAt == null` en todas las queries + índices. |
| Migración no idempotente | Alta | Doc ids determinísticos (`company` key, membership id). Re-runs seguros. |

---

## A. Arquitectura detectada

Plataforma monolítica Next.js 15 sobre Firebase. Tres mundos:

1. **Producto certificado** (multitenant `orgId`, créditos, `campaigns`, API v1, MCP actual).
2. **Admin operativo** (usuarios, planes, reclamos, cookie HMAC).
3. **CRM marketing** (dataset único Notificas, `marketing_*`, APIs admin, Resend + Gmail).

Principio ya vigente en producto y a clonar en CRM:

```
UI / ChatGPT / jobs
        ↓
API de dominio (servicios TypeScript)
        ↓
Firestore Admin  (nunca el modelo, nunca el cliente)
```

## B. CRM existente

Módulo `/admin/marketing`: país, contactos, listas CSV, campañas, envíos, tracking, replies Gmail. Es un **outreach CRM por país**, no un CRM de cuentas/oportunidades. Está bien hecho para v1. Hay que **extenderlo**, no reemplazarlo.

## C. Modelo Firestore actual

Seis colecciones `marketing_*`. Contacto = persona con email. Empresa = string. Campaña = documento mutable con HTML. Send = fila de destinatario sin snapshot de cuerpo. Eventos = lifecycle de email. Settings = Gmail.

## D. Qué conservar

Todo `src/lib/marketing`, tracking, webhook Resend, Gmail, stages de engagement, dedup por email, deny-all rules, APIs admin como compatibilidad, stack MCP (protocolo/OAuth), Zod, idempotencia de API pública como patrón.

## E. Problemas encontrados

Empresa no entidad; etapa mezclada; scans de 2k–8k docs; historial mutable; sin templates; sin tareas/oportunidades/casos de uso; auth unipersonal; MCP de producto ≠ CRM; nombres de colección del brief incompatibles con el producto.

## F. Modelo propuesto

Jerarquía **conceptual** (no anidada en Firestore):

```
País → Industria → Caso de uso → Empresa → Contactos
  → Segmentos/listas → Campañas → Templates → Envíos
  → Respuestas → Actividades → Oportunidades → Tareas
```

Implementación: colecciones planas + IDs. Engagement de email (`stage`) separado de pipeline comercial (`commercialStageId`) y de oportunidad (`opportunity.stageId`).

Tenant CRM: **workspace comercial de Notificas** (no `orgId` de clientes). Si en el futuro hay varios vendedores, `ownerId` + roles **dentro** de ese workspace.

## G. Colecciones nuevas / modificadas

Prefijo `marketing_` para no chocar con producto.

| Colección | Acción |
|-----------|--------|
| `marketing_contacts` | Extender campos; conservar id por email |
| `marketing_lists` | Añadir `type: static \| dynamic`, `rules`, `deletedAt` |
| `marketing_campaigns` | Snapshot, más estados, `useCaseIds`, `industryIds`, freeze |
| `marketing_sends` | = `messageDeliveries`. Añadir `messageSnapshot`, `companyId`, `provider` |
| `marketing_events` | Seguir para email; no mezclar todo aquí |
| `marketing_settings` | Sin cambio de forma |
| `marketing_companies` | **Nueva** |
| `marketing_countries` | **Nueva** (seed desde código) |
| `marketing_industries` | **Nueva** (+ `parentId` para subindustria) |
| `marketing_use_cases` | **Nueva** |
| `marketing_sources` | **Nueva** |
| `marketing_tags` | **Nueva** |
| `marketing_list_memberships` | **Nueva** (estáticas) |
| `marketing_message_templates` | **Nueva** |
| `marketing_message_template_versions` | **Nueva** (inmutables) |
| `marketing_activities` | **Nueva** (timeline universal) |
| `marketing_opportunities` | **Nueva** |
| `marketing_opportunity_stages` | **Nueva** (pipeline configurable) |
| `marketing_tasks` | **Nueva** |
| `marketing_saved_searches` | **Nueva** |
| `marketing_duplicate_candidates` | **Nueva** |
| `marketing_stats` | **Nueva** (counters) |
| `marketing_ai_inbox` | **Nueva** (fase tardía) |
| `marketing_ai_audit_logs` | **Nueva** (o `mcp_audit_logs` + `domain: "crm"`) |
| `marketing_sensitive_actions` | **Nueva** (preview + confirmation token) |

Soft delete: `deletedAt` / `deletedBy` en empresas, contactos, oportunidades, templates. Campañas enviadas y sends: no borrar.

## H. APIs propuestas

Capa TypeScript (única lógica):

```
src/lib/marketing/  (mantener nombre de carpeta en v1)
  companyService
  contactService
  listService
  campaignService
  templateService
  opportunityService
  taskService
  activityService
  searchService
  statsService
  importService
  dedupService
```

HTTP:

```
/api/crm/companies
/api/crm/contacts
/api/crm/lists
/api/crm/campaigns
/api/crm/templates
/api/crm/opportunities
/api/crm/tasks
/api/crm/activities
/api/crm/search
/api/crm/stats
/api/crm/imports
/api/crm/duplicates
```

Compatibilidad: `/api/admin/marketing/*` delega a los mismos servicios.

AI (orquestación, sin queries propias):

```
/api/ai/search-companies
/api/ai/search-contacts
/api/ai/create-company
/api/ai/create-contact
/api/ai/add-note
/api/ai/create-list
/api/ai/create-task
/api/ai/get-followups
/api/ai/get-history
/api/ai/bulk-import-researched-companies   (siempre preview primero)
```

Auth de `/api/crm` y `/api/ai`: sesión admin **o** token OAuth CRM con scopes. `workspaceId` derivado del operador, nunca del body.

## I. Arquitectura MCP propuesta

**No** crear un segundo protocolo. Extender `src/mcp` con un adapter CRM.

```
ChatGPT Apps / MCP client
    │  OAuth 2.1 + PKCE (stack existente)
    ▼
OpenAI / MCP Adapter   (src/mcp — protocol, OAuth, rate limit, audit)
    │  scopes crm.*  + allowlist CRM_ALLOWED_USERS
    ▼
API / servicios CRM    (src/lib/marketing/*)
    │
    ▼
Firestore marketing_*
```

Recomendación de recurso:

- Producto certificado: `POST /mcp` (sin tools CRM).
- CRM comercial: `POST /mcp/crm` (mismo server code, registry distinto) **o** el mismo `/mcp` filtrando tools por scopes.

Preferible **recurso separado** `/mcp/crm` para que el consentimiento de ChatGPT no mezcle “enviar WhatsApp certificado” con “leer prospectos comerciales”.

Scopes CRM (además de los de producto, nunca intercambiables):

```
crm.read
crm.contacts.write
crm.companies.write
crm.tasks.write
crm.campaigns.write
crm.campaigns.send
```

Reglas:

- MCP no usa Firebase Admin “como superusuario”.
- Tools de escritura: validar operador, sanitizar, audit, idempotency key, dedup.
- Sensibles (`send_campaign`, `bulk_delete`, …): `requiresExplicitConfirmation` + preview + token.
- Respuestas paginadas (`nextCursor`), sin dumps de colecciones.
- Nombres de tools específicos (`search_contacts`, no `execute_crm_action`).
- `send_email` del MCP actual **permanece** como envío certificado de 1 destinatario. El envío comercial será `send_marketing_campaign` en V4, nunca un alias ambiguo.

## J. Plan de migración

Ver sección “Plan de migración” arriba. Resumen: A modelo+compat → B backfill empresas/memberships/stats → C UI → D API → E MCP read → F write → G automatizaciones. Flags por fase. UI y APIs viejas vivas hasta cutover.

## K. Índices Firestore necesarios

Existentes (conservar): sends por campaña, contacts por país+updatedAt, events por contactId+at.

Nuevos (antes de las queries, no después):

```
marketing_companies:
  (countryCode, updatedAt DESC)
  (countryCode, status, updatedAt DESC)
  (normalizedName, countryCode)
  (domain, countryCode)
  (industryIds CONTAINS, countryCode, updatedAt DESC)
  (deletedAt, countryCode, updatedAt DESC)   # o campo status + deletedAt nulo vía convención

marketing_contacts:
  (companyId, updatedAt DESC)
  (country, stage, updatedAt DESC)
  (emailKey)  # si deja de ser el id del doc
  (commercialStageId, country, updatedAt DESC)
  (nextFollowUpAt)
  (doNotContact, country)

marketing_list_memberships:
  (listId, createdAt DESC)
  (contactId, listId)

marketing_activities:
  (companyId, createdAt DESC)
  (contactId, createdAt DESC)
  (opportunityId, createdAt DESC)
  (campaignId, createdAt DESC)

marketing_tasks:
  (assignedTo, status, dueAt)
  (dueAt, status)
  (companyId, status, dueAt)

marketing_opportunities:
  (countryCode, stageId, updatedAt DESC)
  (companyId, status, updatedAt DESC)

marketing_campaigns:
  (country, status, createdAt DESC)
  (status, createdAt DESC)

marketing_sends:
  (contactId, sentAt DESC)
  (companyId, sentAt DESC)
  (providerMessageId)  # si no es lookup get()

marketing_use_cases:
  (active, name)
  (industryIds CONTAINS, active)

marketing_duplicate_candidates:
  (status, createdAt DESC)
```

Evitar: N+1 al armar vista 360 (batch `getAll`), arrays de miles de IDs, dashboard que recorre toda la colección.

## L. Riesgos

Ver tabla de riesgos. Los cuatro no negociables:

1. No borrar `marketing_contacts` / `sends` / `events`.
2. No crear colecciones `contacts` ni `campaigns` de CRM.
3. No colgar el CRM del `orgId` de un cliente.
4. No dejar que ChatGPT envíe o borre sin confirmación y scopes.

## M. Plan de implementación por etapas

Orden obligatorio (alineado al pedido, ajustado a lo que ya existe):

| # | Etapa | Entrega | Verificación |
|---|--------|---------|--------------|
| 0 | Auditoría (este doc) | `docs/CRM_AI_AUDIT.md` | — |
| 1 | Modelo de datos + tipos Zod + flags | colecciones/constantes, sin UI nueva | typecheck, tests de normalización |
| 2 | Servicios CRM (extraer de rutas) | `companyService` stub + contact/list/campaign existentes envueltos | tests de contact create/dedup |
| 3 | Migración script dry-run | reporte empresas derivadas | revisión humana |
| 4 | Navegación CRM | Empresas / Países / Industrias / Casos de uso (catálogo) | lint, UI |
| 5 | Empresas + backfill | vista 360 mínima | tests dedup |
| 6 | Contactos extendidos | `companyId`, flags, compat UI | tests |
| 7–10 | Países, industrias, casos de uso, fuentes | CRUD admin, dejar de hardcodear en componentes | tests |
| 11 | Listas estáticas + memberships; dinámicas detrás de flag | | tests listas dinámicas |
| 12 | Activities timeline | | |
| 13 | Tasks + dashboard Hoy/Vencidas/7 días | | |
| 14 | Opportunities + pipeline configurable | sin auto-score | |
| 15 | Templates versionados + campaign freeze + send snapshot | | tests snapshot |
| 16–18 | Search, filter builder, dashboard stats | counters | no-scan tests |
| 19 | `/api/crm` + `/api/ai` | | |
| 20 | MCP V1 read-only `/mcp/crm` | | tests tools |
| 21 | Prueba ChatGPT real (allowlist) | | manual |
| 22 | MCP V2 escritura baja | idempotencia + audit | tests |
| 23 | Bulk + import wizard + AI inbox | confirmación | |
| 24 | MCP V3/V4 campañas y send | preview token | tests confirmación |

Al cierre de cada etapa: `npm run lint`, `npm run typecheck`, `npm test`, documentar en `docs/crm/` (ARCHITECTURE, DATA_MODEL, API, MCP, PERMISSIONS, MIGRATION, IMPORTS, AI_SECURITY) **cuando esa etapa lo toque**, no todos el día uno.

---

## Decisiones de diseño (cerradas en esta auditoría)

1. **Evolucionar** `/admin/marketing` y `src/lib/marketing`. No hay un segundo CRM.
2. **Prefijo `marketing_`** en Firestore. Los nombres del brief son del modelo de dominio TypeScript, no de las colecciones.
3. **`stage` de email se conserva.** El pipeline comercial es otra entidad.
4. **MCP de producto intacto.** CRM es adapter + scopes + (recomendado) path `/mcp/crm`.
5. **Workspace comercial único de Notificas**, no multitenant de clientes. `organizationId` del brief se interpreta como ese workspace, **nunca** como `orgId` de un cliente autenticado.
6. **No auto-fusionar** empresas dudosas. No auto-avanzar oportunidades por reply.
7. **Snapshot en send + freeze de campaña** es condición para dar por cerrada la etapa de campañas.
8. **No programar** la reescritura hasta validar este documento. La implementación empieza por tipos/servicios/flags, no por UI ni por MCP write.

---

## Referencias de código actual

- Tipos: `src/lib/marketing/types.ts`
- Colecciones: `src/lib/marketing/collections.ts`
- Países: `src/lib/marketing/countries.ts`
- Etapas: `src/lib/marketing/stages.ts`
- CSV / id: `src/lib/marketing/csv.ts`
- Audiencia: `src/lib/marketing/audience.ts`, `lists.ts`
- Envío: `src/lib/marketing/send.ts`
- Eventos: `src/lib/marketing/events.ts`
- Gmail: `src/lib/marketing/gmail.ts`
- MCP producto: `docs/MCP.md`, `src/mcp/`
- Producto CRM vs certificado: `PRODUCT.md`
- Índices: `firestore.indexes.json`
- Rules deny marketing: `firestore.rules` (`marketing_*` → `allow read, write: if false`)
