export const COMPANY_MIGRATION_CLASSIFICATIONS = [
  "SAFE_CREATE",
  "SAFE_LINK",
  "PROBABLE_MATCH",
  "AMBIGUOUS",
  "INSUFFICIENT_DATA",
  "ALREADY_MIGRATED",
] as const;

export type CompanyMigrationClassification = (typeof COMPANY_MIGRATION_CLASSIFICATIONS)[number];

export type CompanyMigrationMode = "preview" | "apply" | "status";

export const COMPANY_MIGRATION_STATUSES = [
  "NOT_STARTED",
  "READY_TO_APPLY",
  "PARTIALLY_APPLIED",
  "COMPLETED",
  "INCONSISTENT",
] as const;
export type CompanyMigrationStatus = (typeof COMPANY_MIGRATION_STATUSES)[number];

export const COMPANY_MIGRATION_ACTIONS = ["CREATE", "LINK", "SKIP", "REVIEW"] as const;
export type CompanyMigrationEffectiveAction = (typeof COMPANY_MIGRATION_ACTIONS)[number];

export type CompanyMigrationDecisionSource = "algorithm" | "human_override";

export type CompanyMigrationOverride = {
  match: {
    normalizedName: string;
  };
  action: CompanyMigrationEffectiveAction;
  companyId?: string;
  canonicalName?: string;
  countryCode?: string;
  /** Dominio de empresa explícito. No copiar desde email salvo decisión humana. */
  domain?: string;
  tags?: string[];
  reason: string;
};

export type CompanyMigrationSharedDomainPeer = {
  normalizedName: string;
  contactCount: number;
};

export type CompanyMigrationOverrideIssue = {
  severity: "error" | "warning";
  kind: "missing_group" | "duplicate" | "invalid_link" | "workspace_mismatch" | "invalid_override";
  normalizedName: string;
  reason: string;
};

export type CompanyMigrationIssue = {
  severity: "error" | "warning";
  kind:
    | "broken_company_id"
    | "workspace_mismatch"
    | "deleted_company"
    | "legacy_conflict"
    | "skip_linked"
    | "review_pending"
    | "unlinked_commercial"
    | "override_error";
  group?: string;
  contactId?: string;
  companyId?: string;
  reason: string;
};

export type CompanyMigrationProposedCompany = {
  name: string;
  normalizedName: string;
  countryCode?: string;
  domain?: string;
  source: string;
  contactIds: string[];
};

export type CompanyMigrationLinkPlan = {
  companyId: string;
  companyName: string;
  contactIds: string[];
  legacyCompanyValues: string[];
};

export type CompanyMigrationPlannedGroup = CompanyMigrationGroup & {
  emailDomainCandidates: string[];
  companyDomain?: string;
  sharedDomainWithOtherGroups: CompanyMigrationSharedDomainPeer[];
  automaticClassification: CompanyMigrationClassification;
  effectiveAction: CompanyMigrationEffectiveAction;
  decisionSource: CompanyMigrationDecisionSource;
  overrideReason?: string;
  proposedCompany?: CompanyMigrationProposedCompany;
  linkPlan?: CompanyMigrationLinkPlan;
};

export type CompanyMigrationPlanStats = CompanyMigrationStats & {
  groupsTotal: number;
  create: number;
  link: number;
  skip: number;
  review: number;
  algorithmDecisions: number;
  humanOverrides: number;
  sharedDomainWarnings: number;
  contactsWouldSkip: number;
};

export type CompanyMigrationFinalPreview = {
  migrationId: string;
  overridesVersion: string;
  mode: "preview";
  startedAt: string;
  completedAt: string;
  workspaceId: string;
  stats: CompanyMigrationPlanStats;
  groups: CompanyMigrationPlannedGroup[];
  sharedDomainWarnings: {
    domain: string;
    groups: CompanyMigrationSharedDomainPeer[];
  }[];
  overrideIssues: CompanyMigrationOverrideIssue[];
};

export type CompanyMigrationCountryStatus = "single" | "multiple" | "missing";

export type CanonicalCompanyNameReason =
  | "most_frequent_variant"
  | "tie_prefer_not_all_caps"
  | "first_valid_variant";

export type CompanyMigrationExistingCandidate = {
  companyId: string;
  name: string;
  reason: string;
  workspaceId: string;
  normalizedName?: string;
  normalizedDomain?: string;
  countryCode?: string;
  migrationOwned?: boolean;
};

export type CompanyMigrationContactRef = {
  contactId: string;
  emailDomain?: string;
  country?: string;
  companyId?: string;
};

export type CompanyMigrationGroup = {
  groupKey: string;
  normalizedName: string;
  matchingName: string;
  originalValues: string[];
  suggestedCompanyName?: string;
  canonicalNameReason?: CanonicalCompanyNameReason;
  contactCount: number;
  contactIds: string[];
  contacts: CompanyMigrationContactRef[];
  countryCandidates: string[];
  countryStatus: CompanyMigrationCountryStatus;
  domainCandidates: string[];
  existingCompanyCandidates: CompanyMigrationExistingCandidate[];
  classification: CompanyMigrationClassification;
  reasons: string[];
};

export type CompanyMigrationStats = {
  totalContacts: number;
  contactsScanned: number;
  contactsWithCompanyString: number;
  contactsWithoutCompany: number;
  contactsWithCompanyId: number;
  contactsWithBoth: number;
  uniqueOriginalCompanyValues: number;
  uniqueNormalizedCompanies: number;
  contactsWouldLink: number;
  companiesWouldCreate: number;
  exactGroups: number;
  probableGroups: number;
  ambiguousGroups: number;
  contactsNotAutoMigratable: number;
  safeCreate: number;
  safeLink: number;
  probableMatch: number;
  ambiguous: number;
  insufficientData: number;
  alreadyMigrated: number;
  batches: number;
  durationMs: number;
  skippedOtherWorkspace: number;
  skippedDeleted: number;
};

export type CompanyMigrationPreview = {
  migrationId: string;
  mode: "preview";
  startedAt: string;
  completedAt: string;
  workspaceId: string;
  stats: CompanyMigrationStats;
  groups: CompanyMigrationGroup[];
};

export type CompanyMigrationApplyError = {
  group: string;
  contactId?: string;
  companyId?: string;
  operation: string;
  reason: string;
};

export type CompanyMigrationApplyResult = {
  migrationId: string;
  mode: "apply";
  startedAt: string;
  completedAt: string;
  workspaceId: string;
  processed: number;
  created: number;
  linked: number;
  skipped: number;
  errors: CompanyMigrationApplyError[];
  complete: boolean;
  stats: CompanyMigrationStats;
};

export type CompanyMigrationVerification = {
  migrationId: string;
  workspaceId: string;
  status: CompanyMigrationStatus;
  verifiedAt: string;
  appliedAt?: string;
  version: string;
  contactsScanned: number;
  commercialContacts: number;
  commercialContactsLinked: number;
  companies: number;
  skippedGroups: number;
  brokenLinks: number;
  conflicts: number;
  reviewRequired: number;
  issues: CompanyMigrationIssue[];
  plan: CompanyMigrationFinalPreview;
};
