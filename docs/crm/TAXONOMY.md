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

Catálogo **fijo y plano**. No se inventan rubros al importar CSV ni al crear campañas. ART no cuelga de Seguros. Gas no cuelga de servicios públicos. Un caso de uso nunca es un rubro.

| key | name |
|---|---|
| seguros | Seguros |
| art | ART / Riesgos del Trabajo |
| bancos | Bancos |
| financieras | Financieras / Crédito |
| fintech | Fintech / Pagos |
| mercado_capitales | Mercado de Capitales / ALyC |
| cobranzas | Cobranzas / Recupero |
| carteras_credito | Compra y Administración de Carteras |
| factoring | Factoring / Factoraje |
| cooperativas_credito | Cooperativas / Crédito Mutual |
| retail_credito | Retail con Crédito Propio |
| telecomunicaciones | Telecomunicaciones |
| gas | Gas / Distribución de Gas |
| electricidad | Electricidad / Energía |
| agua_saneamiento | Agua y Saneamiento |
| servicios_publicos | Otros Servicios Públicos |
| rrhh | RR.HH. / Relaciones Laborales |
| estudios_juridicos | Estudios Jurídicos |
| bpo_contact_center | BPO / Contact Center |
| ecommerce | E-commerce / Comercio Digital |
| leasing | Leasing / Financiamiento de Activos |
| inmobiliario | Inmobiliario / Administradores |
| salud | Salud |
| gobierno | Gobierno / Administración Pública |
| judicial | Poder Judicial / Organismos Jurídicos |
| tecnologia | Tecnología / SaaS |
| certificacion_digital | Certificación Digital / Comunicaciones Certificadas |
| postal_logistica | Correo / Postal / Logística Documental |
| agro | Agro / Agronegocios |
| logistica_puertos | Logística / Puertos / Comercio Exterior |
| otros | Otros |

Keys del catálogo anterior (`insurance`, `utilities_gas`, `debt_portfolios`, `legal`, …) se resuelven como alias. No aparecen en la UI.

---

## 3. Subindustrias

El catálogo comercial **no usa subrubros**. `parentIndustryId` sigue existiendo en el modelo por si un workspace arma un árbol propio; la semilla de Notificas no lo usa.

---

## 4. Casos de uso

Entidad distinta del rubro. `industryIds` guarda **keys** de industria (puede ser más de una). `countryCodes: []` = global.

| key | name | industries |
|---|---|---|
| cesion_credito | Notificación de cesión de crédito | carteras_credito, factoring, bancos, financieras, fintech, cobranzas |
| transferencia_cartera | Comunicación de transferencia de cartera | carteras_credito, factoring, cobranzas, bpo_contact_center |
| nuevo_acreedor | Comunicación de nuevo acreedor | carteras_credito, factoring, cobranzas |
| intimacion_pago | Intimación de pago | cobranzas, bancos, financieras, fintech, estudios_juridicos, leasing, cooperativas_credito, retail_credito |
| preaviso_morosidad | Preaviso de morosidad | bancos, financieras, fintech, cobranzas, utilities |
| preaviso_reporte_crediticio | Preaviso de reporte crediticio | cobranzas, bancos, financieras, fintech, carteras_credito |
| cobranza_temprana | Cobranza temprana | cobranzas, bancos, financieras, fintech, bpo_contact_center, retail_credito |
| cobranza_prejudicial | Cobranza prejudicial | cobranzas, estudios_juridicos, bpo_contact_center, carteras_credito |
| aviso_corte | Aviso previo de corte | gas, electricidad, agua_saneamiento, servicios_publicos, telecomunicaciones |
| suspension_servicio | Suspensión del servicio | ídem |
| reconexion | Reconexión | ídem |
| rechazo_siniestro | Rechazo de siniestro | seguros |
| rescision_poliza | Rescisión / cancelación de póliza | seguros, art |
| notificacion_trabajador | Notificación al trabajador | art, rrhh |
| notificacion_empleador | Notificación al empleador | art, rrhh |
| entrega_documentacion | Entrega acreditable de documentación | estudios_juridicos, judicial, certificacion_digital, postal_logistica, mercado_capitales |
| cambio_contractual | Cambio contractual | seguros, art, bancos, factoring, mercado_capitales, utilities |
| aviso_comitentes | Aviso fehaciente a comitentes | mercado_capitales, bancos, fintech |

Ejemplos de audiencia:

```text
CO → carteras_credito → cesion_credito
UY → gas → aviso_corte
AR → seguros → rechazo_siniestro
AR → mercado_capitales → aviso_comitentes
```

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

- `key`: slug estable, snake_case ASCII (`gas`, `aviso_corte`, `carteras_credito`).
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
industryIds: ["gas"]
```

Se persiste la **key canónica**. El catálogo es plano: filtrar gas no requiere expander un padre.

Si un workspace arma un árbol propio, el service sigue expandiendo padre+hoja. La semilla de Notificas no lo hace.

Naturgy, Naturgy NOA y Gasnor / Naturgy NOA comparten taxonomía y **siguen siendo empresas distintas**.

---

## 9. Company ↔ use case

```ts
useCaseIds: ["aviso_corte"]
```

Una empresa suma casos de uso después (`preaviso_morosidad`) sin duplicar la empresa.

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
industryIds: gas
useCaseIds: aviso_corte
```

No se asignan todos los casos de utilities posibles: el criterio es **qué estamos ofreciendo ahora** (aviso previo de corte), no todo lo aplicable.

Empresa Sur: `industryIds: []`, `useCaseIds: []`, tag `classification_pending`. No se inventa rubro.

---

## 12. Estrategia futura

- Etapa 5: UI CRM v2 (países → rubros → empresas → contactos, matriz país × rubro).
- Filtros y listas dinámicas sobre `industryIds` / `useCaseIds` / `countryCode`.
- Campañas e import CSV segmentados por **País + Rubro + Caso de uso** del catálogo fijo.
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
