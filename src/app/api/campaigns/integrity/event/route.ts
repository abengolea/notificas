import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { recordEventLeaf, type IntegrityEventType } from '@/lib/campaign-integrity';

const EVENT_TYPES = new Set<IntegrityEventType>(['email_read', 'wa_delivered', 'wa_read']);

function authorized(request: NextRequest): boolean {
  const worker = (process.env.CAMPAIGN_WORKER_SECRET || '').trim();
  const certify = (process.env.POLYGON_CERTIFY_SECRET || '').trim();
  const headerWorker = (request.headers.get('X-Worker-Secret') || '').trim();
  const headerCert = (request.headers.get('X-Certify-Secret') || '').trim();
  return Boolean((worker && headerWorker === worker) || (certify && headerCert === certify));
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { mailId?: string; messageId?: string; eventType?: string; occurredAt?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const eventType = body.eventType as IntegrityEventType;
  if (!EVENT_TYPES.has(eventType)) {
    return NextResponse.json({ error: 'eventType inválido' }, { status: 400 });
  }

  const db = getAdminDb();
  let messageId = typeof body.messageId === 'string' ? body.messageId : '';
  if (!messageId && body.mailId) {
    const snap = await db.collection('campaign_messages').where('mailId', '==', body.mailId).limit(1).get();
    if (snap.empty) {
      return NextResponse.json({ ok: true, skipped: 'no_campaign_message' });
    }
    messageId = snap.docs[0].id;
  }
  if (!messageId) {
    return NextResponse.json({ error: 'messageId o mailId requerido' }, { status: 400 });
  }

  const msgSnap = await db.collection('campaign_messages').doc(messageId).get();
  if (!msgSnap.exists) {
    return NextResponse.json({ ok: true, skipped: 'no_campaign_message' });
  }
  const msg = msgSnap.data()!;

  try {
    const result = await recordEventLeaf({
      campaignId: String(msg.campaignId),
      orgId: String(msg.orgId || ''),
      messageId,
      eventType,
      occurredAt: typeof body.occurredAt === 'string' ? body.occurredAt : undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error registrando hecho';
    console.error('POST /api/campaigns/integrity/event', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
