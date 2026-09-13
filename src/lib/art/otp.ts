import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { ART_COLLECTIONS } from "@/lib/art/collections";
import { generateOtpCode, hashOtpCode, newArtSecret, otpTtlMs } from "@/lib/art/tokens";
import { newArtChallengeId } from "@/lib/art/ids";
import { assertOtpPurposeForChannel, contactVerifiedByOtpChannel, verifyOtpAttempt } from "@/lib/art/otp-logic";
import { sendArtTransactionalEmail } from "@/lib/art/transactional-mail";
import { appendArtAuditEvent } from "@/lib/art/audit";
import type { ArtOtpChannel, ArtRecipient } from "@/lib/art/types";
import { maskEmail } from "@/lib/art/mask";
import { assertPilotRecipientAllowed, throwArtCode } from "@/lib/art/pilot";

export async function sendOtp(input: {
  orgId: string;
  orgName: string;
  recipient: ArtRecipient;
  purpose: "phone" | "email";
  channel: ArtOtpChannel;
  actor: string;
  ip?: string | null;
}): Promise<{ challengeId: string; channel: ArtOtpChannel; expiresAt: string; destinationMasked: string }> {
  throwArtCode(
    assertPilotRecipientAllowed({
      orgId: input.orgId,
      email: input.recipient.email,
      phone: input.recipient.phone,
    })
  );
  const purposeGate = assertOtpPurposeForChannel(input.purpose, input.channel);
  if (!purposeGate.ok) {
    throw Object.assign(new Error(purposeGate.reason), { code: purposeGate.reason });
  }
  const email = input.recipient.email;
  if (!email) {
    throw Object.assign(new Error("email_required_for_otp"), { code: "email_required_for_otp" });
  }
  const challengeId = newArtChallengeId();
  const code = generateOtpCode(6);
  const expiresAt = new Date(Date.now() + otpTtlMs()).toISOString();
  await getAdminDb().collection(ART_COLLECTIONS.otpChallenges).doc(challengeId).set({
    challengeId,
    orgId: input.orgId,
    recipientId: input.recipient.id,
    purpose: input.purpose,
    channel: input.channel,
    codeHash: hashOtpCode(challengeId, code),
    expiresAt,
    attempts: 0,
    consumed: false,
    replayNonce: newArtSecret(8),
    createdAt: FieldValue.serverTimestamp(),
  });
  const sent = await sendArtTransactionalEmail({
    to: email,
    subject: `${input.orgName}: código de verificación`,
    text: [
      `Tu código para verificar el email es: ${code}`,
      "",
      `Vence a las ${expiresAt} (UTC).`,
      "Si no solicitaste este código, ignorá este mensaje.",
    ].join("\n"),
  });
  await appendArtAuditEvent({
    orgId: input.orgId,
    recipientId: input.recipient.id,
    type: "OTP_SENT",
    actor: input.actor,
    source: "art_public",
    ip: input.ip,
    metadata: {
      challengeId,
      purpose: input.purpose,
      channel: input.channel,
      skipped: sent.skipped === true,
    },
  });
  return {
    challengeId,
    channel: input.channel,
    expiresAt,
    destinationMasked: maskEmail(email) || "",
  };
}

export async function verifyOtp(input: {
  orgId: string;
  recipientId: string;
  challengeId: string;
  code: string;
  actor: string;
  ip?: string | null;
}): Promise<{ ok: true; purpose: "phone" | "email" } | { ok: false; reason: string }> {
  const db = getAdminDb();
  const ref = db.collection(ART_COLLECTIONS.otpChallenges).doc(input.challengeId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, reason: "invalid" };
  const d = snap.data()!;
  if (String(d.orgId) !== input.orgId || String(d.recipientId) !== input.recipientId) {
    return { ok: false, reason: "invalid" };
  }
  const result = verifyOtpAttempt(
    {
      challengeId: input.challengeId,
      codeHash: String(d.codeHash),
      expiresAt: String(d.expiresAt),
      attempts: Number(d.attempts || 0),
      consumed: d.consumed === true,
      channel: d.channel === "whatsapp" || d.channel === "sms" ? d.channel : "email",
      purpose: d.purpose === "email" ? "email" : "phone",
    },
    input.code
  );
  if (!result.ok) {
    await ref.update({ attempts: FieldValue.increment(1), lastAttemptAt: FieldValue.serverTimestamp() });
    return { ok: false, reason: result.reason };
  }
  const channel = d.channel === "whatsapp" || d.channel === "sms" ? d.channel : "email";
  const verifiedContact = contactVerifiedByOtpChannel(channel);
  const now = new Date().toISOString();
  await ref.update({ consumed: true, verifiedAt: now, attempts: FieldValue.increment(1) });
  const recUpdates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp(), revalidationRequired: false };
  if (verifiedContact === "phone") {
    recUpdates.phoneVerified = true;
    recUpdates.phoneVerifiedAt = now;
  } else {
    recUpdates.emailVerified = true;
    recUpdates.emailVerifiedAt = now;
  }
  await db.collection(ART_COLLECTIONS.recipients).doc(input.recipientId).update(recUpdates);
  await appendArtAuditEvent({
    orgId: input.orgId,
    recipientId: input.recipientId,
    type: "OTP_VERIFIED",
    actor: input.actor,
    source: "art_public",
    ip: input.ip,
    metadata: { challengeId: input.challengeId, purpose: d.purpose === "email" ? "email" : "phone", channel, verifiedContact },
  });
  return { ok: true, purpose: verifiedContact };
}
