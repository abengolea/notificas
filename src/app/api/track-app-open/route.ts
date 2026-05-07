import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuthToken } from '@/lib/auth-helper';

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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function certifyEventHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const secret = process.env.POLYGON_CERTIFY_SECRET?.trim();
  if (secret) headers['X-Certify-Secret'] = secret;
  return headers;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function GET() {
  return NextResponse.json(
    { success: true, message: 'Ruta /api/track-app-open está funcionando' },
    { status: 200, headers: CORS_HEADERS }
  );
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const { decoded, errorResponse } = await verifyAuthToken(request);
    if (errorResponse) return errorResponse;

    let body: { messageId?: unknown; userEmail?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'JSON inválido en el body' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const { messageId } = body;
    if (!messageId || typeof messageId !== 'string') {
      return NextResponse.json(
        { error: 'messageId es requerido y debe ser un string' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Usar email del token autenticado (más confiable que el body)
    const userEmail = decoded.email;

    const userAgent = request.headers.get('User-Agent') || 'Unknown';
    const clientIP =
      request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      request.headers.get('X-Real-IP') ||
      'Unknown';

    const messageRef = adminDb.collection('mail').doc(messageId);
    const messageDoc = await messageRef.get();

    if (!messageDoc.exists) {
      return NextResponse.json(
        { error: 'Mensaje no encontrado' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const messageData = messageDoc.data()!;

    const normalizeEmail = (e: unknown) =>
      typeof e === 'string' ? e.trim().toLowerCase() : '';
    const mailboxRecipient =
      normalizeEmail(messageData.recipientEmail) ||
      (Array.isArray(messageData.to) ? normalizeEmail(messageData.to[0]) : normalizeEmail(messageData.to));

    const recipientsRaw = Array.isArray(messageData.to) ? messageData.to : [messageData.to];
    const recipients = recipientsRaw.map(normalizeEmail).filter(Boolean);

    const userNorm = normalizeEmail(userEmail);
    const isSender =
      messageData.createdBy === decoded.uid ||
      normalizeEmail(messageData.senderName) === userNorm;
    const isRecipient = Boolean(userNorm && recipients.includes(userNorm));

    if (!isSender && !isRecipient) {
      return NextResponse.json(
        { error: 'No autorizado para trackear este mensaje' },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    const existingMovements: any[] = messageData.tracking?.movements || [];
    const fiveSecondsAgo = Date.now() - 5000;
    const recentAppOpen = existingMovements
      .filter((m) => m.type === 'app_opened')
      .find((m) => {
        const t = new Date(m.timestamp).getTime();
        if (t <= fiveSecondsAgo) return false;
        const by = normalizeEmail((m as { openedByEmail?: string }).openedByEmail);
        return by === userNorm || (!by && t > fiveSecondsAgo);
      });

    if (recentAppOpen) {
      return NextResponse.json(
        { success: true, message: 'Apertura ya registrada', skipped: true },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const openedByEmail = userEmail || 'Unknown';
    const isSenderOnlyView = isSender && !isRecipient;

    const appOpenMovement = {
      id: generateUUID(),
      type: 'app_opened',
      description: isSenderOnlyView
        ? 'El remitente consultó este envío en el panel (no indica que el destinatario haya leído el correo externo).'
        : 'El destinatario abrió el mensaje desde la aplicación web.',
      timestamp: new Date().toISOString(),
      userAgent,
      clientIP,
      browser: extractBrowserInfo(userAgent),
      /** Buzón al que iba dirigido el envío (siempre el del documento). */
      mailRecipientEmail: mailboxRecipient || undefined,
      /** Quien generó el evento (remitente o destinatario autenticado). */
      openedByEmail,
      /** Compat UI antigua: solo el destinatario debe figurar como “recipient” del evento. */
      recipientEmail: isRecipient ? openedByEmail : mailboxRecipient || undefined,
      viewerIsSender: isSenderOnlyView,
      source: 'app_web',
    };

    if (isRecipient) {
      const wasFirstOpen = !messageData.tracking?.opened;

      await messageRef.update({
        'tracking.opened': true,
        'tracking.openedAt': new Date(),
        'tracking.openCount': (messageData.tracking?.openCount || 0) + 1,
        'tracking.movements': FieldValue.arrayUnion(appOpenMovement),
        'tracking.lastAppOpenAt': new Date(),
      });

      if (wasFirstOpen) {
        try {
          const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9006';
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
            console.warn('⚠️ Polygon certify receive (app-open):', await certifyRes.text());
          }
        } catch (e: any) {
          console.warn('⚠️ Polygon certify receive failed:', e?.message);
        }
      }
    } else {
      await messageRef.update({
        'tracking.movements': FieldValue.arrayUnion(appOpenMovement),
        'tracking.lastSenderPanelViewAt': new Date(),
      });
    }

    return NextResponse.json(
      { success: true, movementId: appOpenMovement.id },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error('❌ Error al trackear apertura desde app:', error?.message);
    return NextResponse.json(
      {
        error: 'Error al trackear apertura',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
