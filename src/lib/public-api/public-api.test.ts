import { test } from "node:test";
import assert from "node:assert/strict";
import { hashApiKey, hmacSha256Hex, sha256Hex, timingSafeEqualHex } from "./crypto";
import { parseApiKey, generateApiKeySecret } from "./api-key-format";
import { errorBody, forbidden, PublicApiError, unauthorized } from "./errors";
import { isBatchPublicId, isNotificationPublicId, newBatchId, newNotificationId, newRequestId } from "./ids";
import { canonicalJson, requestFingerprint } from "./idempotency-hash";
import { maskEmail, maskPhone } from "./mask";
import { mergeStatus, normalizeBatchStatus, normalizeNotificationStatus } from "./status";
import { staticWebhookUrlCheck, isBlockedIp } from "./ssrf";
import {
  createNotificationSchema,
  isValidEmail,
  isValidIdempotencyKey,
  sanitizeMetadata,
  sanitizeVariables,
} from "./validation";
import { isSandboxRecipientAllowed, mergeAllowlist } from "./sandbox";
import { signWebhookPayload, verifyWebhookSignature } from "./webhook-signature";
import { nextWebhookDelaySeconds, shouldRetryWebhookStatus } from "./webhook-retry";
import { decodeCursor, encodeCursor } from "./cursor";
import { hasScope } from "./scopes";
import { assertTenant } from "./tenant";
import { toWhatsAppPhone } from "../parse-campaign-csv";

test("API keys: live/test format, never equal to hash", () => {
  const live = generateApiKeySecret("live");
  const testKey = generateApiKeySecret("test");
  assert.match(live.fullKey, /^ntf_live_[A-Za-z0-9]{16,}$/);
  assert.match(testKey.fullKey, /^ntf_test_[A-Za-z0-9]{16,}$/);
  assert.equal(parseApiKey(live.fullKey)?.environment, "live");
  assert.equal(parseApiKey(testKey.fullKey)?.environment, "test");
  assert.equal(parseApiKey("sk_live_abc"), null);
  const hashed = hashApiKey(live.fullKey);
  assert.notEqual(hashed, live.fullKey);
  assert.equal(hashed.length, 64);
  assert.equal(hashed.includes(live.fullKey), false);
});

test("API keys: invalid and revoked-shaped errors", () => {
  const err = unauthorized("revoked_api_key", "This API key has been revoked.");
  assert.equal(err.httpStatus, 401);
  const body = errorBody(err, "req_test");
  assert.equal(body.error.code, "revoked_api_key");
  assert.equal(body.error.request_id, "req_test");
  assert.equal("stack" in body.error, false);
});

test("tenant isolation helper hides foreign resources as 404", () => {
  assert.throws(
    () => assertTenant("org_a", "org_b"),
    (e: unknown) => e instanceof PublicApiError && e.httpStatus === 404 && e.code === "not_found"
  );
  assert.doesNotThrow(() => assertTenant("org_a", "org_a"));
});

test("scopes: missing scope is denied conceptually", () => {
  assert.equal(hasScope(["notifications:read"], "notifications:write"), false);
  assert.equal(hasScope(["notifications:write"], "notifications:write"), true);
  assert.equal(hasScope(["*"], "batches:write"), true);
});

test("notification public ids", () => {
  const live = newNotificationId(false);
  const sandbox = newNotificationId(true);
  assert.equal(isNotificationPublicId(live), true);
  assert.equal(isNotificationPublicId(sandbox), true);
  assert.equal(sandbox.startsWith("ntf_test_"), true);
  assert.equal(isNotificationPublicId("mail_abc"), false);
  assert.equal(isBatchPublicId(newBatchId(false)), true);
  assert.match(newRequestId(), /^req_/);
});

test("status normalization from mail/campaign fields", () => {
  assert.equal(normalizeNotificationStatus({ queued: true }), "queued");
  assert.equal(normalizeNotificationStatus({ deliveryState: "DELIVERED" }), "sent");
  assert.equal(normalizeNotificationStatus({ transportStatus: "delivered" }), "delivered");
  assert.equal(normalizeNotificationStatus({ whatsappDelivered: true }), "delivered");
  assert.equal(normalizeNotificationStatus({ whatsappRead: true }), "read");
  assert.equal(normalizeNotificationStatus({ waEstado: "leido" }), "read");
  assert.equal(normalizeNotificationStatus({ deliveryState: "ERROR" }), "failed");
  assert.equal(normalizeNotificationStatus({ transportStatus: "bounced" }), "failed");
  assert.equal(normalizeBatchStatus("enviando"), "processing");
  assert.equal(normalizeBatchStatus("completada"), "completed");
  assert.equal(mergeStatus("delivered", "failed"), "delivered");
  assert.equal(mergeStatus("sent", "read"), "read");
});

test("validation: phone, email, template injection, metadata", () => {
  assert.equal(Boolean(toWhatsAppPhone("+5493364123456")), true);
  assert.equal(toWhatsAppPhone("123"), undefined);
  assert.equal(isValidEmail("juan@email.com"), true);
  assert.equal(isValidEmail("not-an-email"), false);
  const bad = createNotificationSchema.safeParse({
    channel: "whatsapp",
    recipient: { phone: "+5493364123456" },
    createdBy: "attacker",
    orgId: "other-org",
  });
  assert.equal(bad.success, false);
  const vars = sanitizeVariables({ nombre: "Juan", "<script>": "x", bad: "a".repeat(600) });
  assert.equal(vars["<script>"], undefined);
  assert.ok((vars.bad || "").length <= 500);
  const meta = sanitizeMetadata({ crm_id: "78482", extra: 1 });
  assert.equal(meta.crm_id, "78482");
  assert.equal(isValidIdempotencyKey("cobranza-982734"), true);
});

test("sandbox allowlist matching", () => {
  const allow = mergeAllowlist({ phones: ["+5493364123456"], emails: ["dev@empresa.com"] });
  assert.equal(isSandboxRecipientAllowed({ allowlist: allow, phone: "+5493364123456" }), true);
  assert.equal(isSandboxRecipientAllowed({ allowlist: allow, phone: "+5491111111111" }), false);
  assert.equal(isSandboxRecipientAllowed({ allowlist: allow, email: "dev@empresa.com" }), true);
});

test("SSRF: block localhost, private IPs, metadata, require https in live", () => {
  assert.equal(staticWebhookUrlCheck("http://localhost/hook", { requireHttps: true }).ok, false);
  assert.equal(staticWebhookUrlCheck("https://127.0.0.1/hook", { requireHttps: true }).ok, false);
  assert.equal(staticWebhookUrlCheck("https://10.0.0.5/hook", { requireHttps: true }).ok, false);
  assert.equal(staticWebhookUrlCheck("https://169.254.169.254/latest/meta-data", { requireHttps: true }).ok, false);
  assert.equal(staticWebhookUrlCheck("https://metadata.google.internal/", { requireHttps: true }).ok, false);
  assert.equal(staticWebhookUrlCheck("http://example.com/hook", { requireHttps: true }).ok, false);
  assert.equal(staticWebhookUrlCheck("https://hooks.example.com/notificas", { requireHttps: true }).ok, true);
  assert.equal(isBlockedIp("192.168.1.1"), true);
  assert.equal(isBlockedIp("8.8.8.8"), false);
});

test("webhook signature HMAC and replay window", () => {
  const secret = "whsec_testsecret";
  const eventId = "evt_01TEST";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const rawBody = JSON.stringify({ id: eventId, type: "notification.delivered" });
  const header = signWebhookPayload(secret, eventId, timestamp, rawBody);
  assert.equal(verifyWebhookSignature({ secret, eventId, timestamp, rawBody, signatureHeader: header }).ok, true);
  assert.equal(
    verifyWebhookSignature({ secret: "whsec_other", eventId, timestamp, rawBody, signatureHeader: header }).ok,
    false
  );
  const oldTs = String(Math.floor(Date.now() / 1000) - 3600);
  const oldHeader = signWebhookPayload(secret, eventId, oldTs, rawBody);
  const replay = verifyWebhookSignature({
    secret,
    eventId,
    timestamp: oldTs,
    rawBody,
    signatureHeader: oldHeader,
  });
  assert.equal(replay.ok, false);
  if (!replay.ok) assert.equal(replay.code, "timestamp_expired");
});

test("webhook retries keep the same event and use backoff", () => {
  assert.equal(nextWebhookDelaySeconds(0), 0);
  assert.equal(nextWebhookDelaySeconds(1), 60);
  assert.equal(nextWebhookDelaySeconds(2), 300);
  assert.equal(nextWebhookDelaySeconds(99), null);
  assert.equal(shouldRetryWebhookStatus(500, false), true);
  assert.equal(shouldRetryWebhookStatus(408, false), true);
  assert.equal(shouldRetryWebhookStatus(200, false), false);
  assert.equal(shouldRetryWebhookStatus(400, false), false);
  assert.equal(shouldRetryWebhookStatus(null, true), true);
});

test("idempotency fingerprint differs when body differs", () => {
  const a = requestFingerprint({ channel: "whatsapp", reference: "A" });
  const b = requestFingerprint({ channel: "whatsapp", reference: "B" });
  const same = requestFingerprint({ reference: "A", channel: "whatsapp" });
  assert.equal(a, same);
  assert.notEqual(a, b);
  assert.equal(canonicalJson({ b: 1, a: 2 }), '{"a":2,"b":1}');
});

test("mask recipient data in API responses", () => {
  const phone = maskPhone("+5493364123456");
  assert.ok(phone);
  assert.equal(phone.includes("123456"), false);
  const email = maskEmail("juan@email.com");
  assert.ok(email);
  assert.match(email, /^ju\*\*\*@email.com$/);
});

test("cursor encode/decode", () => {
  const c = { createdAtMs: 1_700_000_000_000, id: "ntf_01TEST" };
  assert.deepEqual(decodeCursor(encodeCursor(c)), c);
  assert.equal(decodeCursor("%%%"), null);
});

test("timing-safe compare rejects different lengths", () => {
  assert.equal(timingSafeEqualHex("ab", "abcd"), false);
  assert.equal(timingSafeEqualHex(hmacSha256Hex("s", "p"), hmacSha256Hex("s", "p")), true);
});

test("forbidden vs not found for IDOR-style mismatch", () => {
  const hidden = forbidden("tenant_mismatch", "no");
  assert.equal(hidden.httpStatus, 403);
  assert.equal(sha256Hex("secret").includes("secret"), false);
});
