import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { TaxonomyApplyResult, TaxonomyPreview } from "./types";

export function formatTaxonomyPreviewSummary(input: {
  projectId: string;
  workspaceId: string;
  preview: TaxonomyPreview;
}): string {
  const { preview } = input;
  const lines = [
    `Migration: ${preview.migrationId}`,
    `Project: ${input.projectId || "(unknown)"}`,
    `Workspace: ${input.workspaceId}`,
    "",
    `Countries   CREATE=${preview.stats.countries.create} UPDATE=${preview.stats.countries.update} UNCHANGED=${preview.stats.countries.unchanged}`,
    `Industries  CREATE=${preview.stats.industries.create} UPDATE=${preview.stats.industries.update} UNCHANGED=${preview.stats.industries.unchanged}`,
    `Use cases   CREATE=${preview.stats.useCases.create} UPDATE=${preview.stats.useCases.update} UNCHANGED=${preview.stats.useCases.unchanged}`,
    `Tags        CREATE=${preview.stats.tags.create} UPDATE=${preview.stats.tags.update} UNCHANGED=${preview.stats.tags.unchanged}`,
    "",
    `Companies classify=${preview.stats.companiesClassify} unchanged=${preview.stats.companiesUnchanged} unresolved=${preview.stats.companiesUnresolved}`,
    `Catalog extras (not deleted): countries=${preview.extras.countries} industries=${preview.extras.industries} useCases=${preview.extras.useCases} tags=${preview.extras.tags}`,
    `Key conflicts: ${preview.stats.keyConflicts.length ? preview.stats.keyConflicts.join(", ") : "none"}`,
    "",
    "Companies",
  ];
  for (const row of preview.companies) {
    lines.push(
      `  [${row.action}] ${row.name} (${row.companyId}) industries=[${row.industryIds.join(", ")}] useCases=[${row.useCaseIds.join(", ")}] — ${row.reason}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

export function formatTaxonomyApplySummary(result: TaxonomyApplyResult): string {
  return [
    formatTaxonomyPreviewSummary({
      projectId: "",
      workspaceId: result.workspaceId,
      preview: result,
    }).trim(),
    "",
    `Applied at: ${result.appliedAt}`,
    `Wrote countries=${result.wrote.countries} industries=${result.wrote.industries} useCases=${result.wrote.useCases} tags=${result.wrote.tags} companies=${result.wrote.companies} activities=${result.wrote.activities}`,
    "",
  ].join("\n");
}

export async function writeTaxonomyPreviewArtifacts(preview: TaxonomyPreview, outDir: string) {
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "crm-taxonomy-preview.json");
  await writeFile(jsonPath, `${JSON.stringify(preview, null, 2)}\n`, "utf8");
  return { jsonPath };
}

export async function writeTaxonomyApplyResult(result: TaxonomyApplyResult, outDir: string) {
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "crm-taxonomy-apply.json");
  await writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return { jsonPath };
}
