import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { verifyWhatsAppHubSignature } from "./whatsapp-webhook-auth";
import {
  createMetaGraphFetcher,
  isSafeMetaObjectId,
  metaGraphUrl,
  normalizeDisplayPhoneNumber,
  payloadContainsSecrets,
  pickTemplatePublic,
  pickWabaPhoneNumbers,
  pickWabaPublic,
} from "./meta-graph-client";
import {
  buildRecipientMetaEvidence,
  detectWamidMismatch,
  historicalEventFromProvider,
  normalizeWaRecipient,
  recomputeWebhookIntegrity,
  waRecipientsCorrespond,
} from "./meta-webhook-evidence";
import { liveMetaFailureDoesNotInvalidateDocument } from "./meta-verify-status";
import { buildEventLeafPayload, parseEventLeafPayload } from "./campaign-leaf-payload";
import { verifyPhoneNumberAgainstMeta } from "./meta-phone-verification";
import type { HistoricalMetaEvent } from "./meta-communication-types";

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

test("Phone Number ID correcto: Meta devuelve el mismo ID → VERIFIED y pertenece al WABA", async () => {
  const phoneId = "693302653873170";
  const waba = "2169826596871026";
  const fetcher = createMetaGraphFetcher({
    accessToken: "tok",
    fetchImpl: async (url) => {
      const u = new URL(String(url));
      assert.equal(u.pathname.includes("whatsapp_business_account"), false);
      if (u.pathname.endsWith(`/${phoneId}`)) {
        assert.match(u.searchParams.get("fields") || "", /display_phone_number/);
        assert.equal((u.searchParams.get("fields") || "").includes("whatsapp_business_account"), false);
        return new Response(
          JSON.stringify({
            id: phoneId,
            display_phone_number: "+54 9 336 400-0000",
            verified_name: "Notificas",
          }),
          { status: 200 }
        );
      }
      if (u.pathname.endsWith(`/${waba}/phone_numbers`)) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: phoneId,
                display_phone_number: "+54 9 336 400-0000",
                verified_name: "Notificas",
              },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 404 });
    },
  });
  const res = await verifyPhoneNumberAgainstMeta({
    storedPhoneNumberId: phoneId,
    storedWabaId: waba,
    recipientId: "54911111111",
    fetcher,
  });
  assert.equal(res.status, "VERIFIED");
  assert.equal(res.belongsToWaba, true);
  assert.equal(res.metaId, phoneId);
  assert.equal(res.verifiedName, "Notificas");
  assert.equal(res.source, "META_GRAPH_API");
});

test("Phone Number ID pertenece al WABA vía /phone_numbers si el GET directo falla", async () => {
  const phoneId = "693302653873170";
  const waba = "2169826596871026";
  const fetcher = createMetaGraphFetcher({
    accessToken: "tok",
    fetchImpl: async (url) => {
      const u = new URL(String(url));
      if (u.pathname.endsWith(`/${phoneId}`)) {
        return new Response(
          JSON.stringify({
            error: { message: "(#100) Tried accessing nonexisting field", code: 100, type: "OAuthException" },
          }),
          { status: 400 }
        );
      }
      if (u.pathname.endsWith(`/${waba}/phone_numbers`)) {
        return new Response(
          JSON.stringify({
            data: [{ id: Number(phoneId), display_phone_number: "+54 9 336 4XX-XXXX", verified_name: "Notificas" }],
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 404 });
    },
  });
  const res = await verifyPhoneNumberAgainstMeta({
    storedPhoneNumberId: phoneId,
    storedWabaId: waba,
    fetcher,
  });
  assert.equal(res.status, "VERIFIED");
  assert.equal(res.belongsToWaba, true);
  assert.equal(res.source, "META_WABA_PHONE_NUMBERS");
});

test("número con formato distinto no produce falso negativo si el Phone Number ID coincide", async () => {
  assert.equal(normalizeDisplayPhoneNumber("+54 9 336 400-0000"), "5493364000000");
  const phoneId = "693302653873170";
  const waba = "2169826596871026";
  const fetcher = createMetaGraphFetcher({
    accessToken: "tok",
    fetchImpl: async (url) => {
      const u = new URL(String(url));
      if (u.pathname.endsWith("/phone_numbers")) {
        return new Response(JSON.stringify({ data: [{ id: phoneId }] }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ id: phoneId, display_phone_number: "+54 9 336 400-0000", verified_name: "Notificas" }),
        { status: 200 }
      );
    },
  });
  const res = await verifyPhoneNumberAgainstMeta({
    storedPhoneNumberId: phoneId,
    storedWabaId: waba,
    storedDisplayPhone: "5493364000000",
    fetcher,
  });
  assert.equal(res.status, "VERIFIED");
});

test("recipient_id distinto al emisor no genera error de Phone Number ID", async () => {
  const phoneId = "693302653873170";
  const waba = "2169826596871026";
  const fetcher = createMetaGraphFetcher({
    accessToken: "tok",
    fetchImpl: async (url) => {
      const u = new URL(String(url));
      if (u.pathname.endsWith("/phone_numbers")) {
        return new Response(JSON.stringify({ data: [{ id: phoneId }] }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ id: phoneId, display_phone_number: "+54 9 336 400-0000", verified_name: "Notificas" }),
        { status: 200 }
      );
    },
  });
  const res = await verifyPhoneNumberAgainstMeta({
    storedPhoneNumberId: phoneId,
    storedWabaId: waba,
    recipientId: "5491119999999",
    fetcher,
  });
  assert.equal(res.status, "VERIFIED");
  assert.equal(res.belongsToWaba, true);
});

test("timeout Meta del Phone Number ID → API_UNAVAILABLE, no FAILED", async () => {
  const fetcher = createMetaGraphFetcher({
    accessToken: "tok",
    timeoutMs: 20,
    fetchImpl: async (_url, init) => {
      await new Promise<void>((_resolve, reject) => {
        const timer = setTimeout(() => {}, 80);
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
  const res = await verifyPhoneNumberAgainstMeta({
    storedPhoneNumberId: "693302653873170",
    storedWabaId: "2169826596871026",
    fetcher,
  });
  assert.equal(res.status, "API_UNAVAILABLE");
  assert.notEqual(res.status, "FAILED");
  assert.match(res.message, /No fue posible realizar en este momento/);
});

test("Phone Number ID realmente diferente → FAILED", async () => {
  const stored = "693302653873170";
  const fetcher = createMetaGraphFetcher({
    accessToken: "tok",
    fetchImpl: async (url) => {
      const u = new URL(String(url));
      if (u.pathname.endsWith("/phone_numbers")) {
        return new Response(JSON.stringify({ data: [{ id: "111111111111111" }] }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ id: "111111111111111", display_phone_number: "+54 9 11 0000-0000" }),
        { status: 200 }
      );
    },
  });
  const res = await verifyPhoneNumberAgainstMeta({
    storedPhoneNumberId: stored,
    storedWabaId: "2169826596871026",
    fetcher,
  });
  assert.equal(res.status, "FAILED");
  assert.match(res.message, /no coincide/);
});

test("token insuficiente/permisos no afirma que el Phone Number ID sea incorrecto", async () => {
  const fetcher = createMetaGraphFetcher({
    accessToken: "tok",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          error: { message: "Invalid OAuth access token", type: "OAuthException", code: 190 },
        }),
        { status: 400 }
      ),
  });
  const res = await verifyPhoneNumberAgainstMeta({
    storedPhoneNumberId: "693302653873170",
    storedWabaId: "2169826596871026",
    fetcher,
  });
  assert.equal(res.status, "API_UNAVAILABLE");
  assert.match(res.message, /permisos|credencial|No fue posible/);
  assert.equal(res.message.includes("no coincide"), false);
});

test("pickWabaPhoneNumbers encuentra el ID en data[]", () => {
  const found = pickWabaPhoneNumbers({
    data: [{ id: "693302653873170", display_phone_number: "+54 9 336 400-0000" }],
  });
  assert.equal(found[0]?.id, "693302653873170");
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

test("teléfono consignado +54 9 … coincide con recipient_id de Meta", () => {
  assert.equal(waRecipientsCorrespond("+54 9 356 466-0236", "5493564660236"), true);
  assert.equal(waRecipientsCorrespond("5493564660236", "+54 9 356 466-0236"), true);
  assert.equal(waRecipientsCorrespond("+54 9 356 466-0236", "5491111111111"), false);
});

test("recipientEvidence: coincidencia, delivered/read y RAW preservado", () => {
  const raw = '{"object":"whatsapp_business_account"}';
  const base = {
    status: "HISTORICAL_VERIFIED" as const,
    title: "x",
    claim: "x",
    source: "meta_webhook_historical" as const,
    wamid: "wamid.AAA",
    recipientId: "5493564660236",
    metaTimestamp: null,
    receivedAt: null,
    rawPreserved: true,
    rawTruncated: false,
    signatureHeaderPresent: true,
    signatureValidation: "correct" as const,
    payloadSha256: "aa",
    integrityMatchesStoredHash: true,
    webhookAuthLabel: "",
    rawPublic: "hash_only" as const,
  };
  const chronology: HistoricalMetaEvent[] = [
    { ...base, kind: "delivered" },
    { ...base, kind: "read" },
  ];
  const ev = buildRecipientMetaEvidence({
    consignedPhone: "+54 9 356 466-0236",
    chronology,
  });
  assert.equal(ev.match, true);
  assert.equal(ev.status, "VERIFIED");
  assert.equal(ev.delivered, true);
  assert.equal(ev.read, true);
  assert.equal(ev.rawPreserved, true);
  assert.match(ev.summary, /delivered y read/);
  assert.match(ev.sourceNote || "", /payload original del webhook/);
});

test("recipientEvidence: mismatch no afirma coincidencia", () => {
  const chronology: HistoricalMetaEvent[] = [
    {
      status: "HISTORICAL_PRESERVED",
      kind: "delivered",
      title: "x",
      claim: "x",
      source: "meta_webhook_historical",
      wamid: "wamid.AAA",
      recipientId: "54900000000",
      metaTimestamp: null,
      receivedAt: null,
      rawPreserved: false,
      rawTruncated: false,
      signatureHeaderPresent: false,
      signatureValidation: "ingest_only",
      payloadSha256: null,
      integrityMatchesStoredHash: null,
      webhookAuthLabel: "",
      rawPublic: "none",
    },
  ];
  const ev = buildRecipientMetaEvidence({
    consignedPhone: "+54 9 356 466-0236",
    chronology,
  });
  assert.equal(ev.match, false);
  assert.equal(ev.status, "FAILED");
  assert.equal(ev.delivered, false);
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
  assert.equal(ev.status, "HISTORICAL_PRESERVED");
  assert.equal(ev.signatureValidation, "ingest_only");
});

test("HMAC retrospectivo con RAW + App Secret → HISTORICAL_VERIFIED", () => {
  const raw = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  const ev = historicalEventFromProvider(
    {
      eventType: "read",
      providerMessageId: "wamid.AAA",
      recipient: "54911111111",
      httpBody: raw,
      payloadHash: createHash("sha256").update(raw, "utf8").digest("hex"),
      signatureHeader: hmacHeader(raw),
      signatureValid: true,
      receivedAt: { _seconds: 1755684553, _nanoseconds: 284000000 },
    },
    { appSecret: SECRET, expectedWamid: "wamid.AAA", expectedRecipient: "54911111111" }
  );
  assert.equal(ev.status, "HISTORICAL_VERIFIED");
  assert.equal(ev.signatureValidation, "correct");
  assert.equal(ev.receivedAt, "2025-08-20T10:09:13.000Z");
});

test("RAW presente sin App Secret no afirma HMAC", () => {
  const raw = '{"ok":true}';
  const ev = historicalEventFromProvider(
    {
      eventType: "delivered",
      providerMessageId: "wamid.AAA",
      httpBody: raw,
      payloadHash: createHash("sha256").update(raw, "utf8").digest("hex"),
      signatureHeader: hmacHeader(raw),
      signatureValid: true,
    },
    { expectedWamid: "wamid.AAA" }
  );
  assert.equal(ev.status, "HISTORICAL_PRESERVED");
  assert.equal(ev.signatureValidation, "ingest_only");
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
  assert.throws(() => metaGraphUrl("2169826596871026", "id", "messages"));
  const phones = metaGraphUrl("2169826596871026", "id,display_phone_number,verified_name", "phone_numbers");
  assert.equal(phones.pathname, "/v18.0/2169826596871026/phone_numbers");
  assert.equal(phones.hostname, "graph.facebook.com");
  assert.equal(phones.protocol, "https:");
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

test("constancia PDF de verificación Meta arranca como PDF y no es certificado de lectura", async () => {
  const { buildMetaVerificationPdf } = await import("./meta-communication-pdf");
  const pdf = await buildMetaVerificationPdf({
    channel: "whatsapp",
    documentUnaffectedByLiveOutage: true,
    liveUnavailable: null,
    live: {
      waba: {
        id: "2169826596871026",
        status: "VERIFIED",
        message: "WABA ID verificado actualmente mediante Meta Graph API.",
        queriedAt: "2026-08-21T21:00:00.000Z",
        cached: false,
        fields: { name: "Notificas" },
      },
      phone: {
        id: "693302653873170",
        status: "VERIFIED",
        message: "Número de WhatsApp Business verificado actualmente mediante Meta Graph API.",
        queriedAt: "2026-08-21T21:00:00.000Z",
        cached: false,
        fields: { displayPhoneNumber: "+54 9 336 451-3355", verifiedName: "Notificas" },
      },
      template: {
        id: "1393418889653150",
        status: "VERIFIED",
        message: "Template identificado actualmente mediante Meta Graph API.",
        queriedAt: "2026-08-21T21:00:00.000Z",
        cached: false,
        fields: { name: "notificacion_deuda_180_dias" },
      },
      lastLiveCheckAt: "2026-08-21T21:00:00.000Z",
      templateNameMatchesSnapshot: true,
      templateLangMatchesSnapshot: true,
      templateContentHistoricalNote: "El contenido histórico se demuestra con el snapshot.",
    },
    message: {
      wamid: "wamid.TEST",
      explanation: "Identificador asignado por Meta al procesamiento del mensaje.",
      wamidSource: "extracted_id_only",
      inSendResponse: true,
      sendResponseRawPreserved: false,
      sendHttpStatus: null,
      sendBodyHash: null,
    },
    inconsistencies: [],
    chronology: [],
    identification: {
      notificationId: "usLRcAqoscRGPesh5WTV",
      campaignId: null,
      wamid: "wamid.TEST",
      wabaId: "2169826596871026",
      phoneNumberId: "693302653873170",
      templateId: "1393418889653150",
      templateName: "notificacion_deuda_180_dias",
      templateLang: "es",
      recipientPhone: "5493364513355",
      webhookRecipientId: "5493364513355",
    },
    recipientEvidence: {
      consignedPhone: "5493364513355",
      webhookRecipientId: "5493364513355",
      match: true,
      status: "HISTORICAL_PRESERVED",
      matchMessage: "Coinciden",
      delivered: true,
      read: true,
      rawPreserved: true,
      summary: "Evidencia histórica de destinatario.",
      sourceNote: null,
    },
    disclaimer: "Los estados históricos de entrega y lectura no se consultan actualmente a Meta.",
  });
  const bytes = Buffer.from(pdf);
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "%PDF");
  const latin = bytes.toString("latin1");
  assert.match(latin, /Constancia de verificaci/);
  assert.match(latin, /No es el certificado de lectura/);
  assert.equal(latin.includes("access_token"), false);
});
