import { NextRequest, NextResponse } from "next/server";
import { handlePublicApi, publicApiOptionsResponse, readJsonLimited } from "@/lib/public-api/handler";
import { createWebhookEndpoint, listWebhookEndpoints } from "@/lib/public-api/webhooks";
import { createWebhookEndpointSchema, MAX_WEBHOOK_BODY_BYTES } from "@/lib/public-api/validation";
import { invalidRequest } from "@/lib/public-api/errors";

export function OPTIONS() {
  return publicApiOptionsResponse();
}

export async function GET(request: NextRequest) {
  return handlePublicApi(request, { scope: "webhooks:read", rateBucket: "general" }, async (ctx) => {
    const data = await listWebhookEndpoints(ctx);
    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest) {
  return handlePublicApi(request, { scope: "webhooks:write", rateBucket: "general" }, async (ctx) => {
    const raw = await readJsonLimited(request, MAX_WEBHOOK_BODY_BYTES);
    const parsed = createWebhookEndpointSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw invalidRequest("invalid_request", issue?.message || "Invalid request.", issue?.path.join(".") || undefined);
    }
    const created = await createWebhookEndpoint(ctx, parsed.data);
    return NextResponse.json(
      { ...created.endpoint, secret: created.secret },
      { status: 201 }
    );
  });
}
