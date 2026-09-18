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
    industryKeys: ["seguros"],
    countryCodes: [],
    active: true,
  },
  {
    key: "rescision_poliza",
    name: "Rescisión / cancelación de póliza",
    industryKeys: ["seguros", "art"],
    countryCodes: [],
    active: true,
  },
  {
    key: "notificacion_trabajador",
    name: "Notificación al trabajador",
    industryKeys: ["art", "rrhh"],
    countryCodes: [],
    active: true,
  },
  {
    key: "notificacion_empleador",
    name: "Notificación al empleador",
    industryKeys: ["art", "rrhh"],
    countryCodes: [],
    active: true,
  },
  {
    key: "entrega_documentacion",
    name: "Entrega acreditable de documentación",
    industryKeys: ["estudios_juridicos", "judicial", "certificacion_digital", "postal_logistica", "mercado_capitales"],
    countryCodes: [],
    active: true,
  },
  {
    key: "cambio_contractual",
    name: "Cambio contractual",
    industryKeys: ["seguros", "art", "bancos", "factoring", "mercado_capitales", ...UTILITY_INDUSTRIES],
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

export function catalogUseCaseAppliesToIndustry(useCaseKey: string, industryKey: string): boolean {
  const useCase = seedUseCaseByKey(useCaseKey);
  if (!useCase) return false;
  const industry = canonicalIndustryKey(industryKey);
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
