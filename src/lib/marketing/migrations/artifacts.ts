import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { CompanyMigrationFinalPreview, CompanyMigrationPreview } from "./types";

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function previewToCsv(preview: CompanyMigrationPreview): string {
  const header = [
    "classification",
    "suggested_company",
    "normalized_name",
    "original_values",
    "contacts",
    "countries",
    "domains",
    "existing_candidates",
    "reasons",
  ];
  const lines = [header.join(",")];
  for (const group of preview.groups) {
    lines.push(
      [
        group.classification,
        group.suggestedCompanyName || "",
        group.normalizedName,
        group.originalValues.join(" | "),
        String(group.contactCount),
        group.countryCandidates.join(" | "),
        group.domainCandidates.join(" | "),
        group.existingCompanyCandidates.map((c) => `${c.companyId}:${c.name}:${c.reason}`).join(" | "),
        group.reasons.join(" | "),
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export async function writeCompanyMigrationPreviewArtifacts(
  preview: CompanyMigrationPreview,
  outDir: string,
): Promise<{ jsonPath: string; csvPath: string }> {
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "crm-company-migration-preview.json");
  const csvPath = path.join(outDir, "crm-company-migration-preview.csv");
  await writeFile(jsonPath, `${JSON.stringify(preview, null, 2)}\n`, "utf8");
  await writeFile(csvPath, previewToCsv(preview), "utf8");
  return { jsonPath, csvPath };
}

export function formatCompanyMigrationPreviewSummary(input: {
  projectId?: string;
  workspaceId: string;
  preview: CompanyMigrationPreview;
}): string {
  const n = (value: number) => value.toLocaleString("en-US");
  const s = input.preview.stats;
  return [
    `Contacts scanned: ${n(s.contactsScanned)}`,
    `Contacts in workspace: ${n(s.totalContacts)}`,
    `With company: ${n(s.contactsWithCompanyString)}`,
    `Without company: ${n(s.contactsWithoutCompany)}`,
    `With companyId: ${n(s.contactsWithCompanyId)}`,
    `With both: ${n(s.contactsWithBoth)}`,
    `Unique original company values: ${n(s.uniqueOriginalCompanyValues)}`,
    `Unique normalized companies: ${n(s.uniqueNormalizedCompanies)}`,
    `Would link contacts: ${n(s.contactsWouldLink)}`,
    `Would create companies: ${n(s.companiesWouldCreate)}`,
    "",
    `SAFE_CREATE: ${n(s.safeCreate)}`,
    `SAFE_LINK: ${n(s.safeLink)}`,
    `PROBABLE_MATCH: ${n(s.probableMatch)}`,
    `AMBIGUOUS: ${n(s.ambiguous)}`,
    `INSUFFICIENT_DATA: ${n(s.insufficientData)}`,
    `ALREADY_MIGRATED: ${n(s.alreadyMigrated)}`,
    `Exact groups: ${n(s.exactGroups)}`,
    `Probable groups: ${n(s.probableGroups)}`,
    `Ambiguous groups: ${n(s.ambiguousGroups)}`,
    `Contacts not auto-migratable: ${n(s.contactsNotAutoMigratable)}`,
    "",
    `Batches: ${n(s.batches)}`,
    `Duration ms: ${n(s.durationMs)}`,
    "",
    "NO DATA WAS MODIFIED",
    "============================================================",
  ].join("\n");
}

export function finalPreviewToCsv(plan: CompanyMigrationFinalPreview): string {
  const header = [
    "automatic_classification",
    "effective_action",
    "decision_source",
    "canonical_name",
    "normalized_name",
    "original_values",
    "contacts",
    "countries",
    "email_domains",
    "company_domain",
    "shared_domain_warning",
    "reason",
  ];
  const lines = [header.join(",")];
  for (const group of plan.groups) {
    lines.push(
      [
        group.automaticClassification,
        group.effectiveAction,
        group.decisionSource,
        group.proposedCompany?.name || group.suggestedCompanyName || "",
        group.matchingName || group.normalizedName,
        group.originalValues.join(" | "),
        String(group.contactCount),
        group.countryCandidates.join(" | "),
        group.emailDomainCandidates.join(" | "),
        group.companyDomain || "",
        group.sharedDomainWithOtherGroups.map((p) => `${p.normalizedName} (${p.contactCount})`).join(" | "),
        group.overrideReason || group.reasons.join(" | "),
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export async function writeCompanyMigrationFinalPreviewArtifacts(
  plan: CompanyMigrationFinalPreview,
  outDir: string,
): Promise<{ jsonPath: string; csvPath: string }> {
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "crm-company-migration-final-preview.json");
  const csvPath = path.join(outDir, "crm-company-migration-final-preview.csv");
  await writeFile(jsonPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  await writeFile(csvPath, finalPreviewToCsv(plan), "utf8");
  return { jsonPath, csvPath };
}

export function formatCompanyMigrationFinalPreviewSummary(input: {
  plan: CompanyMigrationFinalPreview;
}): string {
  const n = (value: number) => value.toLocaleString("en-US");
  const s = input.plan.stats;
  const issues = input.plan.overrideIssues;
  return [
    `Groups total: ${n(s.groupsTotal)}`,
    `CREATE: ${n(s.create)}`,
    `LINK: ${n(s.link)}`,
    `SKIP: ${n(s.skip)}`,
    `REVIEW: ${n(s.review)}`,
    "",
    `Algorithm decisions: ${n(s.algorithmDecisions)}`,
    `Human overrides: ${n(s.humanOverrides)}`,
    `Shared-domain warnings: ${n(s.sharedDomainWarnings)}`,
    `Would create companies: ${n(s.companiesWouldCreate)}`,
    `Would link contacts: ${n(s.contactsWouldLink)}`,
    `Would skip contacts: ${n(s.contactsWouldSkip)}`,
    "",
    "Automatic classification",
    `SAFE_CREATE: ${n(s.safeCreate)}`,
    `SAFE_LINK: ${n(s.safeLink)}`,
    `PROBABLE_MATCH: ${n(s.probableMatch)}`,
    `AMBIGUOUS: ${n(s.ambiguous)}`,
    `INSUFFICIENT_DATA: ${n(s.insufficientData)}`,
    `ALREADY_MIGRATED: ${n(s.alreadyMigrated)}`,
    "",
    ...input.plan.sharedDomainWarnings.map(
      (w) => `SHARED DOMAIN ${w.domain}: ${w.groups.map((g) => `${g.normalizedName} (${g.contactCount})`).join(", ")}`,
    ),
    issues.length ? `Override issues: ${issues.map((i) => `${i.severity}:${i.kind}:${i.normalizedName}`).join(" | ")}` : "Override issues: none",
    "",
    "NO DATA WAS MODIFIED",
    "============================================================",
  ].join("\n");
}

export async function writeCompanyMigrationApplyResult(
  result: Record<string, unknown>,
  outDir: string,
): Promise<string> {
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "crm-company-migration-apply-result.json");
  await writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return jsonPath;
}

export async function writeCompanyMigrationPostPreviewArtifacts(
  plan: CompanyMigrationFinalPreview,
  outDir: string,
): Promise<{ jsonPath: string; csvPath: string }> {
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "crm-company-migration-post-preview.json");
  const csvPath = path.join(outDir, "crm-company-migration-post-preview.csv");
  await writeFile(jsonPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  await writeFile(csvPath, finalPreviewToCsv(plan), "utf8");
  return { jsonPath, csvPath };
}

export function formatCompanyMigrationStatusSummary(input: {
  projectId: string;
  workspaceId: string;
  verification: import("./types").CompanyMigrationVerification;
}): string {
  const v = input.verification;
  return [
    v.migrationId,
    "",
    `Firebase project: ${input.projectId || "(unknown)"}`,
    `Workspace: ${input.workspaceId}`,
    "",
    `Status: ${v.status}`,
    "",
    `Contacts scanned: ${v.contactsScanned}`,
    `Commercial contacts linked: ${v.commercialContactsLinked}`,
    `Companies: ${v.companies}`,
    `Skipped groups: ${v.skippedGroups}`,
    `Broken links: ${v.brokenLinks}`,
    `Conflicts: ${v.conflicts}`,
    `Review required: ${v.reviewRequired}`,
    v.appliedAt ? `Applied at: ${v.appliedAt}` : "Applied at: (derived; see source Migración CRM legacy)",
    `Verified at: ${v.verifiedAt}`,
    `Version: ${v.version}`,
    "",
    "No data was modified.",
    "",
  ].join("\n");
}

export function formatCompanyMigrationApplySummary(input: {
  projectId?: string;
  workspaceId: string;
  created: number;
  linked: number;
  skipped: number;
  errors: number;
  complete: boolean;
}): string {
  return [
    "============================================================",
    "CRM COMPANIES V1 APPLY",
    "============================================================",
    `Firebase project: ${input.projectId || "(unknown)"}`,
    `Workspace: ${input.workspaceId}`,
    "Mode: APPLY",
    "",
    `Created: ${input.created}`,
    `Linked: ${input.linked}`,
    `Skipped: ${input.skipped}`,
    `Errors: ${input.errors}`,
    input.complete ? "Migration finished without recorded errors." : "MIGRATION NOT COMPLETE — errors were recorded.",
    "============================================================",
  ].join("\n");
}
