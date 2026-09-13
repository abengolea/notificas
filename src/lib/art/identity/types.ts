import type { IdentityAttestation } from "@/lib/art/identity-attestation";
import type { ArtIdentityProviderId, NormalizedIdentityResult } from "@/lib/art/types";

export type IdentityStartInput = {
  orgId: string;
  recipientId: string;
  dni: string;
  cuil: string;
  fullName: string;
  /** @deprecated no verifica por sí solo; usar attestation */
  prevalidatedByArt?: boolean;
  attestation?: IdentityAttestation | null;
};

export type IdentityCheckInput = {
  orgId: string;
  recipientId: string;
  transactionId: string;
};

export interface IdentityProvider {
  id: ArtIdentityProviderId;
  startVerification(input: IdentityStartInput): Promise<NormalizedIdentityResult>;
  checkVerification(input: IdentityCheckInput): Promise<NormalizedIdentityResult>;
  normalizeResult(raw: unknown): NormalizedIdentityResult;
}

export class IdentityProviderNotConfiguredError extends Error {
  readonly provider: ArtIdentityProviderId;
  constructor(provider: ArtIdentityProviderId) {
    super(`Identity provider ${provider} is not configured yet.`);
    this.name = "IdentityProviderNotConfiguredError";
    this.provider = provider;
  }
}

export function emptyIdentityResult(
  provider: ArtIdentityProviderId,
  transactionId: string,
  extras?: Partial<NormalizedIdentityResult>
): NormalizedIdentityResult {
  return {
    provider,
    transactionId,
    verified: false,
    verifiedAt: null,
    verificationLevel: "none",
    documentVerified: false,
    faceMatchVerified: false,
    livenessVerified: false,
    score: null,
    rawReference: null,
    ...extras,
  };
}
