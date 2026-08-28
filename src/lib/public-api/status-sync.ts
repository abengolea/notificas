import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { emitPublicApiEvent } from "@/lib/public-api/webhooks";
import {
  certificateStatusFromMail,
  mergeStatus,
  normalizeNotificationStatus,
  type PublicNotificationStatus,
} from "@/lib/public-api/status";
import { COLLECTIONS } from "@/lib/public-api/types";
import type { WebhookEventType } from "@/lib/public-api/validation";

function eventTypeForStatus(status: PublicNotificationStatus): WebhookEventType | null {
  switch (status) {
    case "queued":
      return "notification.queued";
    case "sent":
      return "notification.sent";
    case "delivered":
      return "notification.delivered";
    case "read":
      return "notification.read";
    case "failed":
      return "notification.failed";
    default:
      return null;
  }
}

function tsNow() {
  return FieldValue.serverTimestamp();
}

function timestampField(status: PublicNotificationStatus): string | null {
  switch (status) {
    case "sent":
      return "sentAt";
    case "delivered":
      return "deliveredAt";
    case "read":
      return "readAt";
    case "failed":
      return "failedAt";
    default:
      return null;
  }
}

export async function registerPublicApiNotification(params: {
  id: string;
  orgId: string;
  mailId: string;
  channel: "whatsapp" | "email";
  batchId?: string;
  testMode: boolean;
  apiKeyId?: string;
  reference?: string | null;
  recipientPhone?: string;
  recipientEmail?: string;
  recipientName?: string;
}): Promise<void> {
  const ref = getAdminDb().collection(COLLECTIONS.apiNotifications).doc(params.id);
  const existing = await ref.get();
  if (existing.exists) return;
  await ref.set({
    id: params.id,
    orgId: params.orgId,
    mailId: params.mailId,
    batchId: params.batchId || null,
    channel: params.channel,
    status: "queued",
    reference: params.reference || null,
    recipientPhone: params.recipientPhone || null,
    recipientEmail: params.recipientEmail || null,
    recipientName: params.recipientName || null,
    createdAt: FieldValue.serverTimestamp(),
    certificateStatus: params.testMode ? "sandbox" : "processing",
    testMode: params.testMode,
    apiKeyId: params.apiKeyId || null,
  });
}

export async function syncPublicApiNotificationFromMail(
  mailId: string,
  hint?: PublicNotificationStatus
): Promise<void> {
  if (!mailId) return;
  const db = getAdminDb();
  const mailSnap = await db.collection("mail").doc(mailId).get();
  if (!mailSnap.exists) return;
  const mail = mailSnap.data()!;
  const publicId = String(mail.publicApiId || "");
  if (!publicId) return;

  const nRef = db.collection(COLLECTIONS.apiNotifications).doc(publicId);
  const nSnap = await nRef.get();
  if (!nSnap.exists) return;
  const current = nSnap.data()!;
  if (String(current.orgId || "") !== String(mail.orgId || current.orgId || "")) return;

  const next = mergeStatus(
    current.status as PublicNotificationStatus | undefined,
    hint ||
      normalizeNotificationStatus({
        deliveryState: mail.delivery?.state,
        transportStatus: mail.transport?.status,
        whatsappDelivered: mail.tracking?.whatsappDelivered,
        whatsappRead: mail.tracking?.whatsappRead,
        readConfirmed: mail.tracking?.readConfirmed,
        readerOpened: mail.tracking?.opened,
        simulated: mail.simulated,
      })
  );

  const cert = certificateStatusFromMail({
    evidenceSealed: mail.evidenceSealed,
    evidenceSnapshotHash: mail.evidenceSnapshotHash,
    testMode: current.testMode === true,
    simulated: mail.simulated === true,
    realSend: mail.simulated !== true,
  });

  const patch: Record<string, unknown> = {
    status: next,
    certificateStatus: cert,
    updatedAt: tsNow(),
  };
  const tf = timestampField(next);
  if (tf && !current[tf]) patch[tf] = tsNow();

  await nRef.update(patch);

  if (next !== current.status) {
    const type = eventTypeForStatus(next);
    if (type) {
      await emitPublicApiEvent({
        type,
        orgId: String(current.orgId),
        environment: current.testMode === true ? "test" : "live",
        data: {
          notification_id: publicId,
          reference: current.reference || null,
          status: next,
        },
      }).catch((e) => console.warn("public-api event", e instanceof Error ? e.message : e));
    }
  }

  if (cert === "ready" && current.certificateStatus !== "ready") {
    await emitPublicApiEvent({
      type: "notification.certificate_ready",
      orgId: String(current.orgId),
      environment: current.testMode === true ? "test" : "live",
      data: {
        notification_id: publicId,
        reference: current.reference || null,
        status: next,
      },
    }).catch((e) => console.warn("public-api cert event", e instanceof Error ? e.message : e));
  }
}

export async function emitBatchCompletedIfApi(campaignId: string): Promise<void> {
  const db = getAdminDb();
  const camp = await db.collection("campaigns").doc(campaignId).get();
  if (!camp.exists) return;
  const data = camp.data()!;
  const batchId = String(data.publicApiBatchId || "");
  if (!batchId) return;
  const already = data.publicApiBatchCompletedEvent === true;
  if (already) return;
  await camp.ref.update({ publicApiBatchCompletedEvent: true }).catch(() => undefined);
  await emitPublicApiEvent({
    type: "batch.completed",
    orgId: String(data.orgId || ""),
    environment: data.publicApiTestMode === true ? "test" : "live",
    data: {
      batch_id: batchId,
      status: "completed",
    },
  }).catch((e) => console.warn("public-api batch event", e instanceof Error ? e.message : e));
}
