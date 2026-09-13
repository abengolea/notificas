import type { ArtConfig, ArtRecipient } from "@/lib/art/types";

export const ART_IDENTITY_METHODS = [
  "ART_INTERNAL_KYC",
  "RENAPER",
  "DIDIT",
  "PRESENCIAL",
  "OTHER",
] as const;

export type ArtIdentityVerificationMethod = (typeof ART_IDENTITY_METHODS)[number];

const PREDECLARED_METHODS = new Set<ArtIdentityVerificationMethod>([
  "ART_INTERNAL_KYC",
  "PRESENCIAL",
  "OTHER",
]);

export type IdentityAttestation = {
  identityVerificationMethod: ArtIdentityVerificationMethod;
  identityVerifiedAt: string;
  identitySource: string;
  identityExternalReference: string | null;
  identityVerifiedBy: string;
  identityAssuranceLevel: string;
  identityMetadata: Record<string, unknown>;
};

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function isMethod(v: string): v is ArtIdentityVerificationMethod {
  return (ART_IDENTITY_METHODS as readonly string[]).includes(v);
}

export function parseIdentityAttestation(
  raw: unknown,
  fallbacks?: { verifiedBy?: string; source?: string; verifiedAt?: string }
): { ok: true; value: IdentityAttestation } | { ok: false; reason: string } {
  const obj = asRecord(raw);
  const methodRaw = pickString(obj, ["identityVerificationMethod", "identity_verification_method", "method"]);
  if (!isMethod(methodRaw)) {
    return { ok: false, reason: "identity_verification_method_required" };
  }
  const verifiedBy =
    pickString(obj, ["identityVerifiedBy", "identity_verified_by", "verified_by"]) ||
    (fallbacks?.verifiedBy || "").trim();
  if (!verifiedBy) return { ok: false, reason: "identity_verified_by_required" };
  const source =
    pickString(obj, ["identitySource", "identity_source", "source"]) ||
    (fallbacks?.source || "").trim();
  if (!source) return { ok: false, reason: "identity_source_required" };
  const verifiedAt =
    pickString(obj, ["identityVerifiedAt", "identity_verified_at", "verified_at"]) ||
    (fallbacks?.verifiedAt || new Date().toISOString());
  if (!Number.isFinite(Date.parse(verifiedAt))) {
    return { ok: false, reason: "identity_verified_at_invalid" };
  }
  const assurance =
    pickString(obj, ["identityAssuranceLevel", "identity_assurance_level", "assurance_level"]) ||
    "ART_DECLARED";
  const externalRaw = pickString(obj, [
    "identityExternalReference",
    "identity_external_reference",
    "external_reference",
  ]);
  const metaRaw = obj.identityMetadata ?? obj.identity_metadata ?? obj.metadata;
  const metadata =
    metaRaw && typeof metaRaw === "object" && !Array.isArray(metaRaw)
      ? (metaRaw as Record<string, unknown>)
      : {};
  return {
    ok: true,
    value: {
      identityVerificationMethod: methodRaw,
      identityVerifiedAt: verifiedAt,
      identitySource: source,
      identityExternalReference: externalRaw || null,
      identityVerifiedBy: verifiedBy,
      identityAssuranceLevel: assurance,
      identityMetadata: metadata,
    },
  };
}

export function identityIsAuditable(
  r: Pick<
    ArtRecipient,
    | "identityVerificationStatus"
    | "identityVerificationMethod"
    | "identityVerifiedAt"
    | "identitySource"
    | "identityVerifiedBy"
    | "identityAssuranceLevel"
  >
): boolean {
  if (r.identityVerificationStatus !== "verified") return false;
  if (!r.identityVerificationMethod || !isMethod(r.identityVerificationMethod)) return false;
  if (!r.identityVerifiedAt || !Number.isFinite(Date.parse(r.identityVerifiedAt))) return false;
  if (!r.identitySource?.trim()) return false;
  if (!r.identityVerifiedBy?.trim()) return false;
  if (!r.identityAssuranceLevel?.trim()) return false;
  return true;
}

export function identitySatisfiesConfig(r: ArtRecipient, config: ArtConfig): boolean {
  if (!identityIsAuditable(r)) return false;
  const method = r.identityVerificationMethod;
  if (method && PREDECLARED_METHODS.has(method) && !config.allowPrevalidatedIdentity) {
    return false;
  }
  return true;
}

export function attestationToRecipientFields(attestation: IdentityAttestation): Record<string, unknown> {
  return {
    identityPrevalidatedByArt: PREDECLARED_METHODS.has(attestation.identityVerificationMethod),
    identityVerificationMethod: attestation.identityVerificationMethod,
    identityVerifiedAt: attestation.identityVerifiedAt,
    identityVerificationAt: attestation.identityVerifiedAt,
    identitySource: attestation.identitySource,
    identityExternalReference: attestation.identityExternalReference,
    identityVerifiedBy: attestation.identityVerifiedBy,
    identityAssuranceLevel: attestation.identityAssuranceLevel,
    identityMetadata: attestation.identityMetadata,
    identityVerificationStatus: "verified",
    identityProvider:
      attestation.identityVerificationMethod === "RENAPER"
        ? "RENAPER"
        : attestation.identityVerificationMethod === "DIDIT"
          ? "DIDIT"
          : "ART_PREVALIDATED",
  };
}
