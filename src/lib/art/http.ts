import { NextRequest, NextResponse } from "next/server";
import { artModuleEnabled } from "@/lib/art/enabled";
import {
  ART_MODULE_NOT_AVAILABLE,
  NOTIFICATION_TYPE_REQUIRED,
  PILOT_BULK_LIMIT,
  PILOT_CAMPAIGN_LIMIT,
  PILOT_RECIPIENT_NOT_ALLOWED,
  artModuleReleased,
  assertArtOrgAccess,
} from "@/lib/art/pilot";

export function artModuleDisabledResponse(): NextResponse {
  return NextResponse.json({ error: "not_found", code: "art_module_disabled" }, { status: 404 });
}

export function artModuleNotAvailableResponse(): NextResponse {
  return NextResponse.json({ error: ART_MODULE_NOT_AVAILABLE, code: ART_MODULE_NOT_AVAILABLE }, { status: 403 });
}

export function pilotRecipientNotAllowedResponse(): NextResponse {
  return NextResponse.json(
    { error: PILOT_RECIPIENT_NOT_ALLOWED, code: PILOT_RECIPIENT_NOT_ALLOWED },
    { status: 403 }
  );
}

export function requireArtModule(): NextResponse | null {
  if (!artModuleEnabled()) return artModuleDisabledResponse();
  if (!artModuleReleased()) return artModuleNotAvailableResponse();
  return null;
}

export function requireArtOrg(orgId: string | null | undefined): NextResponse | null {
  const disabled = requireArtModule();
  if (disabled) return disabled;
  const access = assertArtOrgAccess(orgId);
  if (!access.ok) return artModuleNotAvailableResponse();
  return null;
}

export function artCaughtErrorResponse(e: unknown): NextResponse | null {
  if (!e || typeof e !== "object") return null;
  const code = "code" in e ? String((e as { code?: string }).code || "") : "";
  const httpStatus =
    "httpStatus" in e && typeof (e as { httpStatus?: number }).httpStatus === "number"
      ? (e as { httpStatus: number }).httpStatus
      : 0;
  if (
    code === ART_MODULE_NOT_AVAILABLE ||
    code === PILOT_RECIPIENT_NOT_ALLOWED ||
    code === PILOT_BULK_LIMIT ||
    code === PILOT_CAMPAIGN_LIMIT ||
    code === NOTIFICATION_TYPE_REQUIRED
  ) {
    return NextResponse.json({ error: code, code }, { status: httpStatus || 403 });
  }
  return null;
}

export function clientIp(request: NextRequest): string {
  const xf = request.headers.get("x-forwarded-for") || "";
  const first = xf.split(",")[0]?.trim();
  if (first) return first.slice(0, 64);
  return (request.headers.get("x-real-ip") || "").trim().slice(0, 64) || "0.0.0.0";
}

export function clientUserAgent(request: NextRequest): string {
  return (request.headers.get("user-agent") || "").slice(0, 512);
}

export async function consumeArtPublicRateLimit(opts: {
  key: string;
  limit: number;
  windowSeconds?: number;
}): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const { getAdminDb } = await import("@/lib/firebase-admin");
  const { FieldValue } = await import("firebase-admin/firestore");
  const { ART_COLLECTIONS } = await import("@/lib/art/collections");
  const windowSeconds = opts.windowSeconds ?? 60;
  const now = Date.now();
  const windowStart = Math.floor(now / (windowSeconds * 1000)) * (windowSeconds * 1000);
  const docId = `${opts.key}_${windowStart}`;
  const db = getAdminDb();
  const ref = db.collection(ART_COLLECTIONS.rateLimits).doc(docId);
  return db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const count = typeof snap.data()?.count === "number" ? snap.data()!.count : 0;
    if (count >= opts.limit) {
      const retryAfter = Math.max(1, Math.ceil((windowStart + windowSeconds * 1000 - now) / 1000));
      return { ok: false as const, retryAfter };
    }
    t.set(
      ref,
      {
        key: opts.key,
        windowStart,
        count: count + 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return { ok: true as const };
  });
}
