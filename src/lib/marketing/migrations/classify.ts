import type { MarketingCompany } from "../domain/types";
import { normalizeMarketingCompanyName } from "../normalizers";
import type { MarketingCompanyRepository, MarketingContactRecord } from "../repositories/types";
import { CRM_COMPANIES_MIGRATION_ID } from "./constants";
import {
  collectCountryStatus,
  collectDomainCandidates,
  corporateEmailDomain,
  extractEmailDomain,
  isInsufficientCompanyName,
  normalizeCompanyNameForMatching,
  suggestCanonicalCompanyName,
} from "./grouping";
import type {
  CompanyMigrationClassification,
  CompanyMigrationExistingCandidate,
  CompanyMigrationGroup,
} from "./types";

export type LinkedCompanyInspection = {
  status: "missing" | "deleted" | "workspace_mismatch" | "ok";
  company?: MarketingCompany;
  reasons: string[];
};

export async function inspectLinkedCompany(
  companies: MarketingCompanyRepository,
  workspaceId: string,
  companyId: string,
): Promise<LinkedCompanyInspection> {
  const company = await companies.getById(workspaceId, companyId);
  if (!company) {
    return { status: "missing", reasons: ["broken_company_id"] };
  }
  if (company.workspaceId !== workspaceId) {
    return { status: "workspace_mismatch", company, reasons: ["company_workspace_mismatch"] };
  }
  if (company.deletedAt) {
    return { status: "deleted", company, reasons: ["linked_company_deleted"] };
  }
  return { status: "ok", company, reasons: [] };
}

export function legacyConflictsWithLinkedCompany(
  companyString: string | undefined,
  company: MarketingCompany,
): boolean {
  const raw = (companyString || "").trim();
  if (!raw || isInsufficientCompanyName(raw)) return false;
  const matching = normalizeCompanyNameForMatching(raw);
  const persisted = normalizeMarketingCompanyName(raw);
  if (matching && matching === normalizeCompanyNameForMatching(company.name)) return false;
  if (persisted && persisted === company.normalizedName) return false;
  if (matching && matching === company.normalizedName) return false;
  return true;
}

function candidate(
  company: MarketingCompany,
  reason: string,
  legacySourceId?: string,
): CompanyMigrationExistingCandidate {
  return {
    companyId: company.id,
    name: company.name,
    reason,
    workspaceId: company.workspaceId,
    normalizedName: company.normalizedName,
    normalizedDomain: company.normalizedDomain,
    countryCode: company.countryCode,
    migrationOwned: Boolean(legacySourceId && company.sourceIds?.includes(legacySourceId)),
  };
}

export async function findExistingCompanyCandidates(
  companies: MarketingCompanyRepository,
  workspaceId: string,
  input: {
    matchingName: string;
    persistNames: string[];
    countryCandidates: string[];
    domainCandidates: string[];
    legacySourceId?: string;
  },
): Promise<CompanyMigrationExistingCandidate[]> {
  const found = new Map<string, CompanyMigrationExistingCandidate>();

  const addAll = (rows: MarketingCompany[], reason: string) => {
    for (const row of rows) {
      if (row.workspaceId !== workspaceId) continue;
      if (row.deletedAt) continue;
      const current = found.get(row.id);
      if (current) {
        if (!current.reason.includes(reason)) current.reason = `${current.reason}|${reason}`;
        continue;
      }
      found.set(row.id, candidate(row, reason, input.legacySourceId));
    }
  };

  for (const domain of input.domainCandidates) {
    addAll(await companies.findByNormalizedDomain(workspaceId, domain), `normalizedDomain=${domain}`);
  }

  const names = new Set(
    [input.matchingName, ...input.persistNames].map((n) => n.trim()).filter(Boolean),
  );
  for (const name of names) {
    if (input.countryCandidates.length === 0) {
      addAll(await companies.findByNormalizedName(workspaceId, name), `normalizedName=${name}`);
    } else {
      for (const country of input.countryCandidates) {
        addAll(
          await companies.findByNormalizedName(workspaceId, name, country),
          `normalizedName=${name}+countryCode=${country}`,
        );
      }
      addAll(await companies.findByNormalizedName(workspaceId, name), `normalizedName=${name}`);
    }
  }

  return [...found.values()];
}

export function classifyPreparedGroup(group: CompanyMigrationGroup): CompanyMigrationGroup {
  const reasons = [...group.reasons];
  let classification: CompanyMigrationClassification = group.classification;

  const uniqueCompanyIds = new Set(
    group.contacts.map((c) => c.companyId).filter((id): id is string => Boolean(id)),
  );

  if (classification === "INSUFFICIENT_DATA" || classification === "ALREADY_MIGRATED") {
    return { ...group, reasons };
  }

  if (reasons.includes("broken_company_id") || reasons.includes("linked_company_deleted")) {
    classification = "AMBIGUOUS";
  }
  if (reasons.includes("legacy_company_conflicts_with_linked_company")) {
    classification = "AMBIGUOUS";
  }
  if (group.countryStatus === "multiple") {
    reasons.push("multiple_countries");
    classification = "AMBIGUOUS";
  }
  if (group.domainCandidates.length > 1) {
    reasons.push("multiple_corporate_domains");
    classification = "AMBIGUOUS";
  }
  if (group.existingCompanyCandidates.length > 1) {
    reasons.push("multiple_existing_companies");
    classification = "AMBIGUOUS";
  }
  if (uniqueCompanyIds.size > 1) {
    reasons.push("mixed_existing_company_ids");
    classification = "AMBIGUOUS";
  }

  if (classification === "AMBIGUOUS") {
    return { ...group, classification, reasons: uniqueReasons(reasons) };
  }

  const existing = group.existingCompanyCandidates[0];
  if (!existing) {
    reasons.push("no_existing_company");
    classification = "SAFE_CREATE";
    return { ...group, classification, reasons: uniqueReasons(reasons) };
  }

  const domainReasons = existing.reason
    .split("|")
    .filter((part) => part.startsWith("normalizedDomain="));
  const exactDomain =
    domainReasons.length > 0 &&
    group.domainCandidates.length === 1 &&
    existing.normalizedDomain === group.domainCandidates[0];

  if (exactDomain) {
    if (existing.countryCode && group.countryStatus === "single" && existing.countryCode !== group.countryCandidates[0]) {
      reasons.push("domain_match_country_mismatch");
      classification = "AMBIGUOUS";
      return { ...group, classification, reasons: uniqueReasons(reasons) };
    }
    reasons.push(`exact_domain=${group.domainCandidates[0]}`);
    classification = "SAFE_LINK";
    return { ...group, classification, reasons: uniqueReasons(reasons) };
  }

  if (existing.migrationOwned) {
    reasons.push("migration_owned_name_match");
    classification = "SAFE_LINK";
    return { ...group, classification, reasons: uniqueReasons(reasons) };
  }

  reasons.push("name_and_country_or_name_only_match");
  classification = "PROBABLE_MATCH";
  return { ...group, classification, reasons: uniqueReasons(reasons) };
}

function uniqueReasons(reasons: string[]): string[] {
  return [...new Set(reasons)];
}

export function buildNameGroup(input: {
  matchingName: string;
  contacts: MarketingContactRecord[];
  extraReasons?: string[];
}): Omit<CompanyMigrationGroup, "existingCompanyCandidates" | "classification"> & {
  classification: CompanyMigrationClassification;
  existingCompanyCandidates: CompanyMigrationExistingCandidate[];
} {
  const originalValues = uniqueKeepOrder(input.contacts.map((c) => (c.company || "").trim()).filter(Boolean));
  const suggested = suggestCanonicalCompanyName(originalValues.length ? originalValues : input.contacts.map((c) => c.company || ""));
  const countries = collectCountryStatus(
    input.contacts.map((c) => c.countryCode || c.country),
  );
  const domainCandidates = collectDomainCandidates(input.contacts.map((c) => c.email));
  const persistNames = originalValues.map((v) => normalizeMarketingCompanyName(v)).filter(Boolean);

  return {
    groupKey: input.matchingName || "(empty)",
    normalizedName: persistNames[0] || input.matchingName,
    matchingName: input.matchingName,
    originalValues,
    suggestedCompanyName: suggested.name || undefined,
    canonicalNameReason: suggested.name ? suggested.reason : undefined,
    contactCount: input.contacts.length,
    contactIds: input.contacts.map((c) => c.id),
    contacts: input.contacts.map((c) => ({
      contactId: c.id,
      emailDomain: extractEmailDomain(c.email),
      country: c.countryCode || c.country,
      companyId: c.companyId,
    })),
    countryCandidates: countries.countryCandidates,
    countryStatus: countries.countryStatus,
    domainCandidates,
    existingCompanyCandidates: [],
    classification: "SAFE_CREATE",
    reasons: [
      ...(suggested.reason ? [`canonicalNameReason=${suggested.reason}`] : []),
      `country_status=${countries.countryStatus}`,
      ...(input.extraReasons || []),
    ],
  };
}

export function alreadyMigratedGroup(
  company: MarketingCompany,
  contacts: MarketingContactRecord[],
): CompanyMigrationGroup {
  const originalValues = uniqueKeepOrder(contacts.map((c) => (c.company || "").trim()).filter(Boolean));
  const countries = collectCountryStatus(contacts.map((c) => c.countryCode || c.country));
  return {
    groupKey: `already:${company.id}`,
    normalizedName: company.normalizedName,
    matchingName: normalizeCompanyNameForMatching(company.name),
    originalValues,
    suggestedCompanyName: company.name,
    canonicalNameReason: "most_frequent_variant",
    contactCount: contacts.length,
    contactIds: contacts.map((c) => c.id),
    contacts: contacts.map((c) => ({
      contactId: c.id,
      emailDomain: extractEmailDomain(c.email),
      country: c.countryCode || c.country,
      companyId: c.companyId,
    })),
    countryCandidates: countries.countryCandidates,
    countryStatus: countries.countryStatus,
    domainCandidates: collectDomainCandidates(contacts.map((c) => c.email)),
    existingCompanyCandidates: [candidate(company, "already_linked", undefined)],
    classification: "ALREADY_MIGRATED",
    reasons: ["already_linked", `migrationId=${CRM_COMPANIES_MIGRATION_ID}`],
  };
}

export function insufficientGroup(key: string, contacts: MarketingContactRecord[], reason: string): CompanyMigrationGroup {
  const originalValues = uniqueKeepOrder(contacts.map((c) => (c.company || "").trim()).filter(Boolean));
  const countries = collectCountryStatus(contacts.map((c) => c.countryCode || c.country));
  return {
    groupKey: `insufficient:${key || "(empty)"}`,
    normalizedName: key,
    matchingName: key,
    originalValues,
    contactCount: contacts.length,
    contactIds: contacts.map((c) => c.id),
    contacts: contacts.map((c) => ({
      contactId: c.id,
      emailDomain: extractEmailDomain(c.email),
      country: c.countryCode || c.country,
      companyId: c.companyId,
    })),
    countryCandidates: countries.countryCandidates,
    countryStatus: countries.countryStatus,
    domainCandidates: collectDomainCandidates(contacts.map((c) => c.email)),
    existingCompanyCandidates: [],
    classification: "INSUFFICIENT_DATA",
    reasons: [reason],
  };
}

function uniqueKeepOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

export function persistNamesForGroup(originalValues: string[]): string[] {
  return [...new Set(originalValues.map((v) => normalizeMarketingCompanyName(v)).filter(Boolean))];
}

export { corporateEmailDomain };
