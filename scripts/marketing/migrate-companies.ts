#!/usr/bin/env node
/**
 * Migración controlada contact.company → marketing_companies (CRM_COMPANIES_V1).
 *
 *   npm run crm:migrate:companies
 *   npm run crm:migrate:companies -- --mode=preview
 *   npm run crm:migrate:companies -- --mode=status
 *   npm run crm:migrate:companies -- --mode=apply --confirm=CRM_COMPANIES_V1
 *
 * Apply sólo corre si el verificador dice READY_TO_APPLY.
 * COMPLETED aborta con CRM_COMPANIES_V1_ALREADY_COMPLETED.
 */
import path from "path";
import { config } from "dotenv";

config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  const {
    parseCompanyMigrationCliArgs,
    assertCompanyMigrationCli,
    CRM_COMPANIES_MIGRATION_ID,
    COMPANY_MIGRATION_OVERRIDES,
    formatCompanyMigrationPreviewSummary,
    formatCompanyMigrationFinalPreviewSummary,
    formatCompanyMigrationApplySummary,
    formatCompanyMigrationStatusSummary,
    writeCompanyMigrationPreviewArtifacts,
    writeCompanyMigrationFinalPreviewArtifacts,
    writeCompanyMigrationApplyResult,
    writeCompanyMigrationPostPreviewArtifacts,
    previewCompanyMigration,
    compileCompanyMigrationPlan,
    verifyCompaniesMigration,
    applyCompanyMigration,
    createFirestoreContactScanner,
    firestoreMarketingCompaniesExist,
    preflightCompanyMigrationIndexes,
    formatIndexPreflight,
  } = await import("../../src/lib/marketing/migrations");
  const { getMarketingWorkspaceId } = await import("../../src/lib/marketing/workspace");
  const { marketingContext } = await import("../../src/lib/marketing/context");
  const { createFirestoreMarketingRepositories } = await import(
    "../../src/lib/marketing/repositories/firestore"
  );
  const { createMarketingServices } = await import("../../src/lib/marketing/services");

  const args = parseCompanyMigrationCliArgs(process.argv.slice(2));
  const workspaceId = args.workspaceId || getMarketingWorkspaceId();
  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";

  const title =
    args.mode === "apply"
      ? "CRM COMPANIES V1 APPLY"
      : args.mode === "status"
        ? "CRM COMPANIES V1 STATUS"
        : "CRM COMPANIES V1 FINAL PREVIEW";

  console.log("============================================================");
  console.log(title);
  console.log("============================================================");
  console.log(`Firebase project: ${projectId || "(unknown)"}`);
  console.log(`Workspace: ${workspaceId}`);
  console.log(`Migration: ${CRM_COMPANIES_MIGRATION_ID}`);
  console.log(`Mode: ${args.mode.toUpperCase()}`);
  console.log("============================================================");

  assertCompanyMigrationCli(args);

  const repos = createFirestoreMarketingRepositories();
  const scanner = createFirestoreContactScanner();
  const companiesExist = await firestoreMarketingCompaniesExist();
  const indexes = await preflightCompanyMigrationIndexes({ workspaceId, projectId });
  console.log(formatIndexPreflight(indexes));
  console.log("============================================================");

  const verification = await verifyCompaniesMigration({
    workspaceId,
    scanner,
    companies: repos.companies,
    sources: companiesExist ? repos.sources : undefined,
    batchSize: args.batchSize,
    lookupExistingCompanies: companiesExist,
    overrides: COMPANY_MIGRATION_OVERRIDES,
  });

  if (args.mode === "status") {
    console.log(
      formatCompanyMigrationStatusSummary({
        projectId,
        workspaceId,
        verification,
      }),
    );
    return;
  }

  const automatic = verification.plan;
  console.log(`Contacts: ${automatic.stats.totalContacts}`);
  console.log(`Groups: ${automatic.stats.groupsTotal}`);
  console.log(`Creates: ${automatic.stats.create}`);
  console.log(`Links: ${automatic.stats.link}`);
  console.log(`Skips: ${automatic.stats.skip}`);
  console.log(`Reviews: ${automatic.stats.review}`);
  console.log(`Status: ${verification.status}`);
  console.log("============================================================");

  if (args.mode === "apply") {
    if (projectId !== "notificas-f9953") {
      throw new Error(`APPLY_BLOCKED: project=${projectId || "(empty)"} !== notificas-f9953`);
    }
    if (workspaceId !== "notificas-internal") {
      throw new Error(`APPLY_BLOCKED: workspace=${workspaceId} !== notificas-internal`);
    }
    if (!indexes.ready) {
      throw new Error("APPLY_BLOCKED: required indexes are not READY");
    }
    if (verification.status === "COMPLETED") {
      throw new Error("CRM_COMPANIES_V1_ALREADY_COMPLETED");
    }
    if (verification.status === "PARTIALLY_APPLIED" || verification.status === "INCONSISTENT") {
      throw new Error(`APPLY_BLOCKED: status=${verification.status}; human review required`);
    }
    if (verification.status !== "READY_TO_APPLY") {
      throw new Error(`APPLY_BLOCKED: status=${verification.status}`);
    }
  }

  if (args.mode === "preview") {
    const outDir = path.resolve(process.cwd(), args.outDir);
    const preview = await previewCompanyMigration({
      workspaceId,
      scanner,
      companies: repos.companies,
      sources: companiesExist ? repos.sources : undefined,
      batchSize: args.batchSize,
      lookupExistingCompanies: companiesExist,
    });
    const plan = await compileCompanyMigrationPlan({
      preview,
      overrides: COMPANY_MIGRATION_OVERRIDES,
      companies: repos.companies,
      workspaceId,
    });
    const automaticArtifacts = await writeCompanyMigrationPreviewArtifacts(preview, outDir);
    const finalArtifacts = await writeCompanyMigrationFinalPreviewArtifacts(plan, outDir);
    console.log("Automatic preview");
    console.log(
      formatCompanyMigrationPreviewSummary({
        projectId,
        workspaceId,
        preview,
      }),
    );
    console.log("Final plan (overrides applied)");
    console.log(formatCompanyMigrationFinalPreviewSummary({ plan }));
    console.log(`Automatic JSON: ${automaticArtifacts.jsonPath}`);
    console.log(`Final JSON: ${finalArtifacts.jsonPath}`);
    console.log(`Final CSV: ${finalArtifacts.csvPath}`);
    if (preview.stats.alreadyMigrated > 0) {
      const post = await writeCompanyMigrationPostPreviewArtifacts(plan, outDir);
      console.log(`Post preview JSON: ${post.jsonPath}`);
    }
    return;
  }

  const services = createMarketingServices(repos);
  const result = await applyCompanyMigration({
    confirm: args.confirm || "",
    workspaceId,
    scanner,
    companies: repos.companies,
    sources: repos.sources,
    services,
    ctx: marketingContext(workspaceId, { actorType: "system", actorId: CRM_COMPANIES_MIGRATION_ID }),
    batchSize: args.batchSize,
    overrides: COMPANY_MIGRATION_OVERRIDES,
    indexPreflight: async () => indexes,
    lookupExistingCompanies: companiesExist,
  });
  const outDir = path.resolve(process.cwd(), args.outDir);
  const applyPath = await writeCompanyMigrationApplyResult(
    {
      migrationId: CRM_COMPANIES_MIGRATION_ID,
      mode: "apply",
      projectId,
      workspaceId,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      created: result.created,
      linked: result.linked,
      skipped: result.skipped,
      errors: result.errors,
      complete: result.complete,
      outcome: result.complete ? "SUCCESS" : "PARTIAL",
    },
    outDir,
  );
  const postAutomatic = await previewCompanyMigration({
    workspaceId,
    scanner,
    companies: repos.companies,
    sources: repos.sources,
    batchSize: args.batchSize,
    lookupExistingCompanies: true,
  });
  const postPlan = await compileCompanyMigrationPlan({
    preview: postAutomatic,
    overrides: COMPANY_MIGRATION_OVERRIDES,
    companies: repos.companies,
    workspaceId,
  });
  const post = await writeCompanyMigrationPostPreviewArtifacts(postPlan, outDir);
  console.log(
    formatCompanyMigrationApplySummary({
      projectId,
      workspaceId,
      created: result.created,
      linked: result.linked,
      skipped: result.skipped,
      errors: result.errors.length,
      complete: result.complete,
    }),
  );
  console.log(`Apply JSON: ${applyPath}`);
  console.log(`Post preview JSON: ${post.jsonPath}`);
  if (!result.complete) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
