import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { assertAdminSession } from '@/lib/assert-admin-session';
import { getAdminDb } from '@/lib/firebase-admin';
import { requeuePendingCampaignMessages, startCampaignTanda } from '@/lib/campaign-start-tanda';

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
    const campaign = campSnap.data()!;
    if (String(campaign.estado) !== 'pausada') {
      return NextResponse.json({ error: 'La campaña no está pausada' }, { status: 400 });
    }

    await campRef.update({
      estado: 'enviando',
      resumedAt: FieldValue.serverTimestamp(),
      fanoutActive: false,
    });

    const requeued = await requeuePendingCampaignMessages(parsed.data.campaignId);
    const result = await startCampaignTanda({
      campaignId: parsed.data.campaignId,
      requireStorage: Boolean(campaign.recipientStoragePath),
      chargeCredits: campaign.managedByAdmin !== true,
    });

    return NextResponse.json({ ok: true, requeued, ...result });
  } catch (e: unknown) {
    console.error('POST /api/admin/campaigns/resume', e);
    const msg = e instanceof Error ? e.message : 'Error al reanudar campaña';
    const status = typeof (e as { status?: number }).status === 'number' ? (e as { status: number }).status : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
