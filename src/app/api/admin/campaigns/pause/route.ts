import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { assertAdminSession } from '@/lib/assert-admin-session';
import { getAdminDb } from '@/lib/firebase-admin';
import { manualPauseFields } from '@/lib/campaign-auto-pause';

const bodySchema = z.object({
  campaignId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = getAdminDb();
    const campRef = db.collection('campaigns').doc(parsed.data.campaignId);
    const campSnap = await campRef.get();
    if (!campSnap.exists) {
      return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    }
    const estado = String(campSnap.data()!.estado || '');
    if (estado === 'cancelada' || estado === 'completada') {
      return NextResponse.json({ error: `No se puede pausar una campaña ${estado}` }, { status: 400 });
    }
    if (estado === 'pausada') {
      return NextResponse.json({ ok: true, already: true });
    }
    if (estado !== 'enviando') {
      return NextResponse.json({ error: 'Solo se puede pausar una campaña en envío' }, { status: 400 });
    }

    await campRef.update(manualPauseFields());
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/admin/campaigns/pause', e);
    return NextResponse.json({ error: 'Error al pausar campaña' }, { status: 500 });
  }
}
