import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  colegioMemberDocId,
  normalizeColegioEmail,
} from "@/lib/colegio-discount-server";
import {
  COLEGIO_BONUS_TAG_SAN_NICOL,
  COLEGIO_PENDING_ENVIOS_COLLECTION,
} from "@/lib/colegio-pending-envios";

export type ApplyPendingColegioResult = {
  applied: boolean;
  creditos: number;
  reason?: "none" | "already_redeemed" | "already_granted";
};

async function userAlreadyHasBonus(uid: string, bonusTag: string): Promise<boolean> {
  const snap = await getAdminDb()
    .collection("user_transactions")
    .where("userId", "==", uid)
    .where("bonusTag", "==", bonusTag)
    .limit(1)
    .get();
  return !snap.empty;
}

/**
 * Si hay envíos pendientes para el email (nómina colegio), los acredita y marca el pendiente.
 * Idempotente.
 */
export async function applyPendingColegioEnvios(
  uid: string,
  email: string,
): Promise<ApplyPendingColegioResult> {
  const norm = normalizeColegioEmail(email);
  if (!norm || !norm.includes("@")) {
    return { applied: false, creditos: 0, reason: "none" };
  }

  const db = getAdminDb();
  const pendingRef = db.collection(COLEGIO_PENDING_ENVIOS_COLLECTION).doc(colegioMemberDocId(norm));
  const pendingSnap = await pendingRef.get();
  if (!pendingSnap.exists) {
    return { applied: false, creditos: 0, reason: "none" };
  }

  const data = pendingSnap.data() as Record<string, unknown>;
  const bonusTag =
    typeof data.bonusTag === "string" && data.bonusTag.trim()
      ? data.bonusTag.trim()
      : COLEGIO_BONUS_TAG_SAN_NICOL;
  const cantidad =
    typeof data.creditos === "number" && Number.isFinite(data.creditos)
      ? Math.max(1, Math.floor(data.creditos))
      : 3;
  const descripcion =
    typeof data.descripcion === "string" && data.descripcion.trim()
      ? data.descripcion.trim()
      : `Regalo colegio (+${cantidad} envíos)`;

  if (data.redeemedAt) {
    return { applied: false, creditos: 0, reason: "already_redeemed" };
  }

  if (await userAlreadyHasBonus(uid, bonusTag)) {
    await pendingRef.set(
      {
        redeemedAt: FieldValue.serverTimestamp(),
        redeemedByUid: uid,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return { applied: false, creditos: 0, reason: "already_granted" };
  }

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return { applied: false, creditos: 0, reason: "none" };
  }

  await userRef.update({
    creditos: FieldValue.increment(cantidad),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db.collection("user_transactions").add({
    userId: uid,
    tipo: "regalo",
    descripcion,
    creditos: cantidad,
    monto: 0,
    bonusTag,
    fecha: FieldValue.serverTimestamp(),
  });

  await pendingRef.set(
    {
      redeemedAt: FieldValue.serverTimestamp(),
      redeemedByUid: uid,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { applied: true, creditos: cantidad };
}
