import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireCampaignOrgWrite } from '@/lib/campaign-access';
import { getAdminDb } from '@/lib/firebase-admin';
import { manualPauseFields } from '@/lib/campaign-auto-pause';
import { z } from 'zod';

const bodySchema = z.object({
  campaignId: z.string().min(1),
  orgId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { campaignId, orgId } = parsed.data;
    const denied = await requireCampaignOrgWrite(request, orgId, campaignId);
    if (denied) return denied;

    const db = getAdminDb();
    const campRef = db.collection('campaigns').doc(campaignId);
    const campSnap = await campRef.get();
    if (!campSnap.exists || String(campSnap.data()!.orgId) !== orgId) {
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
    console.error('POST /api/campaigns/pause', e);
    return NextResponse.json({ error: 'Error al pausar campaña' }, { status: 500 });
  }
}
