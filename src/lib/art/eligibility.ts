import type { ArtConfig, ArtEligibility, ArtRecipient, ArtRecipientStatus } from "@/lib/art/types";
import { identitySatisfiesConfig } from "@/lib/art/identity-attestation";

/** El teléfono solo se exige cuando exista un canal OTP que lo pueda verificar. */
export function phoneVerificationEnforced(config: ArtConfig): boolean {
  return config.requirePhoneVerification === true && config.otpChannel !== "email";
}

export function emailVerificationEnforced(config: ArtConfig): boolean {
  return config.requireEmailVerification === true;
}

export function isTerminalBlockedStatus(status: ArtRecipientStatus): boolean {
  return status === "revoked" || status === "suspended" || status === "rejected" || status === "requires_conventional_channel";
}

export function evaluateEligibility(input: {
  moduleEnabled: boolean;
  recipient: ArtRecipient | null;
  config: ArtConfig;
}): ArtEligibility {
  if (!input.moduleEnabled) {
    return {
      eligibleForElectronicNotification: false,
      reason: "MODULE_DISABLED",
      conventionalChannelRequired: true,
      status: input.recipient?.status ?? null,
      recipientId: input.recipient?.id ?? null,
    };
  }

  const r = input.recipient;
  if (!r) {
    return {
      eligibleForElectronicNotification: false,
      reason: "NO_ADHESION",
      conventionalChannelRequired: true,
      status: null,
      recipientId: null,
    };
  }

  if (r.status === "revoked") {
    return blocked(r, "REVOKED");
  }
  if (r.status === "suspended") {
    return blocked(r, "SUSPENDED");
  }
  if (r.status === "rejected" || r.status === "requires_conventional_channel") {
    return blocked(r, "OTHER");
  }
  if (r.status !== "active" || !r.adhesionId || !r.termsAcceptedAt) {
    return blocked(r, "NO_ADHESION");
  }
  if (r.revalidationRequired) {
    return blocked(r, "CONTACT_NOT_VERIFIED");
  }

  if (input.config.requireIdentityVerification && !identitySatisfiesConfig(r, input.config)) {
    return blocked(r, "IDENTITY_NOT_VERIFIED");
  }

  if (phoneVerificationEnforced(input.config) && !r.phoneVerified) {
    return blocked(r, "CONTACT_NOT_VERIFIED");
  }
  if (emailVerificationEnforced(input.config) && r.email && !r.emailVerified) {
    return blocked(r, "CONTACT_NOT_VERIFIED");
  }

  return {
    eligibleForElectronicNotification: true,
    reason: "OK",
    conventionalChannelRequired: false,
    status: r.status,
    recipientId: r.id,
  };
}

function blocked(r: ArtRecipient, reason: ArtEligibility["reason"]): ArtEligibility {
  return {
    eligibleForElectronicNotification: false,
    reason,
    conventionalChannelRequired: true,
    status: r.status,
    recipientId: r.id,
  };
}

export function statusAfterIdentity(input: {
  current: ArtRecipientStatus;
  verified: boolean;
  requireIdentity: boolean;
}): ArtRecipientStatus {
  if (isTerminalBlockedStatus(input.current) && input.current !== "requires_conventional_channel") {
    return input.current;
  }
  if (!input.verified) return "identity_pending";
  if (input.current === "active") return "active";
  return "adhesion_pending";
}

export function canAcceptAdhesion(input: {
  status: ArtRecipientStatus;
  phoneVerified: boolean;
  emailVerified: boolean;
  identityVerified: boolean;
  config: ArtConfig;
  termsAcceptedCheckbox: boolean;
  explicitAcceptAction: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.termsAcceptedCheckbox || !input.explicitAcceptAction) {
    return { ok: false, reason: "positive_action_required" };
  }
  if (input.status === "revoked") return { ok: false, reason: "revoked" };
  if (input.status === "suspended") return { ok: false, reason: "suspended" };
  if (input.status === "rejected") return { ok: false, reason: "rejected" };
  if (phoneVerificationEnforced(input.config) && !input.phoneVerified) {
    return { ok: false, reason: "phone_not_verified" };
  }
  if (emailVerificationEnforced(input.config) && !input.emailVerified) {
    return { ok: false, reason: "email_not_verified" };
  }
  if (input.config.requireIdentityVerification && !input.identityVerified) {
    return { ok: false, reason: "identity_not_verified" };
  }
  return { ok: true };
}
