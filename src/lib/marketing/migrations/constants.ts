/**
 * Migración CRM_COMPANIES_V1.
 *
 * Display/persistence usa `normalizeMarketingCompanyName`.
 * Matching puede usar `normalizeCompanyNameForMatching` (más agresivo con formas jurídicas).
 * Esas dos cosas no son lo mismo: nunca persistir el form matching como `name`.
 */

export const CRM_COMPANIES_MIGRATION_ID = "CRM_COMPANIES_V1";

export const CRM_COMPANIES_MIGRATION_BATCH_SIZE = 500;

export const CRM_COMPANIES_APPLY_CONTACT_BATCH = 25;

export const CRM_LEGACY_COMPANY_SOURCE_NAME = "Migración CRM legacy";

/**
 * Dominios de correo personal/genéricos. No se usan como website oficial
 * ni como prueba de identidad de empresa.
 */
export const GENERIC_EMAIL_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.es",
  "hotmail.com.ar",
  "outlook.com",
  "outlook.es",
  "outlook.com.ar",
  "yahoo.com",
  "yahoo.es",
  "yahoo.com.ar",
  "icloud.com",
  "live.com",
  "live.com.ar",
  "msn.com",
  "aol.com",
  "me.com",
  "ymail.com",
  "protonmail.com",
  "proton.me",
  "gmx.com",
] as const;

/**
 * Strings que no deben convertirse en `marketing_companies`.
 * Lista corta a propósito: no tratar nombres reales como basura.
 * La comparación usa el nombre ya normalizado para matching.
 */
export const INSUFFICIENT_COMPANY_NAMES = [
  "-",
  ".",
  "n/a",
  "na",
  "n.a",
  "n.a.",
  "none",
  "null",
  "particular",
  "sin empresa",
  "no informa",
  "consumidor",
  "personal",
  "sin datos",
  "no aplica",
  "s/e",
] as const;
