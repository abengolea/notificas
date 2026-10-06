import assert from "node:assert/strict";
import { test } from "node:test";
import {
  campaignAudienceStatusLabel,
  canSendMarketingCampaign,
  evaluateCampaignSendReadiness,
} from "./campaign-send-readiness";

const base = {
  status: "draft",
  archivedAt: null,
  listId: "list-1",
  listName: "Lista",
  subject: "Asunto válido",
  emailTitle: "Título válido",
  audience: { total: 10, eligible: 3, skipped: 7 },
};

test("can send when draft has eligible audience", () => {
  assert.equal(canSendMarketingCampaign(base), true);
});

test("blocks send without audience", () => {
  const readiness = evaluateCampaignSendReadiness({
    ...base,
    audience: { total: 0, eligible: 0, skipped: 0 },
  });
  assert.equal(readiness.ok, false);
  if (!readiness.ok) assert.equal(readiness.reason, "no_audience");
  assert.equal(campaignAudienceStatusLabel(readiness), "Sin audiencia");
});

test("blocks send when all contacts skipped", () => {
  const readiness = evaluateCampaignSendReadiness({
    ...base,
    audience: { total: 5, eligible: 0, skipped: 5 },
  });
  assert.equal(readiness.ok, false);
  if (!readiness.ok) assert.equal(readiness.reason, "no_eligible");
  assert.equal(campaignAudienceStatusLabel(readiness, { total: 5, eligible: 0, skipped: 5 }), "Sin destinatarios elegibles");
});

test("incomplete campaign label", () => {
  const readiness = evaluateCampaignSendReadiness({ ...base, subject: "x" });
  assert.equal(readiness.ok, false);
  assert.equal(campaignAudienceStatusLabel(readiness), "Pendiente de completar");
});
