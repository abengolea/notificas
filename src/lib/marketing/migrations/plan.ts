import { normalizeMarketingCompanyName, normalizeMarketingCountryCode, normalizeMarketingDomain } from "../normalizers";
import type { MarketingCompanyRepository } from "../repositories/types";
import { CRM_COMPANIES_MIGRATION_ID, CRM_LEGACY_COMPANY_SOURCE_NAME } from "./constants";
import { CRM_COMPANIES_OVERRIDES_VERSION } from "./company-overrides";
import { normalizeCompanyNameForMatching } from "./grouping";
import { nowIso } from "../persistence/timestamps";
import type {
  CompanyMigrationEffectiveAction,
  CompanyMigrationFinalPreview,
  CompanyMigrationGroup,
  CompanyMigrationOverride,
  CompanyMigrationOverrideIssue,
  CompanyMigrationPlannedGroup,
  CompanyMigrationPlanStats,
  CompanyMigrationPreview,
  CompanyMigrationSharedDomainPeer,
} from "./types";

function defaultAction(classification: CompanyMigrationGroup["classification"]): CompanyMigrationEffectiveAction {
  switch (classification) {
    case "SAFE_CREATE":
      return "CREATE";
    case "SAFE_LINK":
      return "LINK";
    case "ALREADY_MIGRATED":
    case "INSUFFICIENT_DATA":
      return "SKIP";
    case "PROBABLE_MATCH":
    case "AMBIGUOUS":
      return "REVIEW";
    default:
      return "REVIEW";
  }
}

function overrideKey(raw: string): string {
  return normalizeCompanyNameForMatching(raw) || raw.trim().toLowerCase();
}

function findGroup(groups: CompanyMigrationGroup[], normalizedName: string): CompanyMigrationGroup | undefined {
  const key = overrideKey(normalizedName);
  return groups.find((group) => group.matchingName === key || group.normalizedName === key);
}

function sharedDomainMap(groups: CompanyMigrationGroup[]): Map<string, CompanyMigrationSharedDomainPeer[]> {
  const byDomain = new Map<string, CompanyMigrationSharedDomainPeer[]>();
  for (const group of groups) {
    for (const domain of group.domainCandidates) {
      const list = byDomain.get(domain) || [];
      list.push({ normalizedName: group.matchingName || group.normalizedName, contactCount: group.contactCount });
      byDomain.set(domain, list);
    }
  }
  for (const [domain, list] of byDomain) {
    if (list.length < 2) byDomain.delete(domain);
  }
  return byDomain;
}

export async function compileCompanyMigrationPlan(input: {
  preview: CompanyMigrationPreview;
  overrides?: CompanyMigrationOverride[];
  companies: MarketingCompanyRepository;
  workspaceId: string;
}): Promise<CompanyMigrationFinalPreview> {
  const startedAt = nowIso();
  const overrides = input.overrides || [];
  const issues: CompanyMigrationOverrideIssue[] = [];
  const seen = new Set<string>();

  for (const override of overrides) {
    const key = overrideKey(override.match.normalizedName);
    if (!key) {
      issues.push({
        severity: "error",
        kind: "invalid_override",
        normalizedName: override.match.normalizedName,
        reason: "override_match_empty",
      });
      continue;
    }
    if (seen.has(key)) {
      issues.push({
        severity: "error",
        kind: "duplicate",
        normalizedName: key,
        reason: "duplicate_override",
      });
      continue;
    }
    seen.add(key);
    if (!findGroup(input.preview.groups, key)) {
      issues.push({
        severity: "error",
        kind: "missing_group",
        normalizedName: key,
        reason: "override_normalizedName_not_found",
      });
    }
    if (override.action === "LINK" && !override.companyId) {
      issues.push({
        severity: "error",
        kind: "invalid_link",
        normalizedName: key,
        reason: "link_requires_companyId",
      });
    }
    if (override.action === "CREATE" && override.companyId) {
      issues.push({
        severity: "error",
        kind: "invalid_override",
        normalizedName: key,
        reason: "create_must_not_include_companyId",
      });
    }
    if (override.countryCode && !normalizeMarketingCountryCode(override.countryCode)) {
      issues.push({
        severity: "error",
        kind: "invalid_override",
        normalizedName: key,
        reason: `invalid_countryCode=${override.countryCode}`,
      });
    }
    if (override.domain && !normalizeMarketingDomain(override.domain)) {
      issues.push({
        severity: "error",
        kind: "invalid_override",
        normalizedName: key,
        reason: `invalid_domain=${override.domain}`,
      });
    }
  }

  const shared = sharedDomainMap(input.preview.groups);
  const overrideByKey = new Map<string, CompanyMigrationOverride>();
  for (const override of overrides) {
    const key = overrideKey(override.match.normalizedName);
    if (key && !overrideByKey.has(key)) overrideByKey.set(key, override);
  }

  const groups: CompanyMigrationPlannedGroup[] = [];
  for (const group of input.preview.groups) {
    const key = group.matchingName || group.normalizedName;
    const override = overrideByKey.get(key);
    const automaticAction = defaultAction(group.classification);
    let effectiveAction = automaticAction;
    let decisionSource: CompanyMigrationPlannedGroup["decisionSource"] = "algorithm";
    let overrideReason: string | undefined;
    let companyDomain: string | undefined;
    let canonicalName = group.suggestedCompanyName || group.originalValues[0] || group.matchingName;
    let countryCode =
      group.countryStatus === "single" ? group.countryCandidates[0] : undefined;

    if (override) {
      const alreadySatisfied =
        group.classification === "ALREADY_MIGRATED" &&
        (override.action === "CREATE" || override.action === "LINK");
      if (alreadySatisfied) {
        decisionSource = "human_override";
        effectiveAction = "SKIP";
        overrideReason = `${override.reason} | already_migrated`;
        if (override.canonicalName?.trim()) canonicalName = override.canonicalName.trim();
        if (override.countryCode) countryCode = normalizeMarketingCountryCode(override.countryCode) || countryCode;
      } else {
        decisionSource = "human_override";
        effectiveAction = override.action;
        overrideReason = override.reason;
        if (override.canonicalName?.trim()) canonicalName = override.canonicalName.trim();
        if (override.countryCode) countryCode = normalizeMarketingCountryCode(override.countryCode) || countryCode;
        if (override.domain) companyDomain = normalizeMarketingDomain(override.domain) || undefined;
      }
    }

    const peers: CompanyMigrationSharedDomainPeer[] = [];
    for (const domain of group.domainCandidates) {
      const list = shared.get(domain) || [];
      for (const peer of list) {
        if (peer.normalizedName === (group.matchingName || group.normalizedName)) continue;
        if (!peers.some((p) => p.normalizedName === peer.normalizedName)) peers.push(peer);
      }
    }

    const planned: CompanyMigrationPlannedGroup = {
      ...group,
      emailDomainCandidates: [...group.domainCandidates],
      companyDomain,
      sharedDomainWithOtherGroups: peers,
      automaticClassification: group.classification,
      effectiveAction,
      decisionSource,
      overrideReason,
    };

    if (effectiveAction === "CREATE") {
      planned.proposedCompany = {
        name: canonicalName,
        normalizedName: normalizeMarketingCompanyName(canonicalName),
        countryCode,
        domain: companyDomain,
        source: CRM_LEGACY_COMPANY_SOURCE_NAME,
        contactIds: group.contactIds,
      };
    }

    if (effectiveAction === "LINK") {
      const companyId = override?.companyId || group.existingCompanyCandidates[0]?.companyId;
      if (!companyId) {
        issues.push({
          severity: "error",
          kind: "invalid_link",
          normalizedName: key,
          reason: "link_missing_target_company",
        });
        planned.effectiveAction = "REVIEW";
        planned.decisionSource = override ? "human_override" : "algorithm";
      } else {
        const company = await input.companies.getById(input.workspaceId, companyId);
        if (!company) {
          issues.push({
            severity: "error",
            kind: "workspace_mismatch",
            normalizedName: key,
            reason: "link_company_not_in_workspace_or_missing",
          });
          planned.effectiveAction = "REVIEW";
        } else if (company.deletedAt) {
          issues.push({
            severity: "error",
            kind: "invalid_link",
            normalizedName: key,
            reason: "link_company_deleted",
          });
          planned.effectiveAction = "REVIEW";
        } else {
          planned.linkPlan = {
            companyId: company.id,
            companyName: company.name,
            contactIds: group.contactIds,
            legacyCompanyValues: group.originalValues,
          };
        }
      }
    }

    groups.push(planned);
  }

  const countAction = (action: CompanyMigrationEffectiveAction) =>
    groups.filter((g) => g.effectiveAction === action).length;
  const contactAction = (action: CompanyMigrationEffectiveAction) =>
    groups.filter((g) => g.effectiveAction === action).reduce((sum, g) => sum + g.contactCount, 0);

  const create = countAction("CREATE");
  const link = countAction("LINK");
  const skip = countAction("SKIP");
  const review = countAction("REVIEW");
  const sharedDomainWarnings = [...shared.entries()].map(([domain, list]) => ({ domain, groups: list }));

  const stats: CompanyMigrationPlanStats = {
    ...input.preview.stats,
    groupsTotal: groups.length,
    create,
    link,
    skip,
    review,
    algorithmDecisions: groups.filter((g) => g.decisionSource === "algorithm").length,
    humanOverrides: groups.filter((g) => g.decisionSource === "human_override").length,
    sharedDomainWarnings: sharedDomainWarnings.length,
    contactsWouldLink: contactAction("CREATE") + contactAction("LINK"),
    companiesWouldCreate: create,
    contactsWouldSkip: contactAction("SKIP"),
    contactsNotAutoMigratable: contactAction("REVIEW") + contactAction("SKIP"),
  };

  return {
    migrationId: CRM_COMPANIES_MIGRATION_ID,
    overridesVersion: CRM_COMPANIES_OVERRIDES_VERSION,
    mode: "preview",
    startedAt,
    completedAt: nowIso(),
    workspaceId: input.workspaceId,
    stats,
    groups,
    sharedDomainWarnings,
    overrideIssues: issues,
  };
}

export function assertCompanyMigrationPlanReady(plan: CompanyMigrationFinalPreview): void {
  const errors = plan.overrideIssues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    throw new Error(
      `APPLY_BLOCKED: override issues: ${errors.map((e) => `${e.kind}:${e.normalizedName}`).join(", ")}`,
    );
  }
  if (plan.stats.review > 0) {
    throw new Error(`APPLY_BLOCKED: reviewCount=${plan.stats.review}. unresolved > 0 => apply abort`);
  }
  const unresolvedAmbiguous = plan.groups.filter(
    (g) => g.automaticClassification === "AMBIGUOUS" && g.effectiveAction === "REVIEW",
  ).length;
  if (unresolvedAmbiguous > 0) {
    throw new Error(`APPLY_BLOCKED: ambiguousUnresolved=${unresolvedAmbiguous}`);
  }
}
