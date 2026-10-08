import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth-helper";
import { getOrgIfMember } from "@/lib/org-server";
import { ensureOrgCredits } from "@/lib/org-credits";

export async function GET(request: NextRequest) {
  const { decoded, errorResponse } = await verifyAuthToken(request);
  if (errorResponse) return errorResponse;

  const orgId = request.nextUrl.searchParams.get("orgId")?.trim() || "";
  if (!orgId) {
    return NextResponse.json({ error: "orgId requerido" }, { status: 400 });
  }

  const org = await getOrgIfMember(decoded.uid, orgId, decoded.email);
  if (!org) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const creditos = await ensureOrgCredits(orgId);
    return NextResponse.json({ orgId, creditos });
  } catch (e) {
    console.error("GET /api/empresa/org-credits", e);
    return NextResponse.json({ error: "No se pudo leer el saldo de la empresa" }, { status: 500 });
  }
}
