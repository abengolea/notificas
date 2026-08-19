import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { assertAdminSession } from '@/lib/assert-admin-session';
import { getAdminDb } from '@/lib/firebase-admin';

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
    if (estado === 'cancelada') {
      return NextResponse.json({ ok: true, already: true });
    }
    if (estado === 'completada') {
      return NextResponse.json({ error: 'No se puede cancelar una campaña completada' }, { status: 400 });
    }
    if (estado !== 'enviando' && estado !== 'pausada') {
      return NextResponse.json({ error: 'Solo se puede cancelar una campaña en envío o pausada' }, { status: 400 });
    }

    await campRef.update({
      estado: 'cancelada',
      cancelledAt: FieldValue.serverTimestamp(),
      fanoutActive: false,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/admin/campaigns/cancel', e);
    return NextResponse.json({ error: 'Error al cancelar campaña' }, { status: 500 });
  }
}
