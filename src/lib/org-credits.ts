import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { normalizeEnviosDisponibles } from "@/lib/envios";

/** El saldo de empresa vive en `organizations/{orgId}.creditos`. */
export function orgCreditsNeedSeed(value: unknown): boolean {
  return typeof value !== "number" || !Number.isFinite(value);
}

/**
 * Si la org todavía no tiene `creditos` numérico, toma el saldo del admin
 * (modelo viejo: se acreditaba en `users/{adminUid}`).
 */
export function planOrgCreditsSeed(
  orgCreditos: unknown,
  adminCreditos: unknown,
): { seeded: boolean; creditos: number; takeFromAdmin: number } {
  if (!orgCreditsNeedSeed(orgCreditos)) {
    return {
      seeded: false,
      creditos: normalizeEnviosDisponibles(orgCreditos),
      takeFromAdmin: 0,
    };
  }
  const takeFromAdmin = normalizeEnviosDisponibles(adminCreditos);
  return { seeded: true, creditos: takeFromAdmin, takeFromAdmin };
}

export class InsufficientOrgCreditsError extends Error {
  readonly code = "INSUFFICIENT_ORG_CREDITS";
  readonly needed: number;
  readonly available: number;

  constructor(needed: number, available: number) {
    super(
      `Envíos insuficientes: la empresa necesita ${needed.toLocaleString("es-AR")} y tiene ${available.toLocaleString("es-AR")}.`,
    );
    this.name = "InsufficientOrgCreditsError";
    this.needed = needed;
    this.available = available;
  }
}

type OrgCreditSnap = {
  orgRef: FirebaseFirestore.DocumentReference;
  adminRef: FirebaseFirestore.DocumentReference | null;
  seed: ReturnType<typeof planOrgCreditsSeed>;
};

async function readOrgCreditsForTx(t: Transaction, orgId: string): Promise<OrgCreditSnap> {
  const db = getAdminDb();
  const orgRef = db.collection("organizations").doc(orgId);
  const orgSnap = await t.get(orgRef);
  if (!orgSnap.exists) throw new Error("Organización no encontrada");
  const org = orgSnap.data() || {};
  const adminUid = String(org.adminUserId || "").trim();
  const adminRef = adminUid ? db.collection("users").doc(adminUid) : null;
  const adminSnap = adminRef ? await t.get(adminRef) : null;
  return {
    orgRef,
    adminRef,
    seed: planOrgCreditsSeed(org.creditos, adminSnap?.data()?.creditos),
  };
}

function writeOrgCredits(
  t: Transaction,
  snap: OrgCreditSnap,
  next: number,
): void {
  t.update(snap.orgRef, {
    creditos: next,
    updatedAt: FieldValue.serverTimestamp(),
  });
  if (snap.seed.takeFromAdmin > 0 && snap.adminRef) {
    t.update(snap.adminRef, {
      creditos: FieldValue.increment(-snap.seed.takeFromAdmin),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

/**
 * Lee el saldo de la empresa. Si el campo no existe, lo inicializa con el
 * saldo del administrador y se lo quita a esa cuenta para no duplicarlo.
 */
export async function ensureOrgCredits(orgId: string): Promise<number> {
  const db = getAdminDb();
  return db.runTransaction(async (t) => {
    const snap = await readOrgCreditsForTx(t, orgId);
    if (snap.seed.seeded) writeOrgCredits(t, snap, snap.seed.creditos);
    return snap.seed.creditos;
  });
}

export async function addOrgCredits(orgId: string, amount: number): Promise<number> {
  const add = Math.floor(amount);
  if (!Number.isFinite(add) || add < 1) {
    throw new Error("Indicá cuántos envíos sumar (mínimo 1).");
  }
  const db = getAdminDb();
  return db.runTransaction(async (t) => {
    const snap = await readOrgCreditsForTx(t, orgId);
    const next = snap.seed.creditos + add;
    writeOrgCredits(t, snap, next);
    return next;
  });
}

export async function consumeOrgCredits(orgId: string, amount: number): Promise<number> {
  const need = Math.max(0, Math.floor(amount));
  if (need === 0) return ensureOrgCredits(orgId);
  const db = getAdminDb();
  return db.runTransaction(async (t) => consumeOrgCreditsInTx(t, orgId, need));
}

/** Todas las lecturas van primero: llamar después de los `t.get` del caller. */
export async function consumeOrgCreditsInTx(
  t: Transaction,
  orgId: string,
  amount: number,
): Promise<number> {
  const need = Math.max(0, Math.floor(amount));
  const snap = await readOrgCreditsForTx(t, orgId);
  if (need === 0) {
    if (snap.seed.seeded) writeOrgCredits(t, snap, snap.seed.creditos);
    return snap.seed.creditos;
  }
  if (snap.seed.creditos < need) {
    throw new InsufficientOrgCreditsError(need, snap.seed.creditos);
  }
  const next = snap.seed.creditos - need;
  writeOrgCredits(t, snap, next);
  return next;
}

export async function peekOrgCredits(orgId: string): Promise<number> {
  return ensureOrgCredits(orgId);
}
