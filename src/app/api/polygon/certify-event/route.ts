import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import {
  certificarEnvio,
  certificarDocumento,
  certifyMailHitoIfNeeded,
  POLYGON_HITO_FIELDS,
  type PolygonHitoType,
} from '@/lib/certification-polygon';
import { computeContentHash } from '@/lib/certification';

const HITO_TYPES = new Set<string>(Object.keys(POLYGON_HITO_FIELDS));

/**
 * Endpoint para que Firebase Functions certifique eventos en Polygon.
 * Protegido por POLYGON_CERTIFY_SECRET en header X-Certify-Secret.
 * Los hitos (WA / acceso / lectura) solo anclan el primer evento de cada tipo.
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
    const { docId, type, pdfHash, via } = body as {
      docId?: unknown;
      type?: unknown;
      pdfHash?: unknown;
      via?: unknown;
    };

    if (!docId || typeof docId !== 'string' || !type || typeof type !== 'string') {
      return NextResponse.json(
        { error: 'docId y type son requeridos' },
        { status: 400 }
      );
    }

    const mailSnap = await adminDb.collection('mail').doc(docId).get();
    const mailData = mailSnap.data();
    if (!mailData) {
      return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
    }

    const existing = (mailData.polygonCertifications || {}) as Record<string, unknown>;

    let txHash: string;

    if (type === 'send') {
      if (typeof existing.send === 'string' && existing.send) {
        return NextResponse.json({ success: true, txHash: existing.send, skipped: 'ya certificado' });
      }
      const contentHash = await computeContentHash((mailData.message?.contentText as string | undefined) || '');
      const fromUserId =
        (mailData.createdBy as string | undefined) ||
        (mailData.from as string | undefined) ||
        'system';
      const toEmail =
        (mailData.recipientEmail as string | undefined) ||
        (Array.isArray(mailData.to) ? mailData.to[0] : (mailData.to as string | undefined)) ||
        '';
      const smtpMessageId = mailData.smtpMessageId as string | undefined;
      txHash = await certificarEnvio(docId, fromUserId, toEmail, contentHash, smtpMessageId);
      await adminDb.collection('mail').doc(docId).update({
        'polygonCertifications.send': txHash,
        'polygonCertifications.contentHash': contentHash,
        'polygonCertifications.updatedAt': new Date(),
      });
    } else if (HITO_TYPES.has(type) || type === 'receive' || type === 'read') {
      const hito: PolygonHitoType =
        type === 'receive'
          ? 'content_access'
          : type === 'read'
            ? 'read_confirmed'
            : (type as PolygonHitoType);
      const viaStr = typeof via === 'string' && via.trim() ? via.trim() : undefined;
      const result = await certifyMailHitoIfNeeded({ docId, hito, via: viaStr });
      if (!result) {
        return NextResponse.json({ success: true, skipped: 'campaña o en curso' });
      }
      txHash = result;
    } else if (type === 'certificate') {
      if (typeof existing.certificate === 'string' && existing.certificate) {
        return NextResponse.json({
          success: true,
          txHash: existing.certificate,
          skipped: 'ya certificado',
        });
      }
      if (!pdfHash || typeof pdfHash !== 'string') {
        return NextResponse.json(
          { error: 'pdfHash es requerido para type=certificate' },
          { status: 400 }
        );
      }
      txHash = await certificarDocumento(docId, pdfHash, existing.send as string | undefined);
      await adminDb.collection('mail').doc(docId).update({
        'polygonCertifications.certificate': txHash,
        'polygonCertifications.updatedAt': new Date(),
      });
    } else {
      return NextResponse.json(
        {
          error:
            'type debe ser send, wa_delivered, wa_read, content_access, read_confirmed o certificate',
        },
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
