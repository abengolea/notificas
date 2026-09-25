import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth-helper";
import { getOrgIfMember, type OrgRecord } from "@/lib/org-server";
import type { DocumentReference } from "firebase-admin/firestore";

export function isOrgAdminUid(data: OrgRecord, uid: string, authEmail?: string | null): boolean {
  if (data.adminUserId === uid) return true;
  const emailNorm = authEmail?.trim().toLowerCase() ?? "";
  const adminEmail =
    typeof data.adminUserEmail === "string" ? data.adminUserEmail.trim().toLowerCase() : "";
  return Boolean(emailNorm && adminEmail && emailNorm === adminEmail);
}

export async function assertEmpresaMember(request: NextRequest, orgId: string) {
  const { decoded, errorResponse } = await verifyAuthToken(request);
  if (errorResponse) return { errorResponse, decoded: null, org: null, isAdmin: false };
  const org = await getOrgIfMember(decoded.uid, orgId, decoded.email);
  if (!org) {
    return {
      errorResponse: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
      decoded: null,
      org: null,
      isAdmin: false,
    };
  }
  const isAdmin = isOrgAdminUid(org.data, decoded.uid, decoded.email);
  return { errorResponse: null, decoded, org, isAdmin };
}

export async function assertEmpresaAdmin(request: NextRequest, orgId: string) {
  const gate = await assertEmpresaMember(request, orgId);
  if (gate.errorResponse) return gate;
  if (!gate.isAdmin) {
    return {
      errorResponse: NextResponse.json(
        { error: "Solo el administrador de la empresa puede realizar esta acción." },
        { status: 403 },
      ),
      decoded: null,
      org: null as { ref: DocumentReference; data: OrgRecord } | null,
      isAdmin: false,
    };
  }
  return gate;
}
