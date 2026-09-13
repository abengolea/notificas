import { NextRequest, NextResponse } from "next/server";
import { assertEmpresaArt } from "@/lib/art/empresa-auth";
import { loadEvidencePdf } from "@/lib/art/evidence";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const orgId = request.nextUrl.searchParams.get("orgId") || "";
  const gate = await assertEmpresaArt(request, orgId);
  if (gate.errorResponse) return gate.errorResponse;
  const { id } = await ctx.params;
  const ev = await loadEvidencePdf(orgId, id);
  if (!ev) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (request.nextUrl.searchParams.get("format") === "json") return NextResponse.json(ev.json);
  return new NextResponse(new Uint8Array(ev.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${ev.fileName}"`,
    },
  });
}
