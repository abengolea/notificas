import { NextRequest, NextResponse } from 'next/server';
import { createPaymentPreference } from '@/lib/mercadopago';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const { planId, userId, userEmail } = await request.json();

    if (!planId || !userId || !userEmail) {
      return NextResponse.json(
        { error: 'planId, userId y userEmail son requeridos' },
        { status: 400 }
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

    const preference = await createPaymentPreference({
      planId,
      planName: planData.nombre,
      price: planData.precio,
      credits: planData.creditos,
      userId,
      userEmail,
    });

    const transactionRef = db.collection('transactions').doc();
    await transactionRef.set({
      id: transactionRef.id,
      userId,
      planId,
      planName: planData.nombre,
      price: planData.precio,
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
    });
  } catch (error) {
    console.error('Error creating payment preference:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
