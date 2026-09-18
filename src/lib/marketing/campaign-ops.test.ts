import { test } from "node:test";
import assert from "node:assert/strict";
import {
  copyCampaignName,
  copiedCampaignFields,
  isCampaignArchived,
  shouldSkipFailedRetry,
} from "./campaign-ops";

test("nombre de copia no se anida", () => {
  assert.equal(copyCampaignName("Naturgy corte"), "Copia de Naturgy corte");
  assert.equal(copyCampaignName("Copia de Naturgy corte"), "Copia de Naturgy corte");
});

test("copia queda en borrador sin stats ni envíos", () => {
  const copied = copiedCampaignFields(
    {
      name: "ALyC comitentes",
      country: "AR",
      listId: "lista-1",
      listName: "ALyC AR",
      subject: "Aviso a comitentes",
      htmlBody: "<p>Hola</p>",
      audienceKind: "crm",
      industryId: "mercado_capitales",
      useCaseIds: ["aviso_comitentes"],
      status: "sent",
      archivedAt: "2026-01-01",
      stats: { sent: 10, failed: 2 },
    },
    "camp-1",
  );
  assert.equal(copied.status, "draft");
  assert.equal(copied.copiedFromId, "camp-1");
  assert.equal(copied.archivedAt, null);
  assert.equal(copied.startedAt, null);
  assert.deepEqual(copied.stats, {
    queued: 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    replied: 0,
    bounced: 0,
    failed: 0,
    unsubscribed: 0,
  });
  assert.equal(copied.subject, "Aviso a comitentes");
  assert.equal(copied.listId, "lista-1");
});

test("no reenviar fallidos a bajas o rebotes", () => {
  assert.equal(shouldSkipFailedRetry("failed"), false);
  assert.equal(shouldSkipFailedRetry("sent"), false);
  assert.equal(shouldSkipFailedRetry("unsubscribed"), true);
  assert.equal(shouldSkipFailedRetry("bounced"), true);
  assert.equal(shouldSkipFailedRetry("not_interested"), true);
});

test("archivada se detecta por archivedAt", () => {
  assert.equal(isCampaignArchived({}), false);
  assert.equal(isCampaignArchived({ archivedAt: "2026-09-18" }), true);
});
