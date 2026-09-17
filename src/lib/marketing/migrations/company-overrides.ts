/**
 * Decisiones humanas de CRM_COMPANIES_V1.
 *
 * El clasificador no contiene casos "Naturgy" ni "(prueba)".
 * Cualquier excepción comercial vive acá, versionada y auditable.
 */
import type { CompanyMigrationOverride } from "./types";

export const CRM_COMPANIES_OVERRIDES_VERSION = "CRM_COMPANIES_V1_OVERRIDES";

/**
 * `match.normalizedName` es la clave de matching del grupo
 * (`normalizeCompanyNameForMatching`), no el string legacy original.
 */
export const COMPANY_MIGRATION_OVERRIDES: CompanyMigrationOverride[] = [
  {
    match: { normalizedName: "naturgy" },
    action: "CREATE",
    canonicalName: "Naturgy",
    countryCode: "AR",
    reason:
      "Commercially maintained as a separate account. Shared email domain with Naturgy NOA is a warning, not a merge.",
  },
  {
    match: { normalizedName: "naturgy noa" },
    action: "CREATE",
    canonicalName: "Naturgy NOA",
    countryCode: "AR",
    reason:
      "Commercially maintained as a separate account from Naturgy. Same email domain is not sufficient to merge.",
  },
  {
    match: { normalizedName: "gasnor naturgy noa" },
    action: "CREATE",
    canonicalName: "Gasnor / Naturgy NOA",
    countryCode: "AR",
    reason:
      "Independent group. Do not infer name change, absorption, or the same legal entity as Naturgy or Naturgy NOA.",
  },
  {
    match: { normalizedName: "notificas prueba" },
    action: "SKIP",
    tags: ["test"],
    reason: "test_record",
  },
];
