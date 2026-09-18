import { MARKETING_COUNTRY_SEED_CORE } from "../domain/country-seed";
import { CLASSIFICATION_PENDING_TAG_KEY } from "./constants";

export type TaxonomyCountrySeed = {
  code: string;
  name: string;
  defaultLanguage: string;
  active: boolean;
};

export type TaxonomyIndustrySeed = {
  key: string;
  name: string;
  parentKey?: string;
  active: boolean;
  /** Palabras para buscar en la UI. No son keys persistidas. */
  keywords?: readonly string[];
};

export type TaxonomyUseCaseSeed = {
  key: string;
  name: string;
  industryKeys: string[];
  countryCodes: string[];
  active: boolean;
  keywords?: readonly string[];
};

export type TaxonomyTagSeed = {
  key: string;
  name: string;
  active: boolean;
};

export const TAXONOMY_COUNTRIES: readonly TaxonomyCountrySeed[] = MARKETING_COUNTRY_SEED_CORE.map((row) => ({
  code: row.code,
  name: row.name,
  defaultLanguage: row.defaultLanguage,
  active: true,
}));

/**
 * Catálogo fijo de rubros. Plano: no hay subrubros.
 * ART no cuelga de Seguros. Gas no cuelga de servicios públicos.
 * Un caso de uso (cesión, corte, rechazo) nunca es un rubro.
 */
export const TAXONOMY_INDUSTRIES: readonly TaxonomyIndustrySeed[] = [
  { key: "seguros", name: "Seguros", active: true },
  { key: "art", name: "ART / Riesgos del Trabajo", active: true },
  { key: "bancos", name: "Bancos", active: true },
  { key: "financieras", name: "Financieras / Crédito", active: true },
  { key: "fintech", name: "Fintech / Pagos", active: true },
  {
    key: "mercado_capitales",
    name: "Mercado de Capitales / ALyC",
    active: true,
    keywords: [
      "alyc",
      "aly cs",
      "agente de liquidacion",
      "compensacion",
      "broker",
      "brokers",
      "comitentes",
      "byma",
      "cnv",
      "valores",
      "bursatil",
      "inversiones",
      "sociedad de bolsa",
      "capitales",
    ],
  },
  { key: "cobranzas", name: "Cobranzas / Recupero", active: true },
  { key: "carteras_credito", name: "Compra y Administración de Carteras", active: true },
  { key: "factoring", name: "Factoring / Factoraje", active: true },
  { key: "cooperativas_credito", name: "Cooperativas / Crédito Mutual", active: true },
  { key: "retail_credito", name: "Retail con Crédito Propio", active: true },
  { key: "telecomunicaciones", name: "Telecomunicaciones", active: true },
  { key: "gas", name: "Gas / Distribución de Gas", active: true },
  { key: "electricidad", name: "Electricidad / Energía", active: true },
  { key: "agua_saneamiento", name: "Agua y Saneamiento", active: true },
  { key: "servicios_publicos", name: "Otros Servicios Públicos", active: true },
  { key: "rrhh", name: "RR.HH. / Relaciones Laborales", active: true },
  { key: "estudios_juridicos", name: "Estudios Jurídicos", active: true },
  { key: "bpo_contact_center", name: "BPO / Contact Center", active: true },
  { key: "ecommerce", name: "E-commerce / Comercio Digital", active: true },
  { key: "leasing", name: "Leasing / Financiamiento de Activos", active: true },
  { key: "inmobiliario", name: "Inmobiliario / Administradores", active: true },
  { key: "salud", name: "Salud", active: true },
  { key: "gobierno", name: "Gobierno / Administración Pública", active: true },
  { key: "judicial", name: "Poder Judicial / Organismos Jurídicos", active: true },
  { key: "tecnologia", name: "Tecnología / SaaS", active: true },
  { key: "certificacion_digital", name: "Certificación Digital / Comunicaciones Certificadas", active: true },
  { key: "postal_logistica", name: "Correo / Postal / Logística Documental", active: true },
  { key: "agro", name: "Agro / Agronegocios", active: true },
  { key: "logistica_puertos", name: "Logística / Puertos / Comercio Exterior", active: true },
  {
    key: "camaras_canales_partners",
    name: "Cámaras / canales / partners",
    active: true,
    keywords: ["camara", "camaras", "fecene", "asociados", "partners", "vaca muerta"],
  },
  {
    key: "catering_alimentacion_facilities",
    name: "Catering / alimentación / facilities",
    active: true,
    keywords: ["catering", "alimentacion", "campamento", "maximia", "vaca muerta"],
  },
  {
    key: "comercio_servicios_generales",
    name: "Comercio / servicios generales",
    active: true,
    keywords: ["comercio", "retail", "servicios generales", "vaca muerta"],
  },
  {
    key: "energia_gas_utilities",
    name: "Energía / gas / utilities",
    active: true,
    keywords: ["energia", "utilities", "bentia", "vaca muerta"],
  },
  {
    key: "ingenieria_construccion_montaje",
    name: "Ingeniería / construcción / montaje",
    active: true,
    keywords: ["ingenieria", "construccion", "montaje", "obra", "vaca muerta"],
  },
  {
    key: "metalmecanica_equipos_insumos",
    name: "Metalmecánica / equipos / insumos",
    active: true,
    keywords: ["metalmecanica", "equipos", "insumos", "maquinaria", "vaca muerta"],
  },
  {
    key: "operadoras_de_petroleo_y_gas",
    name: "Operadoras de petróleo y gas",
    active: true,
    keywords: ["operadora", "operadoras", "petroleo", "oil", "gas", "vaca muerta"],
  },
  {
    key: "rrhh_empleo_capacitacion",
    name: "RRHH / empleo / capacitación",
    active: true,
    keywords: ["empleo", "capacitacion", "personal eventual", "staffing", "vaca muerta"],
  },
  {
    key: "salud_ocupacional_art_seguros",
    name: "Salud ocupacional / ART / seguros",
    active: true,
    keywords: ["salud ocupacional", "medicina laboral", "art", "vaca muerta"],
  },
  {
    key: "seguridad_hse",
    name: "Seguridad / HSE",
    active: true,
    keywords: ["hse", "seguridad", "ehs", "vaca muerta"],
  },
  {
    key: "servicios_industriales_facilities",
    name: "Servicios industriales / facilities",
    active: true,
    keywords: ["facilities", "mantenimiento", "industria", "vaca muerta"],
  },
  {
    key: "servicios_petroleros_perforacion",
    name: "Servicios petroleros / perforación",
    active: true,
    keywords: ["perforacion", "oilfield", "pozo", "drilling", "vaca muerta"],
  },
  {
    key: "servicios_profesionales_financieros_legales",
    name: "Servicios profesionales / financieros / legales",
    active: true,
    keywords: ["profesionales", "estudio", "asesores", "vaca muerta"],
  },
  {
    key: "tecnologia_telecom_instrumentacion",
    name: "Tecnología / telecom / instrumentación",
    active: true,
    keywords: ["instrumentacion", "telecom", "scada", "vaca muerta"],
  },
  {
    key: "transporte_logistica",
    name: "Transporte / logística",
    active: true,
    keywords: ["transporte", "choferes", "cargas", "vaca muerta"],
  },
  { key: "otros", name: "Otros", active: true },
];

const CREDIT_INDUSTRIES = [
  "carteras_credito",
  "factoring",
  "bancos",
  "financieras",
  "fintech",
  "cobranzas",
] as const;

const UTILITY_INDUSTRIES = [
  "gas",
  "electricidad",
  "agua_saneamiento",
  "servicios_publicos",
  "telecomunicaciones",
  "energia_gas_utilities",
] as const;

const VACA_MUERTA_INDUSTRIES = [
  "camaras_canales_partners",
  "catering_alimentacion_facilities",
  "comercio_servicios_generales",
  "energia_gas_utilities",
  "ingenieria_construccion_montaje",
  "metalmecanica_equipos_insumos",
  "operadoras_de_petroleo_y_gas",
  "rrhh_empleo_capacitacion",
  "salud_ocupacional_art_seguros",
  "seguridad_hse",
  "servicios_industriales_facilities",
  "servicios_petroleros_perforacion",
  "servicios_profesionales_financieros_legales",
  "tecnologia_telecom_instrumentacion",
  "transporte_logistica",
] as const;

export const TAXONOMY_USE_CASES: readonly TaxonomyUseCaseSeed[] = [
  {
    key: "cesion_credito",
    name: "Notificación de cesión de crédito",
    industryKeys: [...CREDIT_INDUSTRIES],
    countryCodes: [],
    active: true,
  },
  {
    key: "transferencia_cartera",
    name: "Comunicación de transferencia de cartera",
    industryKeys: ["carteras_credito", "factoring", "cobranzas", "bpo_contact_center"],
    countryCodes: [],
    active: true,
  },
  {
    key: "nuevo_acreedor",
    name: "Comunicación de nuevo acreedor",
    industryKeys: ["carteras_credito", "factoring", "cobranzas"],
    countryCodes: [],
    active: true,
  },
  {
    key: "intimacion_pago",
    name: "Intimación de pago",
    industryKeys: [
      "cobranzas",
      "bancos",
      "financieras",
      "fintech",
      "estudios_juridicos",
      "leasing",
      "cooperativas_credito",
      "retail_credito",
      "servicios_profesionales_financieros_legales",
    ],
    countryCodes: [],
    active: true,
  },
  {
    key: "preaviso_morosidad",
    name: "Preaviso de morosidad",
    industryKeys: ["bancos", "financieras", "fintech", "cobranzas", ...UTILITY_INDUSTRIES, "retail_credito"],
    countryCodes: [],
    active: true,
  },
  {
    key: "preaviso_reporte_crediticio",
    name: "Preaviso de reporte crediticio",
    industryKeys: ["cobranzas", "bancos", "financieras", "fintech", "carteras_credito"],
    countryCodes: [],
    active: true,
  },
  {
    key: "cobranza_temprana",
    name: "Cobranza temprana",
    industryKeys: ["cobranzas", "bancos", "financieras", "fintech", "bpo_contact_center", "retail_credito"],
    countryCodes: [],
    active: true,
  },
  {
    key: "cobranza_prejudicial",
    name: "Cobranza prejudicial",
    industryKeys: ["cobranzas", "estudios_juridicos", "bpo_contact_center", "carteras_credito"],
    countryCodes: [],
    active: true,
  },
  {
    key: "aviso_corte",
    name: "Aviso previo de corte",
    industryKeys: [...UTILITY_INDUSTRIES],
    countryCodes: [],
    active: true,
  },
  {
    key: "suspension_servicio",
    name: "Suspensión del servicio",
    industryKeys: [...UTILITY_INDUSTRIES],
    countryCodes: [],
    active: true,
  },
  {
    key: "reconexion",
    name: "Reconexión",
    industryKeys: [...UTILITY_INDUSTRIES],
    countryCodes: [],
    active: true,
  },
  {
    key: "rechazo_siniestro",
    name: "Rechazo de siniestro",
    industryKeys: ["seguros", "salud_ocupacional_art_seguros"],
    countryCodes: [],
    active: true,
  },
  {
    key: "rescision_poliza",
    name: "Rescisión / cancelación de póliza",
    industryKeys: ["seguros", "art", "salud_ocupacional_art_seguros"],
    countryCodes: [],
    active: true,
  },
  {
    key: "notificacion_trabajador",
    name: "Notificación al trabajador",
    industryKeys: ["art", "rrhh", "rrhh_empleo_capacitacion", "salud_ocupacional_art_seguros", "seguridad_hse"],
    countryCodes: [],
    active: true,
  },
  {
    key: "notificacion_empleador",
    name: "Notificación al empleador",
    industryKeys: ["art", "rrhh", "rrhh_empleo_capacitacion", "salud_ocupacional_art_seguros", "seguridad_hse"],
    countryCodes: [],
    active: true,
  },
  {
    key: "entrega_documentacion",
    name: "Entrega acreditable de documentación",
    industryKeys: [
      "estudios_juridicos",
      "judicial",
      "certificacion_digital",
      "postal_logistica",
      "mercado_capitales",
      ...VACA_MUERTA_INDUSTRIES,
    ],
    countryCodes: [],
    active: true,
  },
  {
    key: "cambio_contractual",
    name: "Cambio contractual",
    industryKeys: [
      "seguros",
      "art",
      "bancos",
      "factoring",
      "mercado_capitales",
      ...UTILITY_INDUSTRIES,
      "operadoras_de_petroleo_y_gas",
      "servicios_petroleros_perforacion",
      "servicios_profesionales_financieros_legales",
      "ingenieria_construccion_montaje",
    ],
    countryCodes: [],
    active: true,
  },
  {
    key: "aviso_comitentes",
    name: "Aviso fehaciente a comitentes",
    industryKeys: ["mercado_capitales", "bancos", "fintech"],
    countryCodes: [],
    active: true,
    keywords: [
      "alyc",
      "comitente",
      "comitentes",
      "suscripcion preferente",
      "derecho de suscripcion",
      "20643",
      "aviso fehaciente",
    ],
  },
  {
    key: "canal_derivacion_institucional",
    name: "Canal de derivación y comunicaciones institucionales",
    industryKeys: ["camaras_canales_partners"],
    countryCodes: [],
    active: true,
  },
  {
    key: "documentacion_laboral_campamentos",
    name: "Documentación laboral de personal en campamentos y bases",
    industryKeys: ["catering_alimentacion_facilities"],
    countryCodes: [],
    active: true,
  },
  {
    key: "documentacion_laboral_proveedores",
    name: "Documentación laboral y comunicaciones con proveedores",
    industryKeys: ["comercio_servicios_generales"],
    countryCodes: [],
    active: true,
  },
  {
    key: "notificaciones_regulatorias_operativas",
    name: "Notificaciones regulatorias, contractuales y operativas",
    industryKeys: ["energia_gas_utilities"],
    countryCodes: [],
    active: true,
  },
  {
    key: "notificaciones_subcontratistas_obra",
    name: "Notificaciones a subcontratistas por obra, plazos e incumplimientos",
    industryKeys: ["ingenieria_construccion_montaje"],
    countryCodes: [],
    active: true,
  },
  {
    key: "protocolos_hse_evidencia",
    name: "Citaciones, protocolos y comunicaciones de Salud/HSE con evidencia",
    industryKeys: [
      "ingenieria_construccion_montaje",
      "operadoras_de_petroleo_y_gas",
      "seguridad_hse",
      "salud_ocupacional_art_seguros",
      "servicios_petroleros_perforacion",
      "servicios_industriales_facilities",
    ],
    countryCodes: [],
    active: true,
  },
  {
    key: "notificaciones_contractuales_proveedores",
    name: "Notificaciones contractuales a proveedores y contratistas",
    industryKeys: [
      "ingenieria_construccion_montaje",
      "metalmecanica_equipos_insumos",
      "operadoras_de_petroleo_y_gas",
      "servicios_profesionales_financieros_legales",
    ],
    countryCodes: [],
    active: true,
    keywords: ["clientes y proveedores", "contratistas y proveedores"],
  },
  {
    key: "documentacion_laboral_entrega",
    name: "Recibos y documentación laboral con constancia de entrega/aceptación",
    industryKeys: [...VACA_MUERTA_INDUSTRIES, "rrhh", "art"],
    countryCodes: [],
    active: true,
    keywords: ["recibos", "firma", "aceptacion", "onboarding"],
  },
  {
    key: "citaciones_salud_ocupacional",
    name: "Citaciones y comunicaciones trazables a trabajadores/empleadores",
    industryKeys: ["salud_ocupacional_art_seguros", "art", "rrhh"],
    countryCodes: [],
    active: true,
  },
  {
    key: "protocolos_personal_hse",
    name: "Entrega acreditada de instrucciones y protocolos a personal",
    industryKeys: ["seguridad_hse"],
    countryCodes: [],
    active: true,
  },
  {
    key: "notificaciones_personal_clientes",
    name: "Notificaciones a personal, clientes y contratistas",
    industryKeys: ["servicios_industriales_facilities"],
    countryCodes: [],
    active: true,
  },
  {
    key: "comunicaciones_cuadrillas",
    name: "Comunicaciones fehacientes con cuadrillas, contratistas y clientes",
    industryKeys: ["servicios_petroleros_perforacion"],
    countryCodes: [],
    active: true,
  },
  {
    key: "comunicaciones_contractuales_evidencia",
    name: "Comunicaciones contractuales y requerimientos con evidencia",
    industryKeys: ["servicios_profesionales_financieros_legales"],
    countryCodes: [],
    active: true,
  },
  {
    key: "avisos_servicio_evidencia",
    name: "Avisos contractuales y de servicio con evidencia",
    industryKeys: ["tecnologia_telecom_instrumentacion"],
    countryCodes: [],
    active: true,
  },
  {
    key: "comunicaciones_personal_movil",
    name: "Comunicaciones a choferes y personal móvil",
    industryKeys: ["transporte_logistica"],
    countryCodes: [],
    active: true,
  },
];

export const TAXONOMY_TAGS: readonly TaxonomyTagSeed[] = [
  { key: "institutional_contact", name: "Contacto institucional", active: true },
  { key: "technical_contact", name: "Contacto tecnológico", active: true },
  { key: "legal_contact", name: "Contacto legal", active: true },
  { key: "commercial_contact", name: "Contacto comercial", active: true },
  { key: "high_priority", name: "Prioridad alta", active: true },
  { key: "referred", name: "Referido", active: true },
  { key: "event_contact", name: "Evento", active: true },
  { key: "linkedin", name: "LinkedIn", active: true },
  { key: "association", name: "Asociación", active: true },
  { key: "interested", name: "Interesado", active: true },
  { key: "demo_pending", name: "Demo pendiente", active: true },
  { key: "test_record", name: "Registro de prueba", active: true },
  { key: CLASSIFICATION_PENDING_TAG_KEY, name: "Clasificación pendiente", active: true },
];

/**
 * Keys del catálogo anterior → key canónica.
 * No se muestran en la UI. Sirven para leer datos ya persistidos.
 */
export const INDUSTRY_KEY_ALIASES: Readonly<Record<string, string>> = {
  insurance: "seguros",
  insurance_carriers: "seguros",
  insurance_brokers: "seguros",
  workers_compensation: "art",
  banking: "bancos",
  collections: "cobranzas",
  debt_portfolios: "carteras_credito",
  utilities: "servicios_publicos",
  utilities_gas: "gas",
  utilities_electricity: "electricidad",
  utilities_water: "agua_saneamiento",
  telecommunications: "telecomunicaciones",
  legal: "estudios_juridicos",
  healthcare: "salud",
  government: "gobierno",
  retail: "retail_credito",
  real_estate: "inmobiliario",
  logistics: "logistica_puertos",
  other: "otros",
  automotive: "otros",
  education: "otros",
  alyc: "mercado_capitales",
  capital_markets: "mercado_capitales",
  brokers: "mercado_capitales",
  operadoras: "operadoras_de_petroleo_y_gas",
  hse: "seguridad_hse",
};

export const USE_CASE_KEY_ALIASES: Readonly<Record<string, string>> = {
  insurance_claim_rejection: "rechazo_siniestro",
  insurance_policy_cancellation: "rescision_poliza",
  insurance_payment_default: "preaviso_morosidad",
  insurance_contract_notice: "cambio_contractual",
  insurance_claim_notice: "rechazo_siniestro",
  workers_compensation_worker_notice: "notificacion_trabajador",
  workers_compensation_employer_notice: "notificacion_empleador",
  workers_compensation_medical_notice: "notificacion_trabajador",
  workers_compensation_contract_notice: "cambio_contractual",
  collections_payment_demand: "intimacion_pago",
  collections_prelegal_notice: "cobranza_prejudicial",
  collections_credit_reporting_notice: "preaviso_reporte_crediticio",
  collections_debt_status_notice: "preaviso_morosidad",
  debt_assignment_notice: "cesion_credito",
  debt_portfolio_transfer_notice: "transferencia_cartera",
  debtor_new_creditor_notice: "nuevo_acreedor",
  factoring_assignment_notice: "cesion_credito",
  factoring_payment_instruction: "cambio_contractual",
  factoring_contract_notice: "cambio_contractual",
  utility_cutoff_warning: "aviso_corte",
  utility_payment_default: "preaviso_morosidad",
  utility_service_suspension: "suspension_servicio",
  utility_reconnection_notice: "reconexion",
  utility_contract_change: "cambio_contractual",
  utility_debt_notice: "preaviso_morosidad",
  telecom_payment_default: "preaviso_morosidad",
  telecom_service_suspension: "suspension_servicio",
  telecom_termination: "cambio_contractual",
  telecom_debt_notice: "preaviso_morosidad",
  telecom_contract_notice: "cambio_contractual",
  financial_payment_default: "intimacion_pago",
  financial_contract_notice: "cambio_contractual",
  financial_debt_assignment: "cesion_credito",
  financial_data_notice: "preaviso_reporte_crediticio",
  financial_collection_notice: "cobranza_temprana",
  legal_extrajudicial_notice: "intimacion_pago",
  legal_contract_notice: "cambio_contractual",
  legal_default_notice: "preaviso_morosidad",
  legal_document_delivery: "entrega_documentacion",
};

const INDUSTRY_BY_KEY = new Map(TAXONOMY_INDUSTRIES.map((row) => [row.key, row]));
const USE_CASE_BY_KEY = new Map(TAXONOMY_USE_CASES.map((row) => [row.key, row]));

export function canonicalIndustryKey(key: string): string {
  const trimmed = key.trim();
  return INDUSTRY_KEY_ALIASES[trimmed] || trimmed;
}

export function canonicalUseCaseKey(key: string): string {
  const trimmed = key.trim();
  return USE_CASE_KEY_ALIASES[trimmed] || trimmed;
}

export function isCanonicalIndustryKey(key: string): boolean {
  return INDUSTRY_BY_KEY.has(canonicalIndustryKey(key));
}

export function isCanonicalUseCaseKey(key: string): boolean {
  return USE_CASE_BY_KEY.has(canonicalUseCaseKey(key));
}

export function seedIndustryByKey(key: string): TaxonomyIndustrySeed | undefined {
  return INDUSTRY_BY_KEY.get(canonicalIndustryKey(key));
}

export function seedUseCaseByKey(key: string): TaxonomyUseCaseSeed | undefined {
  return USE_CASE_BY_KEY.get(canonicalUseCaseKey(key));
}

export function storedKeysMatch(stored: string[] | undefined, query: string, kind: "industry" | "useCase"): boolean {
  const canonical = kind === "industry" ? canonicalIndustryKey(query) : canonicalUseCaseKey(query);
  return (stored || []).some((key) =>
    kind === "industry" ? canonicalIndustryKey(key) === canonical : canonicalUseCaseKey(key) === canonical,
  );
}

export function foldCatalogSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Slug estable para un rubro o caso de uso cargado a mano. */
export function slugFromCatalogName(name: string): string {
  const folded = foldCatalogSearchText(name);
  let slug = folded.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/_+/g, "_");
  if (!slug) return "";
  if (!/^[a-z]/.test(slug)) slug = `r_${slug}`;
  if (slug.length < 2) slug = `${slug}_x`;
  return slug.slice(0, 79);
}

export type CatalogNameMatch = { key: string; name: string };

export function findCatalogNameMatch(
  name: string,
  rows: readonly CatalogNameMatch[],
): CatalogNameMatch | undefined {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const key = slugFromCatalogName(trimmed);
  const folded = foldCatalogSearchText(trimmed);
  return rows.find((row) => {
    const rowKey = row.key.trim();
    return rowKey === key || foldCatalogSearchText(row.name) === folded;
  });
}

export function catalogRowMatchesQuery(
  row: { key: string; name: string; keywords?: readonly string[] },
  query: string,
): boolean {
  const tokens = foldCatalogSearchText(query).split(" ").filter(Boolean);
  if (!tokens.length) return true;
  const haystack = foldCatalogSearchText([row.key, row.name, ...(row.keywords || [])].join(" "));
  return tokens.every((token) => haystack.includes(token));
}

export function parseCatalogKeyList(value: unknown): string[] {
  const parts = Array.isArray(value)
    ? value.flatMap((item) => parseCatalogKeyList(item))
    : String(value || "").split(/[,\n]/);
  return [...new Set(parts.map((item) => String(item).trim()).filter((item) => item && item !== "all"))];
}

export function catalogUseCaseAppliesToIndustry(
  useCaseKey: string,
  industryKey: string,
  catalogUseCases?: ReadonlyArray<{ key: string; industryKeys: readonly string[] }>,
): boolean {
  const industry = canonicalIndustryKey(industryKey);
  const fromCatalog = catalogUseCases?.find((row) => canonicalUseCaseKey(row.key) === canonicalUseCaseKey(useCaseKey));
  if (fromCatalog) {
    return fromCatalog.industryKeys.some((key) => canonicalIndustryKey(key) === industry);
  }
  const useCase = seedUseCaseByKey(useCaseKey);
  if (!useCase) return false;
  return useCase.industryKeys.some((key) => canonicalIndustryKey(key) === industry);
}

export function expandSeedIndustryKeys(keys: string[]): string[] {
  const out = new Set<string>();
  for (const key of keys) {
    let current = INDUSTRY_BY_KEY.get(canonicalIndustryKey(key));
    const seen = new Set<string>();
    while (current) {
      if (seen.has(current.key)) break;
      seen.add(current.key);
      out.add(current.key);
      current = current.parentKey ? INDUSTRY_BY_KEY.get(current.parentKey) : undefined;
    }
  }
  return [...out].sort();
}

export function seedIndustryParentKey(key: string): string | undefined {
  return INDUSTRY_BY_KEY.get(canonicalIndustryKey(key))?.parentKey;
}
