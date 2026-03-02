import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { adminDb } from '@/lib/firebase-admin';
import { generateCertificatePDF } from '@/lib/certificate-generator';
import { certificarLectura } from '@/lib/certification';

export async function POST(request: NextRequest) {
  try {
    const { messageId } = await request.json();

    if (!messageId) {
      return NextResponse.json({ error: 'messageId es requerido' }, { status: 400 });
    }

    // Obtener datos del mensaje
    const messageRef = doc(db, 'mail', messageId);
    const messageSnap = await getDoc(messageRef);

    if (!messageSnap.exists()) {
      return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
    }

    const mailData = messageSnap.data();

    // Certificar lectura en Polygon al descargar certificado (si no está ya certificada)
    if (!mailData?.polygonCertifications?.read) {
      try {
        const recipientId = mailData.recipientEmail || mailData.to?.[0] || 'recipient';
        const txHash = await certificarLectura(messageId, recipientId);
        await adminDb.collection('mail').doc(messageId).update({
          'polygonCertifications.read': txHash,
          'polygonCertifications.updatedAt': new Date(),
        });
        console.log('🔗 Lectura certificada en Polygon al descargar certificado:', txHash);
      } catch (e: any) {
        console.warn('⚠️ Polygon certify read (download-certificate):', e?.message);
      }
    }

    // Detener el tracking - marcar como certificado
    await updateDoc(messageRef, {
      'tracking.certificateGenerated': true,
      'tracking.certificateGeneratedAt': new Date().toISOString(),
      'tracking.trackingStopped': true,
      'tracking.trackingStoppedAt': new Date().toISOString()
    });

    // Preparar datos para el certificado
    const certificateData = {
      messageId,
      mailData,
      movements: mailData.tracking?.movements || [],
      attachments: mailData.attachments || []
    };

    // Generar el certificado PDF
    const pdfBlob = await generateCertificatePDF(certificateData);
    
    // Convertir Blob a Buffer
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

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
