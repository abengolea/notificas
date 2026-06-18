import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  COLEGIO_COLLEGES_COLLECTION,
  COLEGIO_COLLEGE_MEMBERS_SUB,
  ensureColegiosMigratedFromLegacy,
  listColegioColleges,
  normalizeColegioEmail,
} from "@/lib/colegio-discount-server";
import {
  isLegalMevColegioConfigured,
  listLegalMevColegioMembers,
} from "@/lib/legalmev-colegio-client";
import { normalizeEnviosDisponibles } from "@/lib/envios";

export type AdminUserListRow = {
  id: string;
  nombre: string;
  email: string;
  estado: "activo" | "suspendido";
  enviosDisponibles: number;
  fechaRegistro: string;
  /** Matriculado en nómina del colegio (LegalMev o lista local). */
  enNominaColegio: boolean;
  colegioId?: string;
  colegioNombre?: string;
  colegioMemberEstado?: "activo" | "suspendido";
  tieneCuentaNotificas: boolean;
};

function sortByRegistroDesc(a: AdminUserListRow, b: AdminUserListRow): number {
  return new Date(b.fechaRegistro).getTime() - new Date(a.fechaRegistro).getTime();
}

type CollegeMembership = {
  collegeId: string;
  nombreColegio: string;
  estado: "activo" | "suspendido";
};

/** Mapa email → colegio (nómina local en Firestore). */
async function buildCollegeMembershipMap(): Promise<Map<string, CollegeMembership>> {
  const map = new Map<string, CollegeMembership>();
  await ensureColegiosMigratedFromLegacy();
  const colleges = await listColegioColleges();
  for (const college of colleges) {
    const members = await loadLocalCollegeMembers(college.id);
    for (const m of members) {
      map.set(m.email, {
        collegeId: college.id,
        nombreColegio: college.nombreColegio,
        estado: m.estado,
      });
    }
  }
  return map;
}

function applyCollegeMembership(
  user: AdminUserListRow,
  membership: CollegeMembership | undefined,
): AdminUserListRow {
  if (!membership) return user;
  return {
    ...user,
    enNominaColegio: true,
    colegioId: membership.collegeId,
    colegioNombre: membership.nombreColegio,
    colegioMemberEstado: membership.estado,
  };
}

function toIso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  return new Date(0).toISOString();
}

async function loadNotificasUsersByEmail(): Promise<Map<string, AdminUserListRow>> {
  const db = getAdminDb();
  let snap;
  try {
    snap = await db.collection("users").orderBy("createdAt", "desc").limit(800).get();
  } catch {
    snap = await db.collection("users").limit(800).get();
  }

  const map = new Map<string, AdminUserListRow>();
  for (const docSnap of snap.docs) {
    const d = docSnap.data() as Record<string, unknown>;
    const perfil = (d.perfil || {}) as { nombre?: string; apellido?: string };
    const email = typeof d.email === "string" ? normalizeColegioEmail(d.email) : "";
    if (!email) continue;
    const nombre =
      (typeof perfil.nombre === "string" && perfil.nombre.trim()) ||
      [perfil.nombre, perfil.apellido].filter(Boolean).join(" ").trim() ||
      email;
    map.set(email, {
      id: docSnap.id,
      nombre,
      email,
      estado: d.estado === "suspendido" ? "suspendido" : "activo",
      enviosDisponibles: normalizeEnviosDisponibles(d.creditos),
      fechaRegistro: toIso(d.createdAt),
      enNominaColegio: false,
      tieneCuentaNotificas: true,
    });
  }
  return map;
}

async function loadLocalCollegeMembers(
  collegeId: string,
): Promise<Array<{ email: string; nombre: string; estado: "activo" | "suspendido" }>> {
  const db = getAdminDb();
  const sub = await db
    .collection(COLEGIO_COLLEGES_COLLECTION)
    .doc(collegeId)
    .collection(COLEGIO_COLLEGE_MEMBERS_SUB)
    .limit(5000)
    .get();
  return sub.docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>;
      const email = normalizeColegioEmail(String(data.email ?? ""));
      const nombre = String(data.nombre ?? email).trim() || email;
      const estado: "activo" | "suspendido" =
        data.estado === "suspendido" ? "suspendido" : "activo";
      return { email, nombre, estado };
    })
    .filter((m) => m.email.includes("@"));
}

export type ListAdminUsersOptions = {
  /** todos | colegio | solo_cuenta (usuarios Notificas sin filtrar nómina) */
  filter?: "todos" | "colegio" | "solo_cuenta";
  collegeId?: string;
};

export async function listAdminUsersMerged(
  options: ListAdminUsersOptions = {},
): Promise<{ users: AdminUserListRow[]; colegioNombre?: string }> {
  const filter = options.filter ?? "todos";
  const byEmail = await loadNotificasUsersByEmail();

  if (filter === "solo_cuenta" || filter === "todos") {
    const collegeByEmail = await buildCollegeMembershipMap();
    const users = [...byEmail.values()]
      .map((u) => applyCollegeMembership(u, collegeByEmail.get(u.email)))
      .sort(sortByRegistroDesc);
    return { users };
  }

  await ensureColegiosMigratedFromLegacy();
  const colleges = await listColegioColleges();

  if (!options.collegeId) {
    return { users: [] };
  }

  const college = colleges.find((c) => c.id === options.collegeId);

  if (!college) {
    return { users: [] };
  }

  let colegioNombre = college?.nombreColegio;
  let roster: Array<{ email: string; nombre: string; estado: "activo" | "suspendido" }> =
    [];

  if (college?.legalmevColegioId && isLegalMevColegioConfigured()) {
    const lm = await listLegalMevColegioMembers(college.legalmevColegioId);
    colegioNombre = lm.colegioName || colegioNombre;
    roster = lm.members.map((m) => ({
      email: normalizeColegioEmail(m.email),
      nombre: m.name || m.email,
      estado: m.estado === "suspendido" ? "suspendido" : "activo",
    }));
  } else if (college) {
    roster = await loadLocalCollegeMembers(college.id);
  }

  const merged: AdminUserListRow[] = [];

  for (const m of roster) {
    const existing = byEmail.get(m.email);
    if (existing) {
      merged.push({
        ...existing,
        enNominaColegio: true,
        colegioId: college.id,
        colegioNombre,
        colegioMemberEstado: m.estado,
        tieneCuentaNotificas: true,
      });
    } else {
      merged.push({
        id: "",
        nombre: m.nombre,
        email: m.email,
        estado: m.estado,
        enviosDisponibles: 0,
        fechaRegistro: new Date(0).toISOString(),
        enNominaColegio: true,
        colegioId: college.id,
        colegioNombre,
        colegioMemberEstado: m.estado,
        tieneCuentaNotificas: false,
      });
    }
  }

  merged.sort(sortByRegistroDesc);

  return { users: merged, colegioNombre };
}

export type UserHistorialItem = {
  id: string;
  fecha: string;
  tipo: string;
  descripcion: string;
  creditos: number;
  monto: number;
};

export async function getUserHistorial(uid: string): Promise<UserHistorialItem[]> {
  const db = getAdminDb();
  const items: UserHistorialItem[] = [];

  const txSnap = await db
    .collection("user_transactions")
    .where("userId", "==", uid)
    .limit(80)
    .get();

  for (const doc of txSnap.docs) {
    const d = doc.data() as Record<string, unknown>;
    items.push({
      id: doc.id,
      fecha: toIso(d.fecha),
      tipo: String(d.tipo ?? "movimiento"),
      descripcion: String(d.descripcion ?? ""),
      creditos: typeof d.creditos === "number" ? d.creditos : 0,
      monto: typeof d.monto === "number" ? d.monto : 0,
    });
  }

  items.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  return items.slice(0, 50);
}

/** Busca uid por email en users. */
export async function findUserUidByEmail(email: string): Promise<string | null> {
  const norm = normalizeColegioEmail(email);
  if (!norm) return null;
  const db = getAdminDb();
  const snap = await db.collection("users").where("email", "==", norm).limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}
