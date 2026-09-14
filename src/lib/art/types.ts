export const ART_RECIPIENT_STATUSES = [
  "pending",
  "identity_pending",
  "identity_verified",
  "adhesion_pending",
  "active",
  "rejected",
  "revoked",
  "suspended",
  "requires_conventional_channel",
] as const;

export type ArtRecipientStatus = (typeof ART_RECIPIENT_STATUSES)[number];

export const ART_ELIGIBILITY_REASONS = [
  "OK",
  "NO_ADHESION",
  "REVOKED",
  "IDENTITY_NOT_VERIFIED",
  "CONTACT_NOT_VERIFIED",
  "SUSPENDED",
  "MODULE_DISABLED",
  "ART_MODULE_NOT_AVAILABLE",
  "OTHER",
] as const;

export type ArtEligibilityReason = (typeof ART_ELIGIBILITY_REASONS)[number];

export const ART_IDENTITY_PROVIDERS = ["ART_PREVALIDATED", "RENAPER", "DIDIT", "MANUAL"] as const;
export type ArtIdentityProviderId = (typeof ART_IDENTITY_PROVIDERS)[number];

export const ART_AUDIT_EVENT_TYPES = [
  "INVITATION_CREATED",
  "INVITATION_SENT",
  "INVITATION_DELIVERED",
  "LINK_OPENED",
  "OTP_SENT",
  "OTP_VERIFIED",
  "IDENTITY_STARTED",
  "IDENTITY_VERIFIED",
  "IDENTITY_FAILED",
  "TERMS_VIEWED",
  "ADHESION_ACCEPTED",
  "ADHESION_REVOKED",
  "CONTACT_CHANGED",
  "REVALIDATION_REQUIRED",
  "NOTIFICATION_SENT",
  "NOTIFICATION_DELIVERED",
  "NOTIFICATION_READ",
  "NOTIFICATION_FAILED",
  "CONVENTIONAL_CHANNEL_REQUIRED",
  "SUSPENDED",
  "REACTIVATED",
] as const;

export type ArtAuditEventType = (typeof ART_AUDIT_EVENT_TYPES)[number];

export const ART_WEBHOOK_EVENT_TYPES = [
  "art.adhesion.created",
  "art.adhesion.activated",
  "art.adhesion.revoked",
  "art.identity.verified",
  "art.identity.failed",
  "art.contact.changed",
  "art.recipient.requires_conventional_channel",
] as const;

export type ArtWebhookEventType = (typeof ART_WEBHOOK_EVENT_TYPES)[number];

export type ArtOtpChannel = "email" | "whatsapp" | "sms";

export const ART_BLOCKCHAIN_STATUSES = [
  "HASH_GENERATED",
  "BLOCKCHAIN_PENDING",
  "BLOCKCHAIN_ANCHORED",
  "BLOCKCHAIN_FAILED",
] as const;

export type ArtBlockchainStatus = (typeof ART_BLOCKCHAIN_STATUSES)[number];

export type ArtIdentityVerificationMethod =
  | "ART_INTERNAL_KYC"
  | "RENAPER"
  | "DIDIT"
  | "PRESENCIAL"
  | "OTHER";

export type ArtConfig = {
  orgId: string;
  requirePhoneVerification: boolean;
  requireEmailVerification: boolean;
  requireIdentityVerification: boolean;
  requireLiveness: boolean;
  revalidateOnPhoneChange: boolean;
  revalidateOnEmailChange: boolean;
  allowPrevalidatedIdentity: boolean;
  identityProvider: ArtIdentityProviderId;
  termsVersionId: string | null;
  /** Intención de conservación. No configura por sí sola el bucket WORM. */
  evidenceRetentionYears: number;
  inviteChannel: ArtOtpChannel;
  otpChannel: ArtOtpChannel;
  updatedAt?: unknown;
  createdAt?: unknown;
};

export const DEFAULT_ART_CONFIG: Omit<ArtConfig, "orgId"> = {
  requirePhoneVerification: false,
  requireEmailVerification: true,
  requireIdentityVerification: true,
  requireLiveness: false,
  revalidateOnPhoneChange: true,
  revalidateOnEmailChange: true,
  allowPrevalidatedIdentity: true,
  identityProvider: "ART_PREVALIDATED",
  termsVersionId: null,
  evidenceRetentionYears: 5,
  inviteChannel: "email",
  otpChannel: "email",
};

export const ART_PERSON_RELATIONS = ["trabajador", "cliente", "otro"] as const;
export type ArtPersonRelation = (typeof ART_PERSON_RELATIONS)[number];

export function parseArtPersonRelation(raw: unknown): ArtPersonRelation {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "cliente" || v === "otro") return v;
  return "trabajador";
}

export function artPersonRelationLabel(raw: unknown): string {
  const v = parseArtPersonRelation(raw);
  if (v === "cliente") return "Cliente";
  if (v === "otro") return "Otro";
  return "Trabajador";
}

export type ArtRecipient = {
  id: string;
  orgId: string;
  externalId: string | null;
  dni: string;
  cuil: string;
  fullName: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  /** Vínculo con la empresa. No cambia el régimen de adhesión. */
  relation: ArtPersonRelation;
  status: ArtRecipientStatus;
  identityProvider: ArtIdentityProviderId | null;
  identityVerificationId: string | null;
  identityVerificationStatus: "none" | "pending" | "verified" | "failed";
  identityVerificationAt: string | null;
  identityVerificationMetadata: Record<string, unknown> | null;
  identityPrevalidatedByArt: boolean;
  identityVerificationMethod: ArtIdentityVerificationMethod | null;
  identityVerifiedAt: string | null;
  identitySource: string | null;
  identityExternalReference: string | null;
  identityVerifiedBy: string | null;
  identityAssuranceLevel: string | null;
  identityMetadata: Record<string, unknown> | null;
  phoneVerified: boolean;
  phoneVerifiedAt: string | null;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  revalidationRequired: boolean;
  termsVersion: string | null;
  termsDocumentHash: string | null;
  termsAcceptedAt: string | null;
  consentIp: string | null;
  consentUserAgent: string | null;
  consentSessionId: string | null;
  adhesionId: string | null;
  activatedAt: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  lastEventHash: string | null;
  createdAt: unknown;
  updatedAt: unknown;
};

export type ArtEligibility = {
  eligibleForElectronicNotification: boolean;
  reason: ArtEligibilityReason;
  conventionalChannelRequired: boolean;
  status: ArtRecipientStatus | null;
  recipientId: string | null;
};

export type NormalizedIdentityResult = {
  provider: ArtIdentityProviderId;
  transactionId: string;
  verified: boolean;
  verifiedAt: string | null;
  verificationLevel: "none" | "prevalidated" | "document" | "liveness";
  documentVerified: boolean;
  faceMatchVerified: boolean;
  livenessVerified: boolean;
  score: number | null;
  rawReference: string | null;
};

export type ArtTermsVersion = {
  id: string;
  version: string;
  orgId: string | null;
  title: string;
  content: string;
  documentUrl: string | null;
  documentHash: string;
  effectiveFrom: string;
  createdAt: unknown;
  active: boolean;
};

export type ArtAuditEvent = {
  eventId: string;
  timestamp: string;
  orgId: string;
  recipientId: string | null;
  type: ArtAuditEventType;
  actor: string;
  source: string;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  previousHash: string | null;
  eventHash: string;
  polygonTxHash: string | null;
  blockchainStatus: ArtBlockchainStatus;
};

export type SrtNotificationType = "ORDINARY" | "SRT_ART";
