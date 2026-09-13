import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { ART_COLLECTIONS } from "@/lib/art/collections";
import { planContactChange } from "@/lib/art/contact-change";
import { getOrCreateArtConfig, getRecipient } from "@/lib/art/store";
import { appendArtAuditEvent, emitArtWebhook } from "@/lib/art/audit";
import { toWhatsAppPhone } from "@/lib/parse-campaign-csv";
import { normalizeEmail } from "@/lib/art/ids";
import { assertPilotRecipientAllowed, throwArtCode } from "@/lib/art/pilot";

export async function changeRecipientContact(input: {
  orgId: string;
  recipientId: string;
  field: "phone" | "email";
  nextValue: string;
  actor: string;
  source: string;
}): Promise<void> {
  const rec = await getRecipient(input.orgId, input.recipientId);
  if (!rec) throw Object.assign(new Error("not_found"), { code: "not_found", httpStatus: 404 });
  const config = await getOrCreateArtConfig(input.orgId);
  const nextValue = input.field === "phone" ? toWhatsAppPhone(input.nextValue) || input.nextValue : normalizeEmail(input.nextValue);
  throwArtCode(
    assertPilotRecipientAllowed({
      orgId: input.orgId,
      email: input.field === "email" ? nextValue : rec.email,
      phone: input.field === "phone" ? nextValue : rec.phone,
    })
  );
  const plan = planContactChange({
    recipient: rec,
    field: input.field,
    nextValue,
    revalidateOnPhoneChange: config.revalidateOnPhoneChange,
    revalidateOnEmailChange: config.revalidateOnEmailChange,
  });
  const db = getAdminDb();
  await db.collection(ART_COLLECTIONS.contactHistory).add({
    orgId: input.orgId,
    recipientId: rec.id,
    field: input.field,
    previousValue: plan.change.previousValue,
    nextValue,
    actor: input.actor,
    createdAt: FieldValue.serverTimestamp(),
  });
  const updates: Record<string, unknown> = {
    [input.field]: nextValue,
    revalidationRequired: plan.revalidationRequired,
    status: plan.nextStatus,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (input.field === "phone" && plan.revalidationRequired) {
    updates.phoneVerified = false;
    updates.phoneVerifiedAt = null;
  }
  if (input.field === "email" && plan.revalidationRequired) {
    updates.emailVerified = false;
    updates.emailVerifiedAt = null;
  }
  if (plan.identityPending) {
    updates.identityVerificationStatus = "pending";
    updates.status = "identity_pending";
  }
  await db.collection(ART_COLLECTIONS.recipients).doc(rec.id).update(updates);
  await appendArtAuditEvent({
    orgId: input.orgId,
    recipientId: rec.id,
    type: "CONTACT_CHANGED",
    actor: input.actor,
    source: input.source,
    metadata: { field: input.field, previousValue: plan.change.previousValue, nextValue },
  });
  if (plan.revalidationRequired) {
    await appendArtAuditEvent({
      orgId: input.orgId,
      recipientId: rec.id,
      type: "REVALIDATION_REQUIRED",
      actor: input.actor,
      source: input.source,
      metadata: { field: input.field },
    });
  }
  await emitArtWebhook({
    orgId: input.orgId,
    type: "art.contact.changed",
    data: { recipient_id: rec.id, field: input.field },
  });
}
