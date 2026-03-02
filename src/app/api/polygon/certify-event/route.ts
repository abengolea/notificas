import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { certificarRecepcion, certificarLectura } from '@/lib/certification';

/**
 * Endpoint para que Firebase Functions certifique eventos (recepción, lectura) en Polygon.
 * Protegido por POLYGON_CERTIFY_SECRET en header X-Certify-Secret.
 */
export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get('X-Certify-Secret');
    const expectedSecret = process.env.POLYGON_CERTIFY_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { docId, type, userId } = body;

    if (!docId || !type) {
      return NextResponse.json(
        { error: 'docId y type son requeridos (type: receive | read)' },
        { status: 400 }
      );
    }

    const mailSnap = await adminDb.collection('mail').doc(docId).get();
    const mailData = mailSnap.data();
    if (!mailData) {
      return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
    }

    // No certificar si ya está certificado este evento
    const existing = mailData.polygonCertifications || {};
    if (type === 'receive' && existing.receive) {
      return NextResponse.json({ success: true, txHash: existing.receive, skipped: 'ya certificado' });
    }
    if (type === 'read' && existing.read) {
      return NextResponse.json({ success: true, txHash: existing.read, skipped: 'ya certificado' });
    }

    const recipientId = userId || mailData.recipientEmail || mailData.to?.[0] || 'recipient';

    let txHash: string;
    const updateField =
      type === 'receive'
        ? 'polygonCertifications.receive'
        : type === 'read'
          ? 'polygonCertifications.read'
          : null;

    if (!updateField) {
      return NextResponse.json(
        { error: 'type debe ser receive o read' },
        { status: 400 }
      );
    }

    if (type === 'receive') {
      txHash = await certificarRecepcion(docId, recipientId);
    } else {
      txHash = await certificarLectura(docId, recipientId);
    }

    await adminDb.collection('mail').doc(docId).update({
      [updateField]: txHash,
      'polygonCertifications.updatedAt': new Date(),
    });

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
