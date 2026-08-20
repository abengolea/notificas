import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireCampaignOrgWrite } from '@/lib/campaign-access';
import { getAdminDb } from '@/lib/firebase-admin';
import { requeuePendingCampaignMessages, startCampaignTanda } from '@/lib/campaign-start-tanda';
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
    const campaign = campSnap.data()!;
    if (String(campaign.estado) !== 'pausada') {
      return NextResponse.json({ error: 'La campaña no está pausada' }, { status: 400 });
    }

    await campRef.update({
      estado: 'enviando',
      resumedAt: FieldValue.serverTimestamp(),
      fanoutActive: false,
    });

    const requeued = await requeuePendingCampaignMessages(campaignId);
    const result = await startCampaignTanda({
      campaignId,
      requireStorage: Boolean(campaign.recipientStoragePath),
      chargeCredits: true,
    });
    return NextResponse.json({ ok: true, requeued, ...result });
  } catch (e: unknown) {
    console.error('POST /api/campaigns/resume', e);
    const msg = e instanceof Error ? e.message : 'Error al reanudar campaña';
    const status = typeof (e as { status?: number }).status === 'number' ? (e as { status: number }).status : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
