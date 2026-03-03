import { NextRequest, NextResponse } from 'next/server';
import { getPaymentStatus } from '@/lib/mercadopago';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, increment, setDoc } from 'firebase/firestore';

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

    // Extraer información del external_reference
    const [planId, userIdFromRef] = externalReference.replace('plan_', '').replace('_user_', '|').split('|');
    
    if (userIdFromRef !== userId) {
      return NextResponse.json({ error: 'Usuario no coincide' }, { status: 400 });
    }

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

    // Verificar si el usuario existe, si no, crearlo
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.log('❌ Usuario no encontrado, creando...');
      await setDoc(userRef, {
        uid: userId,
        email: 'abengolea1@gmail.com',
        tipo: 'individual',
        estado: 'activo',
        perfil: {
          nombre: 'abengolea1@gmail.com',
          verificado: true,
        },
        createdAt: new Date(),
        lastLogin: new Date(),
        creditos: 0, // Empezar con 0 créditos
        updatedAt: new Date()
      });
      console.log('✅ Usuario creado');
    }

    // Actualizar créditos del usuario
    console.log('✅ Pago aprobado, actualizando créditos del usuario');
    
    await updateDoc(userRef, {
      creditos: increment(transactionData.credits),
      updatedAt: new Date()
    });

    // Crear registro de transacción de compra
    const purchaseTransactionRef = doc(collection(db, 'user_transactions'));
    await setDoc(purchaseTransactionRef, {
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
