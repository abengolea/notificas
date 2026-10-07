import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { invokeSendEmail } from "@/lib/send-mail-via-cf";
import { sealEvidenceSnapshot } from "@/lib/evidence-snapshot";
import { syncPublicApiNotificationFromMail } from "@/lib/public-api/status-sync";
import { COLLECTIONS } from "@/lib/public-api/types";

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

  // Polygon SEND lo dispara la Cloud Function sendEmail → /api/polygon/certify-event.
  void sealEvidenceSnapshot(mailId).catch((e) => console.warn("public-api snapshot", e instanceof Error ? e.message : e));
  await syncPublicApiNotificationFromMail(mailId, "sent");
}
