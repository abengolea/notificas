import { randomBytes } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { normalizeEnviosDisponibles } from "@/lib/envios";
import { ADMIN_EMPRESA_ONBOARDING_SOURCE, hasPendingPasswordOnboarding } from "@/lib/legacy-migration";
import { sendEmpresaOperatorOnboardingEmail } from "@/lib/send-account-setup-email";
import type { BocaEnvio, OrgMemberMeta } from "@/lib/types";
import type { EmpresaEquipoMember, EmpresaEquipoPayload } from "@/lib/empresa-equipo-types";

function randomAuthPassword() {
  return randomBytes(24).toString("hex");
}

function perfilString(perfil: unknown, key: string): string {
  if (!perfil || typeof perfil !== "object") return "";
  const v = (perfil as Record<string, unknown>)[key];
  return typeof v === "string" ? v.trim() : "";
}

function parseBocas(raw: unknown): BocaEnvio[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b) => {
      if (!b || typeof b !== "object") return null;
      const x = b as Record<string, unknown>;
      const id = String(x.id ?? "").trim();
      const nombre = String(x.nombre ?? "").trim();
      if (!id || !nombre) return null;
      return {
        id,
        nombre,
        descripcion: typeof x.descripcion === "string" ? x.descripcion.trim() : undefined,
        activa: x.activa !== false,
        createdAt: x.createdAt,
      } satisfies BocaEnvio;
    })
    .filter(Boolean) as BocaEnvio[];
}

function parseMemberMeta(raw: unknown): Record<string, OrgMemberMeta> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, OrgMemberMeta> = {};
  for (const [uid, meta] of Object.entries(raw as Record<string, unknown>)) {
    if (!meta || typeof meta !== "object") continue;
    const m = meta as Record<string, unknown>;
    const bocaId = typeof m.bocaId === "string" ? m.bocaId.trim() : undefined;
    out[uid] = bocaId ? { bocaId } : {};
  }
  return out;
}

async function countByCreator(
  orgId: string,
  uid: string,
): Promise<{ campanas: number; individuales: number; enviados: number }> {
  const db = getAdminDb();
  const [campSnap, mailSnap] = await Promise.all([
    db.collection("campaigns").where("orgId", "==", orgId).where("createdBy", "==", uid).get().catch(() => null),
    db.collection("mail").where("orgId", "==", orgId).where("createdBy", "==", uid).get().catch(() => null),
  ]);

  let enviados = 0;
  for (const doc of campSnap?.docs ?? []) {
    const d = doc.data();
    if (d.simulated === true) continue;
    enviados += typeof d.stats?.enviados === "number" ? d.stats.enviados : 0;
  }

  let individuales = 0;
  for (const doc of mailSnap?.docs ?? []) {
    const d = doc.data();
    if (d.campaignId) continue;
    individuales += 1;
    if (d.estado === "enviado" || d.estado === "entregado") enviados += 1;
  }

  return {
    campanas: campSnap?.size ?? 0,
    individuales,
    enviados,
  };
}

async function resolveMember(
  uid: string,
  adminUserId: string,
  orgId: string,
  bocas: BocaEnvio[],
  memberMeta: Record<string, OrgMemberMeta>,
): Promise<EmpresaEquipoMember> {
  const auth = getAdminAuth();
  const db = getAdminDb();
  const [authUser, userSnap, stats] = await Promise.all([
    auth.getUser(uid).catch(() => null),
    db.collection("users").doc(uid).get(),
    countByCreator(orgId, uid),
  ]);
  const data = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : {};
  const email =
    (authUser?.email || (typeof data.email === "string" ? data.email : "") || "").trim().toLowerCase();
  const nombre =
    (authUser?.displayName || perfilString(data.perfil, "nombre") || email || uid).trim();
  const telefono = (authUser?.phoneNumber || perfilString(data.perfil, "telefono") || "").trim();
  const estado = data.estado === "suspendido" || authUser?.disabled ? "suspendido" : "activo";
  const bocaId = memberMeta[uid]?.bocaId ?? null;
  const boca = bocaId ? bocas.find((b) => b.id === bocaId) : undefined;

  return {
    uid,
    email,
    nombre,
    telefono,
    estado,
    enviosDisponibles: normalizeEnviosDisponibles(data.creditos),
    mustSetPassword: data.mustSetPassword === true,
    lastLoginAt: authUser?.metadata.lastSignInTime || null,
    isOrgAdmin: uid === adminUserId,
    bocaId,
    bocaNombre: boca?.nombre ?? null,
    campanasCount: stats.campanas,
    enviosIndividualesCount: stats.individuales,
    enviadosTotal: stats.enviados,
  };
}

export async function loadEmpresaEquipo(
  orgId: string,
  viewerUid: string,
  viewerIsAdmin: boolean,
): Promise<EmpresaEquipoPayload | null> {
  const db = getAdminDb();
  const snap = await db.collection("organizations").doc(orgId).get();
  if (!snap.exists) return null;

  const d = snap.data() as Record<string, unknown>;
  const adminUserId = String(d.adminUserId ?? "");
  const memberIds = Array.isArray(d.members) ? d.members.map((m) => String(m)).filter(Boolean) : [];
  const bocas = parseBocas(d.bocas);
  const memberMeta = parseMemberMeta(d.memberMeta);
  const uids = [...new Set([adminUserId, ...memberIds].filter(Boolean))];

  const members = await Promise.all(
    uids.map((uid) => resolveMember(uid, adminUserId, orgId, bocas, memberMeta)),
  );
  members.sort((a, b) => Number(b.isOrgAdmin) - Number(a.isOrgAdmin) || a.email.localeCompare(b.email));

  const adminMember = members.find((m) => m.isOrgAdmin);

  return {
    orgId: snap.id,
    orgNombre: String(d.nombre ?? ""),
    isAdmin: viewerIsAdmin,
    bocas,
    members: viewerIsAdmin ? members : members.filter((m) => m.uid === viewerUid),
    adminEnviosDisponibles: adminMember?.enviosDisponibles ?? 0,
  };
}

export async function addEmpresaMember(options: {
  orgId: string;
  email: string;
  nombre?: string;
  bocaId?: string;
  enviosIniciales?: number;
  orgNombre: string;
  adminUid: string;
}) {
  const email = options.email.trim().toLowerCase();
  const auth = getAdminAuth();
  const db = getAdminDb();
  const orgRef = db.collection("organizations").doc(options.orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) return { error: "Organización no encontrada", status: 404 as const };

  const orgData = orgSnap.data() as Record<string, unknown>;
  const adminUserId = String(orgData.adminUserId ?? "");
  const bocas = parseBocas(orgData.bocas);
  if (options.bocaId && !bocas.some((b) => b.id === options.bocaId && b.activa)) {
    return { error: "La boca de envío seleccionada no existe o está inactiva.", status: 400 as const };
  }

  let user;
  let authCreated = false;
  try {
    user = await auth.getUserByEmail(email);
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e !== null && "code" in e ? String((e as { code?: string }).code) : "";
    if (code !== "auth/user-not-found") {
      console.error("[empresa-equipo] getUserByEmail", e);
      return { error: "No se pudo verificar el usuario.", status: 500 as const };
    }
    user = await auth.createUser({
      email,
      password: randomAuthPassword(),
      displayName: options.nombre?.trim() || email,
      emailVerified: true,
      disabled: false,
    });
    authCreated = true;
  }

  if (user.uid === adminUserId) {
    return { error: "El administrador ya pertenece a la organización.", status: 400 as const };
  }

  const members = Array.isArray(orgData.members) ? orgData.members.map(String) : [];
  if (members.includes(user.uid)) {
    return { error: "Ese usuario ya es miembro de la organización.", status: 400 as const };
  }

  const envios = Math.max(0, Math.floor(options.enviosIniciales ?? 0));
  if (envios > 0) {
    const adminSnap = await db.collection("users").doc(options.adminUid).get();
    const adminCreditos = normalizeEnviosDisponibles(
      adminSnap.exists ? (adminSnap.data() as Record<string, unknown>).creditos : 0,
    );
    if (adminCreditos < envios) {
      return {
        error: `No tenés envíos suficientes. Disponibles: ${adminCreditos.toLocaleString("es-AR")}.`,
        status: 400 as const,
      };
    }
  }

  const userRef = db.collection("users").doc(user.uid);
  const userSnap = await userRef.get();
  const prev = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : undefined;
  const needsPasswordOnboarding = authCreated || !userSnap.exists || hasPendingPasswordOnboarding(prev);
  const onboardingFields = {
    migrationSource: ADMIN_EMPRESA_ONBOARDING_SOURCE,
    mustSetPassword: true,
    passwordSetAt: null,
  };

  const batch = db.batch();
  batch.update(orgRef, {
    members: FieldValue.arrayUnion(user.uid),
    ...(options.bocaId
      ? { [`memberMeta.${user.uid}`]: { bocaId: options.bocaId } satisfies OrgMemberMeta }
      : {}),
  });

  if (!userSnap.exists) {
    batch.set(userRef, {
      uid: user.uid,
      email,
      tipo: "empresa",
      perfil: {
        nombre: options.nombre?.trim() || user.displayName?.trim() || email,
        telefono: user.phoneNumber || "",
        verificado: true,
      },
      creditos: envios,
      estado: "activo",
      createdAt: FieldValue.serverTimestamp(),
      lastLogin: FieldValue.serverTimestamp(),
      createdByOrgAdmin: options.orgId,
      ...onboardingFields,
    });
  } else {
    const updates: Record<string, unknown> = { tipo: "empresa", createdByOrgAdmin: options.orgId };
    if (needsPasswordOnboarding) Object.assign(updates, onboardingFields);
    if (envios > 0) updates.creditos = FieldValue.increment(envios);
    batch.set(userRef, updates, { merge: true });
  }

  if (envios > 0) {
    batch.update(db.collection("users").doc(options.adminUid), {
      creditos: FieldValue.increment(-envios),
    });
    batch.set(db.collection("user_transactions").doc(), {
      userId: options.adminUid,
      tipo: "transferencia_salida",
      descripcion: `Asignación a operador ${email} (+${envios} envíos)`,
      creditos: -envios,
      monto: 0,
      orgId: options.orgId,
      fecha: FieldValue.serverTimestamp(),
    });
    batch.set(db.collection("user_transactions").doc(), {
      userId: user.uid,
      tipo: "transferencia_entrada",
      descripcion: `Asignación desde administrador de ${options.orgNombre}`,
      creditos: envios,
      monto: 0,
      orgId: options.orgId,
      fecha: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  const mailResult = await sendEmpresaOperatorOnboardingEmail({
    email,
    orgNombre: options.orgNombre,
    authCreated,
  });

  return {
    ok: true as const,
    uid: user.uid,
    authCreated,
    inviteEmailSent: mailResult.ok,
    inviteEmailError: mailResult.ok ? undefined : mailResult.error,
  };
}

export async function updateEmpresaMember(options: {
  orgId: string;
  memberUid: string;
  adminUid: string;
  orgNombre: string;
  bocaId?: string | null;
  addEnvios?: number;
  setEnvios?: number;
  estado?: "activo" | "suspendido";
}) {
  const db = getAdminDb();
  const orgRef = db.collection("organizations").doc(options.orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) return { error: "Organización no encontrada", status: 404 as const };

  const orgData = orgSnap.data() as Record<string, unknown>;
  const adminUserId = String(orgData.adminUserId ?? "");
  if (options.memberUid === adminUserId) {
    return { error: "No podés modificar al administrador principal desde acá.", status: 400 as const };
  }

  const members = Array.isArray(orgData.members) ? orgData.members.map(String) : [];
  if (!members.includes(options.memberUid)) {
    return { error: "El usuario no pertenece a esta organización.", status: 400 as const };
  }

  const bocas = parseBocas(orgData.bocas);
  if (options.bocaId && !bocas.some((b) => b.id === options.bocaId && b.activa)) {
    return { error: "La boca de envío seleccionada no existe o está inactiva.", status: 400 as const };
  }

  const orgUpdates: Record<string, unknown> = {};
  if (options.bocaId === null) {
    orgUpdates[`memberMeta.${options.memberUid}`] = FieldValue.delete();
  } else if (options.bocaId) {
    orgUpdates[`memberMeta.${options.memberUid}`] = { bocaId: options.bocaId };
  }

  const userRef = db.collection("users").doc(options.memberUid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return { error: "Usuario no encontrado", status: 404 as const };
  const prevCreditos = normalizeEnviosDisponibles((userSnap.data() as Record<string, unknown>).creditos);

  const userUpdates: Record<string, unknown> = {};
  if (options.estado) userUpdates.estado = options.estado;

  const batch = db.batch();

  if (options.setEnvios !== undefined) {
    const target = Math.max(0, Math.floor(options.setEnvios));
    const delta = target - prevCreditos;
    userUpdates.creditos = target;
    if (delta > 0) {
      const adminSnap = await db.collection("users").doc(options.adminUid).get();
      const adminCreditos = normalizeEnviosDisponibles(
        adminSnap.exists ? (adminSnap.data() as Record<string, unknown>).creditos : 0,
      );
      if (adminCreditos < delta) {
        return {
          error: `No tenés envíos suficientes para completar el ajuste. Disponibles: ${adminCreditos.toLocaleString("es-AR")}.`,
          status: 400 as const,
        };
      }
      batch.update(db.collection("users").doc(options.adminUid), {
        creditos: FieldValue.increment(-delta),
      });
    }
  } else if (options.addEnvios !== undefined && options.addEnvios > 0) {
    const add = Math.floor(options.addEnvios);
    const adminSnap = await db.collection("users").doc(options.adminUid).get();
    const adminCreditos = normalizeEnviosDisponibles(
      adminSnap.exists ? (adminSnap.data() as Record<string, unknown>).creditos : 0,
    );
    if (adminCreditos < add) {
      return {
        error: `No tenés envíos suficientes. Disponibles: ${adminCreditos.toLocaleString("es-AR")}.`,
        status: 400 as const,
      };
    }
    userUpdates.creditos = FieldValue.increment(add);
    batch.update(db.collection("users").doc(options.adminUid), {
      creditos: FieldValue.increment(-add),
    });
  }

  if (Object.keys(orgUpdates).length) batch.update(orgRef, orgUpdates);
  if (Object.keys(userUpdates).length) batch.update(userRef, userUpdates);
  await batch.commit();

  if (options.estado === "suspendido") {
    await getAdminAuth().updateUser(options.memberUid, { disabled: true }).catch(() => null);
  } else if (options.estado === "activo") {
    await getAdminAuth().updateUser(options.memberUid, { disabled: false }).catch(() => null);
  }

  return { ok: true as const };
}

export async function removeEmpresaMember(orgId: string, memberUid: string) {
  const db = getAdminDb();
  const orgRef = db.collection("organizations").doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) return { error: "Organización no encontrada", status: 404 as const };

  const orgData = orgSnap.data() as Record<string, unknown>;
  const adminUserId = String(orgData.adminUserId ?? "");
  if (memberUid === adminUserId) {
    return { error: "No podés quitar al administrador principal.", status: 400 as const };
  }

  await orgRef.update({
    members: FieldValue.arrayRemove(memberUid),
    [`memberMeta.${memberUid}`]: FieldValue.delete(),
  });
  return { ok: true as const };
}

export async function resetEmpresaMemberPassword(orgId: string, memberUid: string) {
  const db = getAdminDb();
  const orgSnap = await db.collection("organizations").doc(orgId).get();
  if (!orgSnap.exists) return { error: "Organización no encontrada", status: 404 as const };

  const d = orgSnap.data() as Record<string, unknown>;
  const adminUserId = String(d.adminUserId ?? "");
  const memberIds = Array.isArray(d.members) ? d.members.map(String) : [];
  if (memberUid !== adminUserId && !memberIds.includes(memberUid)) {
    return { error: "El usuario no pertenece a esta organización.", status: 400 as const };
  }

  const authUser = await getAdminAuth().getUser(memberUid).catch(() => null);
  const email = authUser?.email?.trim().toLowerCase();
  if (!email) return { error: "Esa cuenta no tiene email para enviar el enlace.", status: 400 as const };

  const mailResult = await sendEmpresaOperatorOnboardingEmail({
    email,
    orgNombre: String(d.nombre || "tu organización"),
    authCreated: false,
  });
  if (!mailResult.ok) {
    return { error: mailResult.error || "No se pudo enviar el correo", status: 502 as const };
  }

  await db.collection("users").doc(memberUid).set(
    {
      migrationSource: ADMIN_EMPRESA_ONBOARDING_SOURCE,
      mustSetPassword: true,
      passwordSetAt: null,
    },
    { merge: true },
  );

  return { ok: true as const, email };
}

export async function upsertBoca(orgId: string, boca: Omit<BocaEnvio, "createdAt"> & { createdAt?: unknown }) {
  const db = getAdminDb();
  const orgRef = db.collection("organizations").doc(orgId);
  const snap = await orgRef.get();
  if (!snap.exists) return { error: "Organización no encontrada", status: 404 as const };

  const bocas = parseBocas((snap.data() as Record<string, unknown>).bocas);
  const idx = bocas.findIndex((b) => b.id === boca.id);
  const next: BocaEnvio = {
    id: boca.id,
    nombre: boca.nombre.trim(),
    descripcion: boca.descripcion?.trim() || undefined,
    activa: boca.activa !== false,
    createdAt: idx >= 0 ? bocas[idx].createdAt : FieldValue.serverTimestamp(),
  };

  if (idx >= 0) bocas[idx] = next;
  else bocas.push(next);

  await orgRef.update({ bocas });
  return { ok: true as const, boca: next };
}

export async function deleteBoca(orgId: string, bocaId: string) {
  const db = getAdminDb();
  const orgRef = db.collection("organizations").doc(orgId);
  const snap = await orgRef.get();
  if (!snap.exists) return { error: "Organización no encontrada", status: 404 as const };

  const d = snap.data() as Record<string, unknown>;
  const bocas = parseBocas(d.bocas).filter((b) => b.id !== bocaId);
  const memberMeta = parseMemberMeta(d.memberMeta);
  const updates: Record<string, unknown> = { bocas };

  for (const [uid, meta] of Object.entries(memberMeta)) {
    if (meta.bocaId === bocaId) {
      updates[`memberMeta.${uid}`] = FieldValue.delete();
    }
  }

  await orgRef.update(updates);
  return { ok: true as const };
}
