import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, getAdminBucket } from '@/lib/firebase-admin';
import { verifyAuthToken } from '@/lib/auth-helper';
import { generateCertificatePDF } from '@/lib/certificate-generator';
import { certificarDocumento } from '@/lib/certification-polygon';

function certificateStoragePath(messageId: string) {
  return `certificates/${messageId}/certificado-lectura.pdf`;
}

function parseIssuedAt(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && value && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    try {
      return (value as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  return null;
}

function toIsoValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
      try {
        return (value as { toDate: () => Date }).toDate().toISOString();
      } catch {
        return value;
      }
    }
    if (typeof (value as { seconds?: number }).seconds === 'number') {
      return new Date((value as { seconds: number }).seconds * 1000).toISOString();
    }
  }
  return value;
}

function freezeMovements(movements: unknown): Record<string, unknown>[] {
  if (!Array.isArray(movements)) return [];
  return movements.map((item) => {
    if (!item || typeof item !== 'object') return { value: item };
    const copy: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
      copy[key] = toIsoValue(value);
    }
    return copy;
  });
}

function pdfResponse(messageId: string, buffer: Buffer) {
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="certificado-lectura-${messageId}.pdf"`,
      'Content-Length': String(buffer.length),
    },
  });
}

async function readStoredPdf(storagePath: string): Promise<Buffer | null> {
  try {
    const [stored] = await getAdminBucket().file(storagePath).download();
    return stored?.length ? stored : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { decoded, errorResponse } = await verifyAuthToken(request);
    if (errorResponse) return errorResponse;

    const { messageId } = await request.json();

    if (!messageId) {
      return NextResponse.json({ error: 'messageId es requerido' }, { status: 400 });
    }

    const messageRef = adminDb.collection('mail').doc(messageId);
    const messageSnap = await messageRef.get();

    if (!messageSnap.exists) {
      return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
    }

    const mailData = messageSnap.data();
    if (!mailData) {
      return NextResponse.json({ error: 'Mensaje sin datos' }, { status: 404 });
    }

    const isAuthorized =
      mailData?.createdBy === decoded.uid ||
      mailData?.recipientEmail === decoded.email ||
      (Array.isArray(mailData?.to) && mailData.to.includes(decoded.email));

    if (!isAuthorized) {
      return NextResponse.json({ error: 'No autorizado para descargar este certificado' }, { status: 403 });
    }

    const storagePath =
      (typeof mailData.certificateStoragePath === 'string' && mailData.certificateStoragePath) ||
      certificateStoragePath(messageId);

    const storedPdf = await readStoredPdf(storagePath);
    if (storedPdf) {
      return pdfResponse(messageId, storedPdf);
    }

    const freeze = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(messageRef);
      const data = snap.data();
      if (!data) throw new Error('Mensaje sin datos');
      const issuedAt =
        parseIssuedAt(data.certificateIssuedAt) ||
        parseIssuedAt(data.tracking?.certificateGeneratedAt) ||
        new Date();
      const issuedAtIso = issuedAt.toISOString();
      const movements = Array.isArray(data.certificateMovements)
        ? data.certificateMovements
        : freezeMovements(data.tracking?.movements || []);
      if (!data.certificateIssuedAt || !Array.isArray(data.certificateMovements)) {
        tx.update(messageRef, {
          certificateIssuedAt: issuedAtIso,
          certificateMovements: movements,
          'tracking.certificateGenerated': true,
          'tracking.certificateGeneratedAt': issuedAtIso,
          'tracking.trackingStopped': true,
          'tracking.trackingStoppedAt': issuedAtIso,
        });
      }
      return { issuedAt, issuedAtIso, movements, mailDataFresh: { ...data, certificateIssuedAt: issuedAtIso, certificateMovements: movements } };
    });

    const { issuedAt, issuedAtIso, movements, mailDataFresh } = freeze;

    let orgNombre: string | undefined;
    let orgCuit: string | undefined;
    if (typeof mailDataFresh.campaignId === 'string' && mailDataFresh.campaignId) {
      const camp = await adminDb.collection('campaigns').doc(mailDataFresh.campaignId).get();
      const orgId = camp.exists ? String(camp.data()?.orgId || '') : '';
      if (orgId) {
        const org = await adminDb.collection('organizations').doc(orgId).get();
        if (org.exists) {
          orgNombre = typeof org.data()?.nombre === 'string' ? org.data()!.nombre : undefined;
          orgCuit = typeof org.data()?.cuit === 'string' ? org.data()!.cuit : undefined;
        }
      }
    }

    const certificateData = {
      messageId,
      issuedAt: parseIssuedAt(mailDataFresh.certificateIssuedAt) || issuedAt,
      mailData: {
        ...mailDataFresh,
        orgNombre,
        orgCuit,
        whatsappMessageId:
          mailDataFresh.whatsappMessageId || mailDataFresh.tracking?.whatsappMessageId,
      },
      movements,
      attachments: mailDataFresh.attachments || []
    };

    const pdfBlob = await generateCertificatePDF(certificateData);
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const certificateHash = createHash('sha256').update(buffer).digest('hex');
    const file = getAdminBucket().file(storagePath);

    try {
      await file.save(buffer, {
        resumable: false,
        contentType: 'application/pdf',
        metadata: { cacheControl: 'private,max-age=31536000' },
        preconditionOpts: { ifGenerationMatch: 0 },
      });
    } catch (e: unknown) {
      const code = typeof e === 'object' && e && 'code' in e ? Number((e as { code?: number }).code) : 0;
      if (code === 412) {
        const winner = await readStoredPdf(storagePath);
        if (winner) return pdfResponse(messageId, winner);
      } else {
        console.warn('⚠️ No se pudo guardar el PDF del certificado:', e instanceof Error ? e.message : e);
      }
    }

    try {
      await messageRef.update({
        certificateHashes: FieldValue.arrayUnion(certificateHash),
        certificateStoragePath: storagePath,
        certificateIssuedAt: issuedAtIso,
        certificateMovements: movements,
      });
    } catch (e: unknown) {
      console.warn('⚠️ No se pudo guardar certificateHash:', e instanceof Error ? e.message : e);
    }

    if (!mailDataFresh.polygonCertifications?.certificate) {
      void (async () => {
        try {
          const sendTxHash = mailDataFresh.polygonCertifications?.send as string | undefined;
          const txHash = await certificarDocumento(messageId, certificateHash, sendTxHash);
          await messageRef.update({
            'polygonCertifications.certificate': txHash,
            'polygonCertifications.updatedAt': new Date(),
          });
          console.log('✅ Certificado PDF certificado en Polygon:', txHash);
        } catch (e: unknown) {
          console.warn('⚠️ Polygon certify certificate (no afecta la descarga):', e instanceof Error ? e.message : e);
        }
      })();
    }

    return pdfResponse(messageId, buffer);

  } catch (error: unknown) {
    console.error('Error generando certificado:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 });
  }
}
