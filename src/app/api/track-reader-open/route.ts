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
    const messageDoc = await messageRef.get();
    if (!messageDoc.exists) {
      return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
    }
    const messageData = messageDoc.data()!;

    // Validar token mágico
    const stored =
      typeof messageData.tracking?.token === 'string'
        ? messageData.tracking.token
        : typeof messageData.trackingToken === 'string'
          ? messageData.trackingToken
          : undefined;
    if (!stored || stored !== k) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const userAgent = request.headers.get('User-Agent') || 'Unknown';
    const clientIP =
      request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      request.headers.get('X-Real-IP') ||
      'Unknown';

    // Deduplicación: ignorar si ya hubo una apertura en los últimos 5s desde la misma IP
    const existingMovements: any[] = messageData.tracking?.movements || [];
    const fiveSecondsAgo = Date.now() - 5000;
    const recent = existingMovements
      .filter((m) => m.type === 'reader_magic_open')
      .find((m) => {
        const t = new Date(m.timestamp).getTime();
        return t > fiveSecondsAgo && m.clientIP === clientIP;
      });
    if (recent) {
      return NextResponse.json({ success: true, skipped: true }, { status: 200 });
    }

    const wasFirstOpen = !messageData.tracking?.opened;
    const movement = {
      id: generateUUID(),
      type: 'reader_magic_open',
      description: 'Abrieron la notificación desde el enlace del correo',
      timestamp: new Date().toISOString(),
      userAgent,
      clientIP,
      browser: extractBrowserInfo(userAgent),
      recipientEmail: messageData.recipientEmail || messageData.to?.[0] || 'Unknown',
      source: 'reader_email',
      isFirstOpen: wasFirstOpen,
    };

    await messageRef.update({
      'tracking.opened': true,
      'tracking.openedAt': new Date(),
      'tracking.openCount': (messageData.tracking?.openCount || 0) + 1,
      'tracking.movements': FieldValue.arrayUnion(movement),
    });

    // Certificar en Polygon solo la PRIMERA apertura, en background, encadenada al send.
    // Condición: debe ser primera apertura Y no tener ya certificación de recepción.
    if (wasFirstOpen && !messageData.polygonCertifications?.receive) {
      const recipientId = messageData.recipientEmail || messageData.to?.[0] || 'recipient';
      const sendTxHash = messageData.polygonCertifications?.send as string | undefined;
      const contentHash = messageData.polygonCertifications?.contentHash as string | undefined;

      // Fire-and-forget: no bloquea la respuesta HTTP
      void certifyFirstReadInBackground(messageId, recipientId, sendTxHash, contentHash);
    }

    return NextResponse.json(
      { success: true, movementId: movement.id, wasFirstOpen },
      { status: 200 }
    );
  } catch (e: any) {
    console.error('track-reader-open:', e?.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
