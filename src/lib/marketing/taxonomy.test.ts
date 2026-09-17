import { test } from "node:test";
import assert from "node:assert/strict";
import { marketingContext } from "./context";
import { MarketingValidationError } from "./errors";
import { createMemoryMarketingRepositories } from "./repositories/memory";
import type { MarketingRepositories } from "./repositories/types";
import { createMarketingServices } from "./services";
import {
  applyTaxonomySeed,
  CRM_TAXONOMY_MIGRATION_ID,
  parseTaxonomyCliArgs,
  previewTaxonomySeed,
  TAXONOMY_COUNTRIES,
  TAXONOMY_INDUSTRIES,
  TAXONOMY_TAGS,
  TAXONOMY_USE_CASES,
} from "./taxonomy";
import { CLASSIFICATION_PENDING_TAG_KEY } from "./taxonomy/constants";

function setup(workspaceId = "notificas-internal") {
  const repos = createMemoryMarketingRepositories();
  const services = createMarketingServices(repos);
  const ctx = marketingContext(workspaceId, { actorType: "system", actorId: CRM_TAXONOMY_MIGRATION_ID });
  return { repos, services, ctx, workspaceId };
}

function countWrites(repos: MarketingRepositories) {
  let writes = 0;
  const wrap = <T extends object>(repo: T, methods: (keyof T)[]) => {
    for (const method of methods) {
      const original = (repo[method] as unknown as (...args: unknown[]) => Promise<unknown>).bind(repo);
      (repo[method] as unknown) = async (...args: unknown[]) => {
        writes += 1;
        return original(...args);
      };
    }
  };
  wrap(repos.countries, ["create", "update"]);
  wrap(repos.industries, ["create", "update"]);
  wrap(repos.useCases, ["create", "update"]);
  wrap(repos.tags, ["create", "update"]);
  wrap(repos.companies, ["create", "update"]);
  wrap(repos.activities, ["create"]);
  return () => writes;
}

async function seedGasCompanies(services: ReturnType<typeof createMarketingServices>, ctx: ReturnType<typeof marketingContext>) {
  const names = [
    "Camuzzi Gas",
    "Naturgy",
    "Naturgy NOA",
    "Gasnor / Naturgy NOA",
    "Empresa Sur",
  ];
  const created = [];
  for (const name of names) {
    const countryCode = name === "Empresa Sur" ? "CL" : "AR";
    const result = await services.companies.createCompany(ctx, {
      name,
      countryCode,
      sourceIds: ["src-legacy"],
      notes: "legacy note",
    });
    created.push(result.company);
  }
  return created;
}

test("taxonomy CLI default es preview y apply exige confirm explícito", () => {
  const preview = parseTaxonomyCliArgs([]);
  assert.equal(preview.mode, "preview");
  const apply = parseTaxonomyCliArgs(["--mode=apply", "--confirm=CRM_TAXONOMY_V1"]);
  assert.equal(apply.mode, "apply");
  assert.equal(apply.confirm, CRM_TAXONOMY_MIGRATION_ID);
});

test("taxonomy preview no escribe", async () => {
  const { repos, services, ctx, workspaceId } = setup();
  await seedGasCompanies(services, ctx);
  const writes = countWrites(repos);
  const before = writes();
  const preview = await previewTaxonomySeed({ workspaceId, services, ctx });
  assert.equal(writes(), before);
  assert.equal(preview.stats.countries.create, TAXONOMY_COUNTRIES.length);
  assert.equal(preview.stats.industries.create, TAXONOMY_INDUSTRIES.length);
  assert.equal(preview.stats.useCases.create, TAXONOMY_USE_CASES.length);
  assert.equal(preview.stats.tags.create, TAXONOMY_TAGS.length);
  assert.equal(preview.stats.companiesClassify, 4);
  assert.equal(preview.stats.companiesUnresolved, 1);
  assert.equal(await services.countries.getByKey(ctx, "AR"), null);
});

test("taxonomy apply crea y el segundo apply queda unchanged", async () => {
  const { repos, services, ctx, workspaceId } = setup();
  await seedGasCompanies(services, ctx);
  const first = await applyTaxonomySeed({
    confirm: CRM_TAXONOMY_MIGRATION_ID,
    workspaceId,
    services,
    ctx,
  });
  assert.equal(first.stats.countries.create, 0);
  assert.equal(first.stats.countries.unchanged, TAXONOMY_COUNTRIES.length);
  assert.equal(first.stats.industries.unchanged, TAXONOMY_INDUSTRIES.length);
  assert.equal(first.stats.useCases.unchanged, TAXONOMY_USE_CASES.length);
  assert.equal(first.stats.tags.unchanged, TAXONOMY_TAGS.length);
  assert.ok(first.wrote.countries > 0);
  assert.equal(first.wrote.activities, 0);

  const extra = await services.industries.createIndustry(ctx, { key: "custom_keep", name: "Rubro manual" });
  const writes = countWrites(repos);
  const second = await applyTaxonomySeed({
    confirm: CRM_TAXONOMY_MIGRATION_ID,
    workspaceId,
    services,
    ctx,
  });
  assert.equal(second.stats.countries.create, 0);
  assert.equal(second.stats.industries.create, 0);
  assert.equal(second.stats.useCases.create, 0);
  assert.equal(second.stats.tags.create, 0);
  assert.equal(second.stats.industries.update, 0);
  assert.equal(second.wrote.countries, 0);
  assert.equal(second.wrote.industries, 0);
  assert.equal(second.wrote.useCases, 0);
  assert.equal(second.wrote.tags, 0);
  assert.equal(second.wrote.companies, 0);
  assert.equal(writes(), 0);
  const kept = await services.industries.getByKey(ctx, "custom_keep");
  assert.equal(kept?.id, extra.id);
});

test("taxonomy apply sin confirm bloquea", async () => {
  const { services, ctx, workspaceId } = setup();
  await assert.rejects(
    () => applyTaxonomySeed({ confirm: "NO", workspaceId, services, ctx }),
    /APPLY_BLOCKED/,
  );
});

test("industries: parent válido y se incluye al clasificar", async () => {
  const { services, ctx } = setup();
  await assert.rejects(
    () => services.industries.createIndustry(ctx, { key: "utilities_gas", name: "Gas", parentIndustryId: "utilities" }),
    MarketingValidationError,
  );
  const parent = await services.industries.createIndustry(ctx, { key: "utilities", name: "Servicios públicos" });
  const child = await services.industries.createIndustry(ctx, {
    key: "utilities_gas",
    name: "Gas",
    parentIndustryId: "utilities",
  });
  assert.equal(child.parentIndustryId, parent.id);
  await services.useCases.createUseCase(ctx, {
    key: "utility_cutoff_warning",
    name: "Aviso previo de corte",
    industryIds: ["utilities", "utilities_gas"],
  });
  const { company } = await services.companies.createCompany(ctx, {
    name: "Camuzzi Gas",
    countryCode: "AR",
    industryIds: ["utilities_gas"],
    useCaseIds: ["utility_cutoff_warning"],
  });
  assert.deepEqual(company.industryIds, ["utilities", "utilities_gas"]);
});

test("keys únicas y getByKey", async () => {
  const { services, ctx, other } = { ...setup(), other: marketingContext("otro-workspace", { actorType: "user", actorId: "otro" }) };
  const industry = await services.industries.createIndustry(ctx, { key: "utilities", name: "Servicios públicos" });
  await assert.rejects(
    () => services.industries.createIndustry(ctx, { key: "utilities", name: "Otra" }),
    MarketingValidationError,
  );
  const found = await services.industries.getByKey(ctx, "utilities");
  assert.equal(found?.id, industry.id);
  const country = await services.countries.createCountry(ctx, { code: "AR", name: "Argentina", defaultLanguage: "es" });
  assert.equal((await services.countries.getByKey(ctx, "AR"))?.id, country.id);
  const tag = await services.tags.createTag(ctx, { key: "high_priority", name: "Prioridad alta" });
  assert.equal((await services.tags.getByKey(ctx, "high_priority"))?.id, tag.id);
  await services.useCases.createUseCase(ctx, { key: "utility_cutoff_warning", name: "Aviso previo de corte", industryIds: ["utilities"] });
  assert.equal((await services.useCases.getByKey(ctx, "utility_cutoff_warning"))?.key, "utility_cutoff_warning");
  assert.equal(await services.industries.getByKey(other, "utilities"), null);
});

test("companies de gas se clasifican y Naturgy permanece separada", async () => {
  const { services, ctx, workspaceId } = setup();
  const created = await seedGasCompanies(services, ctx);
  const ids = Object.fromEntries(created.map((c) => [c.normalizedName, c.id]));
  const sources = Object.fromEntries(created.map((c) => [c.id, c.sourceIds]));
  await applyTaxonomySeed({ confirm: CRM_TAXONOMY_MIGRATION_ID, workspaceId, services, ctx });

  const camuzzi = await services.companies.getCompany(ctx, ids["camuzzi gas"]);
  const naturgy = await services.companies.getCompany(ctx, ids.naturgy);
  const noa = await services.companies.getCompany(ctx, ids["naturgy noa"]);
  const gasnor = await services.companies.getCompany(ctx, ids["gasnor naturgy noa"]);
  const sur = await services.companies.getCompany(ctx, ids["empresa sur"]);

  assert.deepEqual(camuzzi.industryIds, ["utilities", "utilities_gas"]);
  assert.deepEqual(camuzzi.useCaseIds, ["utility_cutoff_warning"]);
  assert.deepEqual(naturgy.industryIds, ["utilities", "utilities_gas"]);
  assert.deepEqual(noa.industryIds, ["utilities", "utilities_gas"]);
  assert.deepEqual(gasnor.industryIds, ["utilities", "utilities_gas"]);
  assert.notEqual(naturgy.id, noa.id);
  assert.notEqual(naturgy.id, gasnor.id);
  assert.notEqual(noa.id, gasnor.id);
  assert.equal(camuzzi.id, ids["camuzzi gas"]);
  assert.deepEqual(camuzzi.sourceIds, sources[camuzzi.id]);
  assert.equal(camuzzi.notes, "legacy note");
  assert.deepEqual(sur.industryIds, []);
  assert.deepEqual(sur.useCaseIds, []);
  assert.ok(sur.tagIds.includes(CLASSIFICATION_PENDING_TAG_KEY));
});

test("Empresa Sur unresolved no inventa classification", async () => {
  const { services, ctx, workspaceId } = setup();
  const { company } = await services.companies.createCompany(ctx, { name: "Empresa Sur", countryCode: "CL" });
  const preview = await previewTaxonomySeed({ workspaceId, services, ctx });
  const row = preview.companies.find((c) => c.companyId === company.id);
  assert.equal(row?.intent, "unresolved");
  assert.deepEqual(row?.industryIds, []);
  assert.deepEqual(row?.useCaseIds, []);
});

test("seed no toca catálogos de otro workspace", async () => {
  const { services, ctx, workspaceId } = setup();
  const otherCtx = marketingContext("otro-workspace", { actorType: "user", actorId: "otro" });
  const foreign = await services.industries.createIndustry(otherCtx, { key: "utilities", name: "Servicios públicos" });
  await applyTaxonomySeed({ confirm: CRM_TAXONOMY_MIGRATION_ID, workspaceId, services, ctx });
  const still = await services.industries.getIndustry(otherCtx, foreign.id);
  assert.equal(still.id, foreign.id);
  assert.equal(still.workspaceId, "otro-workspace");
  const local = await services.industries.getByKey(ctx, "utilities");
  assert.ok(local);
  assert.notEqual(local.id, foreign.id);
});

test("use case vacío countryCodes es global", async () => {
  const { services, ctx } = setup();
  await services.industries.createIndustry(ctx, { key: "legal", name: "Servicios jurídicos" });
  const created = await services.useCases.createUseCase(ctx, {
    key: "legal_extrajudicial_notice",
    name: "Intimación extrajudicial",
    industryIds: ["legal"],
    countryCodes: [],
  });
  assert.equal(created.appliesToAllCountries, true);
  assert.deepEqual(created.countryCodes, []);
});
