import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuthToken } from '@/lib/auth-helper';
import { computeContentHash } from '@/lib/certification';
import { certificarEnvio } from '@/lib/certification-polygon';
import { getFirebaseSendEmailUrl } from '@/lib/mail-defaults';
import { guardarContactoDesdeMail } from '@/lib/contactos-server';

/** Certifica el envío en Polygon en segundo plano — nunca bloquea la respuesta HTTP. */
async function certifyInBackground(docId: string): Promise<void> {
  try {
    const snap = await adminDb.collection('mail').doc(docId).get();
    const mailData = snap.data();
    if (!mailData) return;

    const toEmail = Array.isArray(mailData.to)
      ? mailData.to[0]
      : mailData.recipientEmail || mailData.to || '';
    const fromUserId = mailData.createdBy || mailData.senderName || 'app';
    const contentHash = await computeContentHash(mailData.message?.contentText || '');

    const polygonTxHash = await Promise.race([
      certificarEnvio(docId, fromUserId, toEmail, contentHash),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout certificación Polygon (>40s)')), 40_000)
      ),
    ]);

    await adminDb.collection('mail').doc(docId).update({
      'polygonCertifications.send': polygonTxHash,
      'polygonCertifications.contentHash': contentHash,
      'polygonCertifications.updatedAt': new Date(),
    });
    console.log('🔗 Envío certificado en Polygon:', polygonTxHash);
  } catch (err: any) {
    console.error('⚠️ Error certificando en Polygon (no afecta el envío):', err?.message);
  }
}

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

    // Llamar a la Cloud Function para enviar email + WhatsApp
    const functionUrl = getFirebaseSendEmailUrl();
    const cfController = new AbortController();
    const cfTimeout = setTimeout(() => cfController.abort(), 55_000);
    let response: Response;
    try {
      response = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId }),
        signal: cfController.signal,
      });
    } catch (fetchErr: any) {
      const msg = fetchErr?.name === 'AbortError'
        ? 'Timeout al llamar la función de envío (>55s)'
        : fetchErr?.message;
      console.error('❌ Error/timeout llamando Cloud Function:', msg);
      return NextResponse.json({ error: 'Error al enviar email' }, { status: 500 });
    } finally {
      clearTimeout(cfTimeout);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error en función de Firebase:', errorText);
      return NextResponse.json({ error: 'Error al enviar email' }, { status: 500 });
    }

    const result = await response.json();

    // Guardar destinatario en libreta personal (no bloquea la respuesta).
    void guardarContactoDesdeMail(mailSnap.data()!);

    // Lanzar la certificación Polygon sin await — responde al cliente YA.
    // El void es intencional: Polygon es best-effort y nunca debe bloquear la UI.
    void certifyInBackground(docId);

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error en endpoint sendEmail:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
