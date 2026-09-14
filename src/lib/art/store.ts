import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { ART_COLLECTIONS } from "@/lib/art/collections";
import { DEFAULT_ART_CONFIG, parseArtPersonRelation, type ArtConfig, type ArtPersonRelation, type ArtRecipient, type ArtRecipientStatus } from "@/lib/art/types";
import { attestationToRecipientFields, type IdentityAttestation } from "@/lib/art/identity-attestation";
import { newArtRecipientId, newArtTermsId, normalizeCuil, normalizeDni, normalizeEmail } from "@/lib/art/ids";
import { hashTermsContent, placeholderTermsContent, PLACEHOLDER_TERMS_TITLE } from "@/lib/art/terms";
import { toWhatsAppPhone } from "@/lib/parse-campaign-csv";
import type { ArtBulkRowParsed } from "@/lib/art/bulk-parse";
import { lookupKey } from "@/lib/art/bulk-parse";
import { evidenceRetentionYears, throwArtCode, assertPilotRecipientAllowed } from "@/lib/art/pilot";

function isoNow(): string {
  return new Date().toISOString();
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export async function getOrCreateArtConfig(orgId: string, orgName?: string): Promise<ArtConfig> {
  const db = getAdminDb();
  const ref = db.collection(ART_COLLECTIONS.configs).doc(orgId);
  const snap = await ref.get();
  if (snap.exists) {
    const d = snap.data() || {};
    return {
      orgId,
      requirePhoneVerification: d.otpChannel === "whatsapp" || d.otpChannel === "sms" ? d.requirePhoneVerification !== false : false,
      requireEmailVerification: d.otpChannel === "whatsapp" || d.otpChannel === "sms" ? d.requireEmailVerification === true : true,
      requireIdentityVerification: d.requireIdentityVerification !== false,
      requireLiveness: d.requireLiveness === true,
      revalidateOnPhoneChange: d.revalidateOnPhoneChange !== false,
      revalidateOnEmailChange: d.revalidateOnEmailChange !== false,
      allowPrevalidatedIdentity: d.allowPrevalidatedIdentity !== false,
      identityProvider: d.identityProvider === "RENAPER" || d.identityProvider === "DIDIT" ? d.identityProvider : "ART_PREVALIDATED",
      termsVersionId: typeof d.termsVersionId === "string" ? d.termsVersionId : null,
      evidenceRetentionYears: evidenceRetentionYears(),
      inviteChannel: d.inviteChannel === "whatsapp" ? "whatsapp" : "email",
      otpChannel: d.otpChannel === "whatsapp" || d.otpChannel === "sms" ? d.otpChannel : "email",
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }

  const termsId = newArtTermsId();
  const content = placeholderTermsContent(orgName || "la organización");
  await db.collection(ART_COLLECTIONS.terms).doc(termsId).set({
    id: termsId,
    version: "draft-1",
    orgId,
    title: PLACEHOLDER_TERMS_TITLE,
    content,
    documentUrl: null,
    documentHash: hashTermsContent(content),
    effectiveFrom: isoNow(),
    createdAt: FieldValue.serverTimestamp(),
    active: true,
  });

  const config: ArtConfig = {
    ...DEFAULT_ART_CONFIG,
    orgId,
    termsVersionId: termsId,
    evidenceRetentionYears: evidenceRetentionYears(),
  };
  await ref.set({
    ...config,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return config;
}

export async function updateArtConfig(orgId: string, patch: Partial<ArtConfig>): Promise<ArtConfig> {
  if (patch.identityProvider === "RENAPER" || patch.identityProvider === "DIDIT") {
    throw Object.assign(new Error("identity_provider_not_available"), {
      code: "identity_provider_not_available",
      httpStatus: 400,
    });
  }
  if (patch.requireLiveness === true) {
    throw Object.assign(new Error("liveness_not_available"), {
      code: "liveness_not_available",
      httpStatus: 400,
    });
  }
  const current = await getOrCreateArtConfig(orgId);
  const next = { ...current, ...patch, orgId, evidenceRetentionYears: evidenceRetentionYears() };
  await getAdminDb().collection(ART_COLLECTIONS.configs).doc(orgId).set(
    { ...next, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  return next;
}

export async function getActiveTerms(orgId: string, orgName?: string) {
  const config = await getOrCreateArtConfig(orgId, orgName);
  const db = getAdminDb();
  if (config.termsVersionId) {
    const snap = await db.collection(ART_COLLECTIONS.terms).doc(config.termsVersionId).get();
    if (snap.exists) return { id: snap.id, ...(snap.data() as object) } as {
      id: string;
      version: string;
      title: string;
      content: string;
      documentHash: string;
    };
  }
  const q = await db.collection(ART_COLLECTIONS.terms).where("orgId", "==", orgId).where("active", "==", true).limit(1).get();
  if (!q.empty) {
    const d = q.docs[0];
    return { id: d.id, ...(d.data() as object) } as {
      id: string;
      version: string;
      title: string;
      content: string;
      documentHash: string;
    };
  }
  const created = await getOrCreateArtConfig(orgId, orgName);
  const snap = await db.collection(ART_COLLECTIONS.terms).doc(String(created.termsVersionId)).get();
  return { id: snap.id, ...(snap.data() as object) } as {
    id: string;
    version: string;
    title: string;
    content: string;
    documentHash: string;
  };
}

export function mapRecipient(id: string, d: FirebaseFirestore.DocumentData): ArtRecipient {
  return {
    id,
    orgId: str(d.orgId),
    externalId: d.externalId ? str(d.externalId) : null,
    dni: str(d.dni),
    cuil: str(d.cuil),
    fullName: str(d.fullName),
    firstName: str(d.firstName),
    lastName: str(d.lastName),
    phone: str(d.phone),
    email: str(d.email),
    relation: parseArtPersonRelation(d.relation),
    status: (d.status as ArtRecipientStatus) || "pending",
    identityProvider: d.identityProvider || null,
    identityVerificationId: d.identityVerificationId || null,
    identityVerificationStatus: d.identityVerificationStatus || "none",
    identityVerificationAt: d.identityVerificationAt || null,
    identityVerificationMetadata: d.identityVerificationMetadata || null,
    identityPrevalidatedByArt: d.identityPrevalidatedByArt === true,
    identityVerificationMethod: d.identityVerificationMethod || null,
    identityVerifiedAt: d.identityVerifiedAt || d.identityVerificationAt || null,
    identitySource: d.identitySource || null,
    identityExternalReference: d.identityExternalReference || null,
    identityVerifiedBy: d.identityVerifiedBy || null,
    identityAssuranceLevel: d.identityAssuranceLevel || null,
    identityMetadata: d.identityMetadata || null,
    phoneVerified: d.phoneVerified === true,
    phoneVerifiedAt: d.phoneVerifiedAt || null,
    emailVerified: d.emailVerified === true,
    emailVerifiedAt: d.emailVerifiedAt || null,
    revalidationRequired: d.revalidationRequired === true,
    termsVersion: d.termsVersion || null,
    termsDocumentHash: d.termsDocumentHash || null,
    termsAcceptedAt: d.termsAcceptedAt || null,
    consentIp: d.consentIp || null,
    consentUserAgent: d.consentUserAgent || null,
    consentSessionId: d.consentSessionId || null,
    adhesionId: d.adhesionId || null,
    activatedAt: d.activatedAt || null,
    revokedAt: d.revokedAt || null,
    revokeReason: d.revokeReason || null,
    lastEventHash: d.lastEventHash || null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export async function getRecipient(orgId: string, recipientId: string): Promise<ArtRecipient | null> {
  const snap = await getAdminDb().collection(ART_COLLECTIONS.recipients).doc(recipientId).get();
  if (!snap.exists) return null;
  const rec = mapRecipient(snap.id, snap.data() || {});
  if (rec.orgId !== orgId) return null;
  return rec;
}

export async function findRecipientByCuil(orgId: string, cuil: string): Promise<ArtRecipient | null> {
  const digits = normalizeCuil(cuil);
  if (!digits) return null;
  const snap = await getAdminDb()
    .collection(ART_COLLECTIONS.recipients)
    .where("orgId", "==", orgId)
    .where("cuil", "==", digits)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return mapRecipient(snap.docs[0].id, snap.docs[0].data());
}

export async function findRecipientForSrt(orgId: string, hints: { cuil?: string; dni?: string; phone?: string; email?: string; recipientId?: string }): Promise<ArtRecipient | null> {
  if (hints.recipientId) {
    const byId = await getRecipient(orgId, hints.recipientId);
    if (byId) return byId;
  }
  if (hints.cuil) {
    const byCuil = await findRecipientByCuil(orgId, hints.cuil);
    if (byCuil) return byCuil;
  }
  const db = getAdminDb();
  if (hints.dni) {
    const dni = normalizeDni(hints.dni);
    const snap = await db.collection(ART_COLLECTIONS.recipients).where("orgId", "==", orgId).where("dni", "==", dni).limit(1).get();
    if (!snap.empty) return mapRecipient(snap.docs[0].id, snap.docs[0].data());
  }
  if (hints.phone) {
    const phone = toWhatsAppPhone(hints.phone) || hints.phone;
    const snap = await db.collection(ART_COLLECTIONS.recipients).where("orgId", "==", orgId).where("phone", "==", phone).limit(1).get();
    if (!snap.empty) return mapRecipient(snap.docs[0].id, snap.docs[0].data());
  }
  if (hints.email) {
    const email = normalizeEmail(hints.email);
    const snap = await db.collection(ART_COLLECTIONS.recipients).where("orgId", "==", orgId).where("email", "==", email).limit(1).get();
    if (!snap.empty) return mapRecipient(snap.docs[0].id, snap.docs[0].data());
  }
  return null;
}

export async function upsertRecipient(input: {
  orgId: string;
  cuil: string;
  dni: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  phone: string;
  email?: string;
  externalId?: string | null;
  identityPrevalidatedByArt?: boolean;
  identityAttestation?: IdentityAttestation | null;
  relation?: ArtPersonRelation;
}): Promise<{ recipient: ArtRecipient; created: boolean }> {
  throwArtCode(assertPilotRecipientAllowed({ orgId: input.orgId, email: input.email, phone: input.phone }));
  const cuil = normalizeCuil(input.cuil);
  const dni = normalizeDni(input.dni);
  const phone = toWhatsAppPhone(input.phone) || input.phone;
  const email = normalizeEmail(input.email);
  const existing = await findRecipientByCuil(input.orgId, cuil);
  const now = isoNow();
  const db = getAdminDb();

  if (existing) {
    const updates: Record<string, unknown> = {
      dni,
      fullName: input.fullName.trim(),
      firstName: (input.firstName || existing.firstName).trim(),
      lastName: (input.lastName || existing.lastName).trim(),
      lookupKey: lookupKey(input.orgId, cuil),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (input.externalId !== undefined) updates.externalId = input.externalId;
    if (input.identityPrevalidatedByArt === true && !input.identityAttestation) {
      throw Object.assign(new Error("identity_attestation_required"), {
        code: "identity_attestation_required",
        httpStatus: 400,
      });
    }
    if (input.identityAttestation) {
      Object.assign(updates, attestationToRecipientFields(input.identityAttestation));
      if (existing.status === "pending" || existing.status === "identity_pending") {
        updates.status = "adhesion_pending";
      }
    }
    if (phone && phone !== existing.phone) {
      updates.pendingPhone = phone;
    } else if (phone) {
      updates.phone = phone;
    }
    if (email) updates.email = email;
    if (input.relation) updates.relation = parseArtPersonRelation(input.relation);
    await db.collection(ART_COLLECTIONS.recipients).doc(existing.id).update(updates);
    const fresh = await getRecipient(input.orgId, existing.id);
    return { recipient: fresh!, created: false };
  }

  const id = newArtRecipientId();
  if (input.identityPrevalidatedByArt === true && !input.identityAttestation) {
    throw Object.assign(new Error("identity_attestation_required"), {
      code: "identity_attestation_required",
      httpStatus: 400,
    });
  }
  const attestation = input.identityAttestation || null;
  const pre = Boolean(attestation);
  const status: ArtRecipientStatus = pre ? "adhesion_pending" : "identity_pending";
  const attestationFields = attestation ? attestationToRecipientFields(attestation) : {};
  const doc = {
    orgId: input.orgId,
    externalId: input.externalId || null,
    dni,
    cuil,
    fullName: input.fullName.trim(),
    firstName: (input.firstName || "").trim(),
    lastName: (input.lastName || "").trim(),
    phone,
    email,
    relation: parseArtPersonRelation(input.relation),
    lookupKey: lookupKey(input.orgId, cuil),
    status,
    identityProvider: pre ? attestationFields.identityProvider || "ART_PREVALIDATED" : null,
    identityVerificationId: null,
    identityVerificationStatus: pre ? "verified" : "pending",
    identityVerificationAt: pre ? now : null,
    identityVerificationMetadata: pre ? { provider: "ART_PREVALIDATED", biometricStored: false } : null,
    identityPrevalidatedByArt: pre,
    identityVerificationMethod: attestation?.identityVerificationMethod || null,
    identityVerifiedAt: attestation?.identityVerifiedAt || null,
    identitySource: attestation?.identitySource || null,
    identityExternalReference: attestation?.identityExternalReference || null,
    identityVerifiedBy: attestation?.identityVerifiedBy || null,
    identityAssuranceLevel: attestation?.identityAssuranceLevel || null,
    identityMetadata: attestation?.identityMetadata || null,
    phoneVerified: false,
    phoneVerifiedAt: null,
    emailVerified: false,
    emailVerifiedAt: null,
    revalidationRequired: false,
    termsVersion: null,
    termsDocumentHash: null,
    termsAcceptedAt: null,
    consentIp: null,
    consentUserAgent: null,
    consentSessionId: null,
    adhesionId: null,
    activatedAt: null,
    revokedAt: null,
    revokeReason: null,
    lastEventHash: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await db.collection(ART_COLLECTIONS.recipients).doc(id).set(doc);
  return { recipient: mapRecipient(id, doc), created: true };
}

export async function upsertFromBulkRow(
  orgId: string,
  row: ArtBulkRowParsed,
  attestation: IdentityAttestation | null
) {
  return upsertRecipient({
    orgId,
    cuil: row.cuil,
    dni: row.dni,
    fullName: row.fullName,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    email: row.email,
    externalId: row.externalId,
    identityPrevalidatedByArt: Boolean(attestation),
    identityAttestation: attestation,
  });
}

export async function listRecipients(orgId: string, opts: {
  status?: string;
  limit?: number;
  cursor?: string;
}) {
  const limit = Math.min(Math.max(opts.limit || 50, 1), 100);
  let q: FirebaseFirestore.Query = getAdminDb()
    .collection(ART_COLLECTIONS.recipients)
    .where("orgId", "==", orgId);
  if (opts.status && opts.status !== "all") {
    if (opts.status === "pending_group") {
      q = q.where("status", "in", ["pending", "identity_pending", "adhesion_pending"]);
    } else if (opts.status === "not_adhered") {
      q = q.where("status", "in", ["pending", "identity_pending", "adhesion_pending", "rejected"]);
    } else {
      q = q.where("status", "==", opts.status);
    }
  }
  q = q.orderBy("updatedAt", "desc").limit(limit + 1);
  const snap = await q.get();
  const docs = snap.docs.slice(0, limit);
  return {
    recipients: docs.map((d) => mapRecipient(d.id, d.data())),
    nextCursor: snap.docs.length > limit ? docs[docs.length - 1].id : null,
  };
}
