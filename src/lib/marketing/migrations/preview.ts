import type { MarketingCompany } from "../domain/types";
import { nowIso } from "../persistence/timestamps";
import type { MarketingCompanyRepository, MarketingContactRecord, MarketingSourceRepository } from "../repositories/types";
import { resolveContactWorkspace } from "../services/scope";
import { CRM_COMPANIES_MIGRATION_BATCH_SIZE, CRM_COMPANIES_MIGRATION_ID, CRM_LEGACY_COMPANY_SOURCE_NAME } from "./constants";
import {
  alreadyMigratedGroup,
  findExistingCompanyCandidates,
  inspectLinkedCompany,
  insufficientGroup,
  buildNameGroup,
  classifyPreparedGroup,
  legacyConflictsWithLinkedCompany,
  persistNamesForGroup,
} from "./classify";
import { isInsufficientCompanyName, normalizeCompanyNameForMatching } from "./grouping";
import type { MarketingMigrationContactScanner } from "./scan";
import type { CompanyMigrationGroup, CompanyMigrationPreview, CompanyMigrationStats } from "./types";

export type PreviewCompanyMigrationInput = {
  workspaceId: string;
  scanner: MarketingMigrationContactScanner;
  companies: MarketingCompanyRepository;
  sources?: MarketingSourceRepository;
  batchSize?: number;
  lookupExistingCompanies?: boolean;
};

type Bucket = {
  reason: string;
  contacts: MarketingContactRecord[];
};

async function findLegacySourceId(
  sources: MarketingSourceRepository | undefined,
  workspaceId: string,
): Promise<string | undefined> {
  if (!sources) return undefined;
  let cursor: string | undefined;
  for (;;) {
    const page = await sources.list(workspaceId, cursor, 100);
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

function compactContact(contact: MarketingContactRecord): MarketingContactRecord {
  return {
    ...contact,
    notes: "",
    tags: [],
    listIds: contact.listIds || [],
  };
}

export async function previewCompanyMigration(
  input: PreviewCompanyMigrationInput,
): Promise<CompanyMigrationPreview> {
  const startedAt = nowIso();
  const startedMs = Date.now();
  const batchSize = input.batchSize || CRM_COMPANIES_MIGRATION_BATCH_SIZE;
  const legacySourceId = await findLegacySourceId(input.sources, input.workspaceId);

  let cursor: string | null = null;
  let batches = 0;
  let contactsScanned = 0;
  let skippedOtherWorkspace = 0;
  let skippedDeleted = 0;
  const inWorkspace: MarketingContactRecord[] = [];

  for (;;) {
    const page = await input.scanner.scanBatch(cursor, batchSize);
    batches += 1;
    contactsScanned += page.items.length;
    for (const raw of page.items) {
      if (raw.deletedAt) {
        skippedDeleted += 1;
        continue;
      }
      const workspaceId = resolveContactWorkspace(raw.workspaceId);
      if (workspaceId !== input.workspaceId) {
        skippedOtherWorkspace += 1;
        continue;
      }
      inWorkspace.push(compactContact({ ...raw, workspaceId }));
    }
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }

  const nameBuckets = new Map<string, MarketingContactRecord[]>();
  const alreadyBuckets = new Map<string, { company: MarketingCompany; contacts: MarketingContactRecord[] }>();
  const insufficientBuckets = new Map<string, Bucket>();

  let contactsWithCompanyString = 0;
  let contactsWithoutCompany = 0;
  let contactsWithCompanyId = 0;
  let contactsWithBoth = 0;
  const originalValues = new Set<string>();
  const normalizedCompanies = new Set<string>();

  for (const contact of inWorkspace) {
    const companyString = (contact.company || "").trim();
    if (companyString) {
      contactsWithCompanyString += 1;
      originalValues.add(companyString);
      const matching = normalizeCompanyNameForMatching(companyString);
      if (matching) normalizedCompanies.add(matching);
    } else {
      contactsWithoutCompany += 1;
    }
    if (contact.companyId) contactsWithCompanyId += 1;
    if (companyString && contact.companyId) contactsWithBoth += 1;

    if (contact.companyId) {
      const inspection = await inspectLinkedCompany(input.companies, input.workspaceId, contact.companyId);
      if (inspection.status === "ok" && inspection.company) {
        if (!legacyConflictsWithLinkedCompany(companyString, inspection.company)) {
          const current = alreadyBuckets.get(inspection.company.id) || {
            company: inspection.company,
            contacts: [],
          };
          current.contacts.push(contact);
          alreadyBuckets.set(inspection.company.id, current);
          continue;
        }
        const matching = companyString
          ? normalizeCompanyNameForMatching(companyString)
          : `conflict:${contact.companyId}`;
        const list = nameBuckets.get(matching) || [];
        list.push(contact);
        nameBuckets.set(matching, list);
        continue;
      }

      const matching = companyString
        ? normalizeCompanyNameForMatching(companyString) || `broken:${contact.companyId}`
        : `broken:${contact.companyId}`;
      const list = nameBuckets.get(matching) || [];
      list.push(contact);
      nameBuckets.set(matching, list);
      continue;
    }

    if (isInsufficientCompanyName(companyString)) {
      const key = companyString ? normalizeCompanyNameForMatching(companyString) || companyString.toLowerCase() : "";
      const current = insufficientBuckets.get(key) || {
        reason: companyString ? (normalizeCompanyNameForMatching(companyString) ? "blacklisted_company_string" : "empty_after_normalize") : "missing_company_string",
        contacts: [],
      };
      current.contacts.push(contact);
      insufficientBuckets.set(key, current);
      continue;
    }

    const matching = normalizeCompanyNameForMatching(companyString);
    const list = nameBuckets.get(matching) || [];
    list.push(contact);
    nameBuckets.set(matching, list);
  }

  const groups: CompanyMigrationGroup[] = [];

  for (const { company, contacts } of alreadyBuckets.values()) {
    groups.push(alreadyMigratedGroup(company, contacts));
  }

  for (const [key, bucket] of insufficientBuckets) {
    groups.push(insufficientGroup(key, bucket.contacts, bucket.reason));
  }

  for (const [matchingName, contacts] of nameBuckets) {
    const extraReasons: string[] = [];
    for (const contact of contacts) {
      if (!contact.companyId) continue;
      const inspection = await inspectLinkedCompany(input.companies, input.workspaceId, contact.companyId);
      extraReasons.push(...inspection.reasons);
      if (inspection.status === "ok" && inspection.company && legacyConflictsWithLinkedCompany(contact.company, inspection.company)) {
        extraReasons.push("legacy_company_conflicts_with_linked_company");
      }
    }
    const prepared = buildNameGroup({ matchingName, contacts, extraReasons });
    const existingCompanyCandidates =
      input.lookupExistingCompanies === false
        ? []
        : await findExistingCompanyCandidates(input.companies, input.workspaceId, {
            matchingName,
            persistNames: persistNamesForGroup(prepared.originalValues),
            countryCandidates: prepared.countryCandidates,
            domainCandidates: prepared.domainCandidates,
            legacySourceId,
          });
    groups.push(
      classifyPreparedGroup({
        ...prepared,
        existingCompanyCandidates,
      }),
    );
  }

  groups.sort((a, b) => a.classification.localeCompare(b.classification) || a.groupKey.localeCompare(b.groupKey));

  const count = (classification: CompanyMigrationGroup["classification"]) =>
    groups.filter((g) => g.classification === classification).length;
  const contactCount = (classification: CompanyMigrationGroup["classification"]) =>
    groups.filter((g) => g.classification === classification).reduce((sum, g) => sum + g.contactCount, 0);

  const safeCreate = count("SAFE_CREATE");
  const safeLink = count("SAFE_LINK");
  const probableMatch = count("PROBABLE_MATCH");
  const ambiguous = count("AMBIGUOUS");
  const insufficientData = count("INSUFFICIENT_DATA");
  const alreadyMigrated = count("ALREADY_MIGRATED");

  const stats: CompanyMigrationStats = {
    totalContacts: inWorkspace.length,
    contactsScanned,
    contactsWithCompanyString,
    contactsWithoutCompany,
    contactsWithCompanyId,
    contactsWithBoth,
    uniqueOriginalCompanyValues: originalValues.size,
    uniqueNormalizedCompanies: normalizedCompanies.size,
    contactsWouldLink: contactCount("SAFE_CREATE") + contactCount("SAFE_LINK"),
    companiesWouldCreate: safeCreate,
    exactGroups: safeCreate + safeLink,
    probableGroups: probableMatch,
    ambiguousGroups: ambiguous,
    contactsNotAutoMigratable:
      contactCount("PROBABLE_MATCH") + contactCount("AMBIGUOUS") + contactCount("INSUFFICIENT_DATA"),
    safeCreate,
    safeLink,
    probableMatch,
    ambiguous,
    insufficientData,
    alreadyMigrated,
    batches,
    durationMs: Date.now() - startedMs,
    skippedOtherWorkspace,
    skippedDeleted,
  };

  return {
    migrationId: CRM_COMPANIES_MIGRATION_ID,
    mode: "preview",
    startedAt,
    completedAt: nowIso(),
    workspaceId: input.workspaceId,
    stats,
    groups,
  };
}
