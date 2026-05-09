import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { z } from 'zod';

const bodySchema = z.object({
  mailId: z.string().min(1),
  k: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { mailId, k } = parsed.data;
    const db = getAdminDb();
    const mailSnap = await db.collection('mail').doc(mailId).get();
    if (!mailSnap.exists) {
      return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
    }

    const mail = mailSnap.data()!;
    const storedToken =
      (mail.tracking && typeof mail.tracking.token === 'string' ? mail.tracking.token : null) ??
      (typeof (mail as { trackingToken?: string }).trackingToken === 'string'
        ? (mail as { trackingToken: string }).trackingToken
        : null);

    if (!storedToken || storedToken !== k) {
      return NextResponse.json({ error: 'Enlace inválido' }, { status: 401 });
    }

    if (!mail.tracking?.readConfirmed) {
      return NextResponse.json({ ok: true, updated: false });
    }

    const txRead =
      typeof mail.polygonCertifications?.read === 'string' ? mail.polygonCertifications.read : undefined;

    const msgSnap = await db.collection('campaign_messages').where('mailId', '==', mailId).get();

    if (msgSnap.empty) {
      return NextResponse.json({ ok: true, updated: false, reason: 'no_campaign_message' });
    }

    let updated = false;
    for (const doc of msgSnap.docs) {
      await db.runTransaction(async (t) => {
        const ref = doc.ref;
        const snap = await t.get(ref);
        const data = snap.data();
        if (!data) return;
        if (data.readSynced === true) return;
        const st = data.estado as string;
        if (st !== 'enviado') return;
        const campId = String(data.campaignId || '');
        t.update(ref, {
          estado: 'leido',
          leidoAt: FieldValue.serverTimestamp(),
          txHashLectura: txRead || data.txHashLectura || null,
          readSynced: true,
        });
        if (campId) {
          t.update(db.collection('campaigns').doc(campId), {
            'stats.leidos': FieldValue.increment(1),
          });
        }
        updated = true;
      });
    }

    return NextResponse.json({ ok: true, updated });
  } catch (e) {
    console.error('POST /api/campaigns/sync-read', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
