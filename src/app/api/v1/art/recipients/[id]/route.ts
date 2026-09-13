import { NextRequest, NextResponse } from "next/server";
import { handlePublicApi, publicApiOptionsResponse } from "@/lib/public-api/handler";
import { notFound } from "@/lib/public-api/errors";
import { getRecipient, getOrCreateArtConfig } from "@/lib/art/store";
import { publicApiRecipientView } from "@/lib/art/views";
import { evaluateEligibility } from "@/lib/art/eligibility";
import { assertPublicArtOrg } from "@/lib/art/public-gate";

export function OPTIONS() {
  return publicApiOptionsResponse();
}

export async function GET(request: NextRequest, routeCtx: { params: Promise<{ id: string }> }) {
  return handlePublicApi(request, { scope: "art:read", rateBucket: "general" }, async (ctx) => {
    assertPublicArtOrg(ctx.orgId);
    const { id } = await routeCtx.params;
    const rec = await getRecipient(ctx.orgId, id);
    if (!rec) throw notFound("not_found", "Recipient not found.");
    const config = await getOrCreateArtConfig(ctx.orgId);
    const eligibility = evaluateEligibility({ moduleEnabled: true, recipient: rec, config });
    return NextResponse.json({ data: { ...publicApiRecipientView(rec), eligibility } });
  });
}
