import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { resolveOrgMemberOrAdmin } from "@/lib/campaign-access";
import { getAdminDb } from "@/lib/firebase-admin";
import { assertSavableWaMapping, mapSavedWaTemplate, WA_SAVED_TEMPLATES_MAX } from "@/lib/wa-saved-template";
import { WA_TEMPLATE_MAX_VARS } from "@/lib/wa-template-fields";

const postSchema = z.object({
  orgId: z.string().min(1),
  label: z.string().min(2).max(80),
  templateName: z.string().min(1).max(128),
  templateLang: z.string().max(16).optional(),
  templateVariables: z.array(z.string().max(200)).max(WA_TEMPLATE_MAX_VARS),
  urlButton: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const orgId = request.nextUrl.searchParams.get("orgId") || "";
    const access = await resolveOrgMemberOrAdmin(request, orgId);
    if (!access.ok) return access.response;

    const snap = await getAdminDb().collection("wa_templates").where("orgId", "==", orgId).get();
    const templates = snap.docs
      .map((d) => mapSavedWaTemplate(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));

    return NextResponse.json({ templates });
  } catch (e) {
    console.error("GET /api/wa-templates", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = postSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const access = await resolveOrgMemberOrAdmin(request, parsed.data.orgId);
    if (!access.ok) return access.response;

    const err = assertSavableWaMapping({
      templateName: parsed.data.templateName,
      templateVariables: parsed.data.templateVariables,
    });
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const db = getAdminDb();
    const existing = await db.collection("wa_templates").where("orgId", "==", parsed.data.orgId).get();
    if (existing.size >= WA_SAVED_TEMPLATES_MAX) {
      return NextResponse.json(
        { error: `Máximo ${WA_SAVED_TEMPLATES_MAX} templates guardados por organización.` },
        { status: 400 }
      );
    }

    const ref = await db.collection("wa_templates").add({
      orgId: parsed.data.orgId,
      label: parsed.data.label.trim(),
      templateName: parsed.data.templateName.trim(),
      templateLang: (parsed.data.templateLang || "es_AR").trim() || "es_AR",
      templateVariables: parsed.data.templateVariables.map((v) => v.trim()).filter(Boolean),
      urlButton: parsed.data.urlButton === true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ id: ref.id });
  } catch (e) {
    console.error("POST /api/wa-templates", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
