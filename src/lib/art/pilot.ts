import { isExplicitNotificationType, parseNotificationType } from "@/lib/art/notification-type";
import type { SrtNotificationType } from "@/lib/art/types";
import { artModuleEnabled } from "@/lib/art/enabled";

const TRUE = new Set(["1", "true", "yes", "on"]);

export const ART_MODULE_NOT_AVAILABLE = "ART_MODULE_NOT_AVAILABLE";
export const PILOT_RECIPIENT_NOT_ALLOWED = "PILOT_RECIPIENT_NOT_ALLOWED";
export const PILOT_BULK_LIMIT = "PILOT_BULK_LIMIT";
export const PILOT_CAMPAIGN_LIMIT = "PILOT_CAMPAIGN_LIMIT";
export const NOTIFICATION_TYPE_REQUIRED = "NOTIFICATION_TYPE_REQUIRED";

function envFlag(name: string): boolean {
  return TRUE.has((process.env[name] || "").trim().toLowerCase());
}

function splitList(raw: string | undefined): string[] {
  return (raw || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function artPilotMode(): boolean {
  return envFlag("ART_PILOT_MODE");
}

/** Apertura general. Default false. Sin esto, PILOT=false no abre ART a todas las orgs. */
export function artGeneralReleaseEnabled(): boolean {
  return envFlag("ART_GENERAL_RELEASE_ENABLED");
}

/** El módulo está técnicamente on y hay un modo de acceso (piloto o release general). */
export function artModuleReleased(): boolean {
  return artModuleEnabled() && (artPilotMode() || artGeneralReleaseEnabled());
}

export function artAllowedOrgIds(env = process.env): string[] {
  return splitList(env.ART_ALLOWED_ORGS);
}

export function artPilotEmailAllowlist(env = process.env): string[] {
  return splitList(env.ART_PILOT_EMAIL_ALLOWLIST).map((e) => e.toLowerCase());
}

export function artPilotPhoneAllowlist(env = process.env): string[] {
  return splitList(env.ART_PILOT_PHONE_ALLOWLIST);
}

export function artPilotMaxRecipients(env = process.env): number {
  const n = Number(env.ART_PILOT_MAX_RECIPIENTS);
  if (Number.isFinite(n) && n >= 1 && n <= 10) return Math.floor(n);
  return 10;
}

export function artPilotMaxCampaignRecipients(env = process.env): number {
  const n = Number(env.ART_PILOT_MAX_CAMPAIGN_RECIPIENTS);
  if (Number.isFinite(n) && n >= 1 && n <= 10) return Math.floor(n);
  return 10;
}

export function evidenceRetentionYears(env = process.env): number {
  const n = Number(env.EVIDENCE_RETENTION_YEARS);
  if (Number.isFinite(n) && n >= 1 && n <= 30) return Math.floor(n);
  return 5;
}

export function evidenceRetentionUiCopy(env = process.env): string {
  return `Conservación configurada actualmente: ${evidenceRetentionYears(env)} años.`;
}

export const PILOT_IDENTITY_METHOD = "ART_INTERNAL_KYC" as const;
export const PILOT_IDENTITY_SOURCE = "NOTIFICAS_INTERNAL_PILOT";
export const PILOT_IDENTITY_ASSURANCE = "TEST_DECLARED";

export function artModuleAvailableForOrg(orgId: string | null | undefined, env = process.env): boolean {
  if (!artModuleEnabled()) return false;
  const id = String(orgId || "").trim();
  if (!id) return false;
  if (artPilotMode()) return artAllowedOrgIds(env).includes(id);
  if (artGeneralReleaseEnabled()) return true;
  return false;
}

/** Allowlist, cupos y marcas TEST solo para orgs ART habilitadas en piloto. Otras orgs no se tocan. */
export function artPilotControlsApply(orgId: string | null | undefined, env = process.env): boolean {
  return artPilotMode() && artModuleAvailableForOrg(orgId, env);
}

export function throwArtCode(
  result: { ok: true } | { ok: false; code: string; httpStatus: number }
): asserts result is { ok: true } {
  if (!result.ok) {
    throw Object.assign(new Error(result.code), { code: result.code, httpStatus: result.httpStatus });
  }
}

export function assertArtOrgAccess(
  orgId: string | null | undefined,
  env = process.env
): { ok: true } | { ok: false; code: typeof ART_MODULE_NOT_AVAILABLE; httpStatus: 403 } {
  if (artModuleAvailableForOrg(orgId, env)) return { ok: true };
  return { ok: false, code: ART_MODULE_NOT_AVAILABLE, httpStatus: 403 };
}

export function normalizePilotPhone(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

export function phoneInAllowlist(candidate: string, allowlist: string[]): boolean {
  const b = normalizePilotPhone(candidate);
  if (!b) return false;
  return allowlist.some((allowed) => {
    const a = normalizePilotPhone(allowed);
    if (!a) return false;
    if (a === b) return true;
    const a10 = a.slice(-10);
    const b10 = b.slice(-10);
    return a10.length === 10 && b10.length === 10 && a10 === b10;
  });
}

export function emailInAllowlist(candidate: string, allowlist: string[]): boolean {
  const e = String(candidate || "").trim().toLowerCase();
  if (!e || e.includes("@notificas.internal") || e.includes("@wa.internal")) return false;
  return allowlist.includes(e);
}

export function assertPilotRecipientAllowed(
  input: { orgId?: string | null; email?: string | null; phone?: string | null },
  env = process.env
): { ok: true } | { ok: false; code: typeof PILOT_RECIPIENT_NOT_ALLOWED; httpStatus: 403 } {
  if (!artPilotControlsApply(input.orgId, env)) return { ok: true };
  const emails = artPilotEmailAllowlist(env);
  const phones = artPilotPhoneAllowlist(env);
  if (!emails.length || !phones.length) {
    return { ok: false, code: PILOT_RECIPIENT_NOT_ALLOWED, httpStatus: 403 };
  }
  const rawEmail = String(input.email || "").trim().toLowerCase();
  const email =
    rawEmail.includes("@notificas.internal") || rawEmail.includes("@wa.internal") ? "" : rawEmail;
  const phone = String(input.phone || "").trim();
  if (!email && !phone) return { ok: false, code: PILOT_RECIPIENT_NOT_ALLOWED, httpStatus: 403 };
  if (email && !emailInAllowlist(email, emails)) {
    return { ok: false, code: PILOT_RECIPIENT_NOT_ALLOWED, httpStatus: 403 };
  }
  if (phone && !phoneInAllowlist(phone, phones)) {
    return { ok: false, code: PILOT_RECIPIENT_NOT_ALLOWED, httpStatus: 403 };
  }
  return { ok: true };
}

export function assertPilotBulkLimit(
  count: number,
  orgId?: string | null,
  env = process.env
): { ok: true } | { ok: false; code: typeof PILOT_BULK_LIMIT; httpStatus: 400 } {
  if (!artPilotControlsApply(orgId, env)) return { ok: true };
  if (count > artPilotMaxRecipients(env)) {
    return { ok: false, code: PILOT_BULK_LIMIT, httpStatus: 400 };
  }
  return { ok: true };
}

export function assertPilotCampaignLimit(
  count: number,
  orgId?: string | null,
  env = process.env
): { ok: true } | { ok: false; code: typeof PILOT_CAMPAIGN_LIMIT; httpStatus: 400 } {
  if (!artPilotControlsApply(orgId, env)) return { ok: true };
  if (count > artPilotMaxCampaignRecipients(env)) {
    return { ok: false, code: PILOT_CAMPAIGN_LIMIT, httpStatus: 400 };
  }
  return { ok: true };
}

export function assertExplicitNotificationType(
  raw: unknown,
  opts: { required: boolean }
):
  | { ok: true; value: SrtNotificationType | null }
  | { ok: false; code: typeof NOTIFICATION_TYPE_REQUIRED; httpStatus: 400 } {
  if (!opts.required) {
    return { ok: true, value: raw == null || raw === "" ? null : parseNotificationType(raw) };
  }
  if (!isExplicitNotificationType(raw)) {
    return { ok: false, code: NOTIFICATION_TYPE_REQUIRED, httpStatus: 400 };
  }
  return { ok: true, value: parseNotificationType(raw) };
}

export function artPilotEvidenceMarks(env = process.env): {
  testMode: "PRODUCTION_PILOT" | null;
  banner: string | null;
  subtitle: string | null;
  environment: "production_pilot" | null;
  isTestEvidence: boolean;
} {
  if (!artPilotMode()) {
    return { testMode: null, banner: null, subtitle: null, environment: null, isTestEvidence: false };
  }
  return {
    testMode: "PRODUCTION_PILOT",
    banner: "PRUEBA INTERNA NOTIFICAS",
    subtitle: "TEST MODE: PRODUCTION PILOT",
    environment: "production_pilot",
    isTestEvidence: true,
  };
}

export function artPilotAuditMetadata(env = process.env): Record<string, unknown> {
  const marks = artPilotEvidenceMarks(env);
  if (!marks.isTestEvidence) return {};
  return {
    environment: marks.environment,
    isTestEvidence: true,
  };
}
