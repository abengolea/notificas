import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { verifyWhatsAppHubSignature } from "./whatsapp-webhook-auth";
import {
  createMetaGraphFetcher,
  isSafeMetaObjectId,
  metaGraphUrl,
  payloadContainsSecrets,
  pickPhonePublic,
  pickTemplatePublic,
  pickWabaPublic,
} from "./meta-graph-client";
import {
  detectWamidMismatch,
  historicalEventFromProvider,
  normalizeWaRecipient,
  recomputeWebhookIntegrity,
} from "./meta-webhook-evidence";
import { liveMetaFailureDoesNotInvalidateDocument } from "./meta-verify-status";
import { buildEventLeafPayload, parseEventLeafPayload } from "./campaign-leaf-payload";

const SECRET = "test-app-secret";

function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function hmacHeader(raw: string, secret = SECRET): string {
  return `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
}

test("documento auténtico: el SHA-256 del PDF coincide con el registro", () => {
  const pdf = Buffer.from("%PDF-1.4\nconstancia notificas\n%%EOF", "utf8");
  const stored = sha256Hex(pdf);
  assert.equal(stored.length, 64);
  assert.equal(sha256Hex(pdf), stored);
});

test("documento alterado: cambiar un byte invalida el hash", () => {
  const original = Buffer.from("%PDF-1.4\nconstancia notificas\n%%EOF", "utf8");
  const altered = Buffer.from(original);
  altered[altered.length - 8] = altered[altered.length - 8] ^ 1;
  assert.notEqual(sha256Hex(original), sha256Hex(altered));
});

test("WABA correcto: Meta devuelve el mismo ID → VERIFIED", async () => {
  const id = "2169826596871026";
  const fetcher = createMetaGraphFetcher({
    accessToken: "server-token-must-not-leak",
    fetchImpl: async (url) => {
      assert.equal(new URL(String(url)).hostname, "graph.facebook.com");
      assert.equal(new URL(String(url)).pathname.endsWith(`/${id}`), true);
      return new Response(JSON.stringify({ id, name: "Notificas WABA" }), { status: 200 });
    },
  });
  const res = await fetcher(id, "id,name");
  assert.equal(res.ok, true);
  const picked = pickWabaPublic(res.json);
  assert.equal(picked?.id, id);
  assert.equal(picked?.name, "Notificas WABA");
  assert.equal(JSON.stringify(res.json).includes("server-token"), false);
});

test("Phone Number ID correcto: Meta devuelve relación con el WABA", async () => {
  const phoneId = "693302653873170";
  const waba = "2169826596871026";
  const fetcher = createMetaGraphFetcher({
    accessToken: "tok",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          id: phoneId,
          display_phone_number: "+54 9 11 0000-0000",
          verified_name: "Notificas",
          whatsapp_business_account: { id: waba },
        }),
        { status: 200 }
      ),
  });
  const res = await fetcher(phoneId, "id,display_phone_number,verified_name,whatsapp_business_account{id}");
  const picked = pickPhonePublic(res.json);
  assert.equal(picked?.id, phoneId);
  assert.equal(picked?.wabaId, waba);
});

test("Template correcto: Meta devuelve el template esperado", async () => {
  const templateId = "1393418889653150";
  const fetcher = createMetaGraphFetcher({
    accessToken: "tok",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          id: templateId,
          name: "notificacion_deuda_180_dias",
          language: "es_AR",
          status: "APPROVED",
        }),
        { status: 200 }
      ),
  });
  const res = await fetcher(templateId, "id,name,language,status");
  const picked = pickTemplatePublic(res.json);
  assert.equal(picked?.id, templateId);
  assert.equal(picked?.name, "notificacion_deuda_180_dias");
  assert.equal(picked?.language, "es_AR");
});

test("Meta timeout: la constancia no se invalida", async () => {
  const fetcher = createMetaGraphFetcher({
    accessToken: "tok",
    timeoutMs: 20,
    fetchImpl: async (_url, init) => {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => resolve(), 80);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
      return new Response("{}", { status: 200 });
    },
  });
  const res = await fetcher("2169826596871026", "id");
  assert.equal(res.timedOut, true);
  assert.equal(res.ok, false);
  assert.equal(liveMetaFailureDoesNotInvalidateDocument("API_UNAVAILABLE"), true);
});

test("webhook correcto: RAW + firma válida", () => {
  const raw = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  const header = hmacHeader(raw);
  assert.equal(verifyWhatsAppHubSignature(raw, header, SECRET), true);
  const integ = recomputeWebhookIntegrity({
    httpBody: raw,
    storedHash: createHash("sha256").update(raw, "utf8").digest("hex"),
    signatureHeader: header,
    appSecret: SECRET,
    ingestSignatureValid: true,
  });
  assert.equal(integ.signatureValidation, "correct");
  assert.equal(integ.hashMatches, true);
});

test("webhook alterado: un byte del RAW hace fallar la firma", () => {
  const raw = JSON.stringify({ object: "whatsapp_business_account", status: "delivered" });
  const header = hmacHeader(raw);
  const tampered = raw.replace("delivered", "deliveredx");
  assert.equal(verifyWhatsAppHubSignature(tampered, header, SECRET), false);
});

test("firma alterada → FAILED", () => {
  const raw = '{"a":1}';
  assert.equal(verifyWhatsAppHubSignature(raw, "sha256=deadbeef", SECRET), false);
  const ev = historicalEventFromProvider(
    {
      eventType: "delivered",
      providerMessageId: "wamid.AAA",
      recipient: "549111",
      httpBody: raw,
      payloadHash: createHash("sha256").update(raw, "utf8").digest("hex"),
      signatureHeader: "sha256=00",
      signatureValid: true,
    },
    { appSecret: SECRET, expectedWamid: "wamid.AAA" }
  );
  assert.equal(ev.status, "FAILED");
  assert.equal(ev.signatureValidation, "incorrect");
});

test("WAMID distinto entre envío y webhook", () => {
  assert.equal(detectWamidMismatch("wamid.AAA", "wamid.BBB"), true);
  assert.equal(detectWamidMismatch("wamid.AAA", "AAA"), false);
});

test("recipient_id diferente se detecta", () => {
  const ev = historicalEventFromProvider(
    {
      eventType: "read",
      providerMessageId: "wamid.AAA",
      recipient: "54900000000",
      httpBody: "{}",
      payloadHash: createHash("sha256").update("{}", "utf8").digest("hex"),
      signatureHeader: hmacHeader("{}"),
      signatureValid: true,
    },
    { appSecret: SECRET, expectedWamid: "wamid.AAA", expectedRecipient: "54911111111" }
  );
  assert.equal(ev.status, "FAILED");
  assert.equal(normalizeWaRecipient("54900000000") === normalizeWaRecipient("54911111111"), false);
});

test("evento histórico sin RAW no inventa validación", () => {
  const ev = historicalEventFromProvider(
    {
      eventType: "delivered",
      providerMessageId: "wamid.AAA",
      recipient: "54911111111",
      httpBody: null,
      payloadHash: null,
      signatureHeader: null,
      signatureValid: true,
    },
    { expectedWamid: "wamid.AAA", expectedRecipient: "54911111111" }
  );
  assert.equal(ev.rawPreserved, false);
  assert.equal(ev.rawPublic, "none");
  assert.match(ev.claim, /informó el estado delivered/);
  assert.equal(ev.status, "HISTORICAL_VERIFIED");
});

test("privacidad: no se aceptan tokens/secretos en el payload expuesto", () => {
  assert.equal(payloadContainsSecrets({ access_token: "EAAXXXX" }), true);
  assert.equal(payloadContainsSecrets({ Authorization: "Bearer x" }), true);
  assert.equal(payloadContainsSecrets({ app_secret: "abc" }), true);
  assert.equal(payloadContainsSecrets({ id: "2169826596871026", name: "Notificas" }), false);
});

test("SSRF: solo IDs numéricos contra graph.facebook.com", () => {
  assert.equal(isSafeMetaObjectId("2169826596871026"), true);
  assert.equal(isSafeMetaObjectId("http://evil.test/steal"), false);
  assert.throws(() => metaGraphUrl("../etc/passwd", "id"));
  const url = metaGraphUrl("2169826596871026", "id,name");
  assert.equal(url.hostname, "graph.facebook.com");
  assert.equal(url.protocol, "https:");
});

test("hoja Merkle v1 se conserva; v2 incorpora hash del RAW", () => {
  const v1 = buildEventLeafPayload({
    campaignId: "c1",
    messageId: "m1",
    eventType: "wa_delivered",
    occurredAt: "2026-08-20T10:00:00.000Z",
    sendLeafHash: "aa".repeat(32),
  });
  assert.match(v1, /^v1\|event\|/);
  const parsed1 = parseEventLeafPayload(v1);
  assert.equal(parsed1?.version, "v1");
  const v2 = buildEventLeafPayload({
    campaignId: "c1",
    messageId: "m1",
    eventType: "wa_delivered",
    occurredAt: "2026-08-20T10:00:00.000Z",
    sendLeafHash: "aa".repeat(32),
    meta: {
      wamid: "wamid.AAA",
      status: "delivered",
      metaTimestamp: "2026-08-20T10:00:00.000Z",
      recipientId: "54911",
      rawPayloadHash: "bb".repeat(32),
    },
  });
  assert.match(v2, /^v2\|event\|/);
  const parsed2 = parseEventLeafPayload(v2);
  assert.equal(parsed2?.rawPayloadHash, "bb".repeat(32));
});
