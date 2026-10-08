import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { addOrgCredits } from "@/lib/org-credits";
import { loadAdminOrganizationDetail } from "@/lib/admin-organization-detail";

const bodySchema = z.object({
  add: z.number().finite(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orgId: string }> },
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  const { orgId } = await context.params;
  if (!orgId) return NextResponse.json({ error: "Falta orgId" }, { status: 400 });

  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Indicá cuántos envíos sumar (mínimo 1)." }, { status: 400 });
    }
    const enviosDisponibles = await addOrgCredits(orgId, parsed.data.add);
    const organization = await loadAdminOrganizationDetail(orgId);
    return NextResponse.json({ ok: true, enviosDisponibles, organization });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudieron sumar envíos";
    const status = msg === "Organización no encontrada" ? 404 : 400;
    console.error("POST /api/admin/organizations/[orgId]/credits", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
