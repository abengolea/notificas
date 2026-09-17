import { test } from "node:test";
import assert from "node:assert/strict";
import { marketingContext } from "./context";
import { DEFAULT_MARKETING_WORKSPACE_ID } from "./workspace";
import { createMemoryMarketingRepositories } from "./repositories/memory";
import type { MarketingContactRecord, MarketingRepositories } from "./repositories/types";
import { createMarketingServices } from "./services";
import {
  applyCompanyMigration,
  assertCompanyMigrationCli,
  collectCountryStatus,
  collectDomainCandidates,
  corporateEmailDomain,
  CRM_COMPANIES_MIGRATION_ID,
  createStaticContactScanner,
  isGenericEmailDomain,
  isInsufficientCompanyName,
  normalizeCompanyNameForMatching,
  parseCompanyMigrationCliArgs,
  previewCompanyMigration,
  suggestCanonicalCompanyName,
} from "./migrations";
import type { MarketingMigrationContactScanner } from "./migrations/scan";

function contact(
  over: Partial<MarketingContactRecord> & Pick<MarketingContactRecord, "id" | "email">,
): MarketingContactRecord {
  return {
    emailKey: over.email,
    name: over.name || "",
    company: over.company || "",
    title: "",
    country: over.country || "AR",
    notes: "",
    stage: "new",
    stageManual: false,
    tags: [],
    source: "csv",
    listIds: [],
    lastCampaignId: null,
    lastSendId: null,
    lastSentAt: null,
    lastOpenedAt: null,
    lastClickedAt: null,
    lastRepliedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    ...over,
  };
}

function setup() {
  const repos = createMemoryMarketingRepositories();
  const svc = createMarketingServices(repos);
  const ctx = marketingContext(DEFAULT_MARKETING_WORKSPACE_ID, {
    actorType: "system",
    actorId: CRM_COMPANIES_MIGRATION_ID,
  });
  const other = marketingContext("otro-workspace", { actorType: "user", actorId: "otro" });
  return { repos, svc, ctx, other };
}

function liveScanner(repos: MarketingRepositories, ids: string[]): MarketingMigrationContactScanner {
  const sorted = [...ids].sort();
  return {
    async scanBatch(cursor, limit) {
      let start = 0;
      if (cursor) {
        const idx = sorted.findIndex((id) => id === cursor);
        start = idx >= 0 ? idx + 1 : 0;
      }
      const slice = sorted.slice(start, start + limit);
      const items: MarketingContactRecord[] = [];
      for (const id of slice) {
        const row = await repos.contacts.getById(id);
        if (row && !row.deletedAt) items.push(row);
      }
      const last = slice[slice.length - 1];
      return {
        items,
        nextCursor: start + slice.length >= sorted.length || !last ? null : last,
      };
    },
  };
}

async function seed(repos: MarketingRepositories, row: MarketingContactRecord): Promise<string> {
  await repos.contacts.create(row);
  return row.id;
}

test("agrupamiento: case, espacios, iguales y distintos", () => {
  assert.equal(normalizeCompanyNameForMatching("Sancor Seguros"), normalizeCompanyNameForMatching("SANCOR SEGUROS"));
  assert.equal(normalizeCompanyNameForMatching(" Sancor Seguros "), normalizeCompanyNameForMatching("Sancor Seguros"));
  assert.equal(normalizeCompanyNameForMatching("Sancor Seguros S.A."), normalizeCompanyNameForMatching("Sancor Seguros"));
  assert.equal(
    normalizeCompanyNameForMatching("Sancor Seguros S.A. de C.V."),
    normalizeCompanyNameForMatching("Sancor Seguros S.A."),
  );
  assert.notEqual(normalizeCompanyNameForMatching("Sancor Seguros"), normalizeCompanyNameForMatching("La Segunda"));
});

test("nombre canónico: más frecuente y empate sin ALL CAPS", () => {
  const frequent = suggestCanonicalCompanyName(["Sancor Seguros", "SANCOR SEGUROS", "Sancor Seguros"]);
  assert.equal(frequent.name, "Sancor Seguros");
  assert.equal(frequent.reason, "most_frequent_variant");
  const tie = suggestCanonicalCompanyName(["SANCOR SEGUROS", "Sancor Seguros"]);
  assert.equal(tie.name, "Sancor Seguros");
  assert.equal(tie.reason, "tie_prefer_not_all_caps");
});

test("countries: uno, múltiples, faltante", () => {
  assert.equal(collectCountryStatus(["AR", "AR"]).countryStatus, "single");
  assert.deepEqual(collectCountryStatus(["AR", "UY"]).countryCandidates, ["AR", "UY"]);
  assert.equal(collectCountryStatus(["AR", "UY"]).countryStatus, "multiple");
  assert.equal(collectCountryStatus([undefined, ""]).countryStatus, "missing");
});

test("domain candidates: corporativo, gmail excluido, múltiples", () => {
  assert.equal(corporateEmailDomain("persona@sancorseguros.com"), "sancorseguros.com");
  assert.equal(corporateEmailDomain("persona@gmail.com"), undefined);
  assert.equal(isGenericEmailDomain("hotmail.com"), true);
  assert.deepEqual(collectDomainCandidates(["a@acme.com", "b@gmail.com", "c@acme.com.ar"]), [
    "acme.com",
    "acme.com.ar",
  ]);
});

test("insufficient names no se convierten en company", () => {
  assert.equal(isInsufficientCompanyName(""), true);
  assert.equal(isInsufficientCompanyName("-"), true);
  assert.equal(isInsufficientCompanyName("N/A"), true);
  assert.equal(isInsufficientCompanyName("Particular"), true);
  assert.equal(isInsufficientCompanyName("Sin empresa"), true);
  assert.equal(isInsufficientCompanyName("Sancor Seguros"), false);
});

test("clasificación: SAFE_CREATE, INSUFFICIENT_DATA y preview no muta", async () => {
  const { repos } = setup();
  const rows = [
    contact({ id: "c1", email: "a@acme.com", company: "Acme", country: "AR" }),
    contact({ id: "c2", email: "b@acme.com", company: "ACME", country: "AR" }),
    contact({ id: "c3", email: "c@acme.com", company: " Acme ", country: "AR" }),
    contact({ id: "c4", email: "d@gmail.com", company: "N/A", country: "AR" }),
    contact({ id: "c5", email: "e@gmail.com", company: "", country: "AR" }),
  ];
  for (const row of rows) await seed(repos, row);
  const preview = await previewCompanyMigration({
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    scanner: createStaticContactScanner(rows),
    companies: repos.companies,
    sources: repos.sources,
  });
  assert.equal(preview.mode, "preview");
  assert.equal(preview.migrationId, CRM_COMPANIES_MIGRATION_ID);
  assert.equal(preview.stats.totalContacts, 5);
  assert.equal(preview.stats.contactsWithCompanyString, 4);
  assert.equal(preview.stats.safeCreate, 1);
  assert.equal(preview.stats.insufficientData, 2);
  const acme = preview.groups.find((g) => g.classification === "SAFE_CREATE");
  assert.ok(acme);
  assert.equal(acme?.contactCount, 3);
  assert.deepEqual(acme?.originalValues.sort(), ["ACME", "Acme"]);
  const companies = await repos.companies.search(DEFAULT_MARKETING_WORKSPACE_ID, {});
  assert.equal(companies.items.length, 0);
  assert.equal((await repos.contacts.getById("c1"))?.companyId, undefined);
});

test("clasificación: SAFE_LINK por dominio exacto", async () => {
  const { repos, svc, ctx } = setup();
  const { company } = await svc.companies.createCompany(ctx, {
    name: "Sancor Seguros",
    website: "https://www.sancorseguros.com",
    countryCode: "AR",
  });
  const row = contact({
    id: "s1",
    email: "persona@sancorseguros.com",
    company: "Sancor Seguros",
    country: "AR",
  });
  await seed(repos, row);
  const preview = await previewCompanyMigration({
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    scanner: createStaticContactScanner([row]),
    companies: repos.companies,
  });
  assert.equal(preview.stats.safeLink, 1);
  assert.equal(preview.groups[0]?.existingCompanyCandidates[0]?.companyId, company.id);
});

test("clasificación: PROBABLE_MATCH por nombre+país sin dominio", async () => {
  const { repos, svc, ctx } = setup();
  await svc.companies.createCompany(ctx, { name: "Acme", countryCode: "AR" });
  const row = contact({ id: "p1", email: "ana@gmail.com", company: "Acme", country: "AR" });
  await seed(repos, row);
  const preview = await previewCompanyMigration({
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    scanner: createStaticContactScanner([row]),
    companies: repos.companies,
  });
  assert.equal(preview.stats.probableMatch, 1);
  assert.equal(preview.stats.safeLink, 0);
});

test("clasificación: AMBIGUOUS por dos companies y por países mixtos", async () => {
  const { repos, svc, ctx } = setup();
  await svc.companies.createCompany(ctx, {
    name: "Dup",
    website: "https://dup.com",
    countryCode: "AR",
  });
  await svc.companies.createCompany(ctx, {
    name: "Dup",
    website: "https://dup.com.ar",
    countryCode: "AR",
  });
  const mixed = [
    contact({ id: "m1", email: "a@dup.com", company: "Dup", country: "AR" }),
    contact({ id: "m2", email: "b@dup.com.ar", company: "Dup", country: "AR" }),
  ];
  const preview = await previewCompanyMigration({
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    scanner: createStaticContactScanner(mixed),
    companies: repos.companies,
  });
  assert.equal(preview.stats.ambiguous, 1);

  const countries = [
    contact({ id: "x1", email: "a@empresa.com", company: "Empresa X", country: "AR" }),
    contact({ id: "x2", email: "b@empresa.com", company: "Empresa X", country: "UY" }),
  ];
  const preview2 = await previewCompanyMigration({
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    scanner: createStaticContactScanner(countries),
    companies: repos.companies,
  });
  const group = preview2.groups.find((g) => g.matchingName === "empresa x");
  assert.equal(group?.classification, "AMBIGUOUS");
  assert.equal(group?.countryStatus, "multiple");
});

test("clasificación: ALREADY_MIGRATED y companyId roto/incompatible", async () => {
  const { repos, svc, ctx } = setup();
  const { company } = await svc.companies.createCompany(ctx, { name: "Acme", countryCode: "AR" });
  const { company: otherCo } = await svc.companies.createCompany(ctx, { name: "Beta", countryCode: "AR" });
  const ok = contact({
    id: "ok1",
    email: "ok@acme.com",
    company: "Acme",
    companyId: company.id,
    country: "AR",
  });
  const broken = contact({
    id: "br1",
    email: "br@acme.com",
    company: "Acme",
    companyId: "missing-company",
    country: "AR",
  });
  const conflict = contact({
    id: "cf1",
    email: "cf@acme.com",
    company: "Acme",
    companyId: otherCo.id,
    country: "AR",
  });
  const preview = await previewCompanyMigration({
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    scanner: createStaticContactScanner([ok, broken, conflict]),
    companies: repos.companies,
  });
  assert.equal(preview.stats.alreadyMigrated, 1);
  const ambiguous = preview.groups.filter((g) => g.classification === "AMBIGUOUS");
  assert.ok(ambiguous.some((g) => g.reasons.includes("broken_company_id")));
  assert.ok(ambiguous.some((g) => g.reasons.includes("legacy_company_conflicts_with_linked_company")));
});

test("seguridad: company de otro workspace no entra como match", async () => {
  const { repos, svc, other } = setup();
  await svc.companies.createCompany(other, {
    name: "Acme",
    website: "https://acme.com",
    countryCode: "AR",
  });
  const row = contact({ id: "w1", email: "a@acme.com", company: "Acme", country: "AR" });
  const preview = await previewCompanyMigration({
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    scanner: createStaticContactScanner([row]),
    companies: repos.companies,
  });
  assert.equal(preview.stats.safeCreate, 1);
  assert.equal(preview.groups[0]?.existingCompanyCandidates.length, 0);

  const foreign = contact({
    id: "w2",
    email: "b@acme.com",
    company: "Acme",
    country: "AR",
    workspaceId: "otro-workspace",
  });
  const preview2 = await previewCompanyMigration({
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    scanner: createStaticContactScanner([row, foreign]),
    companies: repos.companies,
  });
  assert.equal(preview2.stats.totalContacts, 1);
  assert.equal(preview2.stats.skippedOtherWorkspace, 1);
});

test("apply: 3 Acme → 1 company, 3 companyId, strings intactos; segunda vez idempotente", async () => {
  const { repos, svc, ctx } = setup();
  const rows = [
    contact({ id: "a1", email: "one@acme.com", company: "Acme", country: "AR" }),
    contact({ id: "a2", email: "two@acme.com", company: "ACME", country: "AR" }),
    contact({ id: "a3", email: "three@acme.com", company: "Acme", country: "AR" }),
  ];
  for (const row of rows) await seed(repos, row);
  const ids = rows.map((r) => r.id);
  const first = await applyCompanyMigration({
    confirm: CRM_COMPANIES_MIGRATION_ID,
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    scanner: liveScanner(repos, ids),
    companies: repos.companies,
    sources: repos.sources,
    services: svc,
    ctx,
  });
  assert.equal(first.created, 1);
  assert.equal(first.linked, 3);
  assert.equal(first.complete, true);
  const listed = await repos.companies.search(DEFAULT_MARKETING_WORKSPACE_ID, {});
  assert.equal(listed.items.length, 1);
  const companyId = listed.items[0].id;
  for (const id of ids) {
    const row = await repos.contacts.getById(id);
    assert.equal(row?.companyId, companyId);
  }
  assert.equal((await repos.contacts.getById("a1"))?.company, "Acme");
  assert.equal((await repos.contacts.getById("a2"))?.company, "ACME");
  assert.equal((await repos.contacts.getById("a3"))?.company, "Acme");

  const secondRejected = applyCompanyMigration({
    confirm: CRM_COMPANIES_MIGRATION_ID,
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    scanner: liveScanner(repos, ids),
    companies: repos.companies,
    sources: repos.sources,
    services: svc,
    ctx,
  });
  await assert.rejects(secondRejected, /CRM_COMPANIES_V1_ALREADY_COMPLETED/);
  const after = await repos.companies.search(DEFAULT_MARKETING_WORKSPACE_ID, {});
  assert.equal(after.items.length, 1);
  const preview = await previewCompanyMigration({
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    scanner: liveScanner(repos, ids),
    companies: repos.companies,
    sources: repos.sources,
  });
  assert.equal(preview.stats.alreadyMigrated, 1);
  assert.equal(preview.stats.safeCreate, 0);
});

test("apply no corre PROBABLE_MATCH ni sin confirm", async () => {
  const { repos, svc, ctx } = setup();
  await svc.companies.createCompany(ctx, { name: "Acme", countryCode: "AR" });
  const row = contact({ id: "q1", email: "ana@gmail.com", company: "Acme", country: "AR" });
  await seed(repos, row);
  await assert.rejects(
    () =>
      applyCompanyMigration({
        confirm: "NOPE",
        workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
        scanner: liveScanner(repos, [row.id]),
        companies: repos.companies,
        sources: repos.sources,
        services: svc,
        ctx,
      }),
    /APPLY_BLOCKED/,
  );
  await assert.rejects(
    () =>
      applyCompanyMigration({
        confirm: CRM_COMPANIES_MIGRATION_ID,
        workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
        scanner: liveScanner(repos, [row.id]),
        companies: repos.companies,
        sources: repos.sources,
        services: svc,
        ctx,
      }),
    /APPLY_BLOCKED: status=NOT_STARTED/,
  );
  assert.equal((await repos.contacts.getById("q1"))?.companyId, undefined);
});

test("CLI: preview por defecto y apply requiere confirm explícito", () => {
  const preview = parseCompanyMigrationCliArgs([]);
  assert.equal(preview.mode, "preview");
  assertCompanyMigrationCli(preview);
  const blocked = parseCompanyMigrationCliArgs(["--mode=apply"]);
  assert.equal(blocked.mode, "apply");
  assert.throws(() => assertCompanyMigrationCli(blocked), /APPLY_BLOCKED/);
  const apply = parseCompanyMigrationCliArgs(["--mode=apply", `--confirm=${CRM_COMPANIES_MIGRATION_ID}`]);
  assert.doesNotThrow(() => assertCompanyMigrationCli(apply));
  const status = parseCompanyMigrationCliArgs(["--mode=status"]);
  assert.equal(status.mode, "status");
  assert.doesNotThrow(() => assertCompanyMigrationCli(status));
  const stillPreview = parseCompanyMigrationCliArgs(["--apply"]);
  assert.equal(stillPreview.mode, "preview");
});
