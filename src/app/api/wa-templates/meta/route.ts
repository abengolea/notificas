import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveOrgMemberOrAdmin } from "@/lib/campaign-access";
import { getWhatsAppAccessToken } from "@/lib/meta-access-token";
import {
  extractTemplateBody,
  extractTemplateFooter,
  extractTemplateHeader,
  fetchApprovedWhatsAppTemplate,
} from "@/lib/meta-message-templates";

const querySchema = z.object({
  orgId: z.string().min(1),
  name: z.string().min(1).max(128),
  lang: z.string().max(16).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const parsed = querySchema.safeParse({
      orgId: request.nextUrl.searchParams.get("orgId") || "",
      name: request.nextUrl.searchParams.get("name") || "",
      lang: request.nextUrl.searchParams.get("lang") || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Falta el nombre del template" }, { status: 400 });
    }

    const access = await resolveOrgMemberOrAdmin(request, parsed.data.orgId);
    if (!access.ok) return access.response;

    const token = await getWhatsAppAccessToken();
    const wabaId = (process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "").trim();
    if (!token || !wabaId) {
      return NextResponse.json(
        { error: "No se puede consultar Meta desde este entorno. Pegá el BODY del template a mano." },
        { status: 503 }
      );
    }

    const tpl = await fetchApprovedWhatsAppTemplate({
      accessToken: token,
      wabaId,
      templateName: parsed.data.name,
      templateLang: parsed.data.lang || "es_AR",
    });
    const body = extractTemplateBody(tpl);
    if (!body) {
      return NextResponse.json(
        { error: "No encontramos ese template aprobado en Meta. Revisá el nombre y el idioma." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      name: typeof tpl?.name === "string" ? tpl.name : parsed.data.name,
      language: typeof tpl?.language === "string" ? tpl.language : parsed.data.lang || "es_AR",
      status: typeof tpl?.status === "string" ? tpl.status : null,
      body,
      header: extractTemplateHeader(tpl) || undefined,
      footer: extractTemplateFooter(tpl) || undefined,
    });
  } catch (e) {
    console.error("GET /api/wa-templates/meta", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
