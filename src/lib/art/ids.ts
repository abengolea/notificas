import { newUlid } from "@/lib/public-api/ids";

export function newArtRecipientId(): string {
  return `art_rcp_${newUlid()}`;
}

export function newArtAdhesionId(): string {
  return `art_adh_${newUlid()}`;
}

export function newArtChallengeId(): string {
  return `art_otp_${newUlid()}`;
}

export function newArtBulkJobId(): string {
  return `art_job_${newUlid()}`;
}

export function newArtTermsId(): string {
  return `art_trm_${newUlid()}`;
}

export function newArtEvidenceId(): string {
  return `art_evd_${newUlid()}`;
}

export function digitsOnly(value: string | undefined | null): string {
  return String(value || "").replace(/\D/g, "");
}

export function normalizeCuil(value: string | undefined | null): string {
  return digitsOnly(value);
}

export function normalizeDni(value: string | undefined | null): string {
  return digitsOnly(value);
}

export function normalizeEmail(value: string | undefined | null): string {
  return String(value || "").trim().toLowerCase();
}
