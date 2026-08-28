import { getAdminDb, getAdminBucket } from "@/lib/firebase-admin";
import { constanciaEnvioStoragePath } from "@/lib/constancia-envio-pdf";
import { isNotificationPublicId } from "@/lib/public-api/ids";
import { maskEmail, maskPhone } from "@/lib/public-api/mask";
import { getPublicCertificate, getPublicNotification } from "@/lib/public-api/notifications";
import { certificateStatusFromMail, normalizeNotificationStatus } from "@/lib/public-api/status";
import { assertTenant } from "@/lib/public-api/tenant";
import { COLLECTIONS } from "@/lib/public-api/types";
import { publicCertificateVerifyUrl } from "@/lib/public-verify-url";
import { toPublicApiContext, type McpAuthContext } from "@/mcp/auth/context";
import { McpToolError } from "@/mcp/errors";
import { parseOrThrow, notificationIdSchema } from "@/mcp/tools/schemas";

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
  if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (typeof value === "object" && value && typeof (value as { seconds?: number }).seconds === "number") {
    return new Date((value as { seconds: number }).seconds * 1000).toISOString();
  }
  return null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

async function loadOwnedMail(ctx: McpAuthContext, notificationId: string): Promise<{
  mailId: string;
  publicId: string | null;
  mail: FirebaseFirestore.DocumentData;
  apiRow: FirebaseFirestore.DocumentData | null;
}> {
  const db = getAdminDb();
  if (isNotificationPublicId(notificationId)) {
    const apiSnap = await db.collection(COLLECTIONS.apiNotifications).doc(notificationId).get();
    if (!apiSnap.exists) throw new McpToolError("NOTIFICATION_NOT_FOUND", "Notification not found.", 404);
    const apiRow = apiSnap.data()!;
    try {
      assertTenant(String(apiRow.orgId || ""), ctx.orgId);
    } catch {
      throw new McpToolError("NOTIFICATION_NOT_FOUND", "Notification not found.", 404);
    }
    const mailId = String(apiRow.mailId || "");
    const mailSnap = mailId ? await db.collection("mail").doc(mailId).get() : null;
    return { mailId, publicId: notificationId, mail: mailSnap?.data() || {}, apiRow };
  }

  const mailSnap = await db.collection("mail").doc(notificationId).get();
  if (!mailSnap.exists) throw new McpToolError("NOTIFICATION_NOT_FOUND", "Notification not found.", 404);
  const mail = mailSnap.data()!;
  const mailOrg = String(mail.orgId || "");
  if (mailOrg) {
    try {
      assertTenant(mailOrg, ctx.orgId);
    } catch {
      throw new McpToolError("NOTIFICATION_NOT_FOUND", "Notification not found.", 404);
    }
  } else if (String(mail.createdBy || "") !== ctx.userId && String(mail.createdBy || "") !== ctx.senderUid) {
    throw new McpToolError("NOTIFICATION_NOT_FOUND", "Notification not found.", 404);
  }
  return { mailId: mailSnap.id, publicId: typeof mail.publicApiId === "string" ? mail.publicApiId : null, mail, apiRow: null };
}

export async function getNotification(ctx: McpAuthContext, raw: unknown) {
  const { notificationId } = parseOrThrow(notificationIdSchema, raw);
  if (isNotificationPublicId(notificationId)) {
    try {
      return await getPublicNotification(toPublicApiContext(ctx), notificationId);
    } catch {
      throw new McpToolError("NOTIFICATION_NOT_FOUND", "Notification not found.", 404);
    }
  }
  const loaded = await loadOwnedMail(ctx, notificationId);
  const mail = loaded.mail;
  const channel = mail.apiChannel === "email" || (!mail.waOnly && !mail.recipientPhone) ? "email" : "whatsapp";
  const status = normalizeNotificationStatus({
    deliveryState: (mail.delivery as { state?: string } | undefined)?.state,
    transportStatus: mail.transportStatus,
    whatsappDelivered: mail.whatsappDelivered,
    whatsappRead: mail.whatsappRead,
    readConfirmed: mail.readConfirmed,
    readerOpened: mail.readerOpened,
    simulated: mail.simulated,
  });
  return {
    id: loaded.publicId || loaded.mailId,
    mail_id: loaded.mailId,
    status,
    channel,
    recipient: {
      ...(maskPhone(str(mail.recipientPhone)) ? { phone: maskPhone(str(mail.recipientPhone)) } : {}),
      ...(maskEmail(str(mail.recipientEmail)) ? { email: maskEmail(str(mail.recipientEmail)) } : {}),
    },
    created_at: toIso(mail.createdAt),
    sent_at: toIso(mail.sentAt || mail.timestamp),
    delivered_at: toIso(mail.deliveredAt),
    read_at: toIso(mail.readAt),
    failed_at: toIso(mail.failedAt),
    error: mail.delivery && typeof mail.delivery === "object" ? str((mail.delivery as { info?: string }).info) || null : null,
    certificate_status: certificateStatusFromMail({
      evidenceSealed: mail.evidenceSealed,
      evidenceSnapshotHash: mail.evidenceSnapshotHash,
      constanciaPath: mail.constanciaEnvioPath,
      simulated: mail.simulated === true,
      realSend: mail.simulated !== true,
    }),
    has_certificate: Boolean(mail.constanciaEnvioPath || mail.evidenceSealed),
    source: mail.apiSource || null,
  };
}

export async function getDeliveryStatus(ctx: McpAuthContext, raw: unknown) {
  const n = (await getNotification(ctx, raw)) as Record<string, unknown>;
  const status = String(n.status || "queued");
  return {
    notificationId: n.id,
    status,
    queued: status === "queued",
    sent: ["sent", "delivered", "read"].includes(status),
    delivered: status === "delivered" || status === "read",
    read: status === "read",
    failed: status === "failed",
    created_at: n.created_at ?? null,
    sent_at: n.sent_at ?? null,
    delivered_at: n.delivered_at ?? null,
    read_at: n.read_at ?? null,
    failed_at: n.failed_at ?? null,
    error: n.error ?? null,
  };
}

export async function getCertificate(ctx: McpAuthContext, raw: unknown) {
  const { notificationId } = parseOrThrow(notificationIdSchema, raw);
  if (isNotificationPublicId(notificationId)) {
    try {
      return await getPublicCertificate(toPublicApiContext(ctx), notificationId);
    } catch {
      throw new McpToolError("NOTIFICATION_NOT_FOUND", "Notification not found.", 404);
    }
  }
  const loaded = await loadOwnedMail(ctx, notificationId);
  const mail = loaded.mail;
  const cert = certificateStatusFromMail({
    evidenceSealed: mail.evidenceSealed,
    evidenceSnapshotHash: mail.evidenceSnapshotHash,
    constanciaPath: mail.constanciaEnvioPath,
    simulated: mail.simulated === true,
    realSend: mail.simulated !== true,
  });
  if (cert !== "ready") {
    return { status: "processing" as const, message: "The constancia is not ready yet." };
  }
  const path = constanciaEnvioStoragePath(loaded.mailId);
  const expires = new Date(Date.now() + 15 * 60 * 1000);
  try {
    const [url] = await getAdminBucket().file(path).getSignedUrl({
      version: "v4",
      action: "read",
      expires,
    });
    return {
      status: "ready" as const,
      kind: "constancia_envio",
      download_url: url,
      expires_at: expires.toISOString(),
    };
  } catch {
    return { status: "processing" as const, message: "The constancia is not ready yet." };
  }
}

export async function verifyNotification(ctx: McpAuthContext, raw: unknown) {
  const { notificationId } = parseOrThrow(notificationIdSchema, raw);
  const loaded = await loadOwnedMail(ctx, notificationId);
  const mail = loaded.mail;
  const polygon =
    mail.polygonCertifications && typeof mail.polygonCertifications === "object"
      ? (mail.polygonCertifications as Record<string, unknown>)
      : {};
  const wamid = str(mail.whatsappMessageId || (mail.tracking as { whatsappMessageId?: string } | undefined)?.whatsappMessageId) || null;
  const recipientId =
    str(mail.whatsappRecipientId || mail.recipient_id || (mail.tracking as { recipientId?: string } | undefined)?.recipientId) ||
    null;
  const contentHash = str(mail.contentHash || polygon.contentHash) || null;
  const snapshotHash = str(mail.evidenceSnapshotHash) || null;
  const tx = str(polygon.send || polygon.txHash || polygon.transactionHash) || null;
  const verifyUrl = publicCertificateVerifyUrl({
    id: loaded.mailId,
    hash: contentHash || snapshotHash || undefined,
  });
  return {
    notificationId: loaded.publicId || loaded.mailId,
    integrity: mail.evidenceSealed === true || Boolean(snapshotHash) ? "sealed" : "pending",
    timestamp: toIso(mail.createdAt),
    content_hash: contentHash,
    snapshot_hash: snapshotHash,
    wamid,
    recipient_id: recipientId,
    blockchain: tx
      ? { network: "polygon", transaction: tx }
      : { network: "polygon", transaction: null },
    verify_url: verifyUrl,
  };
}
