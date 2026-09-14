import { maskCuil, maskDocument, maskEmail, maskFullName, maskPhone } from "@/lib/art/mask";
import type { ArtRecipient } from "@/lib/art/types";

export function publicInviteView(input: {
  orgName: string;
  orgLogoUrl?: string | null;
  recipient: ArtRecipient;
  termsTitle: string;
  termsContent: string;
  termsVersion: string;
  termsHash: string;
}) {
  return {
    art: { name: input.orgName, logoUrl: input.orgLogoUrl || null },
    contact: {
      phone: maskPhone(input.recipient.phone),
      email: maskEmail(input.recipient.email),
    },
    identity: {
      dni: maskDocument(input.recipient.dni),
      cuil: maskCuil(input.recipient.cuil),
      fullName: maskFullName(input.recipient.fullName),
      hasPrefilled: Boolean(input.recipient.dni && input.recipient.cuil && input.recipient.fullName),
    },
    status: input.recipient.status,
    phoneVerified: input.recipient.phoneVerified,
    emailVerified: input.recipient.emailVerified,
    identityStatus: input.recipient.identityVerificationStatus,
    terms: {
      title: input.termsTitle,
      content: input.termsContent,
      version: input.termsVersion,
      hash: input.termsHash,
    },
    copy: {
      voluntary: true,
      canRevoke: true,
      intro: `La adhesión es voluntaria. Podrás revocarla posteriormente. Vas a confirmar tus datos y después te mandamos un código por WhatsApp: ese código se carga acá, en este enlace que te llegó por mail.`,
    },
  };
}

export function empresaRecipientView(r: ArtRecipient) {
  return {
    id: r.id,
    fullName: r.fullName,
    cuil: r.cuil,
    dni: r.dni,
    phone: r.phone,
    email: r.email,
    relation: r.relation,
    status: r.status,
    identity: r.identityVerificationStatus,
    identityProvider: r.identityProvider,
    identityVerificationMethod: r.identityVerificationMethod,
    identityVerifiedBy: r.identityVerifiedBy,
    identitySource: r.identitySource,
    phoneVerified: r.phoneVerified,
    emailVerified: r.emailVerified,
    activatedAt: r.activatedAt,
    updatedAt: r.updatedAt,
    adhesionId: r.adhesionId,
    revalidationRequired: r.revalidationRequired,
  };
}

export function publicApiRecipientView(r: ArtRecipient) {
  return {
    id: r.id,
    status: r.status,
    full_name: r.fullName,
    cuil: r.cuil,
    dni: r.dni,
    phone: r.phone,
    email: r.email || null,
    relation: r.relation,
    identity_status: r.identityVerificationStatus,
    identity_provider: r.identityProvider,
    identity_verification_method: r.identityVerificationMethod,
    identity_verified_at: r.identityVerifiedAt,
    identity_source: r.identitySource,
    identity_external_reference: r.identityExternalReference,
    identity_verified_by: r.identityVerifiedBy,
    identity_assurance_level: r.identityAssuranceLevel,
    phone_verified: r.phoneVerified,
    email_verified: r.emailVerified,
    adhesion_id: r.adhesionId,
    activated_at: r.activatedAt,
    revoked_at: r.revokedAt,
    external_id: r.externalId,
  };
}
