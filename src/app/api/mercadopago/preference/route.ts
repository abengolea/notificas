import { NextRequest, NextResponse } from 'next/server';
import { createPaymentPreference } from '@/lib/mercadopago';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyAuthToken } from '@/lib/auth-helper';
import {
  discountedListPrice,
  resolveColegioDiscountForEmail,
} from '@/lib/colegio-discount-server';

export async function POST(request: NextRequest) {
  try {
    const { decoded, errorResponse } = await verifyAuthToken(request);
    if (errorResponse) return errorResponse;

    let body: { planId?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const planId = typeof body.planId === 'string' ? body.planId.trim() : '';
    if (!planId) {
      return NextResponse.json({ error: 'planId es requerido' }, { status: 400 });
    }

    const userId = decoded.uid;
    const userEmail =
      typeof decoded.email === 'string' && decoded.email.trim()
        ? decoded.email.trim()
        : '';
    if (!userEmail) {
      return NextResponse.json(
        {
          error:
            'Tu cuenta no tiene email en el token de acceso. Volvé a iniciar sesión o usá un método de login con email.',
        },
        { status: 403 },
      );
    }

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()) {
      console.error(
        'MERCADOPAGO_ACCESS_TOKEN ausente: definí el secreto MERCADOPAGO_ACCESS_TOKEN en App Hosting y redeploy.',
      );
      return NextResponse.json(
        {
          error:
            'El servicio de pagos no está configurado en el servidor. Revisá Mercado Pago en App Hosting.',
        },
        { status: 503 },
      );
    }

    const db = getAdminDb();

    const planSnap = await db.collection('plans').doc(planId).get();
    if (!planSnap.exists) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
    }

    const planData = planSnap.data();
    if (!planData?.nombre || planData.precio == null || planData.creditos == null) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
    }

    const listPrice =
      typeof planData.precio === 'number' ? planData.precio : Number(planData.precio);
    if (!Number.isFinite(listPrice)) {
      return NextResponse.json({ error: 'Precio de plan inválido' }, { status: 400 });
    }

    const colegio = await resolveColegioDiscountForEmail(userEmail);
    const discountPct = colegio.eligible ? colegio.discountPercent : 0;
    const finalPrice =
      discountPct > 0
        ? discountedListPrice(listPrice, discountPct)
        : Math.round(listPrice * 100) / 100;

    if (finalPrice <= 0) {
      return NextResponse.json(
        { error: 'El precio con descuento quedó en cero; revisá el porcentaje del colegio.' },
        { status: 400 },
      );
    }

    const transactionRef = db.collection('transactions').doc();
    const transactionId = transactionRef.id;

    let payerDniDigits: string | undefined;
    let hubCuitDigits: string | undefined;
    let hubRazonSocial: string | undefined;
    let hubBillingClientDocId: string | undefined;
    try {
      const userSnap = await db.collection('users').doc(userId).get();
      const userData = userSnap.data() as Record<string, unknown> | undefined;
      const perfil = (userData?.perfil ?? {}) as Record<string, unknown>;
      const fromPerfil =
        typeof perfil.hubBillingClienteId === 'string' ? perfil.hubBillingClienteId.trim() : '';
      const fromRoot =
        typeof userData?.hubBillingClienteId === 'string'
          ? userData.hubBillingClienteId.trim()
          : '';
      if (fromPerfil) hubBillingClientDocId = fromPerfil;
      else if (fromRoot) hubBillingClientDocId = fromRoot;
      const dniRaw =
        typeof perfil.dni === 'string' ? perfil.dni.replace(/\D/g, '') : '';
      if (dniRaw.length >= 6 && dniRaw.length <= 12) {
        payerDniDigits = dniRaw;
      }
      const cuitRaw =
        typeof perfil.cuit === 'string' ? perfil.cuit.replace(/\D/g, '') : '';
      if (cuitRaw.length === 11) {
        hubCuitDigits = cuitRaw;
      }
      const rs =
        typeof perfil.razonSocial === 'string' && perfil.razonSocial.trim()
          ? perfil.razonSocial.trim()
          : [perfil.nombre, perfil.apellido]
              .filter((x) => typeof x === 'string' && x.trim())
              .join(' ')
              .trim();
      if (rs) hubRazonSocial = rs;
    } catch {
      // preferencia igual; metadata AFIP queda sin datos extra
    }

    const hubCbteRaw = process.env.MERCADOPAGO_HUB_CBTE_TIPO?.trim().toUpperCase();
    const hubCbteTipo =
      hubCbteRaw === 'A' || hubCbteRaw === 'B' || hubCbteRaw === 'C' ? hubCbteRaw : undefined;

    const preference = await createPaymentPreference({
      planId,
      planName: planData.nombre,
      price: finalPrice,
      credits: planData.creditos,
      userId,
      userEmail,
      transactionId,
      payerDniDigits,
      hubCbteTipo,
      hubCuitCompradorDigits: hubCuitDigits,
      hubRazonSocial,
      hubBillingClientDocId,
      listPrice,
      colegioDiscountPercent: discountPct > 0 ? discountPct : undefined,
    });

    await transactionRef.set({
      id: transactionRef.id,
      userId,
      planId,
      planName: planData.nombre,
      price: finalPrice,
      listPrice,
      colegioDiscountPercent: discountPct > 0 ? discountPct : null,
      discountSource: discountPct > 0 ? (colegio.source ?? null) : null,
      credits: planData.creditos,
      status: 'pending',
      paymentId: null,
      preferenceId: preference.id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
      colegioDiscountApplied: discountPct > 0,
      discountSource: discountPct > 0 ? (colegio.source ?? null) : null,
      listPrice,
      finalPrice,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[mercadopago/preference]', msg, error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
