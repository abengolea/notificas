import { test } from "node:test";
import assert from "node:assert/strict";
import { MARKETING_COUNTRIES } from "./countries";
import { contactIdForEmail, normalizeEmail } from "./csv";
import { looksLikeNaturalKey, marketingCatalogId, newMarketingEntityId } from "./domain/ids";
import {
  isMarketingCommercialStageId,
  MARKETING_COMMERCIAL_STAGE_SEED,
} from "./domain/commercial-stages";
import { MARKETING_COUNTRY_SEED_CORE } from "./domain/country-seed";
import { crmFlags, isCrmFlagEnabled } from "./flags";
import {
  normalizeMarketingCompanyName,
  normalizeMarketingCountryCode,
  normalizeMarketingDomain,
  normalizeMarketingEmail,
  normalizeMarketingPhone,
  normalizeMarketingUrl,
} from "./normalizers";
import {
  marketingCompanySchema,
  marketingContactDocumentSchema,
  marketingMessageSnapshotSchema,
} from "./schemas";
import { isMarketingStage, MARKETING_STAGES } from "./stages";
import { DEFAULT_MARKETING_WORKSPACE_ID, getMarketingWorkspaceId } from "./workspace";

test("workspace CRM por defecto y override por env", () => {
  const prev = process.env.MARKETING_WORKSPACE_ID;
  try {
    delete process.env.MARKETING_WORKSPACE_ID;
    assert.equal(getMarketingWorkspaceId(), DEFAULT_MARKETING_WORKSPACE_ID);
    process.env.MARKETING_WORKSPACE_ID = "notificas-staging";
    assert.equal(getMarketingWorkspaceId(), "notificas-staging");
    process.env.MARKETING_WORKSPACE_ID = "OrgIdDeCliente/illegal";
    assert.equal(getMarketingWorkspaceId(), DEFAULT_MARKETING_WORKSPACE_ID);
  } finally {
    if (prev === undefined) delete process.env.MARKETING_WORKSPACE_ID;
    else process.env.MARKETING_WORKSPACE_ID = prev;
  }
});

test("feature flags CRM default false", () => {
  const keys = [
    "CRM_V2",
    "CRM_AI",
    "CRM_MCP",
    "CRM_DYNAMIC_LISTS",
    "CRM_BULK_ACTIONS",
    "CRM_OPPORTUNITIES",
    "CRM_TASKS",
  ] as const;
  const prev = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    for (const k of keys) delete process.env[k];
    const flags = crmFlags();
    for (const value of Object.values(flags)) assert.equal(value, false);
    assert.equal(isCrmFlagEnabled("crm_v2"), false);
    process.env.CRM_V2 = "true";
    assert.equal(isCrmFlagEnabled("crm_v2"), true);
    assert.equal(isCrmFlagEnabled("crm_ai"), false);
  } finally {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
});

test("normalize email reutiliza el helper existente", () => {
  assert.equal(normalizeMarketingEmail("  A@X.com "), normalizeEmail("  A@X.com "));
  assert.equal(normalizeMarketingEmail("  A@X.com "), "a@x.com");
});

test("normalize company name ignora forma societaria y acentos", () => {
  assert.equal(normalizeMarketingCompanyName("Sancor Seguros S.A."), "sancor seguros");
  assert.equal(normalizeMarketingCompanyName("SANCOR SEGUROS"), "sancor seguros");
  assert.equal(normalizeMarketingCompanyName("Sancor Seguros SA"), "sancor seguros");
  assert.equal(normalizeMarketingCompanyName("  Seguros  Rivadavia  "), "seguros rivadavia");
});

test("normalize domain unifica www, protocolo y slash", () => {
  assert.equal(normalizeMarketingDomain("https://www.sancorseguros.com"), "sancorseguros.com");
  assert.equal(normalizeMarketingDomain("www.sancorseguros.com"), "sancorseguros.com");
  assert.equal(normalizeMarketingDomain("sancorseguros.com/"), "sancorseguros.com");
  assert.equal(normalizeMarketingDomain("HTTPS://WWW.SancorSeguros.com/path?x=1"), "sancorseguros.com");
  assert.equal(normalizeMarketingUrl("www.sancorseguros.com/planes"), "https://www.sancorseguros.com/planes");
});

test("normalize country code acepta US sin cambiar parseCountry v1", () => {
  assert.equal(normalizeMarketingCountryCode("CL"), "CL");
  assert.equal(normalizeMarketingCountryCode("chile"), "CL");
  assert.equal(normalizeMarketingCountryCode("US"), "US");
  assert.equal(normalizeMarketingCountryCode("United States"), "US");
  assert.equal(normalizeMarketingCountryCode("estados unidos"), "US");
  assert.ok(MARKETING_COUNTRY_SEED_CORE.some((c) => c.code === "US"));
  assert.equal(
    MARKETING_COUNTRIES.some((c) => String(c.code) === "US"),
    false,
    "el allowlist v1 no debe incluir US todavía",
  );
});

test("normalize phone internacional", () => {
  assert.equal(normalizeMarketingPhone("+54 11 5555-1234"), "+541155551234");
  assert.equal(normalizeMarketingPhone("0054 11 5555-1234"), "+541155551234");
  assert.equal(normalizeMarketingPhone("abc"), null);
});

test("IDs internos no son email ni dominio", () => {
  const id = newMarketingEntityId();
  assert.equal(looksLikeNaturalKey(id), false);
  assert.equal(looksLikeNaturalKey("ana@empresa.cl"), true);
  assert.equal(looksLikeNaturalKey("sancorseguros.com"), true);
  assert.equal(looksLikeNaturalKey("CL"), true);
  assert.notEqual(contactIdForEmail("a@x.com"), "a@x.com");
});

test("catalog ids son deterministas por workspace+key", () => {
  const a = marketingCatalogId("notificas-internal", "industry", "utilities");
  const b = marketingCatalogId("notificas-internal", "industry", "utilities");
  const otherWs = marketingCatalogId("otro-workspace", "industry", "utilities");
  const otherKind = marketingCatalogId("notificas-internal", "use_case", "utilities");
  assert.equal(a, b);
  assert.notEqual(a, otherWs);
  assert.notEqual(a, otherKind);
  assert.equal(a.length, 40);
});

test("contacto antiguo sin campos v2 sigue siendo válido", () => {
  const parsed = marketingContactDocumentSchema.safeParse({
    email: "ana@empresa.cl",
    emailKey: "ana@empresa.cl",
    name: "Ana",
    company: "Sur Ltd",
    title: "Gerente",
    country: "CL",
    notes: "",
    stage: "new",
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
    createdAt: "2026-09-01T12:00:00.000Z",
    updatedAt: "2026-09-01T12:00:00.000Z",
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.companyId, undefined);
    assert.equal(parsed.data.commercialStageId, undefined);
    assert.equal(parsed.data.workspaceId, undefined);
    assert.equal(parsed.data.stage, "new");
  }
});

test("stage de email y commercialStageId son espacios distintos", () => {
  for (const stage of MARKETING_STAGES) {
    assert.equal(isMarketingCommercialStageId(stage), false, stage);
  }
  for (const row of MARKETING_COMMERCIAL_STAGE_SEED) {
    assert.equal(isMarketingStage(row.id), false, row.id);
  }

  const ok = marketingContactDocumentSchema.safeParse({
    email: "ana@empresa.cl",
    country: "CL",
    stage: "replied",
    commercialStageId: "interesado",
    companyId: "11111111-2222-3333-4444-555555555555",
    workspaceId: "notificas-internal",
  });
  assert.equal(ok.success, true);

  const bad = marketingContactDocumentSchema.safeParse({
    email: "ana@empresa.cl",
    country: "CL",
    stage: "replied",
    commercialStageId: "replied",
  });
  assert.equal(bad.success, false);
});

test("schema de empresa y snapshot de mensaje", () => {
  const company = marketingCompanySchema.safeParse({
    id: "11111111-2222-3333-4444-555555555555",
    workspaceId: "notificas-internal",
    name: "Sancor Seguros",
    normalizedName: "sancor seguros",
    countryCode: "AR",
    industryIds: [],
    useCaseIds: [],
    sourceIds: [],
    tagIds: [],
    status: "active",
    createdAt: "2026-09-17T12:00:00.000Z",
    updatedAt: "2026-09-17T12:00:00.000Z",
  });
  assert.equal(company.success, true);

  const snap = marketingMessageSnapshotSchema.safeParse({
    subject: "Cesión Chile",
    html: "<p>Hola</p>",
    text: "Hola",
    version: 2,
  });
  assert.equal(snap.success, true);
});
