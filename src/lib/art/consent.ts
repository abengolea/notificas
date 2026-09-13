import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, writeWormSnapshot } from "@/lib/firebase-admin";
import { ART_COLLECTIONS } from "@/lib/art/collections";
import { newArtAdhesionId } from "@/lib/art/ids";
import { canAcceptAdhesion } from "@/lib/art/eligibility";
import { identityIsAuditable } from "@/lib/art/identity-attestation";
import { canonicalConsentPayload, hashTermsContent } from "@/lib/art/terms";
import { appendArtAuditEvent, emitArtWebhook } from "@/lib/art/audit";
import { createManageToken } from "@/lib/art/invite";
import { getActiveTerms, getOrCreateArtConfig, getRecipient } from "@/lib/art/store";
import { publicApiSha256 } from "@/lib/art/hash";
import type { ArtRecipient } from "@/lib/art/types";
import { generateAdhesionEvidence } from "@/lib/art/evidence";

export async function acceptAdhesion(input: {
  orgId: string;
  orgName: string;
  orgCuit?: string | null;
  recipient: ArtRecipient;
  checkboxAccepted: boolean;
  explicitAccept: boolean;
  ip: string;
  userAgent: string;
  sessionId: string;
  otpChallengeId?: string | null;
  invitationTokenHash?: string | null;
}): Promise<{ adhesionId: string; manageToken: string; evidenceId: string; eventHash: string }> {
  const config = await getOrCreateArtConfig(input.orgId, input.orgName);
  const identityVerified = identityIsAuditable(input.recipient);
  const gate = canAcceptAdhesion({
    status: input.recipient.status,
    phoneVerified: input.recipient.phoneVerified,
    emailVerified: input.recipient.emailVerified,
    identityVerified,
    config,
    termsAcceptedCheckbox: input.checkboxAccepted,
    explicitAcceptAction: input.explicitAccept,
  });
  if (!gate.ok) {
    throw Object.assign(new Error(gate.reason), { code: gate.reason, httpStatus: 409 });
  }

  const terms = await getActiveTerms(input.orgId, input.orgName);
  const adhesionId = newArtAdhesionId();
  const acceptedAt = new Date().toISOString();
  const termsHash = terms.documentHash || hashTermsContent(terms.content);
  const canonical = canonicalConsentPayload({
    adhesionId,
    orgId: input.orgId,
    recipientId: input.recipient.id,
    dni: input.recipient.dni,
    cuil: input.recipient.cuil,
    phone: input.recipient.phone,
    email: input.recipient.email,
    termsVersion: terms.version,
    termsDocumentHash: termsHash,
    acceptedAt,
    ip: input.ip,
    userAgent: input.userAgent,
    sessionId: input.sessionId,
    identityStatus: input.recipient.identityVerificationStatus,
    otpChallengeId: input.otpChallengeId || null,
  });
  const consentHash = publicApiSha256(canonical);

  const db = getAdminDb();
  await db.collection(ART_COLLECTIONS.recipients).doc(input.recipient.id).update({
    status: "active",
    adhesionId,
    termsVersion: terms.version,
    termsDocumentHash: termsHash,
    termsAcceptedAt: acceptedAt,
    consentIp: input.ip,
    consentUserAgent: input.userAgent,
    consentSessionId: input.sessionId,
    activatedAt: acceptedAt,
    revokedAt: null,
    revokeReason: null,
    revalidationRequired: false,
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (input.invitationTokenHash) {
    await db.collection(ART_COLLECTIONS.invitations).doc(input.invitationTokenHash).update({
      consumed: true,
      consumedAt: FieldValue.serverTimestamp(),
      adhesionId,
    }).catch(() => undefined);
  }

  const audit = await appendArtAuditEvent({
    orgId: input.orgId,
    recipientId: input.recipient.id,
    type: "ADHESION_ACCEPTED",
    actor: "worker",
    source: "art_public",
    ip: input.ip,
    userAgent: input.userAgent,
    metadata: {
      adhesionId,
      termsVersion: terms.version,
      termsDocumentHash: termsHash,
      consentHash,
      otpChallengeId: input.otpChallengeId || null,
      identityStatus: input.recipient.identityVerificationStatus,
      identityVerificationMethod: input.recipient.identityVerificationMethod,
      identityVerifiedBy: input.recipient.identityVerifiedBy,
      identitySource: input.recipient.identitySource,
    },
  });

  const manageToken = await createManageToken(input.orgId, input.recipient.id);
  const evidence = await generateAdhesionEvidence({
    orgId: input.orgId,
    orgName: input.orgName,
    orgCuit: input.orgCuit || null,
    recipient: { ...input.recipient, status: "active", adhesionId, termsVersion: terms.version, termsDocumentHash: termsHash, termsAcceptedAt: acceptedAt },
    termsVersion: terms.version,
    termsTitle: terms.title,
    termsHash,
    consentHash,
    eventHash: audit.eventHash,
    polygonTxHash: audit.blockchainStatus === "BLOCKCHAIN_ANCHORED" ? audit.polygonTxHash : null,
    blockchainStatus: audit.blockchainStatus,
    otpChallengeId: input.otpChallengeId || null,
    ip: input.ip,
    userAgent: input.userAgent,
    sessionId: input.sessionId,
    acceptedAt,
  });

  await writeWormSnapshot(`art-${adhesionId}`, evidence.json).catch((e) =>
    console.warn("[art] worm snapshot:", e instanceof Error ? e.message : e)
  );

  await emitArtWebhook({
    orgId: input.orgId,
    type: "art.adhesion.activated",
    data: { recipient_id: input.recipient.id, adhesion_id: adhesionId },
  });
  await emitArtWebhook({
    orgId: input.orgId,
    type: "art.adhesion.created",
    data: { recipient_id: input.recipient.id, adhesion_id: adhesionId },
  });

  return { adhesionId, manageToken, evidenceId: evidence.evidenceId, eventHash: audit.eventHash };
}

export async function revokeAdhesion(input: {
  orgId: string;
  recipientId: string;
  actor: string;
  source: string;
  ip?: string | null;
  userAgent?: string | null;
  reason?: string | null;
}): Promise<void> {
  const rec = await getRecipient(input.orgId, input.recipientId);
  if (!rec) throw Object.assign(new Error("not_found"), { code: "not_found", httpStatus: 404 });
  if (rec.status === "revoked") return;
  const revokedAt = new Date().toISOString();
  await getAdminDb().collection(ART_COLLECTIONS.recipients).doc(rec.id).update({
    status: "revoked",
    revokedAt,
    revokeReason: input.reason || null,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await appendArtAuditEvent({
    orgId: input.orgId,
    recipientId: rec.id,
    type: "ADHESION_REVOKED",
    actor: input.actor,
    source: input.source,
    ip: input.ip,
    userAgent: input.userAgent,
    metadata: { reason: input.reason || null, previousStatus: rec.status },
  });
  await emitArtWebhook({
    orgId: input.orgId,
    type: "art.adhesion.revoked",
    data: { recipient_id: rec.id, adhesion_id: rec.adhesionId },
  });
  await emitArtWebhook({
    orgId: input.orgId,
    type: "art.recipient.requires_conventional_channel",
    data: { recipient_id: rec.id, reason: "REVOKED" },
  });
}

export async function suspendRecipient(input: {
  orgId: string;
  recipientId: string;
  actor: string;
  reason: string;
}): Promise<void> {
  const rec = await getRecipient(input.orgId, input.recipientId);
  if (!rec) throw Object.assign(new Error("not_found"), { code: "not_found", httpStatus: 404 });
  await getAdminDb().collection(ART_COLLECTIONS.recipients).doc(rec.id).update({
    status: "suspended",
    updatedAt: FieldValue.serverTimestamp(),
    suspendReason: input.reason,
    suspendedBy: input.actor,
  });
  await appendArtAuditEvent({
    orgId: input.orgId,
    recipientId: rec.id,
    type: "SUSPENDED",
    actor: input.actor,
    source: "empresa",
    metadata: { reason: input.reason },
  });
}

export async function reactivateRecipient(input: {
  orgId: string;
  recipientId: string;
  actor: string;
  reason: string;
}): Promise<void> {
  const rec = await getRecipient(input.orgId, input.recipientId);
  if (!rec) throw Object.assign(new Error("not_found"), { code: "not_found", httpStatus: 404 });
  if (rec.status !== "suspended") {
    throw Object.assign(new Error("not_suspended"), { code: "not_suspended", httpStatus: 409 });
  }
  const next = rec.adhesionId && rec.termsAcceptedAt ? "active" : "adhesion_pending";
  await getAdminDb().collection(ART_COLLECTIONS.recipients).doc(rec.id).update({
    status: next,
    updatedAt: FieldValue.serverTimestamp(),
    reactivatedBy: input.actor,
    reactivateReason: input.reason,
  });
  await appendArtAuditEvent({
    orgId: input.orgId,
    recipientId: rec.id,
    type: "REACTIVATED",
    actor: input.actor,
    source: "empresa",
    metadata: { reason: input.reason, nextStatus: next },
  });
}
