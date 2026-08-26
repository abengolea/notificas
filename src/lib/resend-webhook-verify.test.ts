import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { verifyResendSvixSignature } from "./resend-webhook-verify";

function sign(secretBytes: Buffer, id: string, timestamp: string, body: string) {
  const sig = createHmac("sha256", secretBytes).update(`${id}.${timestamp}.${body}`).digest("base64");
  return `v1,${sig}`;
}

test("Svix/Resend: firma válida", () => {
  const bytes = randomBytes(32);
  const secret = `whsec_${bytes.toString("base64")}`;
  const id = "msg_test_1";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = '{"type":"email.sent","data":{"email_id":"abc"}}';
  const result = verifyResendSvixSignature({
    secret,
    rawBody: body,
    svixId: id,
    svixTimestamp: timestamp,
    svixSignature: sign(bytes, id, timestamp, body),
  });
  assert.equal(result.ok, true);
});

test("Svix/Resend: body alterado falla", () => {
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

test("Svix/Resend: timestamp viejo falla", () => {
  const bytes = randomBytes(32);
  const secret = `whsec_${bytes.toString("base64")}`;
  const id = "msg_test_3";
  const timestamp = String(Math.floor(Date.now() / 1000) - 900);
  const body = "{}";
  const result = verifyResendSvixSignature({
    secret,
    rawBody: body,
    svixId: id,
    svixTimestamp: timestamp,
    svixSignature: sign(bytes, id, timestamp, body),
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "timestamp_out_of_range");
});
