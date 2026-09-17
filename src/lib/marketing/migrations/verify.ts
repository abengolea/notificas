import { nowIso } from "../persistence/timestamps";
import { CRM_COMPANIES_MIGRATION_ID } from "./constants";
import { CRM_COMPANIES_OVERRIDES_VERSION } from "./company-overrides";
import { inspectLinkedCompany, legacyConflictsWithLinkedCompany } from "./classify";
import { compileCompanyMigrationPlan } from "./plan";
import { previewCompanyMigration, type PreviewCompanyMigrationInput } from "./preview";
import type {
  CompanyMigrationIssue,
  CompanyMigrationOverride,
  CompanyMigrationPlannedGroup,
  CompanyMigrationStatus,
  CompanyMigrationVerification,
} from "./types";

export type VerifyCompaniesMigrationInput = PreviewCompanyMigrationInput & {
  overrides?: CompanyMigrationOverride[];
};

export function isHumanSkipGroup(group: CompanyMigrationPlannedGroup): boolean {
  if (group.automaticClassification === "INSUFFICIENT_DATA") return true;
  if (group.effectiveAction !== "SKIP") return false;
  if (group.decisionSource !== "human_override") return false;
  return !String(group.overrideReason || "").includes("already_migrated");
}

export function isCommercialMigrationGroup(group: CompanyMigrationPlannedGroup): boolean {
  if (isHumanSkipGroup(group)) return false;
  return Boolean((group.matchingName || group.normalizedName || "").trim());
}

export async function verifyCompaniesMigration(
  input: VerifyCompaniesMigrationInput,
): Promise<CompanyMigrationVerification> {
  const verifiedAt = nowIso();
  const preview = await previewCompanyMigration(input);
  const plan = await compileCompanyMigrationPlan({
    preview,
    overrides: input.overrides || [],
    companies: input.companies,
    workspaceId: input.workspaceId,
  });

  const issues: CompanyMigrationIssue[] = [];
  for (const issue of plan.overrideIssues) {
    if (issue.severity === "error") {
      issues.push({
        severity: "error",
        kind: "override_error",
        group: issue.normalizedName,
        reason: `${issue.kind}:${issue.reason}`,
      });
    }
  }

  let commercialContacts = 0;
  let commercialContactsLinked = 0;
  let skippedGroups = 0;
  const linkedCompanyIds = new Set<string>();

  for (const group of plan.groups) {
    if (isHumanSkipGroup(group)) skippedGroups += 1;
    const commercial = isCommercialMigrationGroup(group);
    if (commercial) commercialContacts += group.contactCount;

    if (group.reasons.includes("legacy_company_conflicts_with_linked_company")) {
      issues.push({
        severity: "error",
        kind: "legacy_conflict",
        group: group.matchingName || group.normalizedName,
        reason: "legacy_company_conflicts_with_linked_company",
      });
    }

    for (const contact of group.contacts) {
      const companyId = contact.companyId;
      if (isHumanSkipGroup(group)) {
        if (companyId) {
          issues.push({
            severity: "error",
            kind: "skip_linked",
            group: group.matchingName || group.normalizedName,
            contactId: contact.contactId,
            companyId,
            reason: "excluded_group_has_companyId",
          });
        }
        continue;
      }
      if (!commercial) continue;
      if (!companyId) {
        issues.push({
          severity: "error",
          kind: "unlinked_commercial",
          group: group.matchingName || group.normalizedName,
          contactId: contact.contactId,
          reason: "commercial_contact_missing_companyId",
        });
        continue;
      }
      const inspection = await inspectLinkedCompany(input.companies, input.workspaceId, companyId);
      if (inspection.status === "missing") {
        issues.push({
          severity: "error",
          kind: "broken_company_id",
          group: group.matchingName || group.normalizedName,
          contactId: contact.contactId,
          companyId,
          reason: "broken_company_id",
        });
        continue;
      }
      if (inspection.status === "workspace_mismatch") {
        issues.push({
          severity: "error",
          kind: "workspace_mismatch",
          group: group.matchingName || group.normalizedName,
          contactId: contact.contactId,
          companyId,
          reason: "company_workspace_mismatch",
        });
        continue;
      }
      if (inspection.status === "deleted") {
        issues.push({
          severity: "error",
          kind: "deleted_company",
          group: group.matchingName || group.normalizedName,
          contactId: contact.contactId,
          companyId,
          reason: "linked_company_deleted",
        });
        continue;
      }
      const company = inspection.company;
      if (!company) continue;
      if (group.originalValues.some((value) => legacyConflictsWithLinkedCompany(value, company))) {
        const allConflict = group.originalValues.every((value) =>
          legacyConflictsWithLinkedCompany(value, company),
        );
        if (allConflict) {
          issues.push({
            severity: "error",
            kind: "legacy_conflict",
            group: group.matchingName || group.normalizedName,
            contactId: contact.contactId,
            companyId,
            reason: "legacy_company_conflicts_with_linked_company",
          });
          continue;
        }
      }
      commercialContactsLinked += 1;
      linkedCompanyIds.add(company.id);
    }
  }

  const reviewRequired = plan.stats.review;
  if (reviewRequired > 0) {
    issues.push({
      severity: "error",
      kind: "review_pending",
      reason: `reviewCount=${reviewRequired}`,
    });
  }

  const brokenLinks = issues.filter(
    (i) => i.kind === "broken_company_id" || i.kind === "workspace_mismatch" || i.kind === "deleted_company",
  ).length;
  const conflicts = issues.filter(
    (i) => i.kind === "legacy_conflict" || i.kind === "skip_linked" || i.kind === "override_error",
  ).length;
  const structuralErrors = issues.filter((i) => i.kind !== "unlinked_commercial" && i.kind !== "review_pending");
  const unlinkedCommercial = issues.filter((i) => i.kind === "unlinked_commercial").length;
  const workRemaining = plan.stats.create + plan.stats.link;

  let status: CompanyMigrationStatus;
  if (structuralErrors.length > 0) {
    status = "INCONSISTENT";
  } else if (
    commercialContacts > 0 &&
    unlinkedCommercial === 0 &&
    reviewRequired === 0 &&
    workRemaining === 0 &&
    commercialContactsLinked === commercialContacts
  ) {
    status = "COMPLETED";
  } else if (commercialContactsLinked > 0 && (unlinkedCommercial > 0 || workRemaining > 0 || reviewRequired > 0)) {
    status = "PARTIALLY_APPLIED";
  } else if (commercialContactsLinked === 0 && reviewRequired === 0 && workRemaining > 0) {
    status = "READY_TO_APPLY";
  } else {
    status = "NOT_STARTED";
  }

  let appliedAt: string | undefined;
  if (input.sources) {
    let cursor: string | undefined;
    for (;;) {
      const page = await input.sources.list(input.workspaceId, cursor, 100);
      const hit = page.items.find((row) => row.metadata?.migrationId === CRM_COMPANIES_MIGRATION_ID);
      if (hit) {
        appliedAt = hit.createdAt;
        break;
      }
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
  }

  return {
    migrationId: CRM_COMPANIES_MIGRATION_ID,
    workspaceId: input.workspaceId,
    status,
    verifiedAt,
    appliedAt,
    version: CRM_COMPANIES_OVERRIDES_VERSION,
    contactsScanned: preview.stats.contactsScanned,
    commercialContacts,
    commercialContactsLinked,
    companies: linkedCompanyIds.size,
    skippedGroups,
    brokenLinks,
    conflicts,
    reviewRequired,
    issues,
    plan,
  };
}

export function assertCompanyMigrationApplyStatus(status: CompanyMigrationStatus): void {
  if (status === "COMPLETED") {
    throw new Error("CRM_COMPANIES_V1_ALREADY_COMPLETED");
  }
  if (status === "PARTIALLY_APPLIED" || status === "INCONSISTENT") {
    throw new Error(`APPLY_BLOCKED: status=${status}; human review required`);
  }
  if (status !== "READY_TO_APPLY") {
    throw new Error(`APPLY_BLOCKED: status=${status}`);
  }
}
