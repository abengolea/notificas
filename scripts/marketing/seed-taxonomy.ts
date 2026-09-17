#!/usr/bin/env node
/**
 * Seed controlado de catálogos CRM (CRM_TAXONOMY_V1).
 *
 * Default: preview. No modifica Firestore.
 *
 *   npm run crm:seed:taxonomy
 *   npm run crm:seed:taxonomy -- --mode=preview
 *   npm run crm:seed:taxonomy -- --mode=apply --confirm=CRM_TAXONOMY_V1
 */
import path from "path";
import { config } from "dotenv";

config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  const {
    parseTaxonomyCliArgs,
    assertTaxonomyCli,
    CRM_TAXONOMY_MIGRATION_ID,
    previewTaxonomySeed,
    applyTaxonomySeed,
    formatTaxonomyPreviewSummary,
    formatTaxonomyApplySummary,
    writeTaxonomyPreviewArtifacts,
    writeTaxonomyApplyResult,
  } = await import("../../src/lib/marketing/taxonomy");
  const { getMarketingWorkspaceId } = await import("../../src/lib/marketing/workspace");
  const { marketingContext } = await import("../../src/lib/marketing/context");
  const { createFirestoreMarketingRepositories } = await import(
    "../../src/lib/marketing/repositories/firestore"
  );
  const { createMarketingServices } = await import("../../src/lib/marketing/services");

  const args = parseTaxonomyCliArgs(process.argv.slice(2));
  const workspaceId = args.workspaceId || getMarketingWorkspaceId();
  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";

  console.log("============================================================");
  console.log(args.mode === "apply" ? "CRM TAXONOMY V1 APPLY" : "CRM TAXONOMY V1 PREVIEW");
  console.log("============================================================");
  console.log(`Firebase project: ${projectId || "(unknown)"}`);
  console.log(`Workspace: ${workspaceId}`);
  console.log(`Migration: ${CRM_TAXONOMY_MIGRATION_ID}`);
  console.log(`Mode: ${args.mode.toUpperCase()}`);
  console.log("============================================================");

  assertTaxonomyCli(args);

  const repos = createFirestoreMarketingRepositories();
  const services = createMarketingServices(repos);
  const ctx = marketingContext(workspaceId, { actorType: "system", actorId: CRM_TAXONOMY_MIGRATION_ID });
  const preview = await previewTaxonomySeed({ workspaceId, services, ctx });

  if (args.mode === "apply") {
    if (projectId !== "notificas-f9953") {
      throw new Error(`APPLY_BLOCKED: project=${projectId || "(empty)"} !== notificas-f9953`);
    }
    if (workspaceId !== "notificas-internal") {
      throw new Error(`APPLY_BLOCKED: workspace=${workspaceId} !== notificas-internal`);
    }
    if (preview.stats.keyConflicts.length) {
      throw new Error(`APPLY_BLOCKED: key conflicts ${preview.stats.keyConflicts.join(", ")}`);
    }
  }

  if (args.mode === "preview") {
    const outDir = path.resolve(process.cwd(), args.outDir);
    const artifacts = await writeTaxonomyPreviewArtifacts(preview, outDir);
    console.log(
      formatTaxonomyPreviewSummary({
        projectId,
        workspaceId,
        preview,
      }),
    );
    console.log(`JSON: ${artifacts.jsonPath}`);
    return;
  }

  const result = await applyTaxonomySeed({
    confirm: args.confirm || "",
    workspaceId,
    services,
    ctx,
    preview,
  });
  const outDir = path.resolve(process.cwd(), args.outDir);
  const applyPath = await writeTaxonomyApplyResult(result, outDir);
  console.log(formatTaxonomyApplySummary(result));
  console.log(`JSON: ${applyPath.jsonPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
