import { test } from "node:test";
import assert from "node:assert/strict";
import { ART_RECIPIENT_STATUSES } from "./types";
import {
  ART_IDENTITY_STATUS_LABELS,
  ART_RECIPIENT_STATUS_LABELS,
  artIdentityStatusLabel,
  artRecipientStatusLabel,
  isPendingRecipientStatus,
  recipientMatchesStatusFilter,
} from "./status-labels";

test("every recipient status has a Spanish label without raw enum text", () => {
  for (const status of ART_RECIPIENT_STATUSES) {
    const label = artRecipientStatusLabel(status);
    assert.equal(label, ART_RECIPIENT_STATUS_LABELS[status]);
    assert.doesNotMatch(label, /_/);
    assert.notEqual(label, status);
  }
});

test("maps the operator-facing recipient states named in product copy", () => {
  assert.equal(artRecipientStatusLabel("adhesion_pending"), "Pendiente de adhesión");
  assert.equal(artRecipientStatusLabel("active"), "Activo");
  assert.equal(artRecipientStatusLabel("revoked"), "Revocado");
  assert.equal(artRecipientStatusLabel("identity_verified"), "Identidad verificada");
  assert.equal(artRecipientStatusLabel("requires_conventional_channel"), "Requiere canal convencional");
});

test("maps identity verification statuses without exposing verified/pending enums", () => {
  assert.equal(artIdentityStatusLabel("verified"), "Identidad verificada");
  assert.equal(artIdentityStatusLabel("pending"), "Pendiente");
  assert.equal(artIdentityStatusLabel("none"), "Sin verificar");
  assert.equal(artIdentityStatusLabel("failed"), "No verificada");
  for (const [key, label] of Object.entries(ART_IDENTITY_STATUS_LABELS)) {
    assert.notEqual(label, key);
    assert.doesNotMatch(label, /_/);
  }
});

test("unknown values do not leak as raw enums", () => {
  assert.equal(artRecipientStatusLabel("adhesion_pending_v2"), "—");
  assert.equal(artIdentityStatusLabel("ART_INTERNAL_KYC"), "—");
});

test("pending summary and table filters match store groupings", () => {
  assert.equal(isPendingRecipientStatus("adhesion_pending"), true);
  assert.equal(isPendingRecipientStatus("active"), false);
  assert.equal(recipientMatchesStatusFilter("adhesion_pending", "pending_group"), true);
  assert.equal(recipientMatchesStatusFilter("identity_verified", "pending_group"), false);
  assert.equal(recipientMatchesStatusFilter("rejected", "not_adhered"), true);
  assert.equal(recipientMatchesStatusFilter("active", "active"), true);
});
