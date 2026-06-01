import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { ADMIN_EMPRESA_ONBOARDING_SOURCE, hasPendingPasswordOnboarding } from "@/lib/legacy-migration";
import { sendEmpresaAdminOnboardingEmail } from "@/lib/send-account-setup-email";
import { z } from "zod";

const cuitRegex = /^\d{2}-\d{8}-\d{1}$/;

const postSchema = z.object({
  nombre: z.string().min(2).max(200),
  cuit: z.string().regex(cuitRegex, "CUIT con formato XX-XXXXXXXX-X"),
  tipo: z.enum(["empresa", "estudio_juridico", "consumidores", "otro"]),
  /** Email del responsable (se crea en Auth si no existe). */
  adminUserEmail: z.string().email(),
  plan: z.enum(["starter", "business", "enterprise"]).optional(),
  logoUrl: z.string().url().optional().nullable(),
  /** Emails adicionales (usuarios registrados) a incluir en `members`. */
  extraMemberEmails: z.array(z.string().email()).optional(),
});

function randomAuthPassword() {
  return randomBytes(24).toString("hex");
}

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
    const orgNombre = parsed.data.nombre.trim();

    let adminUser;
    let authCreated = false;
    try {
      adminUser = await auth.getUserByEmail(adminEmail);
    } catch (e: unknown) {
      const code =
        typeof e === "object" && e !== null && "code" in e
          ? String((e as { code?: string }).code)
          : "";
      if (code !== "auth/user-not-found") {
        console.error("POST /api/admin/organizations getUserByEmail", e);
        return NextResponse.json({ error: "No se pudo verificar el usuario." }, { status: 500 });
      }
      adminUser = await auth.createUser({
        email: adminEmail,
        password: randomAuthPassword(),
        displayName: orgNombre,
        emailVerified: true,
        disabled: false,
      });
      authCreated = true;
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
      nombre: orgNombre,
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

    const userRef = db.collection("users").doc(adminUser.uid);
    const userSnap = await userRef.get();
    const userTipo = "empresa";
    const prev = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : undefined;
    const needsPasswordOnboarding =
      authCreated || !userSnap.exists || hasPendingPasswordOnboarding(prev);
    const onboardingFields = {
      migrationSource: ADMIN_EMPRESA_ONBOARDING_SOURCE,
      mustSetPassword: true,
      passwordSetAt: null,
    };

    if (!userSnap.exists) {
      await userRef.set({
        uid: adminUser.uid,
        email: adminEmail,
        tipo: userTipo,
        perfil: {
          nombre: adminUser.displayName?.trim() || orgNombre,
          cuit: parsed.data.cuit.trim(),
          telefono: adminUser.phoneNumber || "",
          verificado: true,
        },
        creditos: 0,
        estado: "activo",
        createdAt: FieldValue.serverTimestamp(),
        lastLogin: FieldValue.serverTimestamp(),
        createdByAdminOrg: true,
        ...onboardingFields,
      });
    } else if (needsPasswordOnboarding) {
      await userRef.set({ tipo: userTipo, ...onboardingFields }, { merge: true });
    } else {
      await userRef.set({ tipo: userTipo }, { merge: true });
    }

    const mailResult = await sendEmpresaAdminOnboardingEmail({
      email: adminEmail,
      orgNombre,
      authCreated,
    });

    const inviteEmailSent = mailResult.ok;
    const inviteEmailError = mailResult.ok ? undefined : mailResult.error;

    if (!inviteEmailSent) {
      console.error("[admin/organizations] onboarding email failed", inviteEmailError);
    }

    return NextResponse.json({
      id: ref.id,
      nombre: orgNombre,
      cuit: parsed.data.cuit.trim(),
      tipo: parsed.data.tipo,
      adminUserId: adminUser.uid,
      adminUserEmail: adminEmail,
      members: [...memberUids],
      plan,
      logoUrl: parsed.data.logoUrl ?? null,
      authCreated,
      inviteEmailSent,
      inviteEmailError,
      ...(inviteEmailSent
        ? {}
        : {
            warning:
              "La organización se creó pero no se pudo enviar el correo de activación. Revisá NEXT_PUBLIC_APP_URL y el envío de mail.",
          }),
    });
  } catch (e) {
    console.error("POST /api/admin/organizations", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
