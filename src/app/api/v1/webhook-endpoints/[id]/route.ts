import { NextRequest, NextResponse } from "next/server";
import { handlePublicApi, publicApiOptionsResponse, readJsonLimited } from "@/lib/public-api/handler";
import { getWebhookEndpoint, publicWebhookEndpointView, updateWebhookEndpoint } from "@/lib/public-api/webhooks";
import { invalidRequest } from "@/lib/public-api/errors";
import { isWebhookEndpointPublicId } from "@/lib/public-api/ids";
import { MAX_WEBHOOK_BODY_BYTES, patchWebhookEndpointSchema } from "@/lib/public-api/validation";

export function OPTIONS() {
  return publicApiOptionsResponse();
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  return handlePublicApi(request, { scope: "webhooks:read", rateBucket: "general" }, async (auth) => {
    const { id } = await context.params;
    if (!isWebhookEndpointPublicId(id)) throw invalidRequest("invalid_id", "Invalid webhook endpoint id.", "id");
    const row = await getWebhookEndpoint(auth, id);
    return NextResponse.json(publicWebhookEndpointView(row));
  });
}

export async function PATCH(request: NextRequest, context: Ctx) {
  return handlePublicApi(request, { scope: "webhooks:write", rateBucket: "general" }, async (auth) => {
    const { id } = await context.params;
    if (!isWebhookEndpointPublicId(id)) throw invalidRequest("invalid_id", "Invalid webhook endpoint id.", "id");
    const raw = await readJsonLimited(request, MAX_WEBHOOK_BODY_BYTES);
    const parsed = patchWebhookEndpointSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw invalidRequest("invalid_request", issue?.message || "Invalid request.", issue?.path.join(".") || undefined);
    }
    const row = await updateWebhookEndpoint(auth, id, parsed.data);
    return NextResponse.json(publicWebhookEndpointView(row));
  });
}

export async function DELETE(request: NextRequest, context: Ctx) {
  return handlePublicApi(request, { scope: "webhooks:write", rateBucket: "general" }, async (auth) => {
    const { id } = await context.params;
    if (!isWebhookEndpointPublicId(id)) throw invalidRequest("invalid_id", "Invalid webhook endpoint id.", "id");
    const row = await updateWebhookEndpoint(auth, id, { enabled: false });
    return NextResponse.json(publicWebhookEndpointView(row));
  });
}
