import { NextRequest, NextResponse } from "next/server";
import { handlePublicApi, publicApiOptionsResponse } from "@/lib/public-api/handler";
import { getPublicBatch } from "@/lib/public-api/batches";
import { invalidRequest } from "@/lib/public-api/errors";
import { isBatchPublicId } from "@/lib/public-api/ids";

export function OPTIONS() {
  return publicApiOptionsResponse();
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  return handlePublicApi(request, { scope: "batches:read", rateBucket: "general" }, async (auth) => {
    const { id } = await context.params;
    if (!isBatchPublicId(id)) throw invalidRequest("invalid_id", "Invalid batch id.", "id");
    const body = await getPublicBatch(auth, id);
    return NextResponse.json(body);
  });
}
