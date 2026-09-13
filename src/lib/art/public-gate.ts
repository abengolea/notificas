import { PublicApiError } from "@/lib/public-api/errors";
import { artModuleEnabled } from "@/lib/art/enabled";
import { ART_MODULE_NOT_AVAILABLE, assertArtOrgAccess } from "@/lib/art/pilot";

export function assertPublicArtOrg(orgId: string): void {
  if (!artModuleEnabled()) {
    throw new PublicApiError({
      httpStatus: 404,
      type: "not_found",
      code: "art_module_disabled",
      message: "ART module is not enabled.",
    });
  }
  const access = assertArtOrgAccess(orgId);
  if (!access.ok) {
    throw new PublicApiError({
      httpStatus: 403,
      type: "authorization_error",
      code: ART_MODULE_NOT_AVAILABLE,
      message: "ART module is not available for this organization.",
    });
  }
}

export function throwPublicArtCode(result: { ok: true } | { ok: false; code: string; httpStatus: number }): void {
  if (result.ok) return;
  throw new PublicApiError({
    httpStatus: result.httpStatus,
    type: result.httpStatus === 403 ? "authorization_error" : "validation_error",
    code: result.code,
    message: result.code,
  });
}

export function rethrowArtAsPublic(e: unknown): never {
  if (e && typeof e === "object" && "code" in e) {
    const code = String((e as { code?: string }).code || "");
    const httpStatus =
      "httpStatus" in e && typeof (e as { httpStatus?: number }).httpStatus === "number"
        ? (e as { httpStatus: number }).httpStatus
        : 400;
    if (code) {
      throwPublicArtCode({ ok: false, code, httpStatus });
    }
  }
  throw e;
}
