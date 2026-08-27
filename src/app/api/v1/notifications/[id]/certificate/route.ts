import { NextRequest, NextResponse } from "next/server";
import { handlePublicApi, publicApiOptionsResponse } from "@/lib/public-api/handler";
import { invalidRequest } from "@/lib/public-api/errors";
import { isNotificationPublicId } from "@/lib/public-api/ids";
import { getPublicCertificate } from "@/lib/public-api/notifications";

export function OPTIONS() {
  return publicApiOptionsResponse();
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  return handlePublicApi(request, { scope: "notifications:read", rateBucket: "general" }, async (auth) => {
    const { id } = await context.params;
    if (!isNotificationPublicId(id)) throw invalidRequest("invalid_id", "Invalid notification id.", "id");
    const body = await getPublicCertificate(auth, id);
    return NextResponse.json(body);
  });
}
