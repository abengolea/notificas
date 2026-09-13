import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { loadAdminOrganizationDetail } from "@/lib/admin-organization-detail";

const cuitRegex = /^\d{2}-\d{8}-\d{1}$/;

const patchSchema = z.object({
  nombre: z.string().min(2).max(200).optional(),
  cuit: z.string().regex(cuitRegex, "CUIT con formato XX-XXXXXXXX-X").optional(),
  tipo: z.enum(["empresa", "estudio_juridico", "consumidores", "art", "otro"]).optional(),
  plan: z.enum(["starter", "business", "enterprise"]).optional(),
  telefono: z.string().max(40).optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orgId: string }> },
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  const { orgId } = await context.params;
  if (!orgId) return NextResponse.json({ error: "Falta orgId" }, { status: 400 });

  try {
    const organization = await loadAdminOrganizationDetail(orgId);
    if (!organization) return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
    return NextResponse.json({ organization });
  } catch (e) {
    console.error("GET /api/admin/organizations/[orgId]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ orgId: string }> },
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  const { orgId } = await context.params;
  if (!orgId) return NextResponse.json({ error: "Falta orgId" }, { status: 400 });

  try {
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = getAdminDb();
    const ref = db.collection("organizations").doc(orgId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });

    const orgUpdates: Record<string, unknown> = {};
    if (parsed.data.nombre) orgUpdates.nombre = parsed.data.nombre.trim();
    if (parsed.data.cuit) orgUpdates.cuit = parsed.data.cuit.trim();
    if (parsed.data.tipo) orgUpdates.tipo = parsed.data.tipo;
    if (parsed.data.plan) orgUpdates.plan = parsed.data.plan;

    if (Object.keys(orgUpdates).length) {
      await ref.update(orgUpdates);
    }

    if (parsed.data.telefono !== undefined) {
      const adminUserId = String(snap.data()?.adminUserId ?? "");
      if (adminUserId) {
        const userRef = db.collection("users").doc(adminUserId);
        const userSnap = await userRef.get();
        const prev = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : {};
        const perfil =
          prev.perfil && typeof prev.perfil === "object"
            ? { ...(prev.perfil as Record<string, unknown>) }
            : {};
        perfil.telefono = parsed.data.telefono.trim();
        await userRef.set({ perfil }, { merge: true });
      }
    }

    const organization = await loadAdminOrganizationDetail(orgId);
    return NextResponse.json({ ok: true, organization });
  } catch (e) {
    console.error("PATCH /api/admin/organizations/[orgId]", e);
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }
}
