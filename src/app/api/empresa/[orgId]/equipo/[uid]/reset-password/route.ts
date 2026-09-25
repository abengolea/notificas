import { NextRequest, NextResponse } from "next/server";
import { assertEmpresaAdmin } from "@/lib/empresa-auth";
import { loadEmpresaEquipo, resetEmpresaMemberPassword } from "@/lib/empresa-equipo-server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orgId: string; uid: string }> },
) {
  const { orgId, uid: memberUid } = await context.params;
  const gate = await assertEmpresaAdmin(request, orgId);
  if (gate.errorResponse) return gate.errorResponse;

  const result = await resetEmpresaMemberPassword(orgId, memberUid);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const payload = await loadEmpresaEquipo(orgId, gate.decoded!.uid, true);
  return NextResponse.json({ ok: true, email: result.email, equipo: payload });
}
