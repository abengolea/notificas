import { NextRequest, NextResponse } from "next/server";
import { resolveOrgMemberOrAdmin } from "@/lib/campaign-access";
import { getWhatsAppAccessToken } from "@/lib/meta-access-token";
import { listApprovedWhatsAppTemplates, summarizeApprovedTemplates } from "@/lib/meta-message-templates";

export async function GET(request: NextRequest) {
  try {
    const orgId = request.nextUrl.searchParams.get("orgId") || "";
    const access = await resolveOrgMemberOrAdmin(request, orgId);
    if (!access.ok) return access.response;

    const token = await getWhatsAppAccessToken();
    const wabaId = (process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "").trim();
    if (!token || !wabaId) {
      return NextResponse.json(
        { error: "No se puede consultar Meta desde este entorno." },
        { status: 503 }
      );
    }

    const listed = await listApprovedWhatsAppTemplates({
      accessToken: token,
      wabaId,
    });
    return NextResponse.json({ templates: summarizeApprovedTemplates(listed) });
  } catch (e) {
    console.error("GET /api/wa-templates/meta/catalog", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
