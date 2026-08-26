"use strict";

const { createHmac, createHash, timingSafeEqual } = require("crypto");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const STATUS_RANK = {
  sent: 10,
  delayed: 20,
  delivered: 30,
  complained: 40,
  bounced: 50,
  failed: 50,
  suppressed: 50,
};

const EVENT_STATUS = {
  "email.sent": "sent",
  "email.delivery_delayed": "delayed",
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.failed": "failed",
  "email.complained": "complained",
  "email.suppressed": "suppressed",
};

function sha256Utf8(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

function secretBytes(secret) {
  const raw = String(secret || "").trim();
  if (!raw) return null;
  const payload = raw.startsWith("whsec_") ? raw.slice(6) : raw;
  try {
    const buf = Buffer.from(payload, "base64");
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

function parseSignatures(header) {
  return String(header || "")
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const comma = part.indexOf(",");
      if (comma < 0) return part;
      return part.slice(0, comma) === "v1" ? part.slice(comma + 1) : "";
    })
    .filter(Boolean);
}

function equalB64(a, b) {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function verifyResendSvixSignature({ secret, rawBody, svixId, svixTimestamp, svixSignature, nowSec, toleranceSec }) {
  const key = secretBytes(secret);
  if (!key) return { ok: false, reason: "missing_secret" };
  const id = str(svixId);
  const timestamp = str(svixTimestamp);
  const header = str(svixSignature);
  if (!id || !timestamp || !header) return { ok: false, reason: "missing_headers" };
  if (!/^\d+$/.test(timestamp)) return { ok: false, reason: "bad_timestamp" };
  const now = nowSec ?? Math.floor(Date.now() / 1000);
  const tolerance = toleranceSec ?? 300;
  if (Math.abs(now - Number(timestamp)) > tolerance) return { ok: false, reason: "timestamp_out_of_range" };
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
  const candidates = parseSignatures(header);
  if (!candidates.length) return { ok: false, reason: "missing_v1_signature" };
  if (candidates.some((sig) => equalB64(sig, expected))) return { ok: true };
  return { ok: false, reason: "bad_signature" };
}

function evidentiaryClass(eventType) {
  switch (eventType) {
    case "email.sent":
      return "provider_accepted_for_delivery";
    case "email.delivered":
      return "mailbox_server_accepted";
    case "email.delivery_delayed":
      return "temporary_deferral";
    case "email.bounced":
    case "email.failed":
    case "email.suppressed":
      return "delivery_failure";
    case "email.complained":
      return "spam_complaint";
    case "email.opened":
      return "technical_open_not_fehaciente";
    case "email.clicked":
      return "technical_click_not_fehaciente";
    default:
      return "provider_event";
  }
}

function shouldUpdateTransportStatus(current, incoming) {
  const curRank = STATUS_RANK[String(current || "")];
  const nextRank = STATUS_RANK[incoming];
  if (!nextRank) return false;
  if (!curRank) return true;
  return nextRank >= curRank && current !== incoming;
}

function recipientFromData(data) {
  const to = data && data.to;
  if (Array.isArray(to) && to.length) return str(to[0]).toLowerCase() || null;
  if (typeof to === "string") return to.trim().toLowerCase() || null;
  return str(data && data.recipient).toLowerCase() || null;
}

function messageIdVariants(messageId) {
  const raw = str(messageId);
  if (!raw) return [];
  const bare = raw.replace(/^<|>$/g, "");
  return Array.from(new Set([raw, bare, `<${bare}>`]));
}

async function findMail(db, providerMessageId, smtpMessageId) {
  if (providerMessageId) {
    const snap = await db.collection("mail").where("providerMessageId", "==", providerMessageId).limit(1).get();
    if (!snap.empty) return snap.docs[0];
  }
  for (const variant of messageIdVariants(smtpMessageId)) {
    const snap = await db.collection("mail").where("smtpMessageId", "==", variant).limit(1).get();
    if (!snap.empty) return snap.docs[0];
  }
  return null;
}

async function processResendWebhook({ rawBody, svixId, svixTimestamp, svixSignature, contentType, secret }) {
  const receivedAtIso = new Date().toISOString();
  const db = getFirestore();
  const payloadHash = sha256Utf8(rawBody || "");
  const verified = verifyResendSvixSignature({
    secret,
    rawBody,
    svixId,
    svixTimestamp,
    svixSignature,
  });

  if (!verified.ok) {
    const rejectId = str(svixId) || `unsigned-${payloadHash.slice(0, 24)}`;
    await db.collection("email_provider_webhook_rejects").doc(rejectId).set(
      {
        provider: "resend",
        webhookEventId: str(svixId) || null,
        svixTimestamp: str(svixTimestamp) || null,
        signatureHeader: str(svixSignature) || null,
        signatureVerified: false,
        verifyReason: verified.reason,
        payloadHash,
        rawPreview: String(rawBody || "").slice(0, 2000),
        receivedAt: FieldValue.serverTimestamp(),
        receivedAtIso,
      },
      { merge: true }
    );
    return { httpStatus: 401, body: { error: "invalid_signature" } };
  }

  const webhookEventId = str(svixId);
  if (!webhookEventId) return { httpStatus: 400, body: { error: "missing_svix_id" } };

  const eventRef = db.collection("email_provider_events").doc(webhookEventId);
  if ((await eventRef.get()).exists) {
    return { httpStatus: 200, body: { ok: true, duplicate: true, webhookEventId } };
  }

  let parsed = {};
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { httpStatus: 400, body: { error: "invalid_json" } };
  }

  const eventType = str(parsed.type);
  const data = parsed.data && typeof parsed.data === "object" ? parsed.data : {};
  const providerMessageId = str(data.email_id) || null;
  const smtpMessageId = str(data.message_id) || null;
  const recipient = recipientFromData(data);
  const occurredAt = str(data.created_at) || str(parsed.created_at) || receivedAtIso;
  const mailSnap = await findMail(db, providerMessageId, smtpMessageId);
  const mail = mailSnap ? mailSnap.data() : null;
  const mailId = mailSnap ? mailSnap.id : null;
  const campaignId = mail && typeof mail.campaignId === "string" ? mail.campaignId : null;
  const campaignMessageId = mail && typeof mail.campaignMessageId === "string" ? mail.campaignMessageId : null;
  const canonicalPayload = {
    type: eventType,
    created_at: str(parsed.created_at) || null,
    data: {
      email_id: providerMessageId,
      message_id: smtpMessageId,
      to: data.to ?? null,
      from: data.from ?? null,
      subject: data.subject ?? null,
      bounce: data.bounce ?? null,
      click: data.click ?? null,
    },
  };
  const eventDoc = {
    provider: "resend",
    eventType,
    providerMessageId,
    smtpMessageId,
    webhookEventId,
    recipient,
    occurredAt,
    receivedAt: FieldValue.serverTimestamp(),
    receivedAtIso,
    rawPayload: parsed,
    canonicalPayload,
    payloadHash,
    canonicalHash: sha256Utf8(JSON.stringify(canonicalPayload)),
    signatureVerified: true,
    signatureHeader: svixSignature,
    svixId: webhookEventId,
    svixTimestamp,
    contentType: contentType || null,
    notificationId: mailId,
    mailId,
    campaignId,
    campaignMessageId,
    evidentiaryClass: evidentiaryClass(eventType),
  };

  const incomingStatus = EVENT_STATUS[eventType];
  const currentStatus = mail && mail.transport && typeof mail.transport === "object" ? str(mail.transport.status) : "";
  let created = false;
  await db.runTransaction(async (t) => {
    const again = await t.get(eventRef);
    if (again.exists) return;
    created = true;
    t.set(eventRef, eventDoc);
    if (!mailSnap) return;
    t.set(mailSnap.ref.collection("providerEvents").doc(webhookEventId), eventDoc);
    const updates = {
      "transport.provider": "resend",
      "transport.history": FieldValue.arrayUnion({
        eventType,
        webhookEventId,
        providerMessageId,
        occurredAt,
        receivedAtIso,
        payloadHash,
        evidentiaryClass: evidentiaryClass(eventType),
      }),
      "transport.lastEventType": eventType,
      "transport.lastEventAt": occurredAt,
    };
    if (incomingStatus && shouldUpdateTransportStatus(currentStatus, incomingStatus)) {
      updates["transport.status"] = incomingStatus;
      updates["transport.statusUpdatedAt"] = occurredAt;
    }
    if (eventType === "email.bounced" || eventType === "email.failed" || eventType === "email.suppressed") {
      updates.emailTransportIncident = {
        type: eventType,
        at: occurredAt,
        recipient,
        reason: (data.bounce && data.bounce.message) || data.error || eventType,
        source: "resend",
      };
    }
    t.update(mailSnap.ref, updates);
  });

  if (!created) return { httpStatus: 200, body: { ok: true, duplicate: true, webhookEventId } };

  if (mailId) {
    await db.collection("provider_events").add({
      mailId,
      campaignId,
      campaignMessageId,
      provider: "resend",
      eventType,
      providerMessageId,
      recipient,
      providerTimestamp: occurredAt,
      raw: parsed,
      signatureHeader: svixSignature,
      signatureValid: true,
      payloadHash,
      httpBody: String(rawBody || "").slice(0, 80000),
      contentType: contentType || null,
      signatureValidatedAt: receivedAtIso,
      receivedAt: FieldValue.serverTimestamp(),
      receivedAtIso,
    });
  }

  return {
    httpStatus: 200,
    body: {
      ok: true,
      webhookEventId,
      eventType,
      mailId,
      duplicate: false,
      signalOnly: eventType === "email.opened" || eventType === "email.clicked",
    },
  };
}

module.exports = {
  processResendWebhook,
  verifyResendSvixSignature,
  shouldUpdateTransportStatus,
};
