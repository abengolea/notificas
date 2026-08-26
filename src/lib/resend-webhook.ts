import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { recordProviderEvent } from "@/lib/provider-events";
import { verifyResendSvixSignature } from "@/lib/resend-webhook-verify";

export const RESEND_EMAIL_EVENTS = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.failed",
  "email.complained",
  "email.opened",
  "email.clicked",
  "email.suppressed",
  "email.scheduled",
  "email.received",
] as const;

export type ResendEmailEventType = (typeof RESEND_EMAIL_EVENTS)[number];

export type TransportStatus =
  | "sent"
  | "delayed"
  | "delivered"
  | "bounced"
  | "failed"
  | "complained"
  | "suppressed";

const STATUS_RANK: Record<TransportStatus, number> = {
  sent: 10,
  delayed: 20,
  delivered: 30,
  complained: 40,
  bounced: 50,
  failed: 50,
  suppressed: 50,
};

const EVENT_STATUS: Partial<Record<string, TransportStatus>> = {
  "email.sent": "sent",
  "email.delivery_delayed": "delayed",
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.failed": "failed",
  "email.complained": "complained",
  "email.suppressed": "suppressed",
};

const SIGNAL_EVENTS = new Set(["email.opened", "email.clicked"]);

export function evidentiaryClass(eventType: string): string {
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

export function movementForResendEvent(
  eventType: string,
  occurredAt: string,
  webhookEventId: string,
  recipient: string | null
): Record<string, unknown> | null {
  const labels: Record<string, { type: string; description: string }> = {
    "email.sent": {
      type: "resend_sent",
      description: "Resend aceptó el mensaje para entrega. No es lectura.",
    },
    "email.delivered": {
      type: "resend_delivered",
      description:
        "Resend informó que el servidor de correo del destinatario aceptó el mensaje. No es lectura fehaciente.",
    },
    "email.delivery_delayed": {
      type: "resend_delayed",
      description: "Resend informó demora temporal de entrega.",
    },
    "email.bounced": {
      type: "resend_bounced",
      description: "Resend informó rebote: el mensaje no llegó al buzón.",
    },
    "email.failed": {
      type: "resend_failed",
      description: "Resend informó fallo de envío.",
    },
    "email.suppressed": {
      type: "resend_suppressed",
      description: "Resend no envió: dirección en lista de supresión.",
    },
    "email.complained": {
      type: "resend_complained",
      description: "Resend informó marca de spam. No es lectura.",
    },
    "email.opened": {
      type: "resend_opened_signal",
      description:
        "Señal técnica de apertura informada por Resend (pixel/proxy). No equivale a lectura fehaciente.",
    },
    "email.clicked": {
      type: "resend_clicked_signal",
      description: "Señal técnica de clic informada por Resend. No equivale a acceso al reader.",
    },
  };
  const spec = labels[eventType];
  if (!spec) return null;
  return {
    id: `resend-${webhookEventId}`,
    type: spec.type,
    description: spec.description,
    timestamp: occurredAt,
    userAgent: "Resend webhook",
    clientIP: "Resend",
    browser: "Resend",
    source: "resend_webhook",
    evidentiaryClass: evidentiaryClass(eventType),
    recipientEmail: recipient || undefined,
  };
}

export function shouldUpdateTransportStatus(
  current: string | null | undefined,
  incoming: TransportStatus
): boolean {
  const cur = String(current || "");
  const curRank = STATUS_RANK[cur as TransportStatus];
  const nextRank = STATUS_RANK[incoming];
  if (!nextRank) return false;
  if (!curRank) return true;
  return nextRank >= curRank && cur !== incoming;
}

function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function recipientFromData(data: Record<string, unknown>): string | null {
  const to = data.to;
  if (Array.isArray(to) && to.length) return str(to[0]).toLowerCase() || null;
  if (typeof to === "string") return to.trim().toLowerCase() || null;
  return str(data.recipient).toLowerCase() || null;
}

function messageIdVariants(messageId: string): string[] {
  const raw = messageId.trim();
  if (!raw) return [];
  const bare = raw.replace(/^<|>$/g, "");
  return Array.from(new Set([raw, bare, `<${bare}>`]));
}

export async function findMailForResendEvent(params: {
  providerMessageId?: string | null;
  smtpMessageId?: string | null;
}): Promise<FirebaseFirestore.QueryDocumentSnapshot | null> {
  const db = getAdminDb();
  const emailId = str(params.providerMessageId);
  if (emailId) {
    const snap = await db.collection("mail").where("providerMessageId", "==", emailId).limit(1).get();
    if (!snap.empty) return snap.docs[0];
  }
  for (const variant of messageIdVariants(str(params.smtpMessageId))) {
    const snap = await db.collection("mail").where("smtpMessageId", "==", variant).limit(1).get();
    if (!snap.empty) return snap.docs[0];
  }
  return null;
}

export type ProcessResendWebhookResult = {
  httpStatus: number;
  body: Record<string, unknown>;
};

export async function processResendWebhook(input: {
  rawBody: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
  contentType: string | null;
  secret?: string;
}): Promise<ProcessResendWebhookResult> {
  const secret = (input.secret || process.env.RESEND_WEBHOOK_SECRET || "").trim();
  const receivedAtIso = new Date().toISOString();
  const db = getAdminDb();
  const payloadHash = sha256Utf8(input.rawBody || "");

  const verified = verifyResendSvixSignature({
    secret,
    rawBody: input.rawBody,
    svixId: input.svixId,
    svixTimestamp: input.svixTimestamp,
    svixSignature: input.svixSignature,
  });

  if (!verified.ok) {
    const rejectId = str(input.svixId) || `unsigned-${payloadHash.slice(0, 24)}`;
    await db
      .collection("email_provider_webhook_rejects")
      .doc(rejectId)
      .set(
        {
          provider: "resend",
          webhookEventId: str(input.svixId) || null,
          svixTimestamp: str(input.svixTimestamp) || null,
          signatureHeader: str(input.svixSignature) || null,
          signatureVerified: false,
          verifyReason: verified.reason,
          payloadHash,
          rawPreview: input.rawBody.slice(0, 2000),
          receivedAt: FieldValue.serverTimestamp(),
          receivedAtIso,
        },
        { merge: true }
      );
    return { httpStatus: 401, body: { error: "invalid_signature" } };
  }

  const webhookEventId = str(input.svixId);
  if (!webhookEventId) {
    return { httpStatus: 400, body: { error: "missing_svix_id" } };
  }

  const eventRef = db.collection("email_provider_events").doc(webhookEventId);
  const existing = await eventRef.get();
  if (existing.exists) {
    return {
      httpStatus: 200,
      body: { ok: true, duplicate: true, webhookEventId },
    };
  }

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(input.rawBody) as Record<string, unknown>;
  } catch {
    return { httpStatus: 400, body: { error: "invalid_json" } };
  }

  const eventType = str(parsed.type);
  const data = asRecord(parsed.data) || {};
  const providerMessageId = str(data.email_id) || null;
  const smtpMessageId = str(data.message_id) || null;
  const recipient = recipientFromData(data);
  const occurredAt = str(data.created_at) || str(parsed.created_at) || receivedAtIso;

  const mailSnap = await findMailForResendEvent({ providerMessageId, smtpMessageId });
  const mail = mailSnap?.data() || null;
  const mailId = mailSnap?.id || null;
  const campaignId = mail && typeof mail.campaignId === "string" ? mail.campaignId : null;
  const campaignMessageId =
    mail && typeof mail.campaignMessageId === "string" ? mail.campaignMessageId : null;

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
  const canonicalHash = sha256Utf8(JSON.stringify(canonicalPayload));

  const eventDoc: Record<string, unknown> = {
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
    canonicalHash,
    signatureVerified: true,
    signatureHeader: input.svixSignature,
    svixId: webhookEventId,
    svixTimestamp: input.svixTimestamp,
    contentType: input.contentType,
    notificationId: mailId,
    mailId,
    campaignId,
    campaignMessageId,
    evidentiaryClass: evidentiaryClass(eventType),
  };

  const incomingStatus = EVENT_STATUS[eventType];
  const currentStatus =
    mail && mail.transport && typeof mail.transport === "object"
      ? str((mail.transport as { status?: unknown }).status)
      : "";

  let created = false;
  await db.runTransaction(async (t) => {
    const again = await t.get(eventRef);
    if (again.exists) return;
    created = true;
    t.set(eventRef, eventDoc);
    if (!mailSnap) return;

    const mailRef = mailSnap.ref;
    t.set(mailRef.collection("providerEvents").doc(webhookEventId), eventDoc);
    const historyItem = {
      eventType,
      webhookEventId,
      providerMessageId,
      occurredAt,
      receivedAtIso,
      payloadHash,
      evidentiaryClass: evidentiaryClass(eventType),
    };
    const updates: Record<string, unknown> = {
      "transport.provider": "resend",
      "transport.history": FieldValue.arrayUnion(historyItem),
      "transport.lastEventType": eventType,
      "transport.lastEventAt": occurredAt,
    };
    const movement = movementForResendEvent(eventType, occurredAt, webhookEventId, recipient);
    if (movement) {
      updates["tracking.movements"] = FieldValue.arrayUnion(movement);
    }
    if (incomingStatus && shouldUpdateTransportStatus(currentStatus, incomingStatus)) {
      updates["transport.status"] = incomingStatus;
      updates["transport.statusUpdatedAt"] = occurredAt;
    }
    if (eventType === "email.bounced" || eventType === "email.failed" || eventType === "email.suppressed") {
      updates.emailTransportIncident = {
        type: eventType,
        at: occurredAt,
        recipient,
        reason:
          str(asRecord(data.bounce)?.message) ||
          str(data.error) ||
          eventType,
        source: "resend",
      };
    }
    t.update(mailRef, updates);
  });

  if (!created) {
    return {
      httpStatus: 200,
      body: { ok: true, duplicate: true, webhookEventId },
    };
  }

  if (mailId) {
    await recordProviderEvent({
      mailId,
      campaignId,
      campaignMessageId,
      provider: "resend",
      eventType,
      providerMessageId,
      recipient,
      providerTimestamp: occurredAt,
      raw: parsed,
      signatureHeader: input.svixSignature,
      signatureValid: true,
      payloadHash,
      httpBody: input.rawBody,
      contentType: input.contentType,
      signatureValidatedAt: receivedAtIso,
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
      signalOnly: SIGNAL_EVENTS.has(eventType),
    },
  };
}
