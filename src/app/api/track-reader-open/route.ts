import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { certificarRecepcion } from '@/lib/certification-polygon';

function extractBrowserInfo(userAgent: string) {
  const match = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/(\d+)/);
  return match ? `${match[1]} ${match[2]}` : 'Unknown';
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Certifica la primera apertura en Polygon en segundo plano.
 * Encadena la TX al sendTxHash y contentHash del envío para prueba judicial completa.
 * Nunca bloquea la respuesta HTTP — es fire-and-forget con manejo de errores.
 */
async function certifyFirstReadInBackground(
  docId: string,
  recipientId: string,
  sendTxHash: string | undefined,
  contentHash: string | undefined,
): Promise<void> {
  try {
    // Verificar idempotencia: no certificar si ya tiene TX de recepción
    const snap = await adminDb.collection('mail').doc(docId).get();
    const existing = snap.data()?.polygonCertifications || {};
    if (existing.receive) {
      console.log('ℹ️ Polygon receive ya certificado para', docId);
      return;
    }

    // Certificar con referencia al send: RECEIVE|docId|recipient|contentHash|sendTxHash|timestamp
    const txHash = await Promise.race([
      certificarRecepcion(docId, recipientId, sendTxHash, contentHash),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout certificación Polygon RECEIVE (>40s)')), 40_000)
      ),
    ]);

    await adminDb.collection('mail').doc(docId).update({
      'polygonCertifications.receive': txHash,
      'polygonCertifications.updatedAt': new Date(),
    });
    console.log('🔗 Primera lectura certificada en Polygon:', txHash);
  } catch (err: any) {
    console.error('⚠️ Error certificando FIRST_READ en Polygon (no afecta la apertura):', err?.message);
  }
}

/**
 * Registra `reader_magic_open` cuando el destinatario abre el reader vía magic link (?k=...).
 * Es la señal principal de apertura fehaciente — reemplaza el pixel de correo.
 * La certificación en Polygon corre en background sin bloquear la respuesta.
 */
export async function POST(request: NextRequest) {
  try {
    let body: { messageId?: unknown; k?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }
    const messageId = typeof body.messageId === 'string' ? body.messageId : null;
    const k = typeof body.k === 'string' ? body.k : null;
    if (!messageId || !k) {
      return NextResponse.json({ error: 'messageId y k son requeridos' }, { status: 400 });
    }

    const messageRef = adminDb.collection('mail').doc(messageId);

    const userAgent = request.headers.get('User-Agent') || 'Unknown';
    const clientIP =
      request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      request.headers.get('X-Real-IP') ||
      'Unknown';

    type TxOk = {
      skipped: false;
      movementId: string;
      wasFirstOpen: boolean;
      certify: boolean;
      recipientId: string;
      sendTxHash?: string;
      contentHash?: string;
    };
    type TxSkip = { skipped: true; reason: string };
    type TxResult = TxOk | TxSkip;

    const txResult = await adminDb.runTransaction(async (tx): Promise<TxResult> => {
      const snap = await tx.get(messageRef);
      if (!snap.exists) {
        throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
      }
      const messageData = snap.data()!;

      const stored =
        typeof messageData.tracking?.token === 'string'
          ? messageData.tracking.token
          : typeof messageData.trackingToken === 'string'
            ? messageData.trackingToken
            : undefined;
      if (!stored || stored !== k) {
        throw Object.assign(new Error('INVALID_TOKEN'), { code: 'INVALID_TOKEN' });
      }

      const existingMovements: any[] = messageData.tracking?.movements || [];
      const alreadyLoggedReaderOpen = existingMovements.some(
        (m) => m.type === 'reader_magic_open',
      );
      if (alreadyLoggedReaderOpen || messageData.tracking?.opened) {
        return { skipped: true, reason: 'already_logged' };
      }

      const wasFirstOpen = !messageData.tracking?.opened;
      const movement = {
        id: generateUUID(),
        type: 'reader_magic_open',
        description:
          'El destinatario abrió el mensaje para leerlo (página web de la notificación)',
        timestamp: new Date().toISOString(),
        userAgent,
        clientIP,
        browser: extractBrowserInfo(userAgent),
        recipientEmail: messageData.recipientEmail || messageData.to?.[0] || 'Unknown',
        source: 'reader_email',
        isFirstOpen: wasFirstOpen,
      };

      tx.update(messageRef, {
        'tracking.opened': true,
        'tracking.openedAt': new Date(),
        'tracking.openCount': (messageData.tracking?.openCount || 0) + 1,
        'tracking.movements': FieldValue.arrayUnion(movement),
      });

      const certify =
        wasFirstOpen && !messageData.polygonCertifications?.receive;
      return {
        skipped: false,
        movementId: movement.id,
        wasFirstOpen,
        certify,
        recipientId:
          messageData.recipientEmail || messageData.to?.[0] || 'recipient',
        sendTxHash: messageData.polygonCertifications?.send as string | undefined,
        contentHash: messageData.polygonCertifications?.contentHash as
          | string
          | undefined,
      };
    });

    if (txResult.skipped) {
      return NextResponse.json(
        { success: true, skipped: true, reason: txResult.reason },
        { status: 200 },
      );
    }

    if (txResult.certify) {
      void certifyFirstReadInBackground(
        messageId,
        txResult.recipientId,
        txResult.sendTxHash,
        txResult.contentHash,
      );
    }

    return NextResponse.json(
      { success: true, movementId: txResult.movementId, wasFirstOpen: txResult.wasFirstOpen },
      { status: 200 },
    );
  } catch (e: any) {
    if (e?.code === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
    }
    if (e?.code === 'INVALID_TOKEN') {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }
    console.error('track-reader-open:', e?.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
