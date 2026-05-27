import { createHash } from "node:crypto";
import { FieldValue, type DocumentReference, type Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { COLEGIO_DESCUENTO_PISO_ARS, type ColegioCollegeRow } from "@/lib/colegio-discount-types";
import {
  isLegalMevColegioConfigured,
  listLegalMevColegios,
  verifyLegalMevColegioMember,
} from "@/lib/legalmev-colegio-client";

/** Config global antigua (solo migración). */
export const COLEGIO_CONFIG_COLLECTION = "colegio_discount_config";
export const COLEGIO_CONFIG_DOC_ID = "settings";
export const COLEGIO_MEMBERS_COLLECTION = "colegio_discount_members";

export const COLEGIO_COLLEGES_COLLECTION = "colegio_discount_colleges";
export const COLEGIO_COLLEGE_MEMBERS_SUB = "members";

/** Doc creado al migrar datos legacy (un solo colegio). */
const LEGACY_MIGRATED_COLLEGE_ID = "legacy_v1";

export type ColegioDiscountConfig = {
  enabled: boolean;
  discountPercent: number;
  nombreColegio: string;
  updatedAt?: Timestamp;
};

export type { ColegioCollegeRow } from "@/lib/colegio-discount-types";

export const COLEGIO_NOMBRE_DEFAULT = "Colegio de abogados";

export function displayColegioNombre(raw: string | undefined | null): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s.length > 0 ? s : COLEGIO_NOMBRE_DEFAULT;
}

export function normalizeColegioEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function colegioMemberDocId(normalizedEmail: string): string {
  return createHash("sha256").update(normalizedEmail).digest("hex");
}

/**
 * Precio con descuento colegio (0–100%): se aplica el % sobre lista y luego se trunca al múltiplo inferior de
 * {@link COLEGIO_DESCUENTO_PISO_ARS} pesos (ej. 455 → 450).
 */
export function discountedListPrice(listPrice: number, discountPercent: number): number {
  if (!Number.isFinite(listPrice) || listPrice < 0) return 0;
  if (!Number.isFinite(discountPercent) || discountPercent <= 0) return Math.round(listPrice * 100) / 100;
  const step = COLEGIO_DESCUENTO_PISO_ARS;
  const factor = Math.min(100, Math.max(0, discountPercent)) / 100;
  const out = listPrice * (1 - factor);
  return Math.floor(Math.max(0, out) / step) * step;
}

const DEFAULT_CONFIG: ColegioDiscountConfig = {
  enabled: false,
  discountPercent: 0,
  nombreColegio: COLEGIO_NOMBRE_DEFAULT,
};

function parseCollegeDoc(
  id: string,
  d: Record<string, unknown>,
): Omit<ColegioCollegeRow, "id"> {
  const enabled = d.enabled === true;
  const discountPercent =
    typeof d.discountPercent === "number" && Number.isFinite(d.discountPercent)
      ? Math.min(100, Math.max(0, d.discountPercent))
      : 0;
  const nombreColegio = displayColegioNombre(d.nombreColegio as string | undefined);
  const memberCount =
    typeof d.memberCount === "number" && Number.isFinite(d.memberCount) ? Math.max(0, d.memberCount) : 0;
  const legalmevColegioId =
    typeof d.legalmevColegioId === "string" && d.legalmevColegioId.trim()
      ? d.legalmevColegioId.trim()
      : undefined;
  const legalmevMemberCount =
    typeof d.legalmevMemberCount === "number" && Number.isFinite(d.legalmevMemberCount)
      ? Math.max(0, d.legalmevMemberCount)
      : undefined;
  return {
    nombreColegio,
    enabled,
    discountPercent,
    memberCount,
    legalmevColegioId,
    legalmevMemberCount,
  };
}

let migrationPromise: Promise<void> | null = null;

/**
 * Si aún no hay colegios en la nueva colección pero existía configuración o matriculados
 * en el esquema antiguo, crea un colegio `legacy_v1` y copia la nómina.
 */
export async function ensureColegiosMigratedFromLegacy(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = runColegiosLegacyMigration();
  }
  await migrationPromise;
}

async function runColegiosLegacyMigration(): Promise<void> {
  const db = getAdminDb();
  const col = db.collection(COLEGIO_COLLEGES_COLLECTION);
  const anyNew = await col.limit(1).get();
  if (!anyNew.empty) return;

  const settingsSnap = await db.collection(COLEGIO_CONFIG_COLLECTION).doc(COLEGIO_CONFIG_DOC_ID).get();
  const legacyCountSnap = await db.collection(COLEGIO_MEMBERS_COLLECTION).count().get();
  const legacyN = legacyCountSnap.data().count;
  const hasLegacy = settingsSnap.exists || legacyN > 0;
  if (!hasLegacy) return;

  const d = settingsSnap.exists ? (settingsSnap.data() as Record<string, unknown>) : {};
  const enabled = d.enabled === true;
  const discountPercent =
    typeof d.discountPercent === "number" && Number.isFinite(d.discountPercent)
      ? Math.min(100, Math.max(0, d.discountPercent))
      : 0;
  const nombreColegio = displayColegioNombre(d.nombreColegio as string | undefined);

  const ref = col.doc(LEGACY_MIGRATED_COLLEGE_ID);
  await ref.set({
    nombreColegio,
    enabled,
    discountPercent,
    memberCount: 0,
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (legacyN === 0) return;

  const legacySnap = await db.collection(COLEGIO_MEMBERS_COLLECTION).get();
  const target = ref.collection(COLEGIO_COLLEGE_MEMBERS_SUB);
  let batch = db.batch();
  let ops = 0;
  let copied = 0;
  for (const doc of legacySnap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const payload = {
      email: typeof data.email === "string" ? data.email : doc.id,
      nombre: typeof data.nombre === "string" ? data.nombre : "",
      updatedAt: FieldValue.serverTimestamp(),
    };
    batch.set(target.doc(doc.id), payload, { merge: false });
    ops++;
    copied++;
    if (ops >= 450) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
  await ref.set({ memberCount: copied, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export type MemberRow = { nombre: string; email: string };

async function deleteMembersSubcollection(collegeRef: DocumentReference): Promise<void> {
  const db = getAdminDb();
  const sub = collegeRef.collection(COLEGIO_COLLEGE_MEMBERS_SUB);
  const snap = await sub.get();
  let batch = db.batch();
  let ops = 0;
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    ops++;
    if (ops >= 450) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
}

export async function listColegioColleges(): Promise<ColegioCollegeRow[]> {
  await ensureColegiosMigratedFromLegacy();
  const snap = await getAdminDb()
    .collection(COLEGIO_COLLEGES_COLLECTION)
    .orderBy("nombreColegio")
    .get();
  return snap.docs.map(( doc ) => {
    const d = doc.data() as Record<string, unknown>;
    const row = parseCollegeDoc(doc.id, d);
    return { id: doc.id, ...row };
  });
}

export async function createColegioCollege(partial?: { nombreColegio?: string }): Promise<ColegioCollegeRow> {
  await ensureColegiosMigratedFromLegacy();
  const db = getAdminDb();
  const ref = db.collection(COLEGIO_COLLEGES_COLLECTION).doc();
  const rawNombre =
    typeof partial?.nombreColegio === "string" && partial.nombreColegio.trim()
      ? partial.nombreColegio.trim().slice(0, 160)
      : "Nuevo colegio";
  const nombreColegio = displayColegioNombre(rawNombre);
  await ref.set({
    nombreColegio,
    enabled: false,
    discountPercent: 0,
    memberCount: 0,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return {
    id: ref.id,
    nombreColegio,
    enabled: false,
    discountPercent: 0,
    memberCount: 0,
  };
}

export async function patchColegioCollege(
  collegeId: string,
  partial: {
    enabled?: boolean;
    discountPercent?: number;
    nombreColegio?: string;
    legalmevColegioId?: string | null;
    legalmevMemberCount?: number | null;
  },
): Promise<ColegioCollegeRow> {
  await ensureColegiosMigratedFromLegacy();
  const db = getAdminDb();
  const ref = db.collection(COLEGIO_COLLEGES_COLLECTION).doc(collegeId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error("Colegio no encontrado");
  }
  const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (typeof partial.enabled === "boolean") patch.enabled = partial.enabled;
  if (partial.discountPercent !== undefined) {
    const n = Number(partial.discountPercent);
    if (!Number.isFinite(n)) {
      throw new Error("discountPercent inválido");
    }
    patch.discountPercent = Math.min(100, Math.max(0, n));
  }
  if (partial.nombreColegio !== undefined) {
    if (typeof partial.nombreColegio !== "string") {
      throw new Error("nombreColegio debe ser texto");
    }
    const s = partial.nombreColegio.trim().slice(0, 160);
    patch.nombreColegio = displayColegioNombre(s || null);
  }
  if (partial.legalmevColegioId !== undefined) {
    if (partial.legalmevColegioId === null || partial.legalmevColegioId === "") {
      patch.legalmevColegioId = FieldValue.delete();
    } else if (typeof partial.legalmevColegioId === "string") {
      patch.legalmevColegioId = partial.legalmevColegioId.trim().slice(0, 128);
    } else {
      throw new Error("legalmevColegioId debe ser texto");
    }
  }
  if (partial.legalmevMemberCount !== undefined) {
    if (partial.legalmevMemberCount === null) {
      patch.legalmevMemberCount = FieldValue.delete();
    } else if (typeof partial.legalmevMemberCount === "number" && Number.isFinite(partial.legalmevMemberCount)) {
      patch.legalmevMemberCount = Math.max(0, Math.floor(partial.legalmevMemberCount));
    } else {
      throw new Error("legalmevMemberCount inválido");
    }
  }
  if (Object.keys(patch).length <= 1) {
    throw new Error("Nada que actualizar");
  }
  await ref.set(patch, { merge: true });
  const next = await ref.get();
  const d = next.data() as Record<string, unknown>;
  return { id: collegeId, ...parseCollegeDoc(collegeId, d) };
}

function normalizeMatchName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Vincula un colegio de Notificas con LegalMev y guarda el conteo de matriculados activos.
 */
export async function syncColegioCollegeFromLegalMev(
  collegeId: string,
  options?: { legalmevColegioId?: string },
): Promise<ColegioCollegeRow> {
  if (!isLegalMevColegioConfigured()) {
    throw new Error("Falta LEGALMEV_URL y/o NOTIFICAS_LEGALMEV_SHARED_SECRET en el servidor");
  }

  await ensureColegiosMigratedFromLegacy();
  const db = getAdminDb();
  const ref = db.collection(COLEGIO_COLLEGES_COLLECTION).doc(collegeId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error("Colegio no encontrado");
  }

  const current = snap.data() as Record<string, unknown>;
  const nombreNotificas = displayColegioNombre(current.nombreColegio as string | undefined);
  const normNombre = normalizeMatchName(nombreNotificas);

  const list = await listLegalMevColegios();
  if (list.length === 0) {
    throw new Error("No hay colegios cargados en LegalMev");
  }

  const explicitId = options?.legalmevColegioId?.trim();
  const lm =
    (explicitId ? list.find((c) => c.id === explicitId) : undefined) ??
    list.find((c) => normalizeMatchName(c.name) === normNombre) ??
    list.find((c) => /san\s*nicol/i.test(c.name)) ??
    list.find((c) => c.convenioActivo) ??
    list[0];

  return patchColegioCollege(collegeId, {
    legalmevColegioId: lm.id,
    nombreColegio: lm.name,
    legalmevMemberCount: lm.memberCount,
  });
}

export async function deleteColegioCollege(collegeId: string): Promise<void> {
  await ensureColegiosMigratedFromLegacy();
  const db = getAdminDb();
  const ref = db.collection(COLEGIO_COLLEGES_COLLECTION).doc(collegeId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error("Colegio no encontrado");
  }
  await deleteMembersSubcollection(ref);
  await ref.delete();
}

/** Reemplaza por completo la nómina de un colegio. */
export async function replaceCollegeMembers(
  collegeId: string,
  members: MemberRow[],
): Promise<{ count: number }> {
  await ensureColegiosMigratedFromLegacy();
  const db = getAdminDb();
  const collegeRef = db.collection(COLEGIO_COLLEGES_COLLECTION).doc(collegeId);
  const collegeSnap = await collegeRef.get();
  if (!collegeSnap.exists) {
    throw new Error("Colegio no encontrado");
  }

  const col = collegeRef.collection(COLEGIO_COLLEGE_MEMBERS_SUB);
  await deleteMembersSubcollection(collegeRef);

  const seen = new Set<string>();
  const rows: Array<{ id: string; data: Record<string, unknown> }> = [];

  for (const m of members) {
    const rawEmail = typeof m.email === "string" ? m.email : String(m.email ?? "");
    const norm = normalizeColegioEmail(rawEmail);
    if (!norm || !norm.includes("@")) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    const nombre = typeof m.nombre === "string" ? m.nombre.trim() : String(m.nombre ?? "").trim();
    rows.push({
      id: colegioMemberDocId(norm),
      data: {
        email: norm,
        nombre: nombre || norm,
        updatedAt: FieldValue.serverTimestamp(),
      },
    });
  }

  let batch = db.batch();
  let ops = 0;
  for (const row of rows) {
    batch.set(col.doc(row.id), row.data, { merge: false });
    ops++;
    if (ops >= 450) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();

  const count = rows.length;
  await collegeRef.set(
    { memberCount: count, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  return { count };
}

/**
 * Texto genérico en la billetera si el usuario no tiene email en el token;
 * usa el primer colegio por nombre o el fallback.
 */
export async function getColegioFallbackBannerNombre(): Promise<string> {
  await ensureColegiosMigratedFromLegacy();
  const rows = await listColegioColleges();
  if (rows.length === 0) return COLEGIO_NOMBRE_DEFAULT;
  return rows[0].nombreColegio;
}

/**
 * @deprecated Preferí `getColegioFallbackBannerNombre` o `listColegioColleges`.
 * Devuelve datos del primer colegio (por nombre) para compatibilidad mínima.
 */
export async function getColegioConfig(): Promise<ColegioDiscountConfig> {
  await ensureColegiosMigratedFromLegacy();
  const rows = await listColegioColleges();
  const first = rows[0];
  if (!first) return { ...DEFAULT_CONFIG };
  return {
    enabled: first.enabled,
    discountPercent: first.discountPercent,
    nombreColegio: first.nombreColegio,
  };
}

/**
 * Lista + descuento activo: el mayor % entre colegios donde el mail figura y está habilitado.
 * Si está en nómina pero sin descuento activo, devuelve el nombre de ese colegio (orden alfabético).
 */
export async function resolveColegioDiscountForEmail(email: string): Promise<{
  eligible: boolean;
  discountPercent: number;
  enabled: boolean;
  onList: boolean;
  nombreColegio: string;
}> {
  await ensureColegiosMigratedFromLegacy();
  const norm = normalizeColegioEmail(email);
  if (!norm || !norm.includes("@")) {
    const fb = await getColegioFallbackBannerNombre();
    return {
      eligible: false,
      discountPercent: 0,
      enabled: false,
      onList: false,
      nombreColegio: fb,
    };
  }

  const db = getAdminDb();
  const hash = colegioMemberDocId(norm);
  const all = await db.collection(COLEGIO_COLLEGES_COLLECTION).get();

  type Row = { nombreColegio: string; enabled: boolean; discountPercent: number };
  const withMembership: Row[] = [];

  await Promise.all(
    all.docs.map(async (doc) => {
      const d = doc.data() as Record<string, unknown>;
      const enabled = d.enabled === true;
      const discountPercent =
        typeof d.discountPercent === "number" && Number.isFinite(d.discountPercent)
          ? Math.min(100, Math.max(0, d.discountPercent))
          : 0;
      const nombreColegio = displayColegioNombre(d.nombreColegio as string | undefined);
      const legalmevId =
        typeof d.legalmevColegioId === "string" && d.legalmevColegioId.trim()
          ? d.legalmevColegioId.trim()
          : "";

      if (legalmevId) {
        const lm = await verifyLegalMevColegioMember(norm, legalmevId);
        if (lm.onList || lm.isMember) {
          const displayName =
            lm.colegioName && lm.colegioName.trim() ? lm.colegioName.trim() : nombreColegio;
          if (lm.isMember) {
            withMembership.push({
              nombreColegio: displayName,
              enabled: enabled && lm.convenioActivo,
              discountPercent,
            });
          } else {
            withMembership.push({
              nombreColegio: displayName,
              enabled: false,
              discountPercent: 0,
            });
          }
        }
        return;
      }

      const mSnap = await doc.ref.collection(COLEGIO_COLLEGE_MEMBERS_SUB).doc(hash).get();
      if (!mSnap.exists) return;
      withMembership.push({ nombreColegio, enabled, discountPercent });
    }),
  );

  if (withMembership.length === 0) {
    const fb = await getColegioFallbackBannerNombre();
    return {
      eligible: false,
      discountPercent: 0,
      enabled: false,
      onList: false,
      nombreColegio: fb,
    };
  }

  const applicable = withMembership.filter((x) => x.enabled && x.discountPercent > 0);

  if (applicable.length > 0) {
    applicable.sort((a, b) => b.discountPercent - a.discountPercent);
    const best = applicable[0];
    return {
      eligible: true,
      discountPercent: best.discountPercent,
      enabled: true,
      onList: true,
      nombreColegio: best.nombreColegio,
    };
  }

  const sorted = [...withMembership].sort((a, b) =>
    a.nombreColegio.localeCompare(b.nombreColegio, "es"),
  );

  return {
    eligible: false,
    discountPercent: 0,
    enabled: false,
    onList: true,
    nombreColegio: sorted[0].nombreColegio,
  };
}
