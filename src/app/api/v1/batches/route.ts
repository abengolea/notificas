import { NextRequest, NextResponse } from "next/server";
import { handlePublicApi, publicApiOptionsResponse, readJsonLimited } from "@/lib/public-api/handler";
import { beginIdempotency, completeIdempotency, failIdempotency, requestFingerprint } from "@/lib/public-api/idempotency";
import { createPublicBatch } from "@/lib/public-api/batches";
import { MAX_BATCH_BODY_BYTES } from "@/lib/public-api/validation";

export function OPTIONS() {
  return publicApiOptionsResponse();
}

export async function POST(request: NextRequest) {
  return handlePublicApi(
    request,
    { scope: "batches:write", rateBucket: "general", extraRateBucket: "batches" },
    async (ctx) => {
      const body = await readJsonLimited(request, MAX_BATCH_BODY_BYTES);
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
        const result = await createPublicBatch(ctx, body);
        await completeIdempotency(begun.docId, result.httpStatus, result.body);
        return NextResponse.json(result.body, { status: result.httpStatus });
      } catch (e) {
        await failIdempotency(begun.docId);
        throw e;
      }
    }
  );
}
