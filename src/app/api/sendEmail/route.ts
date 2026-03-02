import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { certificarEnvio } from '@/lib/certification';

export async function POST(request: NextRequest) {
  try {
    const timestamp = new Date().toISOString();
    console.log(`🚀 [${timestamp}] Endpoint /api/sendEmail llamado`);
    const { docId } = await request.json();
    console.log(`📋 [${timestamp}] docId recibido:`, docId);
    
    if (!docId) {
      console.log('❌ docId es requerido');
      return NextResponse.json({ error: 'docId es requerido' }, { status: 400 });
    }

    // Llamar a la función de Firebase
    const functionUrl = 'https://sendemail-ju7n3yysfq-uc.a.run.app';
    
    console.log('🌐 Llamando a Firebase Function:', functionUrl);
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ docId })
    });

    console.log('📡 Respuesta de Firebase:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error en función de Firebase:', errorText);
      return NextResponse.json({ error: 'Error al enviar email' }, { status: 500 });
    }

    const result = await response.json();
    console.log('✅ Resultado exitoso:', result);

    // Certificar en Polygon después de envío exitoso
    let polygonTxHash: string | undefined;
    try {
      const mailSnap = await adminDb.collection('mail').doc(docId).get();
      const mailData = mailSnap.data();
      if (mailData) {
        const toEmail = Array.isArray(mailData.to) ? mailData.to[0] : mailData.recipientEmail || mailData.to || '';
        const fromUserId = mailData.createdBy || mailData.senderName || 'app';
        polygonTxHash = await certificarEnvio(docId, fromUserId, toEmail);
        await adminDb.collection('mail').doc(docId).update({
          'polygonCertifications.send': polygonTxHash,
          'polygonCertifications.updatedAt': new Date()
        });
        console.log('🔗 Envío certificado en Polygon:', polygonTxHash);
      }
    } catch (polygonError: any) {
      console.error('⚠️ Error certificando en Polygon (no bloquea el envío):', polygonError?.message);
      // No fallar el envío si Polygon falla
    }

    return NextResponse.json({
      ...result,
      polygonTxHash: polygonTxHash || undefined,
    });
    
  } catch (error) {
    console.error('❌ Error en endpoint sendEmail:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
