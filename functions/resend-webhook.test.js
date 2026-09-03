"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHmac, randomBytes } = require("crypto");
const { verifyResendSvixSignature, shouldUpdateTransportStatus, movementForResendEvent } = require("./resend-webhook");

function sign(secretBytes, id, timestamp, body) {
  const sig = createHmac("sha256", secretBytes).update(`${id}.${timestamp}.${body}`).digest("base64");
  return `v1,${sig}`;
}

test("firma Svix válida", () => {
  const bytes = randomBytes(32);
  const secret = `whsec_${bytes.toString("base64")}`;
  const id = "msg_test_1";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = '{"type":"email.sent"}';
  const result = verifyResendSvixSignature({
    secret,
    rawBody: body,
    svixId: id,
    svixTimestamp: timestamp,
    svixSignature: sign(bytes, id, timestamp, body),
  });
  assert.equal(result.ok, true);
});

test("transport no baja de delivered a sent", () => {
  assert.equal(shouldUpdateTransportStatus("delivered", "sent"), false);
});

test("transport sube de sent a delivered", () => {
  assert.equal(shouldUpdateTransportStatus("sent", "delivered"), true);
});

test("delayed no pisa delivered", () => {
  assert.equal(shouldUpdateTransportStatus("delivered", "delayed"), false);
});

test("delivered es movimiento de llegada, no de lectura", () => {
  const m = movementForResendEvent("email.delivered", "2026-08-26T20:00:00.000Z", "msg_1", "abengolea1@gmail.com");
  assert.equal(m.type, "resend_delivered");
  assert.equal(m.type === "email_opened" || m.type === "reader_magic_open" || m.type === "read_confirmed", false);
  assert.match(m.description, /servidor de correo/i);
});

test("opened de Resend no usa tipo de lectura fehaciente", () => {
  const m = movementForResendEvent("email.opened", "2026-08-26T20:00:00.000Z", "msg_2", "abengolea1@gmail.com");
  assert.equal(m.type, "resend_opened_signal");
});

test("timestamp viejo falla en ingest y pasa en histórico", () => {
  const bytes = randomBytes(32);
  const secret = `whsec_${bytes.toString("base64")}`;
  const id = "msg_hist";
  const timestamp = String(Math.floor(Date.now() / 1000) - 900);
  const body = '{"type":"email.delivered"}';
  const header = sign(bytes, id, timestamp, body);
  const live = verifyResendSvixSignature({
    secret,
    rawBody: body,
    svixId: id,
    svixTimestamp: timestamp,
    svixSignature: header,
  });
  assert.equal(live.ok, false);
  const historical = verifyResendSvixSignature({
    secret,
    rawBody: body,
    svixId: id,
    svixTimestamp: timestamp,
    svixSignature: header,
    skipTimestampCheck: true,
  });
  assert.equal(historical.ok, true);
});

test("body alterado falla", () => {
  const bytes = randomBytes(32);
  const secret = `whsec_${bytes.toString("base64")}`;
  const id = "msg_test_2";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = '{"type":"email.sent"}';
  const result = verifyResendSvixSignature({
    secret,
    rawBody: '{"type":"email.bounced"}',
    svixId: id,
    svixTimestamp: timestamp,
    svixSignature: sign(bytes, id, timestamp, body),
  });
  assert.equal(result.ok, false);
});
