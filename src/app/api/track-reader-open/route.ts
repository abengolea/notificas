import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { certifyMailHitoIfNeeded } from '@/lib/certification-polygon';
import { recordEventLeaf } from '@/lib/campaign-integrity';
import { syncCampaignMessageLinkClick } from '@/lib/campaign-click-sync';

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
 * Certifica el acceso al contenido (reader) en Polygon. No pisa WhatsApp entregado/leído.
 */
async function certifyContentAccessInBackground(docId: string): Promise<void> {
  try {
    const txHash = await Promise.race([
      certifyMailHitoIfNeeded({ docId, hito: 'content_access', via: 'reader' }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout certificación Polygon CONTENT_ACCESS (>40s)')), 40_000)
      ),
    ]);
    if (!txHash) return;
    const msgSnap = await adminDb.collection('campaign_messages').where('mailId', '==', docId).limit(1).get();
    if (!msgSnap.empty) {
      await msgSnap.docs[0].ref.update({ txHashLectura: txHash, emailTxLectura: txHash });
    }
  } catch (err: any) {
    console.error('⚠️ Error certificando CONTENT_ACCESS en Polygon (no afecta la apertura):', err?.message);
  }
}

/** Marca campaign_message como leído y actualiza stats de campaña. */
async function syncCampaignMessageRead(mailId: string): Promise<void> {
  try {
    const msgSnap = await adminDb.collection('campaign_messages').where('mailId', '==', mailId).limit(1).get();
    if (msgSnap.empty) return;

    const msgRef = msgSnap.docs[0].ref;
    const msgData = msgSnap.docs[0].data();
    if (msgData.emailEstado === 'leido') return;

    const campId = String(msgData.campaignId || '');
    const canal = campId
      ? ((await adminDb.collection('campaigns').doc(campId).get()).data()?.canal || 'email')
      : 'email';

    await adminDb.runTransaction(async (t) => {
      const fresh = await t.get(msgRef);
      const fd = fresh.data();
      if (!fd || fd.emailEstado === 'leido') return;
      const update: Record<string, unknown> = {
        emailEstado: 'leido',
        emailLeidoAt: new Date(),
      };
      // Para solo-email o cuando WA ya está leído, subir estado global
      const waOk = canal !== 'ambos' || fd.waEstado === 'leido';
      if (fd.estado !== 'leido' && waOk) {
        update.estado = 'leido';
        update.leidoAt = new Date();
        if (campId) {
          t.update(adminDb.collection('campaigns').doc(campId), { 'stats.leidos': FieldValue.increment(1) });
        }
      }
      t.update(msgRef, update);
    });
  } catch (err: any) {
    console.error('⚠️ Error sincronizando leído en campaign_message:', err?.message);
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
      isCampaign: boolean;
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
      // Solo omitir si ya hay apertura del reader. `tracking.opened` puede venir
      // de una visita al panel (app_opened) y no debe tapar la lectura real del correo.
      if (alreadyLoggedReaderOpen) {
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

      const isCampaign = Boolean(messageData.campaignId);
      const certify =
        !isCampaign && !messageData.polygonCertifications?.contentAccess;
      return {
        skipped: false,
        movementId: movement.id,
        wasFirstOpen,
        certify,
        isCampaign,
      };
    });

    if (txResult.skipped) {
      // Campañas solo-WA: el link del mensaje apunta directo al reader.
      await syncCampaignMessageLinkClick(messageId, 'auto');
      return NextResponse.json(
        { success: true, skipped: true, reason: txResult.reason },
        { status: 200 },
      );
    }

    if (txResult.certify) {
      void certifyContentAccessInBackground(messageId);
    }

    if (txResult.wasFirstOpen) {
      await syncCampaignMessageRead(messageId);
      await syncCampaignMessageLinkClick(messageId, 'auto');
      void (async () => {
        try {
          const msgSnap = await adminDb.collection('campaign_messages').where('mailId', '==', messageId).limit(1).get();
          if (msgSnap.empty) return;
          const msg = msgSnap.docs[0];
          await recordEventLeaf({
            campaignId: String(msg.data().campaignId),
            orgId: String(msg.data().orgId || ''),
            messageId: msg.id,
            eventType: 'email_read',
          });
        } catch (e: unknown) {
          console.warn('⚠️ Hoja Merkle email_read:', e instanceof Error ? e.message : e);
        }
      })();
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
