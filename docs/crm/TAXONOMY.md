# Taxonomía CRM comercial — CRM_TAXONOMY_V1

Rectores: [`docs/CRM_AI_AUDIT.md`](../CRM_AI_AUDIT.md), [`DATA_MODEL.md`](DATA_MODEL.md), [`SERVICES.md`](SERVICES.md).

Esta etapa persiste catálogos administrables y clasifica las empresas ya migradas. **No** rediseña UI, Kanban, MCP, `/api/ai` ni campañas.

Jerarquía comercial:

```text
PAÍS → INDUSTRIA / RUBRO → CASO DE USO → EMPRESA → CONTACTOS
```

Una empresa puede tener varios casos de uso sin duplicarse.

---

## 1. Países (`marketing_countries`)

Workspace: `notificas-internal`.

| key / code | name | defaultLanguage |
|---|---|---|
| AR | Argentina | es |
| UY | Uruguay | es |
| PY | Paraguay | es |
| CL | Chile | es |
| PE | Perú | es |
| CO | Colombia | es |
| MX | México | es |
| CR | Costa Rica | es |
| BR | Brasil | pt |
| US | Estados Unidos | en |

El allowlist TypeScript (`MARKETING_COUNTRY_SEED_CORE` / `listCountries()`) sigue validando códigos ISO. Esta seed **además** escribe documentos Firestore administrables.

`getByKey("AR")` lee el documento persistido. `validateCountryCode` no depende de que el seed ya se haya aplicado.

---

## 2. Industrias

Identidad lógica = `key` (slug). Nombre visible ≠ key.

| key | name | parent |
|---|---|---|
| insurance | Seguros | — |
| banking | Bancos | — |
| fintech | Fintech | — |
| collections | Cobranzas | — |
| debt_portfolios | Compra / gestión de carteras | — |
| factoring | Factoring | — |
| utilities | Servicios públicos | — |
| telecommunications | Telecomunicaciones | — |
| legal | Servicios jurídicos | — |
| automotive | Automotriz | — |
| healthcare | Salud | — |
| government | Gobierno | — |
| retail | Retail | — |
| ecommerce | E-commerce | — |
| real_estate | Inmobiliario | — |
| education | Educación | — |
| logistics | Logística | — |
| other | Otros | — |

Banking, fintech y factoring quedan hermanos. No hay un padre “servicios financieros” redundante.

---

## 3. Subindustrias

`parentIndustryId` apunta al **documento** padre (hash determinista). El `key` del padre se usa al asignar y al expandir.

| key | name | parent key |
|---|---|---|
| insurance_carriers | Aseguradoras | insurance |
| workers_compensation | Riesgos del trabajo / ART | insurance |
| insurance_brokers | Productores / brokers | insurance |
| utilities_gas | Gas | utilities |
| utilities_electricity | Electricidad | utilities |
| utilities_water | Agua | utilities |

---

## 4. Casos de uso

Entidad central. `industryIds` guarda **keys** de industria (puede ser más de una). `countryCodes: []` = global.

| key | name | industries |
|---|---|---|
| insurance_claim_rejection | Rechazo de siniestro | insurance |
| insurance_policy_cancellation | Rescisión / cancelación de póliza | insurance |
| insurance_payment_default | Mora del asegurado | insurance |
| insurance_contract_notice | Comunicaciones contractuales fehacientes | insurance |
| insurance_claim_notice | Comunicaciones relacionadas con siniestros | insurance |
| workers_compensation_worker_notice | Comunicaciones al trabajador | workers_compensation (+ insurance) |
| workers_compensation_employer_notice | Comunicaciones al empleador | workers_compensation (+ insurance) |
| workers_compensation_medical_notice | Comunicaciones médico-administrativas | workers_compensation (+ insurance) |
| workers_compensation_contract_notice | Comunicaciones contractuales fehacientes | workers_compensation (+ insurance) |
| collections_payment_demand | Intimación de pago | collections |
| collections_prelegal_notice | Aviso previo a gestión judicial | collections |
| collections_credit_reporting_notice | Aviso previo a reporte de deuda | collections |
| collections_debt_status_notice | Comunicación de estado de deuda | collections |
| debt_assignment_notice | Notificación de cesión de crédito | debt_portfolios, factoring, banking, fintech, collections |
| debt_portfolio_transfer_notice | Comunicación de transferencia de cartera | ídem |
| debtor_new_creditor_notice | Comunicación de nuevo acreedor | ídem |
| factoring_assignment_notice | Notificación al deudor cedido | factoring |
| factoring_payment_instruction | Comunicación de instrucciones de pago | factoring |
| factoring_contract_notice | Comunicación contractual | factoring |
| utility_cutoff_warning | Aviso previo de corte | utilities + gas/electricidad/agua |
| utility_payment_default | Mora | utilities + subrubros |
| utility_service_suspension | Suspensión del servicio | utilities + subrubros |
| utility_reconnection_notice | Reconexión | utilities + subrubros |
| utility_contract_change | Cambios contractuales | utilities + subrubros |
| utility_debt_notice | Comunicación de deuda | utilities + subrubros |
| telecom_payment_default | Mora | telecommunications |
| telecom_service_suspension | Suspensión | telecommunications |
| telecom_termination | Baja / rescisión | telecommunications |
| telecom_debt_notice | Comunicación de deuda | telecommunications |
| telecom_contract_notice | Comunicación contractual | telecommunications |
| financial_payment_default | Intimación de pago | banking, fintech |
| financial_contract_notice | Comunicación contractual | banking, fintech |
| financial_debt_assignment | Cesión de crédito | banking, fintech |
| financial_data_notice | Comunicación relacionada con datos crediticios | banking, fintech |
| financial_collection_notice | Gestión de cobranza | banking, fintech |
| legal_extrajudicial_notice | Intimación extrajudicial | legal |
| legal_contract_notice | Notificación contractual | legal |
| legal_default_notice | Constitución en mora | legal |
| legal_document_delivery | Entrega acreditable de documentación | legal |

No intenta cubrir todas las figuras jurídicas mundiales. Es una base comercial de Notificas.

---

## 5. Tags

Tags operativos / de relación. **No** duplican país ni rubro.

| key | name |
|---|---|
| institutional_contact | Contacto institucional |
| technical_contact | Contacto tecnológico |
| legal_contact | Contacto legal |
| commercial_contact | Contacto comercial |
| high_priority | Prioridad alta |
| referred | Referido |
| event_contact | Evento |
| linkedin | LinkedIn |
| association | Asociación |
| interested | Interesado |
| demo_pending | Demo pendiente |
| test_record | Registro de prueba |
| classification_pending | Clasificación pendiente |

`classification_pending` es el mecanismo explícito para empresas sin rubro (p. ej. Empresa Sur). No es un tag comercial de país/industria.

---

## 6. Naming

- `key`: slug estable, snake_case ASCII (`utilities`, `utility_cutoff_warning`).
- `name`: display en español.
- No usar el display como FK.
- No usar UUID aleatorio como identidad lógica del catálogo.

---

## 7. Keys / slugs / IDs de documento

Hay dos capas:

1. **Identidad lógica (`key`)** — lo que se guarda en `company.industryIds`, `company.useCaseIds`, `company.tagIds` y `useCase.industryIds`. Sirve para `array-contains` y para migraciones/UI/MCP.
2. **ID de documento Firestore** — `marketingCatalogId(workspaceId, kind, key)` (SHA-256 truncado). No es UUID aleatorio. Evita colisiones entre workspaces si ambos tienen `utilities`.

`getByKey(workspace, key)` resuelve el documento. Unique conceptual: `workspace + kind + key`.

Países: `key === code` (ISO-2).

---

## 8. Company ↔ industry

Convención elegida (filtros Firestore, esta escala):

```ts
industryIds: ["utilities", "utilities_gas"]
```

Se persisten **padre + hoja** para poder filtrar:

- `array-contains "utilities"`
- `array-contains "utilities_gas"`

sin resolver el árbol en cada query.

El service expande solo. Si el caller pasa `utilities_gas`, se incluye `utilities`. No se agregan hijos al asignar solo el padre.

`parentIndustryId` en el documento de industria es FK interna al id de documento del padre.

Naturgy, Naturgy NOA y Gasnor / Naturgy NOA comparten taxonomía y **siguen siendo empresas distintas**.

---

## 9. Company ↔ use case

```ts
useCaseIds: ["utility_cutoff_warning"]
```

Una empresa suma casos de uso después (`utility_payment_default`) sin duplicar la empresa.

Los contactos **no** copian `industryIds`. Se derivan de `contact.companyId → company.industryIds`. `contact.useCaseIds` queda para excepciones futuras, no se llena en esta seed.

---

## 10. Global vs country-specific

```ts
countryCodes: []
appliesToAllCountries: true
```

significa **global / no restringido**. No significa “no aplica en ningún país”.

Si más adelante un caso es solo AR/CL, `countryCodes: ["AR", "CL"]` y `appliesToAllCountries: false`.

---

## 11. Seed `CRM_TAXONOMY_V1`

Independiente de `CRM_COMPANIES_V1`.

```text
npm run crm:seed:taxonomy
npm run crm:seed:taxonomy -- --mode=apply --confirm=CRM_TAXONOMY_V1
```

Default: **preview** (no escribe). Apply usa `countryService`, `industryService`, `useCaseService`, `tagService`, `companyService`. No escribe Firestore directo.

- Idempotente: segunda ejecución `CREATE=0`, sin UPDATE no intencional.
- Upsert, no sync destructivo: si el seed deja de incluir `factoring`, **no** se borra.
- Distingue CREATE / UPDATE / UNCHANGED (p. ej. cambio de display name).
- No crea activities. La clasificación queda documentada por `updatedBy = CRM_TAXONOMY_V1`.
- No cambia `createdBy` ni `sourceIds` (`Migración CRM legacy`).

Clasificación inicial de empresas de gas:

```text
industryIds: utilities, utilities_gas
useCaseIds: utility_cutoff_warning
```

No se asignan todos los casos de utilities posibles: el criterio es **qué estamos ofreciendo ahora** (aviso previo de corte), no todo lo aplicable.

Empresa Sur: `industryIds: []`, `useCaseIds: []`, tag `classification_pending`. No se inventa rubro.

---

## 12. Estrategia futura

- Etapa 5: UI CRM v2 (países → rubros → empresas → contactos, matriz país × rubro).
- Filtros y listas dinámicas sobre `industryIds` / `useCaseIds` / `countryCode`.
- Campañas segmentadas por la misma taxonomía.
- Casos de uso country-specific cuando el producto lo exija.
- Eliminación de catálogos: manual / explícita, nunca por seed.
- `contact.useCaseIds` sólo si un contacto diverge de la empresa.

El CRM debe responder con datos, no con notas:

```text
¿En qué países estamos prospectando?
¿Qué rubros estamos trabajando?
¿Qué casos de uso estamos ofreciendo?
¿Qué empresas corresponden a cada combinación?
```
