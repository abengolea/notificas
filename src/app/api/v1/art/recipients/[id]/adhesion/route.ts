import { NextRequest, NextResponse } from "next/server";
import { handlePublicApi, publicApiOptionsResponse } from "@/lib/public-api/handler";
import { notFound } from "@/lib/public-api/errors";
import { getRecipient } from "@/lib/art/store";
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
    return NextResponse.json({
      data: {
        adhesion_id: rec.adhesionId,
        status: rec.status,
        activated_at: rec.activatedAt,
        revoked_at: rec.revokedAt,
        terms_version: rec.termsVersion,
        terms_hash: rec.termsDocumentHash,
      },
    });
  });
}
