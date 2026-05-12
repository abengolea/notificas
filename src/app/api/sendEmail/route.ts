import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuthToken } from '@/lib/auth-helper';
import { computeContentHash } from '@/lib/certification';
import { certificarEnvio } from '@/lib/certification-polygon';
import { getFirebaseSendEmailUrl } from '@/lib/mail-defaults';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const { decoded, errorResponse } = await verifyAuthToken(request);
    if (errorResponse) return errorResponse;

    const { docId } = await request.json();

    if (!docId) {
      return NextResponse.json({ error: 'docId es requerido' }, { status: 400 });
    }

    // Verificar que el documento pertenece al usuario autenticado
    const mailSnap = await adminDb.collection('mail').doc(docId).get();
    if (!mailSnap.exists) {
      return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
    }
    if (mailSnap.data()?.createdBy !== decoded.uid) {
      return NextResponse.json({ error: 'No autorizado para enviar este mensaje' }, { status: 403 });
    }

    const functionUrl = getFirebaseSendEmailUrl();
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error en función de Firebase:', errorText);
      return NextResponse.json({ error: 'Error al enviar email' }, { status: 500 });
    }

    const result = await response.json();

    // Certificar en Polygon después de envío exitoso (incluye hash del contenido para integridad)
    // IMPORTANTE: envuelto en timeout para que un cuelgue del RPC no bloquee la respuesta al cliente.
    // El correo y WhatsApp ya fueron enviados — Polygon es adicional, no debe bloquear.
    let polygonTxHash: string | undefined;
    try {
      const mailSnap = await adminDb.collection('mail').doc(docId).get();
      const mailData = mailSnap.data();
      if (mailData) {
        const toEmail = Array.isArray(mailData.to) ? mailData.to[0] : mailData.recipientEmail || mailData.to || '';
        const fromUserId = mailData.createdBy || mailData.senderName || 'app';
        const subject = mailData.message?.subject || '';
        const html = mailData.message?.html;
        const text = mailData.message?.text;
        const contentHash = await computeContentHash(subject, html, text);
        polygonTxHash = await Promise.race([
          certificarEnvio(docId, fromUserId, toEmail, contentHash),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout certificación Polygon (>40s)')), 40_000)
          ),
        ]);
        await adminDb.collection('mail').doc(docId).update({
          'polygonCertifications.send': polygonTxHash,
          'polygonCertifications.contentHash': contentHash,
          'polygonCertifications.updatedAt': new Date()
        });
        console.log('🔗 Envío certificado en Polygon (con contentHash):', polygonTxHash);
      }
    } catch (polygonError: any) {
      console.error('⚠️ Error certificando en Polygon (no bloquea el envío):', polygonError?.message);
      // No fallar el envío si Polygon falla o tarda demasiado
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
