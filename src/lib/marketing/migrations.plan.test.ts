import { test } from "node:test";
import assert from "node:assert/strict";
import { marketingContext } from "./context";
import { DEFAULT_MARKETING_WORKSPACE_ID } from "./workspace";
import { createMemoryMarketingRepositories } from "./repositories/memory";
import type { MarketingContactRecord, MarketingRepositories } from "./repositories/types";
import { createMarketingServices } from "./services";
import {
  applyCompanyMigration,
  assertCompanyMigrationPlanReady,
  compileCompanyMigrationPlan,
  CRM_COMPANIES_MIGRATION_ID,
  createStaticContactScanner,
  previewCompanyMigration,
} from "./migrations";
import type { MarketingMigrationContactScanner } from "./migrations/scan";
import type { CompanyMigrationOverride } from "./migrations/types";

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

async function previewFor(repos: MarketingRepositories, rows: MarketingContactRecord[]) {
  return previewCompanyMigration({
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    scanner: createStaticContactScanner(rows),
    companies: repos.companies,
  });
}

test("override CREATE sobre grupo ya migrado no vuelve a crear", async () => {
  const { repos, svc, ctx } = setup();
  const rows = [
    contact({ id: "n1", email: "a@naturgy.com.ar", company: "Naturgy", country: "AR" }),
    contact({ id: "n2", email: "b@naturgy.com.ar", company: "Naturgy", country: "AR" }),
  ];
  for (const row of rows) await repos.contacts.create(row);
  const overrides: CompanyMigrationOverride[] = [
    {
      match: { normalizedName: "naturgy" },
      action: "CREATE",
      canonicalName: "Naturgy",
      countryCode: "AR",
      reason: "separate account",
    },
  ];
  const first = await applyCompanyMigration({
    confirm: CRM_COMPANIES_MIGRATION_ID,
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    scanner: liveScanner(repos, rows.map((r) => r.id)),
    companies: repos.companies,
    sources: repos.sources,
    services: svc,
    ctx,
    overrides,
  });
  assert.equal(first.created, 1);
  const after = await previewFor(repos, [
    (await repos.contacts.getById("n1"))!,
    (await repos.contacts.getById("n2"))!,
  ]);
  const plan = await compileCompanyMigrationPlan({
    preview: after,
    companies: repos.companies,
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    overrides,
  });
  assert.equal(plan.stats.create, 0);
  assert.equal(plan.groups[0]?.automaticClassification, "ALREADY_MIGRATED");
  assert.equal(plan.groups[0]?.effectiveAction, "SKIP");
  const companies = await repos.companies.search(DEFAULT_MARKETING_WORKSPACE_ID, {});
  assert.equal(companies.items.length, 1);
});

test("override CREATE cambia el canónico sin alterar el agrupamiento", async () => {
  const { repos } = setup();
  const rows = [
    contact({ id: "n1", email: "a@naturgy.com.ar", company: "Naturgy", country: "AR" }),
    contact({ id: "n2", email: "b@naturgy.com.ar", company: "NATURGY", country: "AR" }),
  ];
  const preview = await previewFor(repos, rows);
  const plan = await compileCompanyMigrationPlan({
    preview,
    companies: repos.companies,
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    overrides: [
      {
        match: { normalizedName: "naturgy" },
        action: "CREATE",
        canonicalName: "Naturgy Argentina",
        countryCode: "AR",
        reason: "Commercially maintained as separate account",
      },
    ],
  });
  const group = plan.groups.find((g) => g.matchingName === "naturgy");
  assert.equal(group?.automaticClassification, "SAFE_CREATE");
  assert.equal(group?.effectiveAction, "CREATE");
  assert.equal(group?.decisionSource, "human_override");
  assert.equal(group?.proposedCompany?.name, "Naturgy Argentina");
  assert.equal(group?.contactCount, 2);
  assert.equal(plan.stats.create, 1);
});

test("override SKIP no crea company y no es error", async () => {
  const { repos, svc, ctx } = setup();
  const row = contact({
    id: "t1",
    email: "demo@notificas.com",
    company: "Notificas (prueba)",
    country: "CU",
  });
  await repos.contacts.create(row);
  const preview = await previewFor(repos, [row]);
  const overrides: CompanyMigrationOverride[] = [
    { match: { normalizedName: "notificas prueba" }, action: "SKIP", reason: "test_record" },
  ];
  const plan = await compileCompanyMigrationPlan({
    preview,
    companies: repos.companies,
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    overrides,
  });
  assert.equal(plan.stats.skip, 1);
  assert.equal(plan.stats.create, 0);
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
        overrides,
      }),
    /APPLY_BLOCKED: status=NOT_STARTED/,
  );
  const companies = await repos.companies.search(DEFAULT_MARKETING_WORKSPACE_ID, {});
  assert.equal(companies.items.length, 0);
});

test("override LINK exige company válida del workspace", async () => {
  const { repos, svc, ctx, other } = setup();
  const { company } = await svc.companies.createCompany(ctx, { name: "Acme", countryCode: "AR" });
  const { company: foreign } = await svc.companies.createCompany(other, { name: "Acme", countryCode: "AR" });
  const row = contact({ id: "l1", email: "a@acme.com", company: "Acme", country: "AR" });
  const preview = await previewFor(repos, [row]);
  const ok = await compileCompanyMigrationPlan({
    preview,
    companies: repos.companies,
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    overrides: [{ match: { normalizedName: "acme" }, action: "LINK", companyId: company.id, reason: "link to existing" }],
  });
  assert.equal(ok.groups[0]?.effectiveAction, "LINK");
  assert.equal(ok.groups[0]?.linkPlan?.companyId, company.id);
  assert.equal(ok.overrideIssues.length, 0);

  const bad = await compileCompanyMigrationPlan({
    preview,
    companies: repos.companies,
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    overrides: [{ match: { normalizedName: "acme" }, action: "LINK", companyId: foreign.id, reason: "foreign" }],
  });
  assert.ok(bad.overrideIssues.some((i) => i.kind === "workspace_mismatch"));
  assert.equal(bad.groups[0]?.effectiveAction, "REVIEW");
});

test("override REVIEW bloquea apply", async () => {
  const { repos, svc, ctx } = setup();
  const row = contact({ id: "r1", email: "a@acme.com", company: "Acme", country: "AR" });
  await repos.contacts.create(row);
  const overrides: CompanyMigrationOverride[] = [
    { match: { normalizedName: "acme" }, action: "REVIEW", reason: "postpone" },
  ];
  const preview = await previewFor(repos, [row]);
  const plan = await compileCompanyMigrationPlan({
    preview,
    companies: repos.companies,
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    overrides,
  });
  assert.equal(plan.stats.review, 1);
  assert.throws(() => assertCompanyMigrationPlanReady(plan), /reviewCount=1/);
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
        overrides,
      }),
    /APPLY_BLOCKED: status=NOT_STARTED/,
  );
});

test("dominio compartido: warning, no merge", async () => {
  const { repos } = setup();
  const rows = [
    contact({ id: "a", email: "a@naturgy.com.ar", company: "Naturgy", country: "AR" }),
    contact({ id: "b", email: "b@naturgy.com.ar", company: "Naturgy NOA", country: "AR" }),
  ];
  const preview = await previewFor(repos, rows);
  const plan = await compileCompanyMigrationPlan({
    preview,
    companies: repos.companies,
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    overrides: [],
  });
  assert.equal(plan.stats.create, 2);
  assert.equal(plan.stats.sharedDomainWarnings, 1);
  assert.equal(plan.sharedDomainWarnings[0]?.domain, "naturgy.com.ar");
  const naturgy = plan.groups.find((g) => g.matchingName === "naturgy");
  const noa = plan.groups.find((g) => g.matchingName === "naturgy noa");
  assert.equal(naturgy?.effectiveAction, "CREATE");
  assert.equal(noa?.effectiveAction, "CREATE");
  assert.ok(naturgy?.sharedDomainWithOtherGroups.some((p) => p.normalizedName === "naturgy noa"));
  assert.equal(naturgy?.companyDomain, undefined);
});

test("override inválido: normalizedName inexistente y duplicado", async () => {
  const { repos } = setup();
  const row = contact({ id: "x1", email: "a@acme.com", company: "Acme", country: "AR" });
  const preview = await previewFor(repos, [row]);
  const missing = await compileCompanyMigrationPlan({
    preview,
    companies: repos.companies,
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    overrides: [{ match: { normalizedName: "naturgy" }, action: "CREATE", reason: "stale" }],
  });
  assert.ok(missing.overrideIssues.some((i) => i.kind === "missing_group"));
  const duplicate = await compileCompanyMigrationPlan({
    preview,
    companies: repos.companies,
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    overrides: [
      { match: { normalizedName: "acme" }, action: "CREATE", reason: "one" },
      { match: { normalizedName: "ACME" }, action: "SKIP", reason: "two" },
    ],
  });
  assert.ok(duplicate.overrideIssues.some((i) => i.kind === "duplicate"));
});
