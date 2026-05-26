import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  getPaymentStatus,
  parseHubTransactionIdFromExternalReference,
} from '@/lib/mercadopago';

type PaymentRecord = Record<string, unknown> & {
  id?: string | number;
  status?: string;
  external_reference?: string | null;
  preference_id?: string | null;
  transaction_amount?: number;
  payer?: { email?: string | null };
};

type BillingHubResult =
  | {
      ok: true;
      facturaId?: string;
      CAE?: string;
      CAEFchVto?: string;
      voucherNumber?: number;
      ptoVta?: number;
      cbteTipo?: number;
      tipoComprobante?: string;
      netoGravado?: number;
      iva?: number;
      total?: number;
      alreadyIssued?: boolean;
    }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped?: false; error: string; status?: number };

type BillingHubPersistStatus = 'issued' | 'pending' | 'failed';

type BillingHubSnapshot = {
  id: string;
  ref: {
    set(data: Record<string, unknown>, options: { merge: boolean }): Promise<unknown>;
  };
  data(): Record<string, unknown>;
};

function billingEmitUrl(): string | undefined {
  const explicit =
    process.env.NOTIFICASHUB_BILLING_EMIT_URL ||
    process.env.NOTIFICAS_HUB_BILLING_EMIT_URL;
  const explicitUrl = explicit?.trim();
  if (explicitUrl) return explicitUrl;

  const hubBase = process.env.NOTIFICASHUB_URL?.trim().replace(/\/+$/, '');
  if (!hubBase) return undefined;

  return `${hubBase}/api/integrations/notificas/billing/emit`;
}

function billingSharedSecret(): string | undefined {
  const raw =
    process.env.NOTIFICAS_BILLING_SHARED_SECRET ||
    process.env.NOTIFICASHUB_BILLING_SHARED_SECRET;
  const secret = raw?.trim();
  return secret || undefined;
}

function metadataOf(payment: PaymentRecord): Record<string, unknown> {
  const metadata = payment.metadata;
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function metaString(meta: Record<string, unknown>, key: string): string | undefined {
  const value = meta[key];
  if (value == null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function asString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function digits(value: unknown, max = 32): string | undefined {
  const d = asString(value)?.replace(/\D/g, '').slice(0, max);
  return d || undefined;
}

function limitText(value: string | undefined, max = 500): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}

function hubErrorMessage(json: Record<string, unknown>, status: number): string {
  const explicit = asString(json.error) || asString(json.message);
  if (explicit && !explicit.trimStart().startsWith('<!DOCTYPE html')) {
    return explicit;
  }
  if (status === 404) {
    return 'Endpoint de facturación del Hub no encontrado';
  }
  return `Hub respondió HTTP ${status}`;
}

function statusForHubReason(reason: string): BillingHubPersistStatus {
  const normalized = reason.toLowerCase();
  if (
    normalized.includes('pending') ||
    normalized.includes('not_ready') ||
    normalized.includes('process') ||
    normalized.includes('pendiente')
  ) {
    return 'pending';
  }
  return 'failed';
}

async function persistBillingHubAttempt(opts: {
  paymentId: string;
  transactionSnap: BillingHubSnapshot | null;
  billingHub: Record<string, unknown> & { status: BillingHubPersistStatus };
}) {
  const { paymentId, transactionSnap, billingHub } = opts;
  if (!transactionSnap) return;

  const currentBillingHub = transactionSnap.data().billingHub as
    | { status?: unknown }
    | undefined;
  if (billingHub.status !== 'issued' && currentBillingHub?.status === 'issued') {
    return;
  }

  const db = getAdminDb();
  await transactionSnap.ref.set({ billingHub }, { merge: true });
  await db
    .collection('user_transactions')
    .doc(`mp_${paymentId}`)
    .set({ billingHub }, { merge: true });
}

function buildBillingHubProblem(opts: {
  status: BillingHubPersistStatus;
  reason?: string;
  error?: string;
  httpStatus?: number;
}) {
  return {
    status: opts.status,
    facturaId: null,
    cae: null,
    caeFchVto: null,
    voucherNumber: null,
    ptoVta: null,
    cbteTipo: null,
    tipoComprobante: null,
    reason: limitText(opts.reason),
    error: limitText(opts.error),
    httpStatus: opts.httpStatus ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

async function findSettledTransaction(payment: PaymentRecord) {
  const db = getAdminDb();
  const paymentId = asString(payment.id);
  if (paymentId) {
    const byPayment = await db
      .collection('transactions')
      .where('paymentId', '==', paymentId)
      .limit(1)
      .get();
    if (!byPayment.empty) return byPayment.docs[0];
  }

  const preferenceId = asString(payment.preference_id);
  if (preferenceId) {
    const byPreference = await db
      .collection('transactions')
      .where('preferenceId', '==', preferenceId)
      .limit(1)
      .get();
    if (!byPreference.empty) return byPreference.docs[0];
  }

  const externalReference = asString(payment.external_reference);
  if (externalReference) {
    const transactionId = parseHubTransactionIdFromExternalReference(externalReference);
    if (transactionId) {
      const snap = await db.collection('transactions').doc(transactionId).get();
      if (snap.exists) return snap;
    }
  }

  return null;
}

function resolveRazonSocial(profile: Record<string, unknown>, meta: Record<string, unknown>) {
  const fromMeta = metaString(meta, 'hub_razon_social');
  if (fromMeta) return fromMeta;
  const razonSocial = asString(profile.razonSocial);
  if (razonSocial) return razonSocial;
  return [profile.nombre, profile.apellido]
    .map(asString)
    .filter(Boolean)
    .join(' ')
    .trim();
}

/**
 * Pide al Hub que emita factura ARCA para un pago aprobado de Mercado Pago.
 * No debe bloquear la acreditación de créditos: ante error fiscal, registra logs y devuelve estado.
 */
export async function requestHubInvoiceForMercadoPagoPayment(
  paymentId: string
): Promise<BillingHubResult> {
  const url = billingEmitUrl();
  const secret = billingSharedSecret();

  let payment: PaymentRecord;
  try {
    payment = (await getPaymentStatus(paymentId)) as PaymentRecord;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo consultar Mercado Pago',
    };
  }

  const meta = metadataOf(payment);
  const paymentIdStr = String(payment.id ?? paymentId);
  const transactionSnap = (await findSettledTransaction(payment)) as BillingHubSnapshot | null;
  const transaction = transactionSnap?.data() as Record<string, unknown> | undefined;

  if (payment.status !== 'approved') {
    await persistBillingHubAttempt({
      paymentId: paymentIdStr,
      transactionSnap,
      billingHub: buildBillingHubProblem({
        status: 'pending',
        reason: 'payment_not_approved',
        error: asString(payment.status),
      }),
    });
    return { ok: false, skipped: true, reason: 'payment_not_approved' };
  }

  const shouldEmit =
    metaString(meta, 'hub_emit_factura') === 'true' ||
    process.env.MERCADOPAGO_HUB_EMIT_FACTURA === 'true' ||
    process.env.NOTIFICASHUB_BILLING_FORCE_EMIT === 'true';
  if (!shouldEmit) {
    await persistBillingHubAttempt({
      paymentId: paymentIdStr,
      transactionSnap,
      billingHub: buildBillingHubProblem({
        status: 'failed',
        reason: 'hub_emit_factura_not_enabled',
      }),
    });
    return { ok: false, skipped: true, reason: 'hub_emit_factura_not_enabled' };
  }

  if (!url || !secret) {
    await persistBillingHubAttempt({
      paymentId: paymentIdStr,
      transactionSnap,
      billingHub: buildBillingHubProblem({
        status: 'failed',
        reason: 'hub_billing_not_configured',
      }),
    });
    return { ok: false, skipped: true, reason: 'hub_billing_not_configured' };
  }

  const userId = asString(transaction?.userId) || metaString(meta, 'user_id');
  const db = getAdminDb();

  let userData: Record<string, unknown> | undefined;
  if (userId) {
    const userSnap = await db.collection('users').doc(userId).get();
    userData = userSnap.data() as Record<string, unknown> | undefined;
  }
  const profile = (userData?.perfil ?? {}) as Record<string, unknown>;

  const amount =
    typeof transaction?.price === 'number'
      ? transaction.price
      : typeof payment.transaction_amount === 'number'
        ? payment.transaction_amount
        : Number(metaString(meta, 'amount') ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    await persistBillingHubAttempt({
      paymentId: paymentIdStr,
      transactionSnap,
      billingHub: buildBillingHubProblem({
        status: 'failed',
        error: 'Importe inválido para facturación Hub',
      }),
    });
    return { ok: false, error: 'Importe inválido para facturación Hub' };
  }

  const cuit = metaString(meta, 'hub_cuit_comprador') || digits(profile.cuit, 11);
  const cbteTipo = metaString(meta, 'hub_cbte_tipo') || process.env.MERCADOPAGO_HUB_CBTE_TIPO;
  const planName = asString(transaction?.planName) || metaString(meta, 'plan_name');
  const credits =
    typeof transaction?.credits === 'number'
      ? transaction.credits
      : Number(metaString(meta, 'credits') ?? 0);

  const payload = {
    idempotencyKey: `notificas_mp_${paymentIdStr}`,
    paymentId: paymentIdStr,
    transactionId: transactionSnap?.id,
    preferenceId: asString(payment.preference_id) || asString(transaction?.preferenceId),
    amount,
    amountIncludesVat: true,
    cbteTipo:
      cbteTipo === 'A' || cbteTipo === 'B' || cbteTipo === 'C' ? cbteTipo : undefined,
    buyer: {
      email:
        asString(payment.payer?.email) ||
        asString(userData?.email) ||
        metaString(meta, 'payer_email'),
      razonSocial: resolveRazonSocial(profile, meta),
      cuit,
      dni: digits(profile.dni, 8),
      ivaCondicion: asString(profile.ivaCondicion),
      domicilio: asString(profile.direccion),
    },
    item: {
      planId: asString(transaction?.planId) || metaString(meta, 'plan_id'),
      planName,
      credits: Number.isFinite(credits) && credits > 0 ? credits : undefined,
      description:
        metaString(meta, 'hub_concepto') ||
        (planName && credits ? `${planName} - ${credits} envíos` : planName),
    },
    metadata: {
      external_reference: asString(payment.external_reference),
      hub_cliente_id: metaString(meta, 'hub_cliente_id'),
      hub_pedido_id: metaString(meta, 'hub_pedido_id'),
      hub_periodo: metaString(meta, 'hub_periodo'),
    },
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    await persistBillingHubAttempt({
      paymentId: paymentIdStr,
      transactionSnap,
      billingHub: buildBillingHubProblem({
        status: 'failed',
        error: error instanceof Error ? error.message : 'No se pudo contactar al Hub',
      }),
    });
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo contactar al Hub',
    };
  }

  const text = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { error: text.slice(0, 300) };
  }

  if (!response.ok) {
    const error = hubErrorMessage(json, response.status);
    await persistBillingHubAttempt({
      paymentId: paymentIdStr,
      transactionSnap,
      billingHub: buildBillingHubProblem({
        status: 'failed',
        error,
        httpStatus: response.status,
      }),
    });
    return {
      ok: false,
      status: response.status,
      error,
    };
  }

  if (json.ok === false) {
    const reason = asString(json.status) || asString(json.message) || 'hub_invoice_not_ready';
    await persistBillingHubAttempt({
      paymentId: paymentIdStr,
      transactionSnap,
      billingHub: buildBillingHubProblem({
        status: statusForHubReason(reason),
        reason,
      }),
    });
    return {
      ok: false,
      skipped: true,
      reason,
    };
  }

  const result: BillingHubResult = {
    ok: true,
    facturaId: asString(json.facturaId),
    CAE: asString(json.CAE),
    CAEFchVto: asString(json.CAEFchVto),
    voucherNumber:
      typeof json.voucherNumber === 'number' ? json.voucherNumber : undefined,
    ptoVta: typeof json.ptoVta === 'number' ? json.ptoVta : undefined,
    cbteTipo: typeof json.cbteTipo === 'number' ? json.cbteTipo : undefined,
    tipoComprobante: asString(json.tipoComprobante),
    netoGravado: typeof json.netoGravado === 'number' ? json.netoGravado : undefined,
    iva: typeof json.iva === 'number' ? json.iva : undefined,
    total: typeof json.total === 'number' ? json.total : undefined,
    alreadyIssued: json.alreadyIssued === true,
  };

  await persistBillingHubAttempt({
    paymentId: paymentIdStr,
    transactionSnap,
    billingHub: {
      status: 'issued',
      facturaId: result.facturaId ?? null,
      cae: result.CAE ?? null,
      caeFchVto: result.CAEFchVto ?? null,
      voucherNumber: result.voucherNumber ?? null,
      ptoVta: result.ptoVta ?? null,
      cbteTipo: result.cbteTipo ?? null,
      tipoComprobante: result.tipoComprobante ?? null,
      netoGravado: result.netoGravado ?? null,
      iva: result.iva ?? null,
      total: result.total ?? amount,
      buyerRazonSocial: payload.buyer.razonSocial || null,
      buyerCuit: payload.buyer.cuit || null,
      buyerEmail: payload.buyer.email || null,
      buyerDomicilio: payload.buyer.domicilio || null,
      alreadyIssued: result.alreadyIssued ?? false,
      updatedAt: FieldValue.serverTimestamp(),
    },
  });

  return result;
}
