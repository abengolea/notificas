import { NextRequest, NextResponse } from "next/server";
import { requireArtModule, requireArtOrg } from "@/lib/art/http";
import { resolveInvitation, resolveManageToken } from "@/lib/art/invite";
import { loadEvidencePdf } from "@/lib/art/evidence";

export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const disabled = requireArtModule();
  if (disabled) return disabled;
  const { token } = await ctx.params;
  const format = request.nextUrl.searchParams.get("format") || "pdf";
  const manage = await resolveManageToken(token);
  const invite = manage ? null : await resolveInvitation(token);
  const orgId = manage?.orgId || invite?.orgId;
  const recipientId = manage?.recipientId || invite?.recipientId;
  if (!orgId || !recipientId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const orgDenied = requireArtOrg(orgId);
  if (orgDenied) return orgDenied;
  const ev = await loadEvidencePdf(orgId, recipientId);
  if (!ev) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (format === "json") return NextResponse.json(ev.json);
  return new NextResponse(new Uint8Array(ev.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${ev.fileName}"`,
    },
  });
}
