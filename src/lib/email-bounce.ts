import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { recordProviderEvent } from "@/lib/provider-events";

export type EmailBounceType = "bounce" | "complaint" | "smtp_rejected";

export type ApplyEmailBounceInput = {
  mailId?: string | null;
  smtpMessageId?: string | null;
  type: EmailBounceType;
  reason?: string | null;
  recipient?: string | null;
  raw?: unknown;
};

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export function looksLikeBouncePayload(body: Record<string, unknown>): boolean {
  const from = str(body.from).toLowerCase();
  const subject = str(body.subject).toLowerCase();
  if (/mailer-daemon|postmaster|mail-daemon/.test(from)) return true;
  if (
    /undeliverable|delivery status|failure notice|returned mail|mail delivery failed|rebote|no se pudo entregar|delivery failure/.test(
      subject
    )
  ) {
    return true;
  }
  return str(body.type).toLowerCase() === "bounce" || str(body.event).toLowerCase() === "bounced";
}

export function extractMailIdFromBounceBlob(blob: string): string | null {
  const verp = blob.match(/contacto\+b\.([A-Za-z0-9_-]{8,})@/i);
  if (verp) return verp[1];
  const hdr = blob.match(/X-Notificas-Mail-Id:\s*([A-Za-z0-9_-]+)/i);
  if (hdr) return hdr[1];
  return null;
}

export function extractOriginalMessageId(blob: string): string | null {
  const original = blob.match(/Original-Message-ID:\s*<?([^>\s]+)>?/i);
  if (original) return original[1].trim();
  return null;
}

function blobFromBody(body: Record<string, unknown>): string {
  return [
    body.to,
    body.originalTo,
    body.recipient,
    body.subject,
    body.text,
    body.html,
    body.mailId,
    body.messageId,
    body.smtpMessageId,
    typeof body.headers === "object" ? JSON.stringify(body.headers) : "",
  ]
    .map((v) => str(v))
    .join("\n");
}

export async function applyEmailBounce(input: ApplyEmailBounceInput): Promise<{ mailId: string } | null> {
  const db = getAdminDb();
  let mailId = (input.mailId || "").trim();
  const smtpMessageId = (input.smtpMessageId || "").trim();

  if (!mailId && smtpMessageId) {
    const snap = await db.collection("mail").where("smtpMessageId", "==", smtpMessageId).limit(1).get();
    if (!snap.empty) mailId = snap.docs[0].id;
  }

  if (!mailId) return null;

  const ref = db.collection("mail").doc(mailId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const mail = snap.data()!;
  if (mail.emailBounce) return { mailId };

  const at = new Date().toISOString();
  const reason = (input.reason || "").trim() || "El servidor de destino rechazó el mensaje";
  const movement = {
    id: `bounce-${Date.now()}`,
    type: "email_bounced",
    description: reason,
    timestamp: at,
    userAgent: "Server",
    clientIP: "Server",
    browser: "Server",
  };

  await ref.update({
    emailBounce: {
      type: input.type,
      reason,
      at,
      recipient: input.recipient || mail.recipientEmail || null,
    },
    "tracking.movements": FieldValue.arrayUnion(movement),
  });

  await recordProviderEvent({
    mailId,
    campaignId: typeof mail.campaignId === "string" ? mail.campaignId : null,
    provider: "smtp",
    eventType: input.type,
    providerMessageId: smtpMessageId || mail.smtpMessageId || null,
    recipient: input.recipient || mail.recipientEmail || null,
    providerTimestamp: at,
    raw: input.raw ?? { reason },
  });

  return { mailId };
}

export async function applyEmailBounceFromPayload(body: Record<string, unknown>) {
  const blob = blobFromBody(body);
  const mailId = str(body.mailId) || extractMailIdFromBounceBlob(blob) || "";
  const smtpMessageId =
    str(body.smtpMessageId) || str(body.messageId) || extractOriginalMessageId(blob) || "";
  const typeRaw = str(body.type || body.event).toLowerCase();
  const type: EmailBounceType =
    typeRaw === "complaint" || typeRaw === "complained" ? "complaint" : "bounce";
  return applyEmailBounce({
    mailId: mailId || null,
    smtpMessageId: smtpMessageId || null,
    type,
    reason: str(body.reason || body.diagnostic || body.subject) || null,
    recipient: str(body.recipient) || null,
    raw: body,
  });
}
