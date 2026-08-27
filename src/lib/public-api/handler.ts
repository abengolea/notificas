import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { authenticateBearerToken, touchApiKeyLastUsed } from "@/lib/public-api/api-keys";
import { writeApiAudit } from "@/lib/public-api/audit";
import { errorBody, forbidden, PublicApiError, unauthorized } from "@/lib/public-api/errors";
import { newRequestId } from "@/lib/public-api/ids";
import { consumeRateLimit } from "@/lib/public-api/rate-limit";
import type { RateBucket } from "@/lib/public-api/rate-limit-config";
import { hasScope, type PublicApiScope } from "@/lib/public-api/scopes";
import type { PublicApiAuthContext } from "@/lib/public-api/types";

export const PUBLIC_API_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Idempotency-Key, X-Request-Id",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export function publicApiOptionsResponse(): NextResponse {
  return new NextResponse(null, { status: 204, headers: PUBLIC_API_CORS_HEADERS });
}

function requestIdFrom(request: NextRequest): string {
  const incoming = request.headers.get("X-Request-Id")?.trim();
  if (incoming && /^[a-zA-Z0-9_.:-]{8,80}$/.test(incoming)) return incoming;
  return newRequestId();
}

export function withApiHeaders(
  response: NextResponse,
  requestId: string,
  extra?: Record<string, string>
): NextResponse {
  response.headers.set("X-Request-Id", requestId);
  for (const [k, v] of Object.entries(PUBLIC_API_CORS_HEADERS)) response.headers.set(k, v);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) response.headers.set(k, v);
  }
  return response;
}

export function jsonApiError(err: PublicApiError, requestId: string, extraHeaders?: Record<string, string>): NextResponse {
  const res = NextResponse.json(errorBody(err, requestId), { status: err.httpStatus });
  return withApiHeaders(res, requestId, extraHeaders);
}

export async function readJsonLimited(request: NextRequest, maxBytes: number): Promise<unknown> {
  const len = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(len) && len > maxBytes) {
    throw new PublicApiError({
      httpStatus: 413,
      type: "validation_error",
      code: "payload_too_large",
      message: `Request body exceeds ${maxBytes} bytes.`,
    });
  }
  const buf = Buffer.from(await request.arrayBuffer());
  if (buf.length > maxBytes) {
    throw new PublicApiError({
      httpStatus: 413,
      type: "validation_error",
      code: "payload_too_large",
      message: `Request body exceeds ${maxBytes} bytes.`,
    });
  }
  if (buf.length === 0) return {};
  try {
    return JSON.parse(buf.toString("utf8"));
  } catch {
    throw new PublicApiError({
      httpStatus: 400,
      type: "validation_error",
      code: "invalid_json",
      message: "The request body is not valid JSON.",
    });
  }
}

export async function resolveAuthContext(request: NextRequest): Promise<PublicApiAuthContext> {
  const requestId = requestIdFrom(request);
  const key = await authenticateBearerToken(request.headers.get("Authorization"));
  const db = getAdminDb();
  const orgSnap = await db.collection("organizations").doc(key.orgId).get();
  if (!orgSnap.exists) throw unauthorized("invalid_api_key", "Invalid API key.");
  const org = orgSnap.data()!;
  const senderUid = String(org.adminUserId || "");
  if (!senderUid) throw unauthorized("invalid_api_key", "Invalid API key.");
  void touchApiKeyLastUsed(key.id);
  return {
    requestId,
    apiKeyId: key.id,
    apiKeyPrefix: key.prefix,
    orgId: key.orgId,
    orgName: String(org.nombre || ""),
    orgCuit: typeof org.cuit === "string" ? org.cuit : null,
    senderUid,
    senderEmail: String(org.adminUserEmail || ""),
    environment: key.environment,
    testMode: key.environment === "test",
    scopes: Array.isArray(key.scopes) ? (key.scopes as PublicApiAuthContext["scopes"]) : [],
  };
}

export async function handlePublicApi(
  request: NextRequest,
  opts: {
    scope: PublicApiScope;
    rateBucket: RateBucket;
    extraRateBucket?: RateBucket;
  },
  handler: (ctx: PublicApiAuthContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const started = Date.now();
  const requestId = requestIdFrom(request);
  let ctx: PublicApiAuthContext | null = null;
  try {
    ctx = await resolveAuthContext(request);
    ctx.requestId = requestId;
    if (!hasScope(ctx.scopes, opts.scope)) {
      throw forbidden("insufficient_scope", "This API key does not have permission for this endpoint.");
    }
    try {
      await consumeRateLimit({
        apiKeyId: ctx.apiKeyId,
        orgId: ctx.orgId,
        bucket: opts.rateBucket,
        extra: opts.extraRateBucket,
      });
    } catch (e) {
      if (e instanceof PublicApiError && e.httpStatus === 429) {
        const retry = Number((e as PublicApiError & { retryAfterSeconds?: number }).retryAfterSeconds || 60);
        const res = jsonApiError(e, requestId, { "Retry-After": String(retry) });
        void writeApiAudit({
          requestId,
          apiKeyId: ctx.apiKeyId,
          orgId: ctx.orgId,
          method: request.method,
          path: request.nextUrl.pathname,
          status: 429,
          durationMs: Date.now() - started,
          errorCode: "rate_limited",
        });
        return res;
      }
      throw e;
    }
    const response = await handler(ctx);
    const out = withApiHeaders(response, requestId);
    void writeApiAudit({
      requestId,
      apiKeyId: ctx.apiKeyId,
      orgId: ctx.orgId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: out.status,
      durationMs: Date.now() - started,
    });
    return out;
  } catch (e) {
    const err =
      e instanceof PublicApiError
        ? e
        : new PublicApiError({
            httpStatus: 500,
            type: "api_error",
            code: "internal_error",
            message: "An internal error occurred.",
          });
    if (!(e instanceof PublicApiError)) {
      console.error("public-api", requestId, e instanceof Error ? e.message : e);
    }
    const extra =
      err.httpStatus === 429
        ? { "Retry-After": String((err as PublicApiError & { retryAfterSeconds?: number }).retryAfterSeconds || 60) }
        : undefined;
    void writeApiAudit({
      requestId,
      apiKeyId: ctx?.apiKeyId,
      orgId: ctx?.orgId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: err.httpStatus,
      durationMs: Date.now() - started,
      errorCode: err.code,
    });
    return jsonApiError(err, requestId, extra);
  }
}
