export {
  CRM_COMPANIES_MIGRATION_ID,
  CRM_COMPANIES_MIGRATION_BATCH_SIZE,
  CRM_LEGACY_COMPANY_SOURCE_NAME,
  GENERIC_EMAIL_DOMAINS,
  INSUFFICIENT_COMPANY_NAMES,
} from "./constants";
export {
  normalizeCompanyNameForMatching,
  isGenericEmailDomain,
  isInsufficientCompanyName,
  extractEmailDomain,
  corporateEmailDomain,
  suggestCanonicalCompanyName,
  collectCountryStatus,
  collectDomainCandidates,
} from "./grouping";
export { previewCompanyMigration } from "./preview";
export { applyCompanyMigration, assertCompanyMigrationApplyConfirm } from "./apply";
export { compileCompanyMigrationPlan, assertCompanyMigrationPlanReady } from "./plan";
export { COMPANY_MIGRATION_OVERRIDES, CRM_COMPANIES_OVERRIDES_VERSION } from "./company-overrides";
export { verifyCompaniesMigration, assertCompanyMigrationApplyStatus } from "./verify";
export {
  preflightCompanyMigrationIndexes,
  assertCompanyMigrationIndexesReady,
  formatIndexPreflight,
} from "./preflight";
export { createStaticContactScanner, createFirestoreContactScanner, firestoreMarketingCompaniesExist } from "./scan";
export { parseCompanyMigrationCliArgs, assertCompanyMigrationCli } from "./cli";
export {
  writeCompanyMigrationPreviewArtifacts,
  writeCompanyMigrationFinalPreviewArtifacts,
  writeCompanyMigrationApplyResult,
  writeCompanyMigrationPostPreviewArtifacts,
  formatCompanyMigrationPreviewSummary,
  formatCompanyMigrationFinalPreviewSummary,
  formatCompanyMigrationApplySummary,
  formatCompanyMigrationStatusSummary,
  previewToCsv,
  finalPreviewToCsv,
} from "./artifacts";
export type {
  CompanyMigrationPreview,
  CompanyMigrationFinalPreview,
  CompanyMigrationGroup,
  CompanyMigrationClassification,
  CompanyMigrationApplyResult,
  CompanyMigrationOverride,
  CompanyMigrationVerification,
  CompanyMigrationStatus,
} from "./types";
