import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { computeContentHash } from '@/lib/certification';
import { getTransactionInfo } from '@/lib/blockchain';

/**
 * Extrae el contentHash del payload de una tx SEND en Polygon.
 * Formato: SEND|messageId|fromUserId|toEmail|contentHash|timestamp
 */
function extractContentHashFromSendPayload(payload: string): string | null {
  if (!payload || typeof payload !== 'string') return null;
  const parts = payload.split('|');
  // SEND con contentHash: 6 partes [SEND, msgId, from, to, contentHash, timestamp]
  if (parts[0] === 'SEND' && parts.length >= 6) {
    const hash = parts[4]?.trim();
    return hash && hash.length === 64 ? hash : null;
  }
  return null;
}

/**
 * Verifica la integridad del contenido comparando el hash actual con el hash
 * certificado en la blockchain (Polygon). La blockchain es la fuente de verdad
 * inmutable; Firestore solo se usa como fallback si la consulta a Polygon falla.
 */
export async function POST(request: NextRequest) {
  try {
    const { messageId } = await request.json();

    if (!messageId || typeof messageId !== 'string') {
      return NextResponse.json(
        { error: 'messageId es requerido' },
        { status: 400 }
      );
    }

    const mailSnap = await adminDb.collection('mail').doc(messageId).get();
    const mailData = mailSnap.data();

    if (!mailData) {
      return NextResponse.json(
        { error: 'Mensaje no encontrado' },
        { status: 404 }
      );
    }

    const sendTxHash = mailData.polygonCertifications?.send;
    const firestoreHash = mailData.polygonCertifications?.contentHash;

    if (!sendTxHash) {
      return NextResponse.json({
        success: true,
        integrityValid: null,
        message: 'Este mensaje no tiene certificación de envío en blockchain. No es posible verificar la integridad.',
        storedHash: null,
        currentHash: null,
        source: null
      });
    }

    // 1. Obtener el hash desde la blockchain (fuente de verdad inmutable)
    let blockchainHash: string | null = null;
    try {
      const txInfo = await getTransactionInfo(sendTxHash);
      if (txInfo?.data) {
        blockchainHash = extractContentHashFromSendPayload(txInfo.data);
      }
    } catch (blockchainError: any) {
      console.warn('⚠️ No se pudo obtener tx de Polygon, usando Firestore como fallback:', blockchainError?.message);
    }

    // 2. Usar blockchain si está disponible; si no, fallback a Firestore
    const storedHash = blockchainHash ?? firestoreHash;

    if (!storedHash) {
      return NextResponse.json({
        success: true,
        integrityValid: null,
        message: 'La transacción de envío no incluye hash de contenido (certificación antigua). No es posible verificar.',
        storedHash: null,
        currentHash: null,
        source: blockchainHash !== null ? 'blockchain' : null
      });
    }

    // 3. Calcular hash actual del contenido
    const subject = mailData.message?.subject || '';
    const html = mailData.message?.html;
    const text = mailData.message?.text;
    const currentHash = await computeContentHash(subject, html, text);

    const integrityValid = currentHash === storedHash;

    return NextResponse.json({
      success: true,
      integrityValid,
      message: integrityValid
        ? 'El contenido del mensaje coincide con el certificado en blockchain (verificación inmutable).'
        : '⚠️ El contenido del mensaje no coincide con el certificado en blockchain. Puede haber sido alterado.',
      storedHash,
      currentHash,
      source: blockchainHash !== null ? 'blockchain' : 'firestore'
    });
  } catch (error: any) {
    console.error('Error verificando integridad del contenido:', error);
    return NextResponse.json(
      { error: error?.message || 'Error al verificar integridad' },
      { status: 500 }
    );
  }
}
