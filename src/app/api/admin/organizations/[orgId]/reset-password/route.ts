import { NextRequest, NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { ADMIN_EMPRESA_ONBOARDING_SOURCE } from "@/lib/legacy-migration";
import { sendEmpresaAdminOnboardingEmail } from "@/lib/send-account-setup-email";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orgId: string }> },
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  const { orgId } = await context.params;
  if (!orgId) return NextResponse.json({ error: "Falta orgId" }, { status: 400 });

  try {
    const body = (await request.json().catch(() => ({}))) as { memberUid?: string };
    const db = getAdminDb();
    const snap = await db.collection("organizations").doc(orgId).get();
    if (!snap.exists) return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });

    const d = snap.data() as Record<string, unknown>;
    const adminUserId = String(d.adminUserId ?? "");
    const memberIds = Array.isArray(d.members) ? d.members.map((m) => String(m)) : [];
    const targetUid = (body.memberUid || adminUserId).trim();
    if (!targetUid || (targetUid !== adminUserId && !memberIds.includes(targetUid))) {
      return NextResponse.json({ error: "El usuario no pertenece a esta organización" }, { status: 400 });
    }

    const authUser = await getAdminAuth().getUser(targetUid).catch(() => null);
    const email = (authUser?.email || String(d.adminUserEmail || "")).trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Esa cuenta no tiene email para enviar el enlace" }, { status: 400 });
    }

    const mailResult = await sendEmpresaAdminOnboardingEmail({
      email,
      orgNombre: String(d.nombre || "tu organización"),
      authCreated: false,
    });
    if (!mailResult.ok) {
      return NextResponse.json({ error: mailResult.error || "No se pudo enviar el correo" }, { status: 502 });
    }

    await db.collection("users").doc(targetUid).set(
      {
        migrationSource: ADMIN_EMPRESA_ONBOARDING_SOURCE,
        mustSetPassword: true,
        passwordSetAt: null,
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true, email });
  } catch (e) {
    console.error("POST /api/admin/organizations/[orgId]/reset-password", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
