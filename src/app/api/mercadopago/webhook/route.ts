import { NextRequest, NextResponse } from 'next/server';
import { getPaymentStatus } from '@/lib/mercadopago';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('🔔 Webhook MercadoPago recibido:', body);

    // Verificar que sea una notificación de pago
    if (body.type !== 'payment') {
      return NextResponse.json({ received: true });
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID no encontrado' }, { status: 400 });
    }

    // Obtener información del pago desde MercadoPago
    const payment = await getPaymentStatus(paymentId);
    console.log('💳 Estado del pago:', payment.status);

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
    const [, planId, userId] = refMatch;
    
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

    if (payment.status === 'approved') {
      console.log('✅ Pago aprobado, actualizando créditos del usuario');

      const credits = typeof transactionData.credits === 'number' ? transactionData.credits : 0;

      const userRef = db.collection('users').doc(userId);
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
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('❌ Error procesando webhook:', error);
    return NextResponse.json(
      { error: 'Error procesando webhook' },
      { status: 500 }
    );
  }
}

// Manejar GET para verificación del webhook
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get('topic');
  const id = searchParams.get('id');

  if (topic === 'payment' && id) {
    console.log('🔍 Verificación de webhook - Payment ID:', id);
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}

