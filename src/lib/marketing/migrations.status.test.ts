import { test } from "node:test";
import assert from "node:assert/strict";
import { marketingContext } from "./context";
import { DEFAULT_MARKETING_WORKSPACE_ID } from "./workspace";
import { createMemoryMarketingRepositories } from "./repositories/memory";
import type { MarketingContactRecord, MarketingRepositories } from "./repositories/types";
import { createMarketingServices } from "./services";
import {
  applyCompanyMigration,
  CRM_COMPANIES_MIGRATION_ID,
  createStaticContactScanner,
  verifyCompaniesMigration,
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

const skipOverride: CompanyMigrationOverride = {
  match: { normalizedName: "notificas prueba" },
  action: "SKIP",
  reason: "test_record",
};

async function verifyFor(
  repos: MarketingRepositories,
  rows: MarketingContactRecord[],
  overrides: CompanyMigrationOverride[] = [skipOverride],
) {
  return verifyCompaniesMigration({
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    scanner: createStaticContactScanner(rows),
    companies: repos.companies,
    sources: repos.sources,
    overrides,
  });
}

test("status NOT_STARTED cuando hay REVIEW y nada aplicado", async () => {
  const { repos } = setup();
  const row = contact({ id: "r1", email: "a@acme.com", company: "Acme", country: "AR" });
  await repos.contacts.create(row);
  const verification = await verifyFor(repos, [row], [
    { match: { normalizedName: "acme" }, action: "REVIEW", reason: "postpone" },
  ]);
  assert.equal(verification.status, "NOT_STARTED");
  assert.equal(verification.reviewRequired, 1);
  assert.equal(verification.commercialContactsLinked, 0);
});

test("status READY_TO_APPLY cuando hay trabajo seguro y nada aplicado", async () => {
  const { repos } = setup();
  const rows = [
    contact({ id: "a1", email: "one@acme.com", company: "Acme", country: "AR" }),
    contact({ id: "a2", email: "two@acme.com", company: "Acme", country: "AR" }),
  ];
  for (const row of rows) await repos.contacts.create(row);
  const verification = await verifyFor(repos, rows, []);
  assert.equal(verification.status, "READY_TO_APPLY");
  assert.equal(verification.reviewRequired, 0);
  assert.ok(verification.plan.stats.create > 0);
});

test("status PARTIALLY_APPLIED si queda un grupo comercial sin vincular", async () => {
  const { repos, svc, ctx } = setup();
  const acme = contact({ id: "a1", email: "one@acme.com", company: "Acme", country: "AR" });
  await repos.contacts.create(acme);
  await applyCompanyMigration({
    confirm: CRM_COMPANIES_MIGRATION_ID,
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    scanner: liveScanner(repos, [acme.id]),
    companies: repos.companies,
    sources: repos.sources,
    services: svc,
    ctx,
    overrides: [],
  });
  const beta = contact({ id: "b1", email: "one@beta.com", company: "Beta", country: "AR" });
  await repos.contacts.create(beta);
  const linkedAcme = (await repos.contacts.getById(acme.id))!;
  const verification = await verifyFor(repos, [linkedAcme, beta], []);
  assert.equal(verification.status, "PARTIALLY_APPLIED");
  assert.ok(verification.commercialContactsLinked >= 1);
  await assert.rejects(
    () =>
      applyCompanyMigration({
        confirm: CRM_COMPANIES_MIGRATION_ID,
        workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
        scanner: liveScanner(repos, [acme.id, beta.id]),
        companies: repos.companies,
        sources: repos.sources,
        services: svc,
        ctx,
        overrides: [],
      }),
    /APPLY_BLOCKED: status=PARTIALLY_APPLIED/,
  );
});

test("status COMPLETED y el registro SKIP no lo impide", async () => {
  const { repos, svc, ctx } = setup();
  const acme = contact({ id: "a1", email: "one@acme.com", company: "Acme", country: "AR" });
  const prueba = contact({
    id: "t1",
    email: "demo@notificas.com",
    company: "Notificas (prueba)",
    country: "CU",
  });
  await repos.contacts.create(acme);
  await repos.contacts.create(prueba);
  await applyCompanyMigration({
    confirm: CRM_COMPANIES_MIGRATION_ID,
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    scanner: liveScanner(repos, [acme.id, prueba.id]),
    companies: repos.companies,
    sources: repos.sources,
    services: svc,
    ctx,
    overrides: [skipOverride],
  });
  const linkedAcme = (await repos.contacts.getById(acme.id))!;
  const stillPrueba = (await repos.contacts.getById(prueba.id))!;
  const verification = await verifyFor(repos, [linkedAcme, stillPrueba]);
  assert.equal(verification.status, "COMPLETED");
  assert.equal(verification.skippedGroups, 1);
  assert.equal(verification.commercialContactsLinked, 1);
  assert.equal(verification.brokenLinks, 0);
  assert.equal((await repos.contacts.getById("t1"))?.companyId, undefined);
});

test("broken companyId => INCONSISTENT", async () => {
  const { repos } = setup();
  const row = contact({
    id: "br1",
    email: "br@acme.com",
    company: "Acme",
    companyId: "missing-company",
    country: "AR",
  });
  await repos.contacts.create(row);
  const verification = await verifyFor(repos, [row], []);
  assert.equal(verification.status, "INCONSISTENT");
  assert.ok(verification.brokenLinks >= 1);
});

test("wrong workspace => INCONSISTENT", async () => {
  const { repos, svc, other } = setup();
  const { company } = await svc.companies.createCompany(other, { name: "Acme", countryCode: "AR" });
  const row = contact({
    id: "w1",
    email: "a@acme.com",
    company: "Acme",
    companyId: company.id,
    country: "AR",
  });
  await repos.contacts.create(row);
  const verification = await verifyFor(repos, [row], []);
  assert.equal(verification.status, "INCONSISTENT");
  assert.ok(verification.issues.some((i) => i.kind === "broken_company_id" || i.kind === "workspace_mismatch"));
});

test("apply sobre COMPLETED aborta sin escribir", async () => {
  const { repos, svc, ctx } = setup();
  const row = contact({ id: "a1", email: "one@acme.com", company: "Acme", country: "AR" });
  await repos.contacts.create(row);
  await applyCompanyMigration({
    confirm: CRM_COMPANIES_MIGRATION_ID,
    workspaceId: DEFAULT_MARKETING_WORKSPACE_ID,
    scanner: liveScanner(repos, [row.id]),
    companies: repos.companies,
    sources: repos.sources,
    services: svc,
    ctx,
    overrides: [],
  });
  let writes = 0;
  const originalCreate = repos.companies.create.bind(repos.companies);
  const originalUpdate = repos.companies.update.bind(repos.companies);
  const originalContactUpdate = repos.contacts.update.bind(repos.contacts);
  repos.companies.create = async (doc) => {
    writes += 1;
    return originalCreate(doc);
  };
  repos.companies.update = async (workspaceId, id, patch) => {
    writes += 1;
    return originalUpdate(workspaceId, id, patch);
  };
  repos.contacts.update = async (id, patch) => {
    writes += 1;
    return originalContactUpdate(id, patch);
  };
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
        overrides: [],
      }),
    /CRM_COMPANIES_V1_ALREADY_COMPLETED/,
  );
  assert.equal(writes, 0);
});
