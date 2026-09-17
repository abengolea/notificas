import { MARKETING_COUNTRIES } from "../countries";

export type MarketingCountrySeed = {
  code: string;
  name: string;
  defaultLanguage: string;
};

const EXTRA_SEED: readonly MarketingCountrySeed[] = [
  { code: "US", name: "Estados Unidos", defaultLanguage: "en" },
];

function languageForCode(code: string): string {
  if (code === "BR") return "pt";
  if (code === "US") return "en";
  return "es";
}

/**
 * Semilla del catálogo Firestore futuro (`marketing_countries`).
 * Incluye el allowlist v1 más US. No se escribe a Firestore en esta etapa.
 * No altera `parseCountry()` ni el CSV actual.
 */
export const MARKETING_COUNTRY_CATALOG_SEED: readonly MarketingCountrySeed[] = [
  ...MARKETING_COUNTRIES.map((c) => ({
    code: c.code,
    name: c.name,
    defaultLanguage: languageForCode(c.code),
  })),
  ...EXTRA_SEED.filter((row) => !MARKETING_COUNTRIES.some((c) => c.code === row.code)),
];

export const MARKETING_COUNTRY_SEED_CORE: readonly MarketingCountrySeed[] = [
  { code: "AR", name: "Argentina", defaultLanguage: "es" },
  { code: "UY", name: "Uruguay", defaultLanguage: "es" },
  { code: "PY", name: "Paraguay", defaultLanguage: "es" },
  { code: "CL", name: "Chile", defaultLanguage: "es" },
  { code: "PE", name: "Perú", defaultLanguage: "es" },
  { code: "CO", name: "Colombia", defaultLanguage: "es" },
  { code: "MX", name: "México", defaultLanguage: "es" },
  { code: "CR", name: "Costa Rica", defaultLanguage: "es" },
  { code: "BR", name: "Brasil", defaultLanguage: "pt" },
  { code: "US", name: "Estados Unidos", defaultLanguage: "en" },
];
