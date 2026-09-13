import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth-helper";
import { getOrgIfMember } from "@/lib/org-server";
import { requireArtOrg } from "@/lib/art/http";

export async function assertEmpresaArt(request: NextRequest, orgId: string) {
  const disabled = requireArtOrg(orgId);
  if (disabled) return { errorResponse: disabled as NextResponse, decoded: null, org: null };
  const { decoded, errorResponse } = await verifyAuthToken(request);
  if (errorResponse) return { errorResponse, decoded: null, org: null };
  const org = await getOrgIfMember(decoded.uid, orgId, decoded.email);
  if (!org) {
    return {
      errorResponse: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
      decoded: null,
      org: null,
    };
  }
  return { errorResponse: null, decoded, org };
}
