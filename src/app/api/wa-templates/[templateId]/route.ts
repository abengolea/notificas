import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { resolveOrgMemberOrAdmin } from "@/lib/campaign-access";
import { getAdminDb } from "@/lib/firebase-admin";
import { assertSavableWaMapping } from "@/lib/wa-saved-template";
import { WA_TEMPLATE_MAX_VARS } from "@/lib/wa-template-fields";

const putSchema = z.object({
  label: z.string().min(2).max(80).optional(),
  templateName: z.string().min(1).max(128).optional(),
  templateLang: z.string().max(16).optional(),
  templateVariables: z.array(z.string().max(200)).max(WA_TEMPLATE_MAX_VARS).optional(),
  urlButton: z.boolean().optional(),
  templateBody: z.string().max(20000).optional(),
});

type RouteContext = { params: Promise<{ templateId: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { templateId } = await context.params;
    const parsed = putSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = getAdminDb();
    const ref = db.collection("wa_templates").doc(templateId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const data = snap.data()!;
    const access = await resolveOrgMemberOrAdmin(request, String(data.orgId));
    if (!access.ok) return access.response;

    const nextName = parsed.data.templateName ?? String(data.templateName || "");
    const nextVars = parsed.data.templateVariables
      ?? (Array.isArray(data.templateVariables) ? data.templateVariables.map(String) : []);
    const err = assertSavableWaMapping({ templateName: nextName, templateVariables: nextVars });
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (parsed.data.label) update.label = parsed.data.label.trim();
    if (parsed.data.templateName) update.templateName = parsed.data.templateName.trim();
    if (parsed.data.templateLang) update.templateLang = parsed.data.templateLang.trim() || "es_AR";
    if (parsed.data.templateVariables) {
      update.templateVariables = parsed.data.templateVariables.map((v) => v.trim()).filter(Boolean);
    }
    if (typeof parsed.data.urlButton === "boolean") update.urlButton = parsed.data.urlButton;
    if (typeof parsed.data.templateBody === "string") update.templateBody = parsed.data.templateBody.trim();

    await ref.update(update);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/wa-templates/[templateId]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { templateId } = await context.params;
    const db = getAdminDb();
    const ref = db.collection("wa_templates").doc(templateId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const access = await resolveOrgMemberOrAdmin(request, String(snap.data()?.orgId));
    if (!access.ok) return access.response;

    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/wa-templates/[templateId]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
