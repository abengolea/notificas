import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { z } from "zod";

const cuitRegex = /^\d{2}-\d{8}-\d{1}$/;

const postSchema = z.object({
  nombre: z.string().min(2).max(200),
  cuit: z.string().regex(cuitRegex, "CUIT con formato XX-XXXXXXXX-X"),
  tipo: z.enum(["empresa", "estudio_juridico", "consumidores", "otro"]),
  /** Usuario Firebase (debe existir en Auth) que será admin de la org en la app. */
  adminUserEmail: z.string().email(),
  plan: z.enum(["starter", "business", "enterprise"]).optional(),
  logoUrl: z.string().url().optional().nullable(),
  /** Emails adicionales (usuarios registrados) a incluir en `members`. */
  extraMemberEmails: z.array(z.string().email()).optional(),
});

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  try {
    const db = getAdminDb();
    const snap = await db.collection("organizations").orderBy("createdAt", "desc").limit(500).get();
    const organizations = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ organizations });
  } catch (e) {
    console.error("GET /api/admin/organizations", e);
    try {
      const snap = await getAdminDb().collection("organizations").limit(500).get();
      const organizations = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return NextResponse.json({ organizations });
    } catch (e2) {
      console.error("GET /api/admin/organizations fallback", e2);
      return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
  }
}

export async function POST(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const auth = getAdminAuth();
    const adminEmail = parsed.data.adminUserEmail.trim().toLowerCase();

    let adminUser;
    try {
      adminUser = await auth.getUserByEmail(adminEmail);
    } catch {
      return NextResponse.json(
        {
          error:
            "No existe un usuario en Firebase Auth con ese email. El responsable debe registrarse primero en la app.",
        },
        { status: 400 },
      );
    }

    const memberUids = new Set<string>([adminUser.uid]);
    const extra = parsed.data.extraMemberEmails ?? [];
    for (const raw of extra) {
      const em = raw.trim().toLowerCase();
      if (em === adminEmail) continue;
      try {
        const u = await auth.getUserByEmail(em);
        memberUids.add(u.uid);
      } catch {
        return NextResponse.json(
          { error: `No existe usuario registrado con el email: ${em}` },
          { status: 400 },
        );
      }
    }

    const db = getAdminDb();
    const ref = db.collection("organizations").doc();
    const plan = parsed.data.plan ?? "starter";

    await ref.set({
      nombre: parsed.data.nombre.trim(),
      cuit: parsed.data.cuit.trim(),
      tipo: parsed.data.tipo,
      adminUserId: adminUser.uid,
      adminUserEmail: adminEmail,
      members: [...memberUids],
      plan,
      logoUrl: parsed.data.logoUrl ?? null,
      createdAt: FieldValue.serverTimestamp(),
      createdByAdmin: true,
    });

    return NextResponse.json({
      id: ref.id,
      nombre: parsed.data.nombre.trim(),
      cuit: parsed.data.cuit.trim(),
      tipo: parsed.data.tipo,
      adminUserId: adminUser.uid,
      adminUserEmail: adminEmail,
      members: [...memberUids],
      plan,
      logoUrl: parsed.data.logoUrl ?? null,
    });
  } catch (e) {
    console.error("POST /api/admin/organizations", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
