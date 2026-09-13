import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { ART_COLLECTIONS } from "@/lib/art/collections";
import { getIdentityProvider } from "@/lib/art/identity/registry";
import { IdentityProviderNotConfiguredError } from "@/lib/art/identity/types";
import { appendArtAuditEvent, emitArtWebhook } from "@/lib/art/audit";
import { getOrCreateArtConfig } from "@/lib/art/store";
import type { ArtRecipient } from "@/lib/art/types";
import { statusAfterIdentity } from "@/lib/art/eligibility";
import {
  attestationToRecipientFields,
  identityIsAuditable,
  type IdentityAttestation,
} from "@/lib/art/identity-attestation";

export async function startOrApplyIdentity(input: {
  orgId: string;
  recipient: ArtRecipient;
  attestation?: IdentityAttestation | null;
  actor: string;
}): Promise<ArtRecipient> {
  if (identityIsAuditable(input.recipient) && !input.attestation) {
    return input.recipient;
  }
  const config = await getOrCreateArtConfig(input.orgId);
  const provider = getIdentityProvider(config.identityProvider);
  const attestation = input.attestation || null;
  await appendArtAuditEvent({
    orgId: input.orgId,
    recipientId: input.recipient.id,
    type: "IDENTITY_STARTED",
    actor: input.actor,
    source: "art",
    metadata: { provider: provider.id, hasAttestation: Boolean(attestation) },
  });
  try {
    const result = await provider.startVerification({
      orgId: input.orgId,
      recipientId: input.recipient.id,
      dni: input.recipient.dni,
      cuil: input.recipient.cuil,
      fullName: input.recipient.fullName,
      attestation,
    });
    const verified = result.verified === true && Boolean(attestation);
    const nextStatus = statusAfterIdentity({
      current: input.recipient.status,
      verified,
      requireIdentity: config.requireIdentityVerification,
    });
    const attestationFields = attestation && verified ? attestationToRecipientFields(attestation) : {};
    await getAdminDb().collection(ART_COLLECTIONS.recipients).doc(input.recipient.id).update({
      identityProvider: result.provider,
      identityVerificationId: result.transactionId,
      identityVerificationStatus: verified ? "verified" : "pending",
      identityVerificationAt: verified ? result.verifiedAt : null,
      identityVerificationMetadata: {
        verificationLevel: result.verificationLevel,
        documentVerified: result.documentVerified,
        faceMatchVerified: false,
        livenessVerified: false,
        biometricStored: false,
        rawReference: result.rawReference,
      },
      ...attestationFields,
      status: nextStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await appendArtAuditEvent({
      orgId: input.orgId,
      recipientId: input.recipient.id,
      type: verified ? "IDENTITY_VERIFIED" : "IDENTITY_STARTED",
      actor: input.actor,
      source: "art",
      metadata: {
        provider: result.provider,
        transactionId: result.transactionId,
        verified,
        identityVerificationMethod: attestation?.identityVerificationMethod || null,
        identityVerifiedBy: attestation?.identityVerifiedBy || null,
        identitySource: attestation?.identitySource || null,
        identityExternalReference: attestation?.identityExternalReference || null,
        identityAssuranceLevel: attestation?.identityAssuranceLevel || null,
      },
    });
    if (verified) {
      await emitArtWebhook({
        orgId: input.orgId,
        type: "art.identity.verified",
        data: {
          recipient_id: input.recipient.id,
          provider: result.provider,
          identity_verification_method: attestation?.identityVerificationMethod || null,
        },
      });
    }
    return {
      ...input.recipient,
      status: nextStatus,
      identityProvider: result.provider,
      identityVerificationId: result.transactionId,
      identityVerificationStatus: verified ? "verified" : "pending",
      identityVerificationAt: verified ? result.verifiedAt : null,
      ...(attestation && verified
        ? {
            identityPrevalidatedByArt: Boolean(attestationFields.identityPrevalidatedByArt),
            identityVerificationMethod: attestation.identityVerificationMethod,
            identityVerifiedAt: attestation.identityVerifiedAt,
            identitySource: attestation.identitySource,
            identityExternalReference: attestation.identityExternalReference,
            identityVerifiedBy: attestation.identityVerifiedBy,
            identityAssuranceLevel: attestation.identityAssuranceLevel,
            identityMetadata: attestation.identityMetadata,
          }
        : {}),
    };
  } catch (e) {
    if (e instanceof IdentityProviderNotConfiguredError) {
      await getAdminDb().collection(ART_COLLECTIONS.recipients).doc(input.recipient.id).update({
        identityVerificationStatus: "pending",
        status: "identity_pending",
        identityProvider: e.provider,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { ...input.recipient, status: "identity_pending", identityVerificationStatus: "pending", identityProvider: e.provider };
    }
    await appendArtAuditEvent({
      orgId: input.orgId,
      recipientId: input.recipient.id,
      type: "IDENTITY_FAILED",
      actor: input.actor,
      source: "art",
      metadata: { error: e instanceof Error ? e.message : "identity_failed" },
    });
    await emitArtWebhook({
      orgId: input.orgId,
      type: "art.identity.failed",
      data: { recipient_id: input.recipient.id },
    });
    throw e;
  }
}
