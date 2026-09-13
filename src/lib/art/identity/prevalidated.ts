import { newArtSecret } from "@/lib/art/tokens";
import type { IdentityProvider, IdentityCheckInput, IdentityStartInput } from "@/lib/art/identity/types";
import { emptyIdentityResult } from "@/lib/art/identity/types";
import type { NormalizedIdentityResult } from "@/lib/art/types";

/**
 * Proveedor inicial: la ART declara identidad con attestation auditable.
 * Un boolean identityVerified/prevalidatedByArt no alcanza.
 * Nunca guarda biometría. WhatsApp AUTH / RENAPER / Didit no están activos aquí.
 */
export class ManualOrPrevalidatedIdentityProvider implements IdentityProvider {
  readonly id = "ART_PREVALIDATED" as const;

  async startVerification(input: IdentityStartInput): Promise<NormalizedIdentityResult> {
    const transactionId = `idp_pre_${newArtSecret(12)}`;
    const attestation = input.attestation;
    if (!attestation) {
      return emptyIdentityResult(this.id, transactionId, { verificationLevel: "none" });
    }
    return {
      provider: this.id,
      transactionId,
      verified: true,
      verifiedAt: attestation.identityVerifiedAt,
      verificationLevel: "prevalidated",
      documentVerified: true,
      faceMatchVerified: false,
      livenessVerified: false,
      score: null,
      rawReference: attestation.identityExternalReference,
    };
  }

  async checkVerification(input: IdentityCheckInput): Promise<NormalizedIdentityResult> {
    return emptyIdentityResult(this.id, input.transactionId);
  }

  normalizeResult(raw: unknown): NormalizedIdentityResult {
    const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const verified = obj.verified === true && typeof obj.identityVerifiedBy === "string";
    return {
      provider: this.id,
      transactionId: String(obj.transactionId || obj.identityVerificationId || ""),
      verified,
      verifiedAt: verified ? String(obj.verifiedAt || obj.identityVerifiedAt || new Date().toISOString()) : null,
      verificationLevel: verified ? "prevalidated" : "none",
      documentVerified: verified,
      faceMatchVerified: false,
      livenessVerified: false,
      score: null,
      rawReference: typeof obj.rawReference === "string" ? obj.rawReference : null,
    };
  }
}
