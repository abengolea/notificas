import { NextRequest, NextResponse } from 'next/server';
import { getPaymentStatus } from '@/lib/mercadopago';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const { paymentId, userId } = await request.json();
    
    if (!paymentId || !userId) {
      return NextResponse.json({ error: 'paymentId y userId son requeridos' }, { status: 400 });
    }

    console.log('🔄 Procesando pago manual:', { paymentId, userId });

    // Obtener información del pago desde MercadoPago
    const payment = await getPaymentStatus(paymentId);
    console.log('💳 Estado del pago:', payment.status);

    if (payment.status !== 'approved') {
      return NextResponse.json({ error: 'Pago no aprobado' }, { status: 400 });
    }

    // Buscar la transacción pendiente por external_reference
    const externalReference = payment.external_reference;
    if (!externalReference) {
      console.error('❌ External reference no encontrado en el pago');
      return NextResponse.json({ error: 'External reference no encontrado' }, { status: 400 });
    }

    // Extraer información del external_reference (formato: "plan_<planId>_user_<userId>")
    const refMatch = externalReference.match(/^plan_(.+)_user_(.+)$/);
    if (!refMatch) {
      console.error('❌ external_reference con formato inválido:', externalReference);
      return NextResponse.json({ error: 'external_reference inválido' }, { status: 400 });
    }
    const [, planId, userIdFromRef] = refMatch;

    if (userIdFromRef !== userId) {
      return NextResponse.json({ error: 'Usuario no coincide' }, { status: 400 });
    }

    const db = getAdminDb();

    const querySnapshot = await db
      .collection('transactions')
      .where('userId', '==', userId)
      .where('planId', '==', planId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      console.error('❌ Transacción no encontrada');
      return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 });
    }

    const transactionDoc = querySnapshot.docs[0];
    const transactionData = transactionDoc.data();

    await transactionDoc.ref.update({
      paymentId,
      status: payment.status,
      paymentData: payment,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.error('❌ Usuario no encontrado para el pago:', userId);
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    console.log('✅ Pago aprobado, actualizando créditos del usuario');

    const credits = typeof transactionData.credits === 'number' ? transactionData.credits : 0;

    await userRef.update({
      creditos: FieldValue.increment(credits),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const purchaseTransactionRef = db.collection('user_transactions').doc();
    await purchaseTransactionRef.set({
      id: purchaseTransactionRef.id,
      userId,
      tipo: 'compra',
      descripcion: `Compra de ${transactionData.credits} créditos - ${transactionData.planName}`,
      monto: transactionData.price,
      creditos: transactionData.credits,
      metodoPago: 'Mercado Pago',
      fecha: FieldValue.serverTimestamp(),
      paymentId,
      planId: transactionData.planId,
    });

    console.log('✅ Créditos actualizados exitosamente');

    return NextResponse.json({ 
      success: true, 
      message: 'Pago procesado correctamente',
      creditsAdded: transactionData.credits
    });

  } catch (error) {
    console.error('❌ Error procesando pago:', error);
    return NextResponse.json(
      { error: 'Error procesando pago' },
      { status: 500 }
    );
  }
}
