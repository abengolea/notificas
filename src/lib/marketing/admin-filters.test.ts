import { test } from "node:test";
import assert from "node:assert/strict";
import { campaignMatchesAdminFilters, contactMatchesOutcome, sendMatchesOutcome } from "./admin-filters";

const camp = {
  name: "Colombia carteras",
  subject: "Cesión de crédito",
  listName: "Compra y Administración de Carteras — Notificación de cesión de crédito — Colombia",
  country: "CO",
  industryId: "carteras_credito",
  useCaseId: "cesion_credito",
  status: "draft",
  audienceKind: "crm",
  stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, bounced: 0, failed: 0 },
};

test("filtros de campaña: país, rubro, caso de uso y sin envíos", () => {
  assert.equal(campaignMatchesAdminFilters(camp, { country: "CO", industryId: "carteras_credito", useCaseId: "cesion_credito", outcome: "unsent" }), true);
  assert.equal(campaignMatchesAdminFilters(camp, { country: "AR" }), false);
  assert.equal(campaignMatchesAdminFilters(camp, { industryId: "gas" }), false);
  assert.equal(campaignMatchesAdminFilters(camp, { useCaseId: "aviso_corte" }), false);
  assert.equal(campaignMatchesAdminFilters(camp, { outcome: "replied" }), false);
  assert.equal(campaignMatchesAdminFilters(camp, { q: "cesión" }), true);
  assert.equal(campaignMatchesAdminFilters(camp, { status: "sent" }), false);
});

test("filtros de campaña: enviados y recibidos", () => {
  const sent = {
    ...camp,
    status: "sent",
    stats: { sent: 40, delivered: 38, opened: 12, clicked: 3, replied: 1, bounced: 2, failed: 0 },
  };
  assert.equal(campaignMatchesAdminFilters(sent, { outcome: "unsent" }), false);
  assert.equal(campaignMatchesAdminFilters(sent, { outcome: "sent" }), true);
  assert.equal(campaignMatchesAdminFilters(sent, { outcome: "delivered" }), true);
  assert.equal(campaignMatchesAdminFilters(sent, { outcome: "replied" }), true);
  assert.equal(campaignMatchesAdminFilters(sent, { status: "sent", country: "CO" }), true);
});

test("filtros de campaña: alias de rubro anterior", () => {
  const legacy = { ...camp, industryId: "debt_portfolios" };
  assert.equal(campaignMatchesAdminFilters(legacy, { industryId: "carteras_credito" }), true);
});

test("filtros de campaña: varios casos de uso", () => {
  const multi = { ...camp, useCaseId: "aviso_comitentes", useCaseIds: ["aviso_comitentes", "cambio_contractual"] };
  assert.equal(campaignMatchesAdminFilters(multi, { useCaseId: "aviso_comitentes,cambio_contractual" }), true);
  assert.equal(campaignMatchesAdminFilters(multi, { useCaseIds: ["entrega_documentacion"] }), false);
});

test("filtros de campaña: lista y etapa como en contactos", () => {
  const withList = { ...camp, listId: "lista-gas", includeStages: ["new", "sent"] };
  assert.equal(campaignMatchesAdminFilters(withList, { listId: "lista-gas" }), true);
  assert.equal(campaignMatchesAdminFilters(withList, { listId: "otra" }), false);
  assert.equal(campaignMatchesAdminFilters(withList, { stage: "sent" }), true);
  assert.equal(campaignMatchesAdminFilters(withList, { stage: "replied" }), false);
});

test("filtros de campaña: archivadas ocultas por defecto", () => {
  const archived = { ...camp, archivedAt: "2026-09-18T12:00:00.000Z" };
  assert.equal(campaignMatchesAdminFilters(camp, {}), true);
  assert.equal(campaignMatchesAdminFilters(archived, {}), false);
  assert.equal(campaignMatchesAdminFilters(archived, { archived: "hide" }), false);
  assert.equal(campaignMatchesAdminFilters(archived, { archived: "only" }), true);
  assert.equal(campaignMatchesAdminFilters(camp, { archived: "only" }), false);
  assert.equal(campaignMatchesAdminFilters(archived, { archived: "all" }), true);
});

test("filtros de contacto: sin envío, enviado y respondido", () => {
  assert.equal(contactMatchesOutcome({ stage: "new" }, "unsent"), true);
  assert.equal(contactMatchesOutcome({ stage: "new" }, "sent"), false);
  assert.equal(contactMatchesOutcome({ stage: "sent", lastSentAt: "2026-01-01" }, "unsent"), false);
  assert.equal(contactMatchesOutcome({ stage: "sent", lastSentAt: "2026-01-01" }, "sent"), true);
  assert.equal(contactMatchesOutcome({ stage: "replied", lastRepliedAt: "2026-01-02" }, "replied"), true);
});

test("filtros de envío: recibidos y no enviados", () => {
  assert.equal(sendMatchesOutcome({ status: "queued" }, "unsent"), true);
  assert.equal(sendMatchesOutcome({ status: "sent", sentAt: "2026-01-01", deliveredAt: "2026-01-01" }, "delivered"), true);
  assert.equal(sendMatchesOutcome({ status: "sent", sentAt: "2026-01-01" }, "delivered"), false);
});
