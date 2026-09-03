import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { pickResendEmailPublic, lastEventClaim, isSafeResendEmailId } from "./resend-api-client";
import {
  claimForResendEvent,
  classifyResendHistoricalSignature,
  historicalEventFromResend,
  mapResendEventKind,
  RESEND_VERIFICATION_DISCLAIMER,
} from "./resend-webhook-evidence";
import { resendLiveFailureDoesNotInvalidateHistory } from "./resend-webhook-evidence";
import { resendVerificationExecutiveLines } from "./resend-communication-pdf";
import type { ResendCommunicationReport } from "./resend-communication-types";

function sign(secretBytes: Buffer, id: string, timestamp: string, body: string) {
  const sig = createHmac("sha256", secretBytes).update(`${id}.${timestamp}.${body}`).digest("base64");
  return `v1,${sig}`;
}

test("HMAC histórico: timestamp viejo verifica si hay RAW exacto", () => {
  const bytes = randomBytes(32);
  const secret = `whsec_${bytes.toString("base64")}`;
  const id = "msg_hist_1";
  const timestamp = String(Math.floor(Date.now() / 1000) - 86_400);
  const body = '{"type":"email.delivered","data":{"email_id":"abc"}}';
  const result = classifyResendHistoricalSignature(
    {
      httpBody: body,
      signatureHeader: sign(bytes, id, timestamp, body),
      svixId: id,
      svixTimestamp: timestamp,
      payloadHash: undefined,
    },
    secret
  );
  assert.equal(result.status, "HISTORICAL_VERIFIED");
  assert.equal(result.signatureValidation, "correct");
  assert.equal(result.rawPreserved, true);
});

test("sin RAW: ingest_only / HISTORICAL_PRESERVED (no HMAC retrospectivo)", () => {
  const result = classifyResendHistoricalSignature(
    {
      signatureVerified: true,
      signatureHeader: "v1,abc",
      svixId: "msg_old",
      svixTimestamp: "1700000000",
      payloadHash: "aa".repeat(32),
    },
    "whsec_dGVzdA=="
  );
  assert.equal(result.status, "HISTORICAL_PRESERVED");
  assert.equal(result.signatureValidation, "ingest_only");
  assert.equal(result.rawPreserved, false);
  assert.match(result.webhookAuthLabel, /no se recompute HMAC|RAW no está conservado/i);
});

test("RAW truncado no recomputa HMAC", () => {
  const result = classifyResendHistoricalSignature(
    {
      httpBodyTruncated: true,
      signatureVerified: true,
      signatureHeader: "v1,abc",
      svixId: "msg_big",
      svixTimestamp: "1700000000",
    },
    "whsec_dGVzdA=="
  );
  assert.equal(result.status, "HISTORICAL_PRESERVED");
  assert.equal(result.signatureValidation, "ingest_only");
  assert.equal(result.rawTruncated, true);
});

test("HMAC histórico incorrecto si el body no coincide", () => {
  const bytes = randomBytes(32);
  const secret = `whsec_${bytes.toString("base64")}`;
  const id = "msg_bad";
  const timestamp = "1700000000";
  const signed = '{"type":"email.sent"}';
  const result = classifyResendHistoricalSignature(
    {
      httpBody: '{"type":"email.bounced"}',
      signatureHeader: sign(bytes, id, timestamp, signed),
      svixId: id,
      svixTimestamp: timestamp,
    },
    secret
  );
  assert.equal(result.status, "FAILED");
  assert.equal(result.signatureValidation, "incorrect");
});

test("caída de API en vivo no invalida el documento histórico", () => {
  assert.equal(resendLiveFailureDoesNotInvalidateHistory("API_UNAVAILABLE"), true);
  assert.equal(resendLiveFailureDoesNotInvalidateHistory("NOT_AVAILABLE"), true);
  assert.equal(resendLiveFailureDoesNotInvalidateHistory("HISTORICAL_VERIFIED"), false);
});

test("claims honestos: delivered ≠ bandeja; open ≠ lectura", () => {
  assert.match(claimForResendEvent("delivered"), /no afirma/i);
  assert.match(claimForResendEvent("delivered"), /bandeja de entrada/i);
  assert.match(claimForResendEvent("opened"), /no es lectura fehaciente/i);
  assert.match(claimForResendEvent("clicked"), /no es lectura fehaciente/i);
  assert.equal(mapResendEventKind("email.delivered"), "delivered");
  assert.match(lastEventClaim("delivered"), /no afirma/i);
  assert.match(RESEND_VERIFICATION_DISCLAIMER, /hmac histórico/i);
  assert.match(RESEND_VERIFICATION_DISCLAIMER, /no se invalida/i);
});

test("pickResendEmailPublic no expone html ni text", () => {
  const picked = pickResendEmailPublic({
    id: "4ef9a417-02e9-4d39-ad75-9611e0fcc33c",
    last_event: "delivered",
    created_at: "2026-01-01T00:00:00.000Z",
    subject: "Hola",
    from: "Notificas <noreply@notificas.com.ar>",
    to: ["dest@example.com"],
    html: "<p>secreto</p>",
    text: "secreto",
  });
  assert.equal(picked?.id, "4ef9a417-02e9-4d39-ad75-9611e0fcc33c");
  assert.equal(picked?.lastEvent, "delivered");
  assert.equal(JSON.stringify(picked).includes("secreto"), false);
  assert.equal(JSON.stringify(picked).includes("html"), false);
});

test("email_id inseguro no se consulta", () => {
  assert.equal(isSafeResendEmailId("../etc/passwd"), false);
  assert.equal(isSafeResendEmailId("4ef9a417-02e9-4d39-ad75-9611e0fcc33c"), true);
});

test("evento histórico opened no se vende como lectura", () => {
  const ev = historicalEventFromResend(
    {
      eventType: "email.opened",
      signatureVerified: true,
    },
    null
  );
  assert.equal(ev.kind, "opened");
  assert.match(ev.claim, /no es lectura fehaciente/i);
  assert.equal(ev.status, "HISTORICAL_PRESERVED");
});

test("resumen ejecutivo no afirma bandeja ni lectura", () => {
  const report: ResendCommunicationReport = {
    channel: "email",
    documentUnaffectedByLiveOutage: true,
    liveUnavailable: { status: "API_UNAVAILABLE", message: "timeout" },
    live: { email: null, lastLiveCheckAt: null },
    identification: {
      notificationId: "mail1",
      campaignId: null,
      campaignMessageId: null,
      emailId: "abc",
      smtpMessageId: null,
      recipientEmail: "a@b.com",
      subject: "x",
    },
    inconsistencies: [],
    chronology: [
      {
        status: "HISTORICAL_VERIFIED",
        kind: "delivered",
        title: "Servidor de correo aceptó el mensaje",
        claim: claimForResendEvent("delivered"),
        source: "resend_webhook_historical",
        emailId: "abc",
        smtpMessageId: null,
        recipient: "a@b.com",
        providerTimestamp: "2026-01-01T00:00:00.000Z",
        receivedAt: "2026-01-01T00:00:01.000Z",
        rawPreserved: true,
        rawTruncated: false,
        signatureHeaderPresent: true,
        signatureValidation: "correct",
        payloadSha256: "aa".repeat(32),
        integrityMatchesStoredHash: true,
        webhookAuthLabel: "HMAC",
        rawPublic: "hash_only",
        evidentiaryClass: "mailbox_server_accepted",
      },
    ],
    disclaimer: RESEND_VERIFICATION_DISCLAIMER,
  };
  const lines = resendVerificationExecutiveLines(report);
  assert.equal(lines.some((l) => /bandeja de entrada/i.test(l)), true);
  assert.equal(lines.some((l) => /no invalida/i.test(l)), true);
  assert.equal(lines.join(" ").toLowerCase().includes("lectura fehaciente"), true);
});
