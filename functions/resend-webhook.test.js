"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHmac, randomBytes } = require("crypto");
const { verifyResendSvixSignature, shouldUpdateTransportStatus } = require("./resend-webhook");

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
