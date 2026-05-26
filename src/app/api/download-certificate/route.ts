import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuthToken } from '@/lib/auth-helper';
import { generateCertificatePDF } from '@/lib/certificate-generator';
import { certificarLectura, certificarDocumento } from '@/lib/certification-polygon';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const { decoded, errorResponse } = await verifyAuthToken(request);
    if (errorResponse) return errorResponse;

    const { messageId } = await request.json();

    if (!messageId) {
      return NextResponse.json({ error: 'messageId es requerido' }, { status: 400 });
    }

    // Obtener datos del mensaje usando Admin SDK (ruta de servidor)
    const messageRef = adminDb.collection('mail').doc(messageId);
    const messageSnap = await messageRef.get();

    if (!messageSnap.exists) {
      return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
    }

    const mailData = messageSnap.data();
    if (!mailData) {
      return NextResponse.json({ error: 'Mensaje sin datos' }, { status: 404 });
    }

    // Verificar que el usuario es el remitente o destinatario
    const isAuthorized =
      mailData?.createdBy === decoded.uid ||
      mailData?.recipientEmail === decoded.email ||
      (Array.isArray(mailData?.to) && mailData.to.includes(decoded.email));

    if (!isAuthorized) {
      return NextResponse.json({ error: 'No autorizado para descargar este certificado' }, { status: 403 });
    }

    // Certificar lectura en Polygon al descargar certificado (si no está ya certificada)
    if (!mailData?.polygonCertifications?.read) {
      try {
        const recipientId = mailData?.recipientEmail || mailData?.to?.[0] || 'recipient';
        const txHash = await certificarLectura(messageId, recipientId);
        await messageRef.update({
          'polygonCertifications.read': txHash,
          'polygonCertifications.updatedAt': new Date(),
        });
      } catch (e: any) {
        console.warn('⚠️ Polygon certify read (download-certificate):', e?.message);
      }
    }

    // Detener el tracking - marcar como certificado
    await messageRef.update({
      'tracking.certificateGenerated': true,
      'tracking.certificateGeneratedAt': new Date().toISOString(),
      'tracking.trackingStopped': true,
      'tracking.trackingStoppedAt': new Date().toISOString()
    });

    // Datos frescos: la certificación de lectura (y otros campos) pueden haberse actualizado arriba
    const refreshedSnap = await messageRef.get();
    const mailDataFresh = refreshedSnap.data();
    if (!mailDataFresh) {
      return NextResponse.json({ error: 'Mensaje sin datos' }, { status: 404 });
    }

    // Preparar datos para el certificado
    const certificateData = {
      messageId,
      mailData: mailDataFresh,
      movements: mailDataFresh.tracking?.movements || [],
      attachments: mailDataFresh.attachments || []
    };

    // Generar el certificado PDF
    const pdfBlob = await generateCertificatePDF(certificateData);

    // Convertir Blob a Buffer
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Calcular hash del PDF y guardarlo para verificación posterior
    const certificateHash = createHash('sha256').update(buffer).digest('hex');
    try {
      await messageRef.update({
        certificateHashes: FieldValue.arrayUnion(certificateHash),
      });
    } catch (e: any) {
      console.warn('⚠️ No se pudo guardar certificateHash:', e?.message);
    }

    // Certificar el hash del PDF en Polygon (fire-and-forget — no bloquea la descarga)
    // La TX encadena al send TX para probar que el certificado corresponde a este mensaje.
    void (async () => {
      try {
        const sendTxHash = mailDataFresh.polygonCertifications?.send as string | undefined;
        const txHash = await certificarDocumento(messageId, certificateHash, sendTxHash);
        await messageRef.update({
          'polygonCertifications.certificate': txHash,
          'polygonCertifications.updatedAt': new Date(),
        });
        console.log('✅ Certificado PDF certificado en Polygon:', txHash);
      } catch (e: any) {
        console.warn('⚠️ Polygon certify certificate (no afecta la descarga):', e?.message);
      }
    })();

    // Devolver el PDF como respuesta
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="certificado-lectura-${messageId}.pdf"`,
        'Content-Length': buffer.length.toString(),
      },
    });

  } catch (error: any) {
    console.error('Error generando certificado:', error);
    return NextResponse.json({ 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
