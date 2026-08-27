import { NextRequest, NextResponse } from "next/server";
import { handlePublicApi, publicApiOptionsResponse, readJsonLimited } from "@/lib/public-api/handler";
import { beginIdempotency, completeIdempotency, failIdempotency, requestFingerprint } from "@/lib/public-api/idempotency";
import { createPublicNotification, listPublicNotifications } from "@/lib/public-api/notifications";
import { MAX_NOTIFICATION_BODY_BYTES } from "@/lib/public-api/validation";

export function OPTIONS() {
  return publicApiOptionsResponse();
}

export async function GET(request: NextRequest) {
  return handlePublicApi(request, { scope: "notifications:read", rateBucket: "general" }, async (ctx) => {
    const q = Object.fromEntries(request.nextUrl.searchParams.entries());
    const result = await listPublicNotifications(ctx, q);
    return NextResponse.json(result);
  });
}

export async function POST(request: NextRequest) {
  return handlePublicApi(
    request,
    { scope: "notifications:write", rateBucket: "general", extraRateBucket: "notifications" },
    async (ctx) => {
      const body = await readJsonLimited(request, MAX_NOTIFICATION_BODY_BYTES);
      const idempotencyKey = request.headers.get("Idempotency-Key")?.trim() || null;
      const begun = await beginIdempotency({
        orgId: ctx.orgId,
        environment: ctx.environment,
        key: idempotencyKey,
        fingerprint: requestFingerprint(body),
      });
      if (begun.replay) {
        return NextResponse.json(begun.replay.body, { status: begun.replay.status });
      }
      try {
        const result = await createPublicNotification(ctx, body);
        await completeIdempotency(begun.docId, result.httpStatus, result.body);
        return NextResponse.json(result.body, { status: result.httpStatus });
      } catch (e) {
        await failIdempotency(begun.docId);
        throw e;
      }
    }
  );
}
