# Modelo de datos del CRM comercial

Antecedente: [`docs/CRM_AI_AUDIT.md`](../CRM_AI_AUDIT.md). Este documento fija el modelo de la etapa 1 (tipos, colecciones, convenciones). No describe UI ni MCP.

## 1. Tres dominios

| Dominio | Tenant | Colecciones típicas |
|---------|--------|---------------------|
| Producto certificado | `orgId` de la empresa cliente | `campaigns`, `campaign_messages`, `mail`, `contactos` |
| Administración | cookie admin | usuarios, planes, reclamos |
| CRM comercial | `workspaceId` | `marketing_*` |

El CRM **no** usa `orgId` de clientes. ChatGPT sobre `/mcp` (producto) y `/mcp/crm` (comercial, futuro) no comparten scopes (`notifications.send` ≠ `crm.contacts.read`).

## 2. Workspace CRM

Helper: `getMarketingWorkspaceId()` en `src/lib/marketing/workspace.ts`.

- Default: `notificas-internal`
- Override: env `MARKETING_WORKSPACE_ID` (slug `[a-z0-9-]`)
- Toda entidad nueva lleva `workspaceId`
- Staging u otra unidad comercial = otro workspace, no un `orgId` de producto

## 3. Colecciones actuales (v1, en producción)

`marketing_contacts`, `marketing_lists`, `marketing_campaigns`, `marketing_sends`, `marketing_events`, `marketing_settings`

El cliente web no las lee ni escribe (Firestore rules deny-all + Admin SDK).

## 4. Colecciones nuevas

`marketing_companies` (seed `CRM_COMPANIES_V1`), `marketing_countries` / `marketing_industries` / `marketing_use_cases` / `marketing_tags` (seed `CRM_TAXONOMY_V1`, ver [`TAXONOMY.md`](TAXONOMY.md)). Constante TS de países: `MARKETING_COUNTRY_COLLECTION`, para no chocar con el array `MARKETING_COUNTRIES`.

También: `marketing_sources`, `marketing_list_memberships`, `marketing_message_templates`, `marketing_message_template_versions`, `marketing_activities`, `marketing_opportunities`, `marketing_commercial_stages`, `marketing_tasks`, `marketing_saved_searches`, `marketing_duplicate_candidates`, `marketing_stats`.

Posteriores: `marketing_ai_inbox`, `marketing_ai_audit_logs`, `marketing_action_confirmations`.

Prefijo obligatorio `marketing_`. Prohibido crear `contacts`, `campaigns`, `companies`.

## 5. Relaciones

Todas las FKs de operación (`companyId`, `contactId`, `listId`, `templateId`, …) son IDs internos de documento.

Los catálogos tienen **key** lógica (`utilities`, `utility_cutoff_warning`, `AR`) además del id de documento. En `company.industryIds` / `useCaseIds` / `tagIds` y `useCase.industryIds` se persisten **keys**, no hashes, para poder filtrar con `array-contains` sin resolver el árbol. Detalle: [`TAXONOMY.md`](TAXONOMY.md).

```
workspace
  country (code ISO, documento con id propio)
  industry ──parentIndustryId──► industry
  useCase ── industryIds[], countryCodes[]
  company ── countryCode, industryIds[], useCaseIds[], tagIds[], sourceIds[], commercialStageId, ownerId
  contact ── companyId, listIds[] (v1) / memberships (v2), commercialStageId, stage (email)
  list ◄── membership.listId + membership.contactId
  template ── versions (inmutables)
  campaign ── listId, templateId + templateVersion, templateSnapshot
  send ── campaignId, contactId, companyId, messageSnapshot
  opportunity ── companyId, contactIds[], commercialStageId
  task / activity ── companyId / contactId / opportunityId / campaignId
```

Nombre, email, dominio y país sirven para **buscar y deduplicar**, no como relación permanente.

El id de documento de contacto v1 es un hash de email (`contactIdForEmail`). Es un ID sintético, no el email en claro. Entidades operativas nuevas usan UUID (`newMarketingEntityId`). Catálogos seed usan `marketingCatalogId(workspaceId, kind, key)` (hash determinista) + campo `key`.

## 6. `stage` vs `commercialStageId`

| Campo | Significado | Ejemplos |
|-------|-------------|----------|
| `contact.stage` | Engagement de **email** | `new`, `sent`, `opened`, `clicked`, `replied`, `bounced`, `unsubscribed` |
| `commercialStageId` | Pipeline **comercial** | `nuevo`, `interesado`, `demo_realizada`, `cliente` |

Un reply actualiza `stage` (y más adelante una activity `email_replied`). **No** mueve la oportunidad ni asigna `interesado`.

Semilla comercial: `src/lib/marketing/domain/commercial-stages.ts`. Los ids no coinciden con `MARKETING_STAGES`.

## 7. Template vs versión vs snapshot

1. `marketing_message_templates` — identidad lógica (`currentVersion`).
2. `marketing_message_template_versions` — cuerpo inmutable por `version`.
3. `campaign.templateSnapshot` — copia en la campaña al usarse.
4. `send.messageSnapshot` — copia de lo **efectivamente enviado** al destinatario.

Si el template cambia después, el send histórico no cambia. `htmlBody` de la campaña v1 se conserva; el freeze de escritura es etapa posterior.

## 8. Company / contact

Hoy `contact.company` es un string. Se conserva como legacy.

`contact.companyId` → `marketing_companies` se introduce con la migración controlada `CRM_COMPANIES_V1` (`docs/crm/MIGRATION_COMPANIES_V1.md`). El job es preview-first; no fusiona empresas dudosas ni borra el string. Dual representation (`company` + `companyId`) durante la transición.

La clasificación comercial (país / rubro / caso de uso) es `CRM_TAXONOMY_V1` (`docs/crm/TAXONOMY.md`). No reemplaza el origen de la empresa.

Contactos v1 siguen siendo válidos sin `workspaceId`, `companyId` ni `commercialStageId`. Al leerlos por servicios v2 se hidrata `workspaceId = notificas-internal` si falta. `deletedAt` de entidades nuevas se persiste como `null` para queries.

## 9. Soft delete

`deletedAt` / `deletedBy` en empresas, contactos, oportunidades y templates lógicos.

No soft-delete por defecto: activities, template versions, sends, events, campañas ya enviadas, memberships históricas.

## 10. Naming `marketing_*`

El nombre TypeScript puede ser `MarketingCompany`. El nombre Firestore es `marketing_companies`. Nunca el nombre corto del producto certificado.

## 11. IDs

- Nuevos documentos operativos: `newMarketingEntityId()` (UUID).
- Catálogos: `marketingCatalogId(workspaceId, kind, key)` + `key` único por workspace.
- Membership futura: `marketingListMembershipId(listId, contactId)` (hash estable).
- Contactos existentes: no se regeneran.

## 12. Normalización

`src/lib/marketing/normalizers/`

| Helper | Uso |
|--------|-----|
| `normalizeMarketingEmail` | Delega en `normalizeEmail` |
| `normalizeMarketingCompanyName` | minúsculas, sin acentos, sin SA/SRL/Ltd |
| `normalizeMarketingDomain` | host sin `www`, path ni protocolo |
| `normalizeMarketingUrl` | URL canónica |
| `normalizeMarketingPhone` | dígitos, `+` si venía internacional |
| `normalizeMarketingCountryCode` | aliases v1 + ISO, incluye US |

`parseCountry()` / CSV v1 **no** aceptan US todavía (comportamiento actual intacto). El catálogo seed sí incluye US.

## 13. Timestamps

| Capa | Tipo |
|------|------|
| Firestore | `Timestamp` / `FieldValue.serverTimestamp()` |
| Dominio y Zod | ISO-8601 UTC (`MarketingInstant`, string) |
| APIs admin actuales | ISO string vía `serializeAdminDoc` |

No persistir `Date` de JS en Firestore. Los servicios futuros convierten Timestamp → ISO al salir y serverTimestamp al entrar.

## 14. Índices futuros (no desplegados en esta etapa)

Solo se agregarán a `firestore.indexes.json` cuando exista la query.

Previstos:

- `marketing_companies`: `(workspaceId, countryCode, updatedAt DESC)`, `(workspaceId, normalizedName, countryCode)`, `(workspaceId, normalizedDomain, countryCode)`
- `marketing_contacts`: `(workspaceId, companyId, updatedAt DESC)`, `(workspaceId, country, stage, updatedAt DESC)`, `(workspaceId, commercialStageId, updatedAt DESC)`, `(workspaceId, nextFollowUpAt)`
- `marketing_list_memberships`: `(workspaceId, listId, addedAt DESC)`, `(workspaceId, contactId, listId)`
- `marketing_activities`: `(workspaceId, companyId, createdAt DESC)`, `(workspaceId, contactId, createdAt DESC)`
- `marketing_tasks`: `(workspaceId, assignedTo, status, dueAt)`, `(workspaceId, dueAt, status)`
- `marketing_opportunities`: `(workspaceId, countryCode, commercialStageId, updatedAt DESC)`, `(workspaceId, companyId, status)`
- `marketing_campaigns`: `(workspaceId, country, status, createdAt DESC)`
- `marketing_sends`: `(workspaceId, contactId, sentAt DESC)`, `(workspaceId, companyId, sentAt DESC)`

Todas las queries nuevas deben filtrar `workspaceId`. Preferir counters en `marketing_stats` antes que scans de dashboard.

## 15. Compatibilidad

- APIs `/api/admin/marketing/*` no cambian en esta etapa.
- `listIds[]` se mantiene; memberships son dual-write futuro.
- `stage` no se reinterpreta.
- Flags `crm_*` default **false**; ninguna es `NEXT_PUBLIC_*`.
- No hay converters Firestore en el repo; no se introduce una capa competidora.

## Feature flags

`crm_v2`, `crm_ai`, `crm_mcp`, `crm_dynamic_lists`, `crm_bulk_actions`, `crm_opportunities`, `crm_tasks`

Env: `CRM_V2`, `CRM_AI`, `CRM_MCP`, `CRM_DYNAMIC_LISTS`, `CRM_BULK_ACTIONS`, `CRM_OPPORTUNITIES`, `CRM_TASKS`.
