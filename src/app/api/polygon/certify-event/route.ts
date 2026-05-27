import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { certificarRecepcion, certificarLectura, certificarEnvio, certificarDocumento } from '@/lib/certification-polygon';
import { computeContentHash } from '@/lib/certification';

/**
 * Endpoint para que Firebase Functions certifique eventos (envío, recepción, lectura) en Polygon.
 * Protegido por POLYGON_CERTIFY_SECRET en header X-Certify-Secret.
 */
export async function POST(request: NextRequest) {
  try {
    const expectedSecret = process.env.POLYGON_CERTIFY_SECRET?.trim();
    if (!expectedSecret) {
      console.error('POLYGON_CERTIFY_SECRET no está configurado');
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta' },
        { status: 503 }
      );
    }

    const secret = request.headers.get('X-Certify-Secret');
    if (secret !== expectedSecret) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { docId, type, userId, pdfHash } = body;

    if (!docId || !type) {
      return NextResponse.json(
        { error: 'docId y type son requeridos (type: send | receive | read | certificate)' },
        { status: 400 }
      );
    }

    const mailSnap = await adminDb.collection('mail').doc(docId).get();
    const mailData = mailSnap.data();
    if (!mailData) {
      return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
    }

    // Idempotencia: no volver a certificar si ya existe la TX para este evento
    const existing = mailData.polygonCertifications || {};
    if (type === 'send' && existing.send) {
      return NextResponse.json({ success: true, txHash: existing.send, skipped: 'ya certificado' });
    }
    if (type === 'receive' && existing.receive) {
      return NextResponse.json({ success: true, txHash: existing.receive, skipped: 'ya certificado' });
    }
    if (type === 'read' && existing.read) {
      return NextResponse.json({ success: true, txHash: existing.read, skipped: 'ya certificado' });
    }
    if (type === 'certificate' && existing.certificate) {
      return NextResponse.json({ success: true, txHash: existing.certificate, skipped: 'ya certificado' });
    }

    const recipientId = userId || mailData.recipientEmail || mailData.to?.[0] || 'recipient';

    let txHash: string;

    if (type === 'send') {
      const contentHash = await computeContentHash((mailData.message?.contentText as string | undefined) || '');

      const fromUserId = (mailData.createdBy as string | undefined) || (mailData.from as string | undefined) || 'system';
      const toEmail = (mailData.recipientEmail as string | undefined) || (Array.isArray(mailData.to) ? mailData.to[0] : mailData.to as string | undefined) || '';
      // smtpMessageId vincula la TX con el registro del servidor de correo
      const smtpMessageId = mailData.smtpMessageId as string | undefined;

      txHash = await certificarEnvio(docId, fromUserId, toEmail, contentHash, smtpMessageId);

      await adminDb.collection('mail').doc(docId).update({
        'polygonCertifications.send': txHash,
        'polygonCertifications.contentHash': contentHash,
        'polygonCertifications.updatedAt': new Date(),
      });
    } else if (type === 'receive') {
      // Encadenar al SEND: pasar sendTxHash y contentHash para prueba judicial completa
      const sendTxHash = existing.send as string | undefined;
      const contentHash = existing.contentHash as string | undefined;

      txHash = await certificarRecepcion(docId, recipientId, sendTxHash, contentHash);

      await adminDb.collection('mail').doc(docId).update({
        'polygonCertifications.receive': txHash,
        'polygonCertifications.updatedAt': new Date(),
      });
    } else if (type === 'read') {
      txHash = await certificarLectura(docId, recipientId);

      await adminDb.collection('mail').doc(docId).update({
        'polygonCertifications.read': txHash,
        'polygonCertifications.updatedAt': new Date(),
      });
    } else if (type === 'certificate') {
      if (!pdfHash || typeof pdfHash !== 'string') {
        return NextResponse.json(
          { error: 'pdfHash es requerido para type=certificate' },
          { status: 400 }
        );
      }
      // Encadenar al envío para probar que el certificado corresponde a este mensaje
      const sendTxHash = existing.send as string | undefined;

      txHash = await certificarDocumento(docId, pdfHash, sendTxHash);

      await adminDb.collection('mail').doc(docId).update({
        'polygonCertifications.certificate': txHash,
        'polygonCertifications.updatedAt': new Date(),
      });
    } else {
      return NextResponse.json(
        { error: 'type debe ser send, receive, read o certificate' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      txHash,
      explorerUrl: `https://polygonscan.com/tx/${txHash}`,
    });
  } catch (error: any) {
    console.error('❌ Error certificando evento en Polygon:', error);
    return NextResponse.json(
      { error: error?.message || 'Error al certificar' },
      { status: 500 }
    );
  }
}
