import { FieldValue, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  getPaymentStatus,
  parseHubTransactionIdFromExternalReference,
} from '@/lib/mercadopago';

/** Respuesta mínima de GET /v1/payments/:id que usamos para conciliar */
export type MpPaymentResource = {
  id?: string | number;
  status?: string;
  external_reference?: string | null;
  preference_id?: string | null;
};

type PaymentRecord = MpPaymentResource & Record<string, unknown>;

function parseExternalReference(ref: string): { planId: string; userId: string } | null {
  const prefix = 'plan_';
  const mid = '_user_';
  if (!ref.startsWith(prefix)) return null;
  const rest = ref.slice(prefix.length);
  const idx = rest.indexOf(mid);
  if (idx === -1) return null;
  return {
    planId: rest.slice(0, idx),
    userId: rest.slice(idx + mid.length),
  };
}

function asMetaString(meta: Record<string, unknown>, key: string): string | null {
  const v = meta[key];
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function extractPaymentMetadata(payment: PaymentRecord): Record<string, unknown> | null {
  const m = payment.metadata;
  if (m && typeof m === 'object' && !Array.isArray(m)) {
    return m as Record<string, unknown>;
  }
  return null;
}

export async function findPendingTransactionForPayment(
  payment: MpPaymentResource
): Promise<QueryDocumentSnapshot | null> {
  const db = getAdminDb();
  const preferenceId =
    typeof payment.preference_id === 'string' && payment.preference_id.length > 0
      ? payment.preference_id
      : null;

  if (preferenceId) {
    const byPref = await db
      .collection('transactions')
      .where('preferenceId', '==', preferenceId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    if (!byPref.empty) return byPref.docs[0];
  }

  const ref = payment.external_reference;
  if (!ref || typeof ref !== 'string') return null;

  const hubTxnId = parseHubTransactionIdFromExternalReference(ref);
  if (hubTxnId) {
    const txnSnap = await db.collection('transactions').doc(hubTxnId).get();
    if (
      txnSnap.exists &&
      (txnSnap.data() as { status?: string } | undefined)?.status === 'pending'
    ) {
      return txnSnap as QueryDocumentSnapshot;
    }
    return null;
  }

  const parsed = parseExternalReference(ref);
  if (!parsed) return null;

  const { planId, userId } = parsed;
  const byRef = await db
    .collection('transactions')
    .where('userId', '==', userId)
    .where('planId', '==', planId)
    .where('status', '==', 'pending')
    .limit(1)
    .get();

  return byRef.empty ? null : byRef.docs[0];
}

export type SettleResult =
  | { ok: true; creditsAdded: number; alreadySettled: boolean }
  | { ok: false; status: number; error: string };

/**
 * Cuando no hay doc `transactions` pendiente (p.ej. nunca se guardó bien),
 * usamos metadata de la preferencia que Mercado Pago devuelve en el pago.
 */
async function settleApprovedFromMpMetadata(opts: {
  payment: PaymentRecord;
  paymentIdStr: string;
  actorUserId: string | null;
}): Promise<SettleResult> {
  const { payment, paymentIdStr, actorUserId } = opts;
  const meta = extractPaymentMetadata(payment);
  if (!meta) {
    return {
      ok: false,
      status: 404,
      error:
        'No encontramos datos de tu compra asociados al pago. Escribínos con el número de operación.',
    };
  }

  const metaUserId = asMetaString(meta, 'user_id');
  const metaPlanId = asMetaString(meta, 'plan_id');
  const creditsRaw = meta.credits != null ? Number(meta.credits) : NaN;

  if (!metaUserId || !metaPlanId) {
    return { ok: false, status: 404, error: 'El pago no trae información de plan/usuario esperada.' };
  }

  if (actorUserId && metaUserId !== actorUserId) {
    return { ok: false, status: 403, error: 'El pago no corresponde a tu usuario' };
  }

  const ext = payment.external_reference;
  if (ext && typeof ext === 'string') {
    const parsed = parseExternalReference(ext);
    if (parsed && parsed.userId !== metaUserId) {
      return {
        ok: false,
        status: 409,
        error: 'Datos del pago inconsistentes. Consultá soporte con el número de operación.',
      };
    }
  }

  const db = getAdminDb();
  const planSnap = await db.collection('plans').doc(metaPlanId).get();

  let addCredits =
    typeof creditsRaw === 'number' && Number.isFinite(creditsRaw)
      ? Math.floor(creditsRaw)
      : NaN;
  const paidAmount =
    typeof payment.transaction_amount === 'number' && Number.isFinite(payment.transaction_amount)
      ? payment.transaction_amount
      : 0;
  let monto = paidAmount;
  let planName = `Plan ${metaPlanId}`;

  if (planSnap.exists) {
    const p = planSnap.data()!;
    if (typeof p.creditos === 'number') addCredits = p.creditos;
    if (!monto && typeof p.precio === 'number') monto = p.precio;
    if (typeof p.nombre === 'string') planName = p.nombre;
  }

  if (!Number.isFinite(addCredits) || addCredits <= 0) {
    return { ok: false, status: 400, error: 'No se pudieron determinar los créditos del pago.' };
  }

  const stampRef = db.collection('applied_mp_payments').doc(paymentIdStr);

  try {
    const outcome = await db.runTransaction(async (t) => {
      const stampSnap = await t.get(stampRef);
      if (stampSnap.exists) {
        const c = stampSnap.data()?.creditsGranted;
        return {
          tag: 'already' as const,
          credits: typeof c === 'number' ? c : addCredits,
        };
      }

      const userRef = db.collection('users').doc(metaUserId);
      const userSnap = await t.get(userRef);
      if (!userSnap.exists) {
        return { tag: 'error' as const, error: 'Usuario no encontrado' };
      }

      const paymentData = JSON.parse(JSON.stringify(payment ?? {})) as Record<string, unknown>;

      t.set(stampRef, {
        paymentId: paymentIdStr,
        userId: metaUserId,
        planId: metaPlanId,
        creditsGranted: addCredits,
        appliedAt: FieldValue.serverTimestamp(),
      });

      t.update(userRef, {
        creditos: FieldValue.increment(addCredits),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const purchaseTransactionRef = db.collection('user_transactions').doc(`mp_${paymentIdStr}`);
      t.set(purchaseTransactionRef, {
        id: purchaseTransactionRef.id,
        userId: metaUserId,
        tipo: 'compra',
        descripcion: `Compra de ${addCredits} créditos — ${planName}`,
        monto,
        creditos: addCredits,
        metodoPago: 'Mercado Pago',
        fecha: FieldValue.serverTimestamp(),
        paymentId: paymentIdStr,
        planId: metaPlanId,
        settledVia: 'mp_metadata_fallback',
      });

      const ledgerRef = db.collection('transactions').doc();
      t.set(ledgerRef, {
        id: ledgerRef.id,
        userId: metaUserId,
        planId: metaPlanId,
        planName,
        price: monto,
        credits: addCredits,
        status: 'approved',
        paymentId: paymentIdStr,
        paymentData,
        recoveredFromMetadataFallback: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { tag: 'applied' as const, credits: addCredits };
    });

    if (outcome.tag === 'error') {
      return { ok: false, status: 404, error: outcome.error };
    }
    if (outcome.tag === 'already') {
      return { ok: true, creditsAdded: outcome.credits, alreadySettled: true };
    }
    return { ok: true, creditsAdded: outcome.credits, alreadySettled: false };
  } catch {
    return { ok: false, status: 500, error: 'Error al guardar la acreditación' };
  }
}

/**
 * Acredita créditos para un pago aprobado de Checkout Pro.
 * Idempotente: si ese paymentId ya figura en el historial, no vuelve a sumar.
 */
export async function settleMercadoPagoPayment(opts: {
  paymentId: string;
  /** Si se informa, debe coincidir con el userId de la transacción pendiente (y external_reference). */
  actorUserId: string | null;
}): Promise<SettleResult> {
  const paymentIdStr = String(opts.paymentId).trim();
  if (!paymentIdStr) {
    return { ok: false, status: 400, error: 'paymentId inválido' };
  }

  const db = getAdminDb();

  const dupPurchase = await db
    .collection('user_transactions')
    .where('paymentId', '==', paymentIdStr)
    .limit(1)
    .get();
  if (!dupPurchase.empty) {
    const c = dupPurchase.docs[0].data()?.creditos;
    const credits = typeof c === 'number' ? c : 0;
    return { ok: true, creditsAdded: credits, alreadySettled: true };
  }

  const existingByPayment = await db
    .collection('transactions')
    .where('paymentId', '==', paymentIdStr)
    .limit(1)
    .get();

  if (!existingByPayment.empty) {
    const docSnap = existingByPayment.docs[0];
    const data = docSnap.data();
    if (data.status === 'approved') {
      const credits =
        typeof data.credits === 'number' ? data.credits : 0;
      return { ok: true, creditsAdded: credits, alreadySettled: true };
    }
  }

  let payment: PaymentRecord;
  try {
    payment = (await getPaymentStatus(paymentIdStr)) as PaymentRecord;
  } catch {
    return { ok: false, status: 502, error: 'No se pudo consultar el pago en Mercado Pago' };
  }

  if (payment.status !== 'approved') {
    return { ok: false, status: 400, error: 'Pago no aprobado' };
  }

  const ext = payment.external_reference;
  if (ext && typeof ext === 'string') {
    const parsed = parseExternalReference(ext);
    if (parsed && opts.actorUserId && parsed.userId !== opts.actorUserId) {
      return { ok: false, status: 403, error: 'El pago no corresponde a tu usuario' };
    }
  }

  const transactionDoc = await findPendingTransactionForPayment(payment);
  if (!transactionDoc) {
    return settleApprovedFromMpMetadata({
      payment,
      paymentIdStr,
      actorUserId: opts.actorUserId,
    });
  }

  const transactionData = transactionDoc.data();
  const txnUserId = transactionData.userId as string;
  if (opts.actorUserId && txnUserId !== opts.actorUserId) {
    return { ok: false, status: 403, error: 'Usuario no coincide con la compra' };
  }

  const credits =
    typeof transactionData.credits === 'number' ? transactionData.credits : 0;
  const txnRef = transactionDoc.ref;

  try {
    const outcome = await db.runTransaction(async (t) => {
      const snap = await t.get(txnRef);
      const data = snap.data();
      if (!data) {
        return { tag: 'error' as const, error: 'Transacción inexistente' };
      }

      if (data.paymentId === paymentIdStr && data.status === 'approved') {
        const c =
          typeof data.credits === 'number' ? data.credits : credits;
        return { tag: 'already' as const, credits: c };
      }

      if (data.status !== 'pending') {
        return {
          tag: 'error' as const,
          error: 'La compra ya fue procesada o cancelada',
        };
      }

      const uid = data.userId as string;
      const userRef = db.collection('users').doc(uid);
      const userSnap = await t.get(userRef);
      if (!userSnap.exists) {
        return { tag: 'error' as const, error: 'Usuario no encontrado' };
      }

      const addCredits =
        typeof data.credits === 'number' ? data.credits : 0;

      const paymentData = JSON.parse(JSON.stringify(payment ?? {})) as Record<
        string,
        unknown
      >;

      t.update(txnRef, {
        paymentId: paymentIdStr,
        status: payment.status,
        paymentData,
        updatedAt: FieldValue.serverTimestamp(),
      });

      t.update(userRef, {
        creditos: FieldValue.increment(addCredits),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const purchaseTransactionRef = db.collection('user_transactions').doc(`mp_${paymentIdStr}`);
      t.set(purchaseTransactionRef, {
        id: purchaseTransactionRef.id,
        userId: uid,
        tipo: 'compra',
        descripcion: `Compra de ${data.credits} créditos — ${data.planName}`,
        monto: data.price,
        creditos: data.credits,
        metodoPago: 'Mercado Pago',
        fecha: FieldValue.serverTimestamp(),
        paymentId: paymentIdStr,
        planId: data.planId,
      });

      return { tag: 'applied' as const, credits: addCredits };
    });

    if (outcome.tag === 'error') {
      return {
        ok: false,
        status:
          outcome.error === 'Usuario no encontrado'
            ? 404
            : outcome.error === 'Transacción inexistente'
              ? 404
              : 409,
        error: outcome.error,
      };
    }

    if (outcome.tag === 'already') {
      return {
        ok: true,
        creditsAdded: outcome.credits,
        alreadySettled: true,
      };
    }

    return {
      ok: true,
      creditsAdded: outcome.credits,
      alreadySettled: false,
    };
  } catch {
    return { ok: false, status: 500, error: 'Error al guardar la acreditación' };
  }
}
