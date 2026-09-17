import type { MarketingServiceContext } from "../context";
import type { MarketingServices } from "../services";
import { CRM_COMPANIES_APPLY_CONTACT_BATCH, CRM_COMPANIES_MIGRATION_ID, CRM_LEGACY_COMPANY_SOURCE_NAME } from "./constants";
import { findExistingCompanyCandidates, persistNamesForGroup } from "./classify";
import { previewCompanyMigration, type PreviewCompanyMigrationInput } from "./preview";
import { assertCompanyMigrationPlanReady, compileCompanyMigrationPlan } from "./plan";
import { assertCompanyMigrationApplyStatus, verifyCompaniesMigration } from "./verify";
import type { CompanyMigrationIndexPreflight } from "./preflight";
import { assertCompanyMigrationIndexesReady } from "./preflight";
import type { MarketingMigrationContactScanner } from "./scan";
import type {
  CompanyMigrationApplyError,
  CompanyMigrationApplyResult,
  CompanyMigrationOverride,
  CompanyMigrationPlannedGroup,
} from "./types";

export type ApplyCompanyMigrationInput = PreviewCompanyMigrationInput & {
  confirm: string;
  services: MarketingServices;
  ctx: MarketingServiceContext;
  scanner: MarketingMigrationContactScanner;
  overrides?: CompanyMigrationOverride[];
  indexPreflight?: () => Promise<CompanyMigrationIndexPreflight>;
};

async function resolveLegacySourceId(input: ApplyCompanyMigrationInput): Promise<string> {
  const existing = await findExistingLegacySource(input);
  if (existing) return existing;
  const created = await input.services.sources.createSource(input.ctx, {
    type: "manual",
    name: CRM_LEGACY_COMPANY_SOURCE_NAME,
    description: "Empresas creadas por CRM_COMPANIES_V1 a partir de contact.company legacy",
    metadata: { migrationId: CRM_COMPANIES_MIGRATION_ID },
  });
  return created.id;
}

async function findExistingLegacySource(input: ApplyCompanyMigrationInput): Promise<string | undefined> {
  let cursor: string | undefined;
  for (;;) {
    const page = await input.services.sources.listSources(input.ctx, cursor, 100);
    const hit = page.items.find(
      (row) =>
        row.name === CRM_LEGACY_COMPANY_SOURCE_NAME &&
        row.metadata?.migrationId === CRM_COMPANIES_MIGRATION_ID,
    );
    if (hit) return hit.id;
    if (!page.nextCursor) return undefined;
    cursor = page.nextCursor;
  }
}

async function linkContacts(
  input: ApplyCompanyMigrationInput,
  group: CompanyMigrationPlannedGroup,
  companyId: string,
  result: CompanyMigrationApplyResult,
): Promise<void> {
  for (let i = 0; i < group.contactIds.length; i += CRM_COMPANIES_APPLY_CONTACT_BATCH) {
    const slice = group.contactIds.slice(i, i + CRM_COMPANIES_APPLY_CONTACT_BATCH);
    for (const contactId of slice) {
      result.processed += 1;
      try {
        const current = await input.services.contacts.getContact(input.ctx, contactId);
        if (current.companyId && current.companyId !== companyId) {
          result.skipped += 1;
          result.errors.push({
            group: group.groupKey,
            contactId,
            companyId: current.companyId,
            operation: "link",
            reason: "legacy_company_conflicts_with_linked_company",
          });
          continue;
        }
        if (current.companyId === companyId) {
          result.skipped += 1;
          continue;
        }
        await input.services.contacts.updateContact(input.ctx, contactId, { companyId });
        result.linked += 1;
      } catch (error) {
        result.errors.push({
          group: group.groupKey,
          contactId,
          companyId,
          operation: "link",
          reason: error instanceof Error ? error.message : "link_failed",
        });
      }
    }
  }
}

export function assertCompanyMigrationApplyConfirm(confirm: string): void {
  if (confirm !== CRM_COMPANIES_MIGRATION_ID) {
    throw new Error(
      `APPLY_BLOCKED: se requiere --mode=apply --confirm=${CRM_COMPANIES_MIGRATION_ID}`,
    );
  }
}

export async function applyCompanyMigration(
  input: ApplyCompanyMigrationInput,
): Promise<CompanyMigrationApplyResult> {
  assertCompanyMigrationApplyConfirm(input.confirm);
  const verification = await verifyCompaniesMigration(input);
  assertCompanyMigrationApplyStatus(verification.status);
  const startedAt = new Date().toISOString();
  const preview = await previewCompanyMigration(input);
  const plan = await compileCompanyMigrationPlan({
    preview,
    overrides: input.overrides || [],
    companies: input.companies,
    workspaceId: input.workspaceId,
  });
  assertCompanyMigrationPlanReady(plan);
  if (input.indexPreflight) {
    assertCompanyMigrationIndexesReady(await input.indexPreflight());
  }

  const legacySourceId = await resolveLegacySourceId(input);
  const result: CompanyMigrationApplyResult = {
    migrationId: CRM_COMPANIES_MIGRATION_ID,
    mode: "apply",
    startedAt,
    completedAt: startedAt,
    workspaceId: input.workspaceId,
    processed: 0,
    created: 0,
    linked: 0,
    skipped: 0,
    errors: [] as CompanyMigrationApplyError[],
    complete: false,
    stats: preview.stats,
  };

  for (const group of plan.groups) {
    if (group.effectiveAction === "SKIP") {
      result.skipped += group.contactCount;
      continue;
    }
    if (group.effectiveAction !== "CREATE" && group.effectiveAction !== "LINK") {
      result.errors.push({
        group: group.groupKey,
        operation: "plan",
        reason: `unexpected_action=${group.effectiveAction}`,
      });
      continue;
    }

    let companyId = group.linkPlan?.companyId;
    if (group.effectiveAction === "CREATE") {
      const existing = await findExistingCompanyCandidates(input.companies, input.workspaceId, {
        matchingName: group.matchingName,
        persistNames: persistNamesForGroup(group.originalValues),
        countryCandidates: group.countryCandidates,
        domainCandidates: group.emailDomainCandidates,
        legacySourceId,
      });
      const unique = existing.length === 1 ? existing[0] : undefined;
      const domainMatch =
        unique &&
        group.emailDomainCandidates.length === 1 &&
        unique.normalizedDomain === group.emailDomainCandidates[0];
      if (unique && (domainMatch || unique.migrationOwned)) {
        companyId = unique.companyId;
      } else if (existing.length > 1) {
        result.skipped += group.contactCount;
        result.errors.push({
          group: group.groupKey,
          operation: "revalidate",
          reason: "group_no_longer_safe",
        });
        continue;
      } else {
        try {
          const proposed = group.proposedCompany;
          const created = await input.services.companies.createCompany(input.ctx, {
            name: proposed?.name || group.suggestedCompanyName || group.originalValues[0] || group.matchingName,
            countryCode: proposed?.countryCode,
            website: proposed?.domain ? `https://${proposed.domain}` : undefined,
            sourceIds: [legacySourceId],
          });
          companyId = created.company.id;
          result.created += 1;
        } catch (error) {
          result.errors.push({
            group: group.groupKey,
            operation: "create_company",
            reason: error instanceof Error ? error.message : "create_failed",
          });
          continue;
        }
      }
    }

    if (!companyId) {
      result.errors.push({
        group: group.groupKey,
        operation: "link",
        reason: "missing_company_id_after_revalidate",
      });
      continue;
    }

    await linkContacts(input, group, companyId, result);
  }

  result.completedAt = new Date().toISOString();
  result.complete = result.errors.length === 0;
  return result;
}
