# Servicios de dominio CRM

Rectores: [`docs/CRM_AI_AUDIT.md`](../CRM_AI_AUDIT.md), [`docs/crm/DATA_MODEL.md`](DATA_MODEL.md).

Esta etapa introduce la capa reusable. **No** hay `/api/crm`, `/api/ai` ni `/mcp/crm`. Las rutas `/api/admin/marketing/*` no fueron reescritas.

## 1. Arquitectura

```
UI / API / MCP / jobs     (futuro)
        ↓
createMarketingServices(repos)     src/lib/marketing/services/
        ↓
MarketingRepositories              interface
        ↓
memory | firestore                 src/lib/marketing/repositories/
        ↓
marketing_*
```

Los servicios no importan Next.js, cookies, MCP ni OpenAI. Reciben `MarketingServiceContext`.

Factory: `createMarketingServices(repos)`. Persistencia real: `createFirestoreMarketingRepositories()`. Tests: `createMemoryMarketingRepositories()`.

## 2. Service context

```ts
{
  workspaceId: string
  actorType: "user" | "system" | "ai"
  actorId?: string
  idempotencyKey?: string  // aceptado, ignorado en etapa 2
}
```

`workspaceId` lo fija la capa de entrada (`getMarketingWorkspaceId()` u otro workspace explícito). El dominio **no** asume `notificas-internal`.

## 3. Repositories

Interfaces en `repositories/types.ts`. Implementaciones:

- `repositories/memory.ts` — tests, sin Firestore
- `repositories/firestore.ts` — Admin SDK, convierte ISO ↔ Timestamp

No hay converters de Firestore; el mapeo vive en `persistence/timestamps.ts` y `persistence/documents.ts`.

## 4. Workspace scoping

Toda entidad v2 se lee/escribe con `workspaceId`. Un `get` de otro workspace se comporta como **not found** (repositorio filtrado). Los contactos se cargan por id sintético (email hash) y después se valida workspace: ahí sí puede aparecer `MarketingWorkspaceMismatchError`.

Contactos v1 **sin** `workspaceId` se hidratan como `notificas-internal` al leer. Un workspace distinto no los ve. `searchContacts` sin `country`/`companyId` solo lista documentos que ya tienen `workspaceId` (los v1 puros no aparecen hasta el backfill). Búsqueda por email sí los encuentra y los hidrata.

## 5. Timestamps

Única capa: `toFirestoreTimestamp` / `fromFirestoreTimestamp`. Dominio = ISO. Firestore = `Timestamp`. `deletedAt` se persiste como `null` en altas para poder queryar `deletedAt == null`.

## 6. Paginación

`MarketingPage<T> { items, nextCursor? }`. Cursor opaco (base64url de `{ t, id }`). Límite default 50, máximo 100. Sin offsets.

## 7. Búsqueda

Filtros estructurados. **No** hay full-text ni `collection.get()` masivo en servicios normales.

Excepción controlada: el job `CRM_COMPANIES_V1` pagina `marketing_contacts` server-side (batches, p.ej. 500) solo para esa migración. No se expone como `searchContacts`.

Companies:

- `query` → lookup por dominio normalizado o nombre exacto (no substring)
- un extra de igualdad: `countryCode` **o** `status` **o** `commercialStageId`
- **o** `industryId` / `useCaseId` (array-contains), no combinables entre sí ni con país todavía

Contacts:

- email en `query` → `getByEmail`
- `companyId` o `country` + `updatedAt`
- `stage` / `commercialStageId` se aplican sobre la página, no con scan global

Pendiente: substring, país+industria, listado v1 completo sin `workspaceId`.

## 8. Catálogos persistidos

`countryService` sigue exponiendo `listCountries()` / `validateCountryCode()` contra el seed TypeScript (ISO + US). Además persiste `marketing_countries` con `createCountry` / `getByKey` / `listPersistedCountries`.

`industryService`, `useCaseService` y `tagService` exigen `key` estable en el alta. `getByKey()` resuelve workspace+key. El id de documento es `marketingCatalogId`, no UUID aleatorio.

Al asignar `industryIds` (empresa o caso de uso), el service **expande el padre si existe**. El catálogo comercial actual es **plano** (`gas`, `art`, `seguros` son hermanos). Keys del catálogo anterior (`utilities_gas`, `insurance`) se canonicalizan. Si el documento Firestore aún no existe, se acepta la key de la semilla fija. No depende del caller.

`useCase.countryCodes: []` implica `appliesToAllCountries: true` (global). Ver [`TAXONOMY.md`](TAXONOMY.md). Seed: `npm run crm:seed:taxonomy` (`CRM_TAXONOMY_V1`, preview default).

## 9. Duplicados de empresa

Al crear:

| Tipo | Criterio | Efecto |
|------|----------|--------|
| exact | `normalizedDomain` igual, mismo workspace, no borrada | warning; **no bloquea ni fusiona** |
| probable | `normalizedName` + `countryCode` | warning; no bloquea |
| possible | no implementado | — |

## 10. Templates / versiones

`createTemplate` abre v1. `createTemplateVersion` incrementa en transacción (Firestore `runTransaction`; memory equivalente). No existe `updateTemplateVersion`. El HTML de v1 permanece al crear v2.

## 11. Backward compatibility

`/api/admin/marketing/*` intactas. `contact.listIds[]` intacto. Memberships v2 **no** están enchufadas a esas APIs (sin dual-write silencioso). `contact.company` string se conserva junto a `companyId`.

## 12. Funciones legacy

| Área | Decisión |
|------|----------|
| `csv.normalizeEmail` / `contactIdForEmail` | A. reutilizar |
| `countries.parseCountry` | C. legacy CSV v1; country service usa seed + normalizer (incluye US) |
| `stages` / `nextStage` | A. reutilizar; no es pipeline comercial |
| `audience` / `lists` / APIs de listas | C. temporal; memberships en paralelo |
| `send.ts` / campañas | C. no tocar envío |
| `events.ts` / Gmail / tokens | C. events de email ≠ `marketing_activities` |
| `serializeAdminDoc` | C. APIs admin actuales |
| Contact POST admin | C. no reescribe a `contactService` todavía |

## 13. Índices agregados (`firestore.indexes.json`)

Usados por `repositories/firestore.ts`:

- `marketing_companies`: `(workspaceId, deletedAt, updatedAt DESC)` y variantes con `countryCode` / `status` / `commercialStageId`; array-contains `industryIds` y `useCaseIds`; `(workspaceId, normalizedDomain)`; `(workspaceId, normalizedName, countryCode)`
- `marketing_contacts`: `(workspaceId, updatedAt DESC)`, `(workspaceId, companyId, updatedAt DESC)` — el de `(country, updatedAt DESC)` ya existía
- catálogos: industries/tags `(workspaceId, normalizedName)` y `(workspaceId, updatedAt DESC)`; use_cases y sources por workspace + tiempo; `marketing_countries` `(workspaceId, updatedAt DESC)`
- memberships: `(workspaceId, listId, addedAt DESC)`, `(workspaceId, contactId, addedAt DESC)`
- templates + versions `(workspaceId, templateId, version)`
- activities por company/contact/opportunity + `createdAt DESC`
- tasks: `(workspaceId, updatedAt DESC)`, `(workspaceId, status, dueAt)`, `(workspaceId, assignedTo, status, dueAt)`, `(workspaceId, companyId, dueAt)`
- opportunities: `(workspaceId, deletedAt, updatedAt DESC)` y con `companyId`

## 14. Decisiones pendientes

- Backfill `workspaceId` en contactos v1 (queda fuera de `CRM_COMPANIES_V1`; el scanner hidrata el default al leer).
- US en CSV/import v1 (no mezclar con la migración de companies).
- Dual-write `listIds` ↔ memberships (no en APIs actuales).
- Bloquear creación si el dominio es exact duplicate (hoy solo warning).
- `possible` duplicates (fuzzy).
- Idempotency keys reales.
- Activity automática en create/update.
- Combinaciones de filtros país × industria.
