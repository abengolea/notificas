import { NextRequest, NextResponse } from "next/server";
import { handlePublicApi, publicApiOptionsResponse } from "@/lib/public-api/handler";
import { notFound } from "@/lib/public-api/errors";
import { getRecipient } from "@/lib/art/store";
import { createInvitation } from "@/lib/art/invite";
import { assertPublicArtOrg, rethrowArtAsPublic } from "@/lib/art/public-gate";

export function OPTIONS() {
  return publicApiOptionsResponse();
}

export async function POST(request: NextRequest, routeCtx: { params: Promise<{ id: string }> }) {
  return handlePublicApi(request, { scope: "art:write", rateBucket: "general" }, async (ctx) => {
    assertPublicArtOrg(ctx.orgId);
    const { id } = await routeCtx.params;
    const rec = await getRecipient(ctx.orgId, id);
    if (!rec) throw notFound("not_found", "Recipient not found.");
    const inv = await createInvitation({
      orgId: ctx.orgId,
      orgName: ctx.orgName,
      recipient: rec,
      actor: ctx.apiKeyPrefix,
      send: true,
    }).catch((e) => {
      rethrowArtAsPublic(e);
    });
    return NextResponse.json({ data: { url: inv.url, expires_at: inv.expiresAt } });
  });
}
