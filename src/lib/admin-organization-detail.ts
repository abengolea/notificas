import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { normalizeEnviosDisponibles } from "@/lib/envios";
import { ensureOrgCredits } from "@/lib/org-credits";
import type {
  AdminOrgContact,
  AdminOrgMember,
  AdminOrganizationDetail,
} from "@/lib/admin-organization-detail-types";

export type {
  AdminOrgContact,
  AdminOrgMember,
  AdminOrganizationDetail,
} from "@/lib/admin-organization-detail-types";

function toIso(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "object" && v && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
    try {
      const d = (v as { toDate: () => Date }).toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
    } catch {
      return null;
    }
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toISOString();
  }
  return null;
}

function perfilString(perfil: unknown, key: string): string {
  if (!perfil || typeof perfil !== "object") return "";
  const v = (perfil as Record<string, unknown>)[key];
  return typeof v === "string" ? v.trim() : "";
}

async function resolveOperator(
  uid: string,
  adminUserId: string,
): Promise<AdminOrgMember> {
  const auth = getAdminAuth();
  const db = getAdminDb();
  const [authUser, userSnap] = await Promise.all([
    auth.getUser(uid).catch(() => null),
    db.collection("users").doc(uid).get(),
  ]);
  const data = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : {};
  const email =
    (authUser?.email || (typeof data.email === "string" ? data.email : "") || "").trim().toLowerCase();
  const nombre =
    (authUser?.displayName || perfilString(data.perfil, "nombre") || email || uid).trim();
  const telefono = (authUser?.phoneNumber || perfilString(data.perfil, "telefono") || "").trim();
  const estado = data.estado === "suspendido" || authUser?.disabled ? "suspendido" : "activo";
  return {
    uid,
    email,
    nombre,
    telefono,
    estado,
    enviosDisponibles: normalizeEnviosDisponibles(data.creditos),
    mustSetPassword: data.mustSetPassword === true,
    emailVerified: authUser?.emailVerified === true,
    lastLoginAt: authUser?.metadata.lastSignInTime || null,
    isOrgAdmin: uid === adminUserId,
  };
}

/** Nombre y teléfono de quien entra como administrador. No es el nombre de la empresa. */
export async function updateOrgAdminProfile(
  adminUserId: string,
  patch: { nombre?: string; telefono?: string },
): Promise<void> {
  const uid = String(adminUserId || "").trim();
  if (!uid) return;
  const nombre = patch.nombre !== undefined ? patch.nombre.trim() : undefined;
  const telefono = patch.telefono !== undefined ? patch.telefono.trim() : undefined;
  if (nombre === undefined && telefono === undefined) return;

  const db = getAdminDb();
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const prev = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : {};
  const perfil =
    prev.perfil && typeof prev.perfil === "object"
      ? { ...(prev.perfil as Record<string, unknown>) }
      : {};
  if (nombre !== undefined) perfil.nombre = nombre;
  if (telefono !== undefined) perfil.telefono = telefono;
  await userRef.set({ perfil }, { merge: true });

  if (nombre !== undefined) {
    await getAdminAuth().updateUser(uid, { displayName: nombre }).catch(() => null);
  }
}

export async function loadAdminOrganizationDetail(orgId: string): Promise<AdminOrganizationDetail | null> {
  const db = getAdminDb();
  const snap = await db.collection("organizations").doc(orgId).get();
  if (!snap.exists) return null;
  const d = snap.data() as Record<string, unknown>;
  const adminUserId = String(d.adminUserId ?? "");
  const memberIds = Array.isArray(d.members) ? d.members.map((m) => String(m)).filter(Boolean) : [];
  const uids = [...new Set([adminUserId, ...memberIds].filter(Boolean))];

  const [operators, campaignSnap, listSnap, enviosDisponibles] = await Promise.all([
    Promise.all(uids.map((uid) => resolveOperator(uid, adminUserId))),
    db.collection("campaigns").where("orgId", "==", orgId).get().catch(() => null),
    db.collection("recipient_lists").where("orgId", "==", orgId).get().catch(() => null),
    ensureOrgCredits(orgId).catch(() => normalizeEnviosDisponibles(d.creditos)),
  ]);

  const contacts: AdminOrgContact[] = [];
  const seen = new Set<string>();
  let recipientCount = 0;
  const listDocs = listSnap?.docs ?? [];
  for (const listDoc of listDocs) {
    const x = listDoc.data();
    const lista = String(x.nombre || "");
    const recs = Array.isArray(x.recipients) ? x.recipients : [];
    recipientCount += typeof x.count === "number" ? x.count : recs.length;
    for (const raw of recs) {
      if (contacts.length >= 50) break;
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const email = String(r.email ?? "").trim().toLowerCase();
      const telefono = String(r.telefono ?? "").trim();
      const nombre = String(r.nombre ?? "").trim();
      const key = `${email}|${telefono}`;
      if (!email && !telefono) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      contacts.push({ email, nombre, telefono, lista });
    }
  }

  operators.sort((a, b) => Number(b.isOrgAdmin) - Number(a.isOrgAdmin) || a.email.localeCompare(b.email));

  return {
    id: snap.id,
    nombre: String(d.nombre ?? ""),
    cuit: String(d.cuit ?? ""),
    tipo: String(d.tipo ?? "empresa"),
    plan: String(d.plan ?? "starter"),
    logoUrl: typeof d.logoUrl === "string" ? d.logoUrl : null,
    adminUserId,
    adminUserEmail: String(d.adminUserEmail ?? "").trim().toLowerCase(),
    members: memberIds,
    isTestOrganization: d.isTestOrganization === true,
    environment: typeof d.environment === "string" ? d.environment : null,
    createdAt: toIso(d.createdAt),
    enviosDisponibles,
    campaignCount: campaignSnap?.size ?? 0,
    listCount: listDocs.length,
    recipientCount,
    operators,
    contacts,
    contactsTruncated: recipientCount > contacts.length,
  };
}
