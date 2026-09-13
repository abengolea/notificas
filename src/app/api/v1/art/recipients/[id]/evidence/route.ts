import { NextRequest, NextResponse } from "next/server";
import { handlePublicApi, publicApiOptionsResponse } from "@/lib/public-api/handler";
import { notFound } from "@/lib/public-api/errors";
import { getRecipient } from "@/lib/art/store";
import { loadEvidencePdf } from "@/lib/art/evidence";
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
    const ev = await loadEvidencePdf(ctx.orgId, rec.id);
    if (!ev) throw notFound("not_found", "Evidence not found.");
    return NextResponse.json({ data: ev.json });
  });
}
