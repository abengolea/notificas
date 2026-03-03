import { NextRequest, NextResponse } from 'next/server';
import { getPaymentStatus } from '@/lib/mercadopago';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, increment } from 'firebase/firestore';

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

    // Extraer información del external_reference
    const [planId, userId] = externalReference.replace('plan_', '').replace('_user_', '|').split('|');
    
    // Buscar la transacción en Firestore
    const transactionsRef = collection(db, 'transactions');
    const q = query(
      transactionsRef,
      where('userId', '==', userId),
      where('planId', '==', planId),
      where('status', '==', 'pending')
    );
    
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      console.error('❌ Transacción no encontrada');
      return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 });
    }

    const transactionDoc = querySnapshot.docs[0];
    const transactionData = transactionDoc.data();

    // Actualizar la transacción con el estado del pago
    await updateDoc(transactionDoc.ref, {
      paymentId,
      status: payment.status,
      paymentData: payment,
      updatedAt: new Date()
    });

    // Si el pago fue aprobado, actualizar los créditos del usuario
    if (payment.status === 'approved') {
      console.log('✅ Pago aprobado, actualizando créditos del usuario');
      
      // Actualizar créditos del usuario
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        creditos: increment(transactionData.credits),
        updatedAt: new Date()
      });

      // Crear registro de transacción de compra
      const purchaseTransactionRef = doc(collection(db, 'user_transactions'));
      await updateDoc(purchaseTransactionRef, {
        id: purchaseTransactionRef.id,
        userId,
        tipo: 'compra',
        descripcion: `Compra de ${transactionData.credits} créditos - ${transactionData.planName}`,
        monto: transactionData.price,
        creditos: transactionData.credits,
        metodoPago: 'Mercado Pago',
        fecha: new Date(),
        paymentId,
        planId: transactionData.planId
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

