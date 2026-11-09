import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { certifyMailHitoIfNeeded } from '@/lib/certification-polygon';
import { isMailSender } from '@/lib/mail-sender';
import { getOptionalViewer } from '@/lib/optional-viewer';

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

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function getRecipientEmails(messageData: Record<string, any>): string[] {
  const recipientsRaw = Array.isArray(messageData.to) ? messageData.to : [messageData.to];
  const recipientsFromTo = recipientsRaw.map(normalizeEmail).filter(Boolean);
  const recipientDocEmail = normalizeEmail(messageData.recipientEmail);
  return [...new Set([...recipientsFromTo, recipientDocEmail].filter(Boolean))];
}

function getPrimaryRecipientEmail(messageData: Record<string, any>): string {
  return (
    normalizeEmail(messageData.recipientEmail) ||
    (Array.isArray(messageData.to) ? normalizeEmail(messageData.to[0]) : normalizeEmail(messageData.to))
  );
}

export async function POST(request: NextRequest) {
  try {
    const { messageId, attachmentId, fileName, action, k } = await request.json();

    if (!messageId || !attachmentId) {
      return NextResponse.json({ error: 'messageId y attachmentId son requeridos' }, { status: 400 });
    }

    // Obtener el documento primero para poder validar el tracking key
    const messageRef = adminDb.collection('mail').doc(messageId);
    const messageDoc = await messageRef.get();

    if (!messageDoc.exists) {
      return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
    }

    const messageData = messageDoc.data()!;

    // Estrategia de autenticación dual:
    // 1. Firebase ID token (usuarios logueados)
    // 2. Tracking key `k` (destinatarios externos vía magic link del reader)
    let recipientEmail: string | null = null;
    let openedByEmail: string | null = null;
    const primaryRecipientEmail = getPrimaryRecipientEmail(messageData);

    const authHeader = request.headers.get('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const hasValidKey = (() => {
      if (!k || typeof k !== 'string') return false;
      const storedKey =
        typeof messageData.tracking?.token === 'string'
          ? messageData.tracking.token
          : typeof messageData.trackingToken === 'string'
            ? messageData.trackingToken
            : undefined;
      return Boolean(storedKey && storedKey === k);
    })();

    // El remitente nunca cuenta como "el destinatario abrió el adjunto", venga con clave o sin ella.
    // Con clave (lector), la sesión Firebase es solo una pista: si es inválida se ignora.
    const viewer = bearerToken ? await getOptionalViewer(request) : null;
    if (viewer && isMailSender(viewer, messageData)) {
      // Incluye la prueba típica: el remitente se lo mandó a sí mismo.
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Apertura de adjunto del remitente ignorada.',
      });
    }

    if (bearerToken && !hasValidKey) {
      // Panel / app: destinatario logueado, sin clave.
      if (!viewer) {
        return NextResponse.json({ error: 'Token inválido o expirado.' }, { status: 401 });
      }
      const userEmail = normalizeEmail(viewer.email);
      const recipients = getRecipientEmails(messageData);
      if (!userEmail || !recipients.includes(userEmail)) {
        return NextResponse.json(
          { error: 'No autorizado para trackear este adjunto.' },
          { status: 403 },
        );
      }
      recipientEmail = userEmail;
      openedByEmail = userEmail;
    } else if (k && typeof k === 'string') {
      const stored =
        typeof messageData.tracking?.token === 'string'
          ? messageData.tracking.token
          : typeof messageData.trackingToken === 'string'
            ? messageData.trackingToken
            : undefined;
      if (!stored || stored !== k) {
        return NextResponse.json({ error: 'Tracking key inválido.' }, { status: 401 });
      }
      recipientEmail = primaryRecipientEmail || null;
      openedByEmail = recipientEmail;
    } else {
      return NextResponse.json({ error: 'Se requiere autenticación o tracking key.' }, { status: 401 });
    }

    const userAgent = request.headers.get('User-Agent') || 'Unknown';
    const clientIP =
      request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      request.headers.get('X-Real-IP') ||
      'Unknown';

    const attachmentMovement = {
      id: generateUUID(),
      type: 'attachment_opened',
      description: `Apertura de archivo adjunto: ${fileName || attachmentId}`,
      timestamp: new Date().toISOString(),
      userAgent,
      clientIP,
      browser: extractBrowserInfo(userAgent),
      recipientEmail: recipientEmail || primaryRecipientEmail || 'Unknown',
      mailRecipientEmail: primaryRecipientEmail || undefined,
      openedByEmail: openedByEmail || recipientEmail || undefined,
      viewerIsSender: false,
      attachmentId,
      fileName: fileName || null,
      action: action || 'open',
    };

    const currentAttachmentsOpened = messageData.tracking?.attachmentsOpened || 0;

    await messageRef.update({
      'tracking.attachmentsOpened': currentAttachmentsOpened + 1,
      'tracking.lastAttachmentActivity': new Date(),
      'tracking.movements': FieldValue.arrayUnion(attachmentMovement),
    });

    if (!messageData.campaignId) {
      void certifyMailHitoIfNeeded({
        docId: messageId,
        hito: 'content_access',
        via: 'attachment',
      }).catch((certifyError: unknown) => {
        console.warn(
          '⚠️ Polygon certify content_access (attachment):',
          certifyError instanceof Error ? certifyError.message : certifyError
        );
      });
    }

    return NextResponse.json({ success: true, movementId: attachmentMovement.id });
  } catch (error: any) {
    console.error('❌ Error tracking attachment:', error?.message);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
