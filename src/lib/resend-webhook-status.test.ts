import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldUpdateTransportStatus } from "./resend-webhook";

test("transport status no baja de delivered a sent", () => {
  assert.equal(shouldUpdateTransportStatus("delivered", "sent"), false);
});

test("transport status sube de sent a delivered", () => {
  assert.equal(shouldUpdateTransportStatus("sent", "delivered"), true);
});

test("delayed no pisa delivered", () => {
  assert.equal(shouldUpdateTransportStatus("delivered", "delayed"), false);
});
