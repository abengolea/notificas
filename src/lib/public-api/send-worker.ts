import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { invokeSendEmail } from "@/lib/send-mail-via-cf";
import { sealEvidenceSnapshot } from "@/lib/evidence-snapshot";
import { computeContentHash } from "@/lib/certification";
import { certificarEnvio, certifyWhatsAppPayloadIfNeeded } from "@/lib/certification-polygon";
import { syncPublicApiNotificationFromMail } from "@/lib/public-api/status-sync";
import { COLLECTIONS } from "@/lib/public-api/types";

async function certifyInBackground(docId: string): Promise<void> {
  try {
    const snap = await getAdminDb().collection("mail").doc(docId).get();
    const mailData = snap.data();
    if (!mailData) return;
    const toEmail = Array.isArray(mailData.to) ? mailData.to[0] : mailData.recipientEmail || mailData.to || "";
    const fromUserId = mailData.createdBy || mailData.senderName || "app";
    const contentHash = await computeContentHash(mailData.message?.contentText || "");
    const polygonTxHash = await Promise.race([
      certificarEnvio(docId, fromUserId, toEmail, contentHash),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout certificación Polygon (>40s)")), 40_000)),
    ]);
    await getAdminDb().collection("mail").doc(docId).update({
      "polygonCertifications.send": polygonTxHash,
      "polygonCertifications.contentHash": contentHash,
      "polygonCertifications.updatedAt": new Date(),
    });
    await certifyWhatsAppPayloadIfNeeded(docId).catch(() => undefined);
  } catch (err: unknown) {
    console.error("public-api certify", err instanceof Error ? err.message : err);
  }
}

export async function processPublicApiSend(mailId: string, notificationId: string): Promise<void> {
  const db = getAdminDb();
  const mailSnap = await db.collection("mail").doc(mailId).get();
  if (!mailSnap.exists) return;
  const mail = mailSnap.data()!;
  if (mail.publicApiId && mail.publicApiId !== notificationId) return;
  if (mail.simulated === true) return;

  await db.collection(COLLECTIONS.apiNotifications).doc(notificationId).update({
    status: "processing",
    updatedAt: FieldValue.serverTimestamp(),
  }).catch(() => undefined);

  const result = await invokeSendEmail(mailId);
  if (!result.ok && !result.skipped) {
    await db.collection("mail").doc(mailId).update({
      delivery: { state: "ERROR", time: new Date().toISOString(), error: result.error || "send_failed" },
    }).catch(() => undefined);
    await syncPublicApiNotificationFromMail(mailId, "failed");
    return;
  }

  if (mail.apiChannel === "whatsapp" || mail.waOnly) {
    const fresh = await db.collection("mail").doc(mailId).get();
    const wamid = fresh.data()?.whatsappMessageId || fresh.data()?.tracking?.whatsappMessageId;
    if (wamid) {
      await db.collection("whatsapp_ids").doc(String(wamid)).set({ mailDocId: mailId }, { merge: true });
    }
  }

  void certifyInBackground(mailId);
  void sealEvidenceSnapshot(mailId).catch((e) => console.warn("public-api snapshot", e instanceof Error ? e.message : e));
  await syncPublicApiNotificationFromMail(mailId, "sent");
}
