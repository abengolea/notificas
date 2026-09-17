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
};

export type TaxonomyUseCaseSeed = {
  key: string;
  name: string;
  industryKeys: string[];
  countryCodes: string[];
  active: boolean;
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

export const TAXONOMY_INDUSTRIES: readonly TaxonomyIndustrySeed[] = [
  { key: "insurance", name: "Seguros", active: true },
  { key: "banking", name: "Bancos", active: true },
  { key: "fintech", name: "Fintech", active: true },
  { key: "collections", name: "Cobranzas", active: true },
  { key: "debt_portfolios", name: "Compra / gestión de carteras", active: true },
  { key: "factoring", name: "Factoring", active: true },
  { key: "utilities", name: "Servicios públicos", active: true },
  { key: "telecommunications", name: "Telecomunicaciones", active: true },
  { key: "legal", name: "Servicios jurídicos", active: true },
  { key: "automotive", name: "Automotriz", active: true },
  { key: "healthcare", name: "Salud", active: true },
  { key: "government", name: "Gobierno", active: true },
  { key: "retail", name: "Retail", active: true },
  { key: "ecommerce", name: "E-commerce", active: true },
  { key: "real_estate", name: "Inmobiliario", active: true },
  { key: "education", name: "Educación", active: true },
  { key: "logistics", name: "Logística", active: true },
  { key: "other", name: "Otros", active: true },
  { key: "insurance_carriers", name: "Aseguradoras", parentKey: "insurance", active: true },
  { key: "workers_compensation", name: "Riesgos del trabajo / ART", parentKey: "insurance", active: true },
  { key: "insurance_brokers", name: "Productores / brokers", parentKey: "insurance", active: true },
  { key: "utilities_gas", name: "Gas", parentKey: "utilities", active: true },
  { key: "utilities_electricity", name: "Electricidad", parentKey: "utilities", active: true },
  { key: "utilities_water", name: "Agua", parentKey: "utilities", active: true },
];

export const TAXONOMY_USE_CASES: readonly TaxonomyUseCaseSeed[] = [
  { key: "insurance_claim_rejection", name: "Rechazo de siniestro", industryKeys: ["insurance"], countryCodes: [], active: true },
  { key: "insurance_policy_cancellation", name: "Rescisión / cancelación de póliza", industryKeys: ["insurance"], countryCodes: [], active: true },
  { key: "insurance_payment_default", name: "Mora del asegurado", industryKeys: ["insurance"], countryCodes: [], active: true },
  { key: "insurance_contract_notice", name: "Comunicaciones contractuales fehacientes", industryKeys: ["insurance"], countryCodes: [], active: true },
  { key: "insurance_claim_notice", name: "Comunicaciones relacionadas con siniestros", industryKeys: ["insurance"], countryCodes: [], active: true },
  { key: "workers_compensation_worker_notice", name: "Comunicaciones al trabajador", industryKeys: ["workers_compensation"], countryCodes: [], active: true },
  { key: "workers_compensation_employer_notice", name: "Comunicaciones al empleador", industryKeys: ["workers_compensation"], countryCodes: [], active: true },
  { key: "workers_compensation_medical_notice", name: "Comunicaciones médico-administrativas", industryKeys: ["workers_compensation"], countryCodes: [], active: true },
  { key: "workers_compensation_contract_notice", name: "Comunicaciones contractuales fehacientes", industryKeys: ["workers_compensation"], countryCodes: [], active: true },
  { key: "collections_payment_demand", name: "Intimación de pago", industryKeys: ["collections"], countryCodes: [], active: true },
  { key: "collections_prelegal_notice", name: "Aviso previo a gestión judicial", industryKeys: ["collections"], countryCodes: [], active: true },
  { key: "collections_credit_reporting_notice", name: "Aviso previo a reporte de deuda", industryKeys: ["collections"], countryCodes: [], active: true },
  { key: "collections_debt_status_notice", name: "Comunicación de estado de deuda", industryKeys: ["collections"], countryCodes: [], active: true },
  {
    key: "debt_assignment_notice",
    name: "Notificación de cesión de crédito",
    industryKeys: ["debt_portfolios", "factoring", "banking", "fintech", "collections"],
    countryCodes: [],
    active: true,
  },
  {
    key: "debt_portfolio_transfer_notice",
    name: "Comunicación de transferencia de cartera",
    industryKeys: ["debt_portfolios", "factoring", "banking", "fintech", "collections"],
    countryCodes: [],
    active: true,
  },
  {
    key: "debtor_new_creditor_notice",
    name: "Comunicación de nuevo acreedor",
    industryKeys: ["debt_portfolios", "factoring", "banking", "fintech", "collections"],
    countryCodes: [],
    active: true,
  },
  { key: "factoring_assignment_notice", name: "Notificación al deudor cedido", industryKeys: ["factoring"], countryCodes: [], active: true },
  { key: "factoring_payment_instruction", name: "Comunicación de instrucciones de pago", industryKeys: ["factoring"], countryCodes: [], active: true },
  { key: "factoring_contract_notice", name: "Comunicación contractual", industryKeys: ["factoring"], countryCodes: [], active: true },
  {
    key: "utility_cutoff_warning",
    name: "Aviso previo de corte",
    industryKeys: ["utilities", "utilities_gas", "utilities_electricity", "utilities_water"],
    countryCodes: [],
    active: true,
  },
  {
    key: "utility_payment_default",
    name: "Mora",
    industryKeys: ["utilities", "utilities_gas", "utilities_electricity", "utilities_water"],
    countryCodes: [],
    active: true,
  },
  {
    key: "utility_service_suspension",
    name: "Suspensión del servicio",
    industryKeys: ["utilities", "utilities_gas", "utilities_electricity", "utilities_water"],
    countryCodes: [],
    active: true,
  },
  {
    key: "utility_reconnection_notice",
    name: "Reconexión",
    industryKeys: ["utilities", "utilities_gas", "utilities_electricity", "utilities_water"],
    countryCodes: [],
    active: true,
  },
  {
    key: "utility_contract_change",
    name: "Cambios contractuales",
    industryKeys: ["utilities", "utilities_gas", "utilities_electricity", "utilities_water"],
    countryCodes: [],
    active: true,
  },
  {
    key: "utility_debt_notice",
    name: "Comunicación de deuda",
    industryKeys: ["utilities", "utilities_gas", "utilities_electricity", "utilities_water"],
    countryCodes: [],
    active: true,
  },
  { key: "telecom_payment_default", name: "Mora", industryKeys: ["telecommunications"], countryCodes: [], active: true },
  { key: "telecom_service_suspension", name: "Suspensión", industryKeys: ["telecommunications"], countryCodes: [], active: true },
  { key: "telecom_termination", name: "Baja / rescisión", industryKeys: ["telecommunications"], countryCodes: [], active: true },
  { key: "telecom_debt_notice", name: "Comunicación de deuda", industryKeys: ["telecommunications"], countryCodes: [], active: true },
  { key: "telecom_contract_notice", name: "Comunicación contractual", industryKeys: ["telecommunications"], countryCodes: [], active: true },
  { key: "financial_payment_default", name: "Intimación de pago", industryKeys: ["banking", "fintech"], countryCodes: [], active: true },
  { key: "financial_contract_notice", name: "Comunicación contractual", industryKeys: ["banking", "fintech"], countryCodes: [], active: true },
  { key: "financial_debt_assignment", name: "Cesión de crédito", industryKeys: ["banking", "fintech"], countryCodes: [], active: true },
  { key: "financial_data_notice", name: "Comunicación relacionada con datos crediticios", industryKeys: ["banking", "fintech"], countryCodes: [], active: true },
  { key: "financial_collection_notice", name: "Gestión de cobranza", industryKeys: ["banking", "fintech"], countryCodes: [], active: true },
  { key: "legal_extrajudicial_notice", name: "Intimación extrajudicial", industryKeys: ["legal"], countryCodes: [], active: true },
  { key: "legal_contract_notice", name: "Notificación contractual", industryKeys: ["legal"], countryCodes: [], active: true },
  { key: "legal_default_notice", name: "Constitución en mora", industryKeys: ["legal"], countryCodes: [], active: true },
  { key: "legal_document_delivery", name: "Entrega acreditable de documentación", industryKeys: ["legal"], countryCodes: [], active: true },
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

const INDUSTRY_BY_KEY = new Map(TAXONOMY_INDUSTRIES.map((row) => [row.key, row]));

export function expandSeedIndustryKeys(keys: string[]): string[] {
  const out = new Set<string>();
  for (const key of keys) {
    let current = INDUSTRY_BY_KEY.get(key);
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
  return INDUSTRY_BY_KEY.get(key)?.parentKey;
}
