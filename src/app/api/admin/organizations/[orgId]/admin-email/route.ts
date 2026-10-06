import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { loadAdminOrganizationDetail } from "@/lib/admin-organization-detail";
import { planChangeOrgAdminEmail, normalizeAdminEmail } from "@/lib/change-org-admin-email";
import { ADMIN_EMPRESA_ONBOARDING_SOURCE } from "@/lib/legacy-migration";
import { sendEmpresaAdminOnboardingEmail } from "@/lib/send-account-setup-email";

const bodySchema = z.object({
  email: z.string().email(),
  keepPreviousAsMember: z.boolean().optional(),
});

function randomAuthPassword() {
  return randomBytes(24).toString("hex");
}

function authErrorCode(e: unknown): string {
  if (typeof e === "object" && e !== null && "code" in e) {
    return String((e as { code?: string }).code || "");
  }
  return "";
}

async function getUserByEmailOrNull(email: string) {
  try {
    return await getAdminAuth().getUserByEmail(email);
  } catch (e: unknown) {
    if (authErrorCode(e) === "auth/user-not-found") return null;
    throw e;
  }
}

async function nextEmailOwnsOtherOrg(orgId: string, email: string, uid: string | null) {
  const db = getAdminDb();
  const [byEmail, byUid] = await Promise.all([
    db.collection("organizations").where("adminUserEmail", "==", email).get(),
    uid
      ? db.collection("organizations").where("adminUserId", "==", uid).get()
      : Promise.resolve({ docs: [] as { id: string }[] }),
  ]);
  return (
    byEmail.docs.some((d) => d.id !== orgId) ||
    byUid.docs.some((d) => d.id !== orgId)
  );
}

async function markEmpresaUser(uid: string, email: string, orgNombre: string, cuit: string) {
  const db = getAdminDb();
  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  const onboarding = {
    migrationSource: ADMIN_EMPRESA_ONBOARDING_SOURCE,
    mustSetPassword: true,
    passwordSetAt: null,
  };
  if (!snap.exists) {
    await userRef.set({
      uid,
      email,
      tipo: "empresa",
      perfil: {
        nombre: orgNombre,
        cuit,
        telefono: "",
        verificado: true,
      },
      creditos: 0,
      estado: "activo",
      createdAt: FieldValue.serverTimestamp(),
      lastLogin: FieldValue.serverTimestamp(),
      createdByAdminOrg: true,
      ...onboarding,
    });
    return;
  }
  await userRef.set(
    {
      email,
      tipo: "empresa",
      createdByAdminOrg: true,
      ...onboarding,
    },
    { merge: true },
  );
}

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
      return NextResponse.json({ error: "Ingresá un email válido." }, { status: 400 });
    }

    const nextEmail = normalizeAdminEmail(parsed.data.email);
    const keepPreviousAsMember = parsed.data.keepPreviousAsMember !== false;
    const db = getAdminDb();
    const auth = getAdminAuth();
    const orgRef = db.collection("organizations").doc(orgId);
    const snap = await orgRef.get();
    if (!snap.exists) return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });

    const d = snap.data() as Record<string, unknown>;
    const adminUid = String(d.adminUserId || "").trim();
    const currentAuth = adminUid ? await auth.getUser(adminUid).catch(() => null) : null;
    const currentEmail = normalizeAdminEmail(
      currentAuth?.email || String(d.adminUserEmail || ""),
    );
    const existing = await getUserByEmailOrNull(nextEmail);
    const ownsOther = await nextEmailOwnsOtherOrg(orgId, nextEmail, existing?.uid || null);

    const plan = planChangeOrgAdminEmail({
      currentAdminUid: adminUid,
      currentAdminEmail: currentEmail,
      nextEmail,
      existingUserByNextEmail: existing ? { uid: existing.uid } : null,
      nextEmailOwnsOtherOrg: ownsOther,
    });

    if (plan.action === "conflict") {
      return NextResponse.json({ error: plan.error }, { status: 400 });
    }

    const orgNombre = String(d.nombre || "tu organización");
    const cuit = String(d.cuit || "");
    let inviteEmailSent = true;
    let inviteEmailError: string | undefined;

    if (plan.action === "rename") {
      await auth.updateUser(plan.adminUid, {
        email: plan.to,
        emailVerified: true,
        password: randomAuthPassword(),
        disabled: false,
      });
      await auth.revokeRefreshTokens(plan.adminUid).catch(() => null);
      await db.collection("users").doc(plan.adminUid).set(
        {
          email: plan.to,
          tipo: "empresa",
          createdByAdminOrg: true,
          migrationSource: ADMIN_EMPRESA_ONBOARDING_SOURCE,
          mustSetPassword: true,
          passwordSetAt: null,
        },
        { merge: true },
      );
      await orgRef.update({ adminUserEmail: plan.to });
    } else if (plan.action === "reassign") {
      const toUid = plan.toUid;
      await markEmpresaUser(toUid, nextEmail, orgNombre, cuit);
      const members = Array.isArray(d.members) ? d.members.map((m) => String(m)) : [];
      const nextMembers = new Set(members);
      nextMembers.add(toUid);
      if (keepPreviousAsMember && adminUid) nextMembers.add(adminUid);
      else nextMembers.delete(adminUid);
      await orgRef.update({
        adminUserId: toUid,
        adminUserEmail: nextEmail,
        members: [...nextMembers],
      });
    }

    if (plan.action !== "noop") {
      const mailResult = await sendEmpresaAdminOnboardingEmail({
        email: nextEmail,
        orgNombre,
        authCreated: plan.action === "rename",
      });
      inviteEmailSent = mailResult.ok;
      inviteEmailError = mailResult.ok ? undefined : mailResult.error;
      if (!inviteEmailSent) {
        console.error("[admin/organizations/admin-email] onboarding email failed", inviteEmailError);
      }
    }

    const organization = await loadAdminOrganizationDetail(orgId);
    return NextResponse.json({
      ok: true,
      action: plan.action,
      organization,
      inviteEmailSent,
      inviteEmailError,
      ...(inviteEmailSent
        ? {}
        : {
            warning:
              "El email se actualizó pero no se pudo enviar el correo de activación. Usá Restablecer contraseña.",
          }),
    });
  } catch (e) {
    const code = authErrorCode(e);
    if (code === "auth/email-already-exists") {
      return NextResponse.json(
        { error: "Ese email ya tiene una cuenta. Probá de nuevo o usá otro correo." },
        { status: 409 },
      );
    }
    console.error("POST /api/admin/organizations/[orgId]/admin-email", e);
    return NextResponse.json({ error: "No se pudo cambiar el email" }, { status: 500 });
  }
}
