# Migración CRM_COMPANIES_V1

Rectores: [`docs/CRM_AI_AUDIT.md`](../CRM_AI_AUDIT.md), [`DATA_MODEL.md`](DATA_MODEL.md), [`SERVICES.md`](SERVICES.md). Overrides: `src/lib/marketing/migrations/company-overrides.ts`. Verificador: `verifyCompaniesMigration()`.

**Estado (notificas-f9953 / notificas-internal):** `COMPLETED`.

No volver a ejecutar apply. El cierre es `--mode=status`, no un count histórico `CREATE=10`.

Código: `src/lib/marketing/migrations/`. CLI: `scripts/marketing/migrate-companies.ts`.

## 1. Objetivo

Convertir progresivamente el string legacy:

```ts
contact.company?: string
```

en una relación:

```ts
contact.companyId?: string  // → marketing_companies
```

Sin perder información, sin fusionar empresas automáticamente, sin cambiar IDs de contactos, sin tocar campañas, listas, UI, MCP, IA ni APIs admin.

Durante la transición conviven ambos campos (dual representation).

## 2. Datos fuente

| Fuente | Uso |
|--------|-----|
| `marketing_contacts.company` | string legacy, se agrupa |
| `marketing_contacts.companyId` | si ya existe, se verifica |
| `marketing_contacts.country` / `countryCode` | candidatos de país del grupo |
| dominio del email | `domainCandidate` (no website oficial) |
| `marketing_companies` | match contra empresas v2 ya creadas |

El job pagina la colección completa (excepción controlada). Los servicios normales (`searchContacts`) **no** ganan un scan equivalente.

Contactos de otro `workspaceId` no entran. Contactos v1 sin workspace se hidratan como `notificas-internal`. Soft-deleted se omiten.

Pendiente explícito, **fuera de esta migración**: agregar US al CSV/import v1.

## 3. Normalización

| Uso | Helper |
|-----|--------|
| Display y persistencia (`name`, `normalizedName`) | `normalizeMarketingCompanyName()` |
| Matching / agrupamiento | `normalizeCompanyNameForMatching()` |
| Dominio | `normalizeMarketingDomain()` |

**Display normalization ≠ matching normalization.**

El matching además pliega residuos de formas jurídicas del estilo `S.A. de C.V.` que el normalizador de display deja (terminan en `cv`, no en `sa`). El nombre persistido conserva la variante canónica original (`Sancor Seguros S.A.` no se reescribe a `Sancor Seguros`).

No hay normalizadores locales ni llamadas a LLM/OpenAI.

Dominios de correo genéricos (gmail, hotmail, outlook, yahoo, icloud, live, …) se listan en `GENERIC_EMAIL_DOMAINS`. No se usan como website.

Strings basura (`-`, `N/A`, `Particular`, `Sin empresa`, `No informa`, `Consumidor`, …) están en `INSUFFICIENT_COMPANY_NAMES`. Lista corta; no se crean companies con esos nombres.

## 4. Clasificación

Agrupación primaria: `normalizeCompanyNameForMatching(company)`.

Se conservan `originalValues` y se propone `suggestedCompanyName` (variante más frecuente; en empate, no ALL CAPS).

| Clase | Criterio | ¿Apply? |
|-------|----------|---------|
| `SAFE_CREATE` | sin company compatible; país single o missing; ≤1 dominio corporativo | sí |
| `SAFE_LINK` | una company inequívoca (mismo `normalizedDomain`, o company creada por esta migración) | sí |
| `PROBABLE_MATCH` | p.ej. mismo nombre+país sin dominio; diferencias secundarias | no |
| `AMBIGUOUS` | varias companies, varios países, varios dominios, `companyId` roto o conflictivo | no |
| `INSUFFICIENT_DATA` | company vacío/basura | no |
| `ALREADY_MIGRATED` | `companyId` válido, mismo workspace, no deleted, coherente con el string | no |

`companyId` vs string distinto → `AMBIGUOUS` / `legacy_company_conflicts_with_linked_company`. No se sobrescribe.

Nombre+país **sin** dominio exacto es `PROBABLE_MATCH`, no `SAFE_LINK`.

## 5. Preview

Default. No crea empresas. No modifica contactos.

```bash
npm run crm:migrate:companies
npm run crm:migrate:companies -- --mode=preview
```

Salida:

- resumen CLI (incluye `Mode: PREVIEW` y `NO DATA WAS MODIFIED`)
- `artifacts/crm-company-migration-preview.json`
- `artifacts/crm-company-migration-preview.csv`

Esos archivos no se versionan (`.gitignore`). El CSV no incluye emails completos; el JSON lista `contactId` y dominio, no cuerpos de mail ni notas.

Metadata:

```ts
{ migrationId: "CRM_COMPANIES_V1", mode: "preview", startedAt, completedAt }
```

## 6. Apply

Implementado y cubierto por tests de memoria. **No ejecutar contra datos reales hasta revisión humana.**

```bash
npm run crm:migrate:companies -- --mode=apply --confirm=CRM_COMPANIES_V1
```

`--apply` solo no alcanza. No hay prompt interactivo.

Apply:

1. Recomputa el preview (no confía en un JSON manipulado).
2. Revalida cada grupo inmediatamente antes de escribir (puede haber aparecido una company).
3. Solo `SAFE_CREATE` y `SAFE_LINK`.
4. Crea vía `companyService.createCompany()`.
5. Enlaza vía `contactService.updateContact({ companyId })`.
6. **No** modifica `contact.company`.
7. Una sola source: `Migración CRM legacy` / `manual` / `metadata.migrationId = CRM_COMPANIES_V1`.

Batches de contactos (25). Errores parciales se registran (`group`, `contactId`/`companyId`, `operation`, `reason`). Nunca afirma “migración completa” si hubo errores.

`PROBABLE_MATCH` y `AMBIGUOUS` se mapean a `REVIEW` en el plan. Apply **aborta** si el verificador no dice `READY_TO_APPLY`. No existe `--allow-unresolved`.

Un override `CREATE`/`LINK` sobre un grupo `ALREADY_MIGRATED` no vuelve a crear: queda `SKIP` con `already_migrated`.

## 6.1 Estado formal

`verifyCompaniesMigration()` es **solo lectura**. No hay colección extra de migrations: el estado se deriva de invariantes (contactos, `companyId`, companies, overrides). `appliedAt` se lee de la source `Migración CRM legacy` si existe.

| Status | Significado |
|--------|-------------|
| `NOT_STARTED` | Nada comercial vinculado; el plan no está listo (p.ej. REVIEW) o no hay trabajo |
| `READY_TO_APPLY` | Hay CREATE/LINK, review=0, sin vínculos comerciales aún, sin roturas |
| `PARTIALLY_APPLIED` | Algunos comerciales vinculados y todavía queda trabajo |
| `COMPLETED` | Todos los grupos comerciales esperados tienen `companyId` válido; SKIP humanos siguen excluidos; review=0; 0 roturas |
| `INCONSISTENT` | `companyId` roto, company de otro workspace/soft-deleted, conflicto legacy, o SKIP vinculado |

Apply:

- `COMPLETED` → `CRM_COMPANIES_V1_ALREADY_COMPLETED` (no es un “plan inesperado”)
- `PARTIALLY_APPLIED` / `INCONSISTENT` → abort + revisión humana
- sólo `READY_TO_APPLY` puede escribir, con `--confirm=CRM_COMPANIES_V1`

No se usa `CREATE==10` / `SKIP==1` como definición de completo. El CRM puede crecer; COMPLETED mira invariantes.

```bash
npm run crm:migrate:companies -- --mode=status
```

## 11. Overrides humanos (etapa 3.1)

Archivo versionado: `src/lib/marketing/migrations/company-overrides.ts`.

El algoritmo **no** contiene reglas para Naturgy ni “(prueba)”. Las excepciones comerciales viven solo ahí.

Acciones: `CREATE` | `LINK` | `SKIP` | `REVIEW`.

Cada grupo del plan final declara:

- `automaticClassification` — salida del clasificador
- `effectiveAction` — CREATE/LINK/SKIP/REVIEW
- `decisionSource` — `algorithm` | `human_override`

`emailDomainCandidate` ≠ `companyDomain`. El dominio de email es evidencia y warning; no se copia a `website`/`normalizedDomain` salvo override humano de `domain`.

Dominio de email compartido entre grupos → `sharedDomainWithOtherGroups` (WARNING, no merge).

Cuentas **deliberadamente separadas** (override humano, no heurística):

- Naturgy
- Naturgy NOA
- Gasnor / Naturgy NOA

Comparten taxonomía posible; no son merge. `naturgy.com.ar` entre Naturgy y Naturgy NOA es warning aceptado.

Notificas (prueba) es `SKIP` / `test_record`. No está en una blacklist global de “(prueba)”.

## 12. Preflight de índices

Apply no arranca si fallan las queries reales de:

- `marketing_companies` `(workspaceId, normalizedDomain)`
- `marketing_companies` `(workspaceId, normalizedName, countryCode)`
- `marketing_sources` `(workspaceId, createdAt DESC)`

Comando de despliegue:

```bash
firebase deploy --only firestore:indexes --project notificas-f9953
```

Check: el preview/apply imprimen `Required indexes: READY|NOT READY` tras probes (no basta con el JSON local).

## 13. Comandos

```bash
npm run crm:migrate:companies
# preview automático + plan final con overrides

npm run crm:migrate:companies -- --mode=status
# verificador READ ONLY: NOT_STARTED | READY_TO_APPLY | PARTIALLY_APPLIED | COMPLETED | INCONSISTENT

# Apply sólo si status == READY_TO_APPLY:
# npm run crm:migrate:companies -- --mode=apply --confirm=CRM_COMPANIES_V1
```

## 7. Idempotencia

Segunda ejecución: contactos ya bien enlazados → `ALREADY_MIGRATED`. No crea otra company. No reescribe enlaces correctos.

Si apply creó la company y falló a mitad de los links, la company queda con la source de migración y el revalidate puede tratar el resto como `SAFE_LINK` (`migration_owned_name_match`).

## 8. Ambiguos

Quedan fuera de apply. Ejemplos:

- mismo nombre, países distintos
- varios dominios corporativos
- dos companies existentes candidatas
- `companyId` inexistente o de otra empresa
- string legacy vs company enlazada distintos

La IA podrá ayudar a revisarlos después. No durante esta migración.

## 9. Rollback

Definido **antes** de cualquier apply real.

1. `contact.company` no se borra: se puede vaciar `companyId` de los contactos tocados por esta migración y volver al string.
2. Companies creadas por el job se reconocen por `sourceIds` → source `Migración CRM legacy` con `metadata.migrationId = CRM_COMPANIES_V1`.
3. Borrar esas companies **solo** si se pide rollback expreso, no tienen referencias posteriores (oportunidades, tasks, activities, otros contactos no migrados por este job) y se confirma a mano.
4. No hay borrado agresivo implementado. No hay “undo” automático en el CLI.

## 10. Comandos

```bash
npm run crm:migrate:companies
# equivale a --mode=preview (automático + final)

npm run crm:migrate:companies -- --mode=preview --workspace=notificas-internal --out-dir=artifacts
npm run crm:migrate:companies -- --mode=status

# No ejecutar: la migración en producción está COMPLETED.
# npm run crm:migrate:companies -- --mode=apply --confirm=CRM_COMPANIES_V1
```

El CLI imprime `Firebase project`, `Workspace` y `Mode` antes de trabajar.

Si `marketing_companies` está vacía, el preview no dispara lookups compuestos (los índices v2 pueden no estar desplegados todavía). El matching contra companies existentes se activa cuando hay al menos un documento.

No hay cron, endpoint web ni hook de deploy.

Tests (memoria, sin Firestore real): `src/lib/marketing/migrations.test.ts`.
