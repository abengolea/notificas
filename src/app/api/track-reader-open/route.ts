import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

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

function certifyEventHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const secret = process.env.POLYGON_CERTIFY_SECRET?.trim();
  if (secret) headers['X-Certify-Secret'] = secret;
  return headers;
}

/**
 * Primera apertura real del mensaje vía enlace del correo (?k=...) cuando el HTML enlaza directo a /reader
 * (sin pasar por linkRedirect ni pixel). Registra tracking y certifica receive en Polygon (idempotente).
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

    const movement = {
      id: generateUUID(),
      type: 'reader_magic_open',
      description: 'Apertura del mensaje desde el enlace del correo (reader con token).',
      timestamp: new Date().toISOString(),
      userAgent,
      clientIP,
      browser: extractBrowserInfo(userAgent),
      recipientEmail: messageData.recipientEmail || messageData.to?.[0] || 'Unknown',
      source: 'reader_email',
    };

    const wasFirstOpen = !messageData.tracking?.opened;

    await messageRef.update({
      'tracking.opened': true,
      'tracking.openedAt': new Date(),
      'tracking.openCount': (messageData.tracking?.openCount || 0) + 1,
      'tracking.movements': FieldValue.arrayUnion(movement),
    });

    const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:9006';
    if (process.env.POLYGON_CERTIFY_SECRET?.trim()) {
      try {
        const certifyRes = await fetch(`${base}/api/polygon/certify-event`, {
          method: 'POST',
          headers: certifyEventHeaders(),
          body: JSON.stringify({
            docId: messageId,
            type: 'receive',
            userId: messageData.recipientEmail || messageData.to?.[0],
          }),
        });
        if (!certifyRes.ok) {
          console.warn('⚠️ Polygon certify receive (reader-open):', await certifyRes.text());
        }
      } catch (e: any) {
        console.warn('⚠️ Polygon certify receive failed:', e?.message);
      }
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
