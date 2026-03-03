import { NextRequest, NextResponse } from 'next/server';
import { createPaymentPreference } from '@/lib/mercadopago';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const { planId, userId, userEmail } = await request.json();
    
    if (!planId || !userId || !userEmail) {
      return NextResponse.json(
        { error: 'planId, userId y userEmail son requeridos' },
        { status: 400 }
      );
    }

    // Obtener información del plan desde la base de datos
    const planDoc = await getDoc(doc(db, 'plans', planId));
    if (!planDoc.exists()) {
      return NextResponse.json(
        { error: 'Plan no encontrado' },
        { status: 404 }
      );
    }

    const planData = planDoc.data();
    
    // Crear preferencia de pago
    const preference = await createPaymentPreference({
      planId,
      planName: planData.nombre,
      price: planData.precio,
      credits: planData.creditos,
      userId,
      userEmail
    });

    // Registrar la transacción pendiente en Firestore
    const transactionRef = doc(collection(db, 'transactions'));
    await setDoc(transactionRef, {
      id: transactionRef.id,
      userId,
      planId,
      planName: planData.nombre,
      price: planData.precio,
      credits: planData.creditos,
      status: 'pending',
      paymentId: null,
      preferenceId: preference.id,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return NextResponse.json({
      success: true,
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point
    });

  } catch (error) {
    console.error('Error creating payment preference:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
