import { test } from "node:test";
import assert from "node:assert/strict";
import { marketingContext } from "./context";
import { contactIdForEmail } from "./csv";
import {
  MarketingNotFoundError,
  MarketingValidationError,
} from "./errors";
import { createMemoryMarketingRepositories } from "./repositories/memory";
import { createMarketingServices } from "./services";

function setup() {
  const repos = createMemoryMarketingRepositories();
  const svc = createMarketingServices(repos);
  const ctx = marketingContext("notificas-internal", { actorType: "user", actorId: "adrian" });
  const other = marketingContext("otro-workspace", { actorType: "user", actorId: "otro" });
  return { repos, svc, ctx, other };
}

test("company: crea con normalización y detecta duplicados", async () => {
  const { svc, ctx } = setup();
  const first = await svc.companies.createCompany(ctx, {
    name: "Sancor Seguros S.A.",
    website: "https://www.sancorseguros.com",
    countryCode: "AR",
  });
  assert.equal(first.company.normalizedName, "sancor seguros");
  assert.equal(first.company.normalizedDomain, "sancorseguros.com");
  assert.equal(first.duplicateWarnings.length, 0);

  const exact = await svc.companies.createCompany(ctx, {
    name: "Otra",
    website: "sancorseguros.com/",
    countryCode: "CL",
  });
  assert.ok(exact.duplicateWarnings.some((w) => w.matchType === "exact"));

  const probable = await svc.companies.createCompany(ctx, {
    name: "SANCOR SEGUROS",
    countryCode: "AR",
  });
  assert.ok(probable.duplicateWarnings.some((w) => w.matchType === "probable"));
});

test("company: workspace mismatch y soft delete", async () => {
  const { svc, ctx, other } = setup();
  const { company } = await svc.companies.createCompany(ctx, { name: "Acme", countryCode: "UY" });
  await assert.rejects(() => svc.companies.getCompany(other, company.id), MarketingNotFoundError);
  await svc.companies.deleteCompany(ctx, company.id);
  await assert.rejects(() => svc.companies.getCompany(ctx, company.id), MarketingNotFoundError);
});

test("contact: v1 hidratado, companyId válida y stage separado", async () => {
  const { repos, svc, ctx, other } = setup();
  const v1Id = contactIdForEmail("legacy@empresa.cl");
  await repos.contacts.create({
    id: v1Id,
    email: "legacy@empresa.cl",
    emailKey: "legacy@empresa.cl",
    name: "Ana",
    company: "Sur Ltd",
    title: "",
    country: "CL",
    notes: "",
    stage: "replied",
    stageManual: false,
    tags: [],
    source: "csv",
    listIds: ["lista-1"],
    lastCampaignId: null,
    lastSendId: null,
    lastSentAt: null,
    lastOpenedAt: null,
    lastClickedAt: null,
    lastRepliedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    workspaceId: "",
  });
  const legacy = await svc.contacts.getContact(ctx, v1Id);
  assert.equal(legacy.workspaceId, "notificas-internal");
  assert.equal(legacy.stage, "replied");
  assert.equal(legacy.commercialStageId, undefined);

  const { company } = await svc.companies.createCompany(ctx, { name: "Sancor", countryCode: "AR" });
  await assert.rejects(
    () => svc.contacts.createContact(ctx, { email: "x@y.com", country: "AR", companyId: "no-existe" }),
    MarketingValidationError,
  );
  const { company: foreign } = await svc.companies.createCompany(other, { name: "Otra SA", countryCode: "MX" });
  await assert.rejects(
    () => svc.contacts.createContact(ctx, { email: "x@y.com", country: "AR", companyId: foreign.id }),
    MarketingValidationError,
  );

  const contact = await svc.contacts.createContact(ctx, {
    email: "persona@sancorseguros.com",
    companyId: company.id,
    country: "AR",
    commercialStageId: "nuevo",
  });
  assert.equal(contact.stage, "new");
  assert.equal(contact.commercialStageId, "nuevo");
  assert.equal(contact.companyId, company.id);
  await assert.rejects(
    () => svc.contacts.updateContact(ctx, contact.id, { commercialStageId: "replied" }),
    MarketingValidationError,
  );
});

test("templates: versiones inmutables y transaccionales", async () => {
  const { svc, ctx } = setup();
  const created = await svc.templates.createTemplate(ctx, {
    name: "Cesión Chile",
    subject: "v1",
    html: "<p>uno</p>",
    text: "uno",
  });
  assert.equal(created.version.version, 1);
  const v2 = await svc.templates.createTemplateVersion(ctx, created.template.id, {
    subject: "v2",
    html: "<p>dos</p>",
    text: "dos",
  });
  assert.equal(v2.version.version, 2);
  const old = await svc.templates.getTemplateVersion(ctx, created.template.id, 1);
  assert.equal(old.subject, "v1");
  assert.equal(old.html, "<p>uno</p>");
  const listed = await svc.templates.listTemplateVersions(ctx, created.template.id);
  assert.equal(listed.length, 2);
  assert.equal("updateTemplateVersion" in svc.templates, false);
});

test("tasks: crear, completar y filtrar", async () => {
  const { svc, ctx } = setup();
  const { company } = await svc.companies.createCompany(ctx, { name: "Acme", countryCode: "AR" });
  const open = await svc.tasks.createTask(ctx, {
    type: "follow_up",
    title: "Volver a contactar",
    companyId: company.id,
    dueAt: "2026-09-20T12:00:00.000Z",
  });
  assert.equal(open.status, "open");
  const done = await svc.tasks.completeTask(ctx, open.id);
  assert.equal(done.status, "completed");
  assert.ok(done.completedAt);
  const listed = await svc.tasks.listTasks(ctx, { companyId: company.id, status: "completed" });
  assert.equal(listed.items.length, 1);
});

test("opportunities: company obligatoria, contacts del workspace, reply no mueve stage", async () => {
  const { svc, ctx, other } = setup();
  await assert.rejects(
    () =>
      svc.opportunities.createOpportunity(ctx, {
        name: "X",
        companyId: "missing",
        commercialStageId: "nuevo",
      }),
    MarketingValidationError,
  );
  const { company } = await svc.companies.createCompany(ctx, { name: "Sancor", countryCode: "AR" });
  const local = await svc.contacts.createContact(ctx, {
    email: "local@sancor.com",
    country: "AR",
    companyId: company.id,
  });
  const { company: otherCo } = await svc.companies.createCompany(other, { name: "Foranea", countryCode: "MX" });
  const foreign = await svc.contacts.createContact(other, {
    email: "mx@foranea.com",
    country: "MX",
    companyId: otherCo.id,
  });
  await assert.rejects(
    () =>
      svc.opportunities.createOpportunity(ctx, {
        name: "Mix",
        companyId: company.id,
        contactIds: [local.id, foreign.id],
        commercialStageId: "nuevo",
      }),
    MarketingValidationError,
  );
  const opp = await svc.opportunities.createOpportunity(ctx, {
    name: "Siniestros",
    companyId: company.id,
    contactIds: [local.id],
    commercialStageId: "nuevo",
  });
  await svc.contacts.updateContact(ctx, local.id, { stage: "replied" });
  const still = await svc.opportunities.getOpportunity(ctx, opp.id);
  assert.equal(still.commercialStageId, "nuevo");
  const contact = await svc.contacts.getContact(ctx, local.id);
  assert.equal(contact.stage, "replied");
  assert.notEqual(contact.stage, contact.commercialStageId);
});

test("criterio de éxito: company + contact + task sin UI/MCP", async () => {
  const { svc, ctx } = setup();
  const { company } = await svc.companies.createCompany(ctx, {
    name: "Sancor Seguros",
    website: "https://www.sancorseguros.com",
    countryCode: "AR",
  });
  const contact = await svc.contacts.createContact(ctx, {
    email: "persona@sancorseguros.com",
    companyId: company.id,
    country: "AR",
  });
  const task = await svc.tasks.createTask(ctx, {
    type: "follow_up",
    companyId: company.id,
    title: "Volver a contactar",
    dueAt: "2026-09-24T12:00:00.000Z",
  });
  assert.equal(contact.companyId, company.id);
  assert.equal(task.companyId, company.id);
});
