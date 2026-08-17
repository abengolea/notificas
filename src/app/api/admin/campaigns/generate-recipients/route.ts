import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertAdminSession } from '@/lib/assert-admin-session';
import { getAdminDb } from '@/lib/firebase-admin';
import { saveAllRecipientChunks } from '@/lib/campaign-recipients-storage';
import {
  generateFakeCampaignRecipients,
  SIM_RECIPIENT_MAX,
  SIM_RECIPIENT_MIN,
} from '@/lib/campaign-fake-recipients';
import type { CanalCampaign } from '@/lib/types';

const bodySchema = z.object({
  campaignId: z.string().min(1),
  count: z.number().int().min(SIM_RECIPIENT_MIN).max(SIM_RECIPIENT_MAX),
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
    if (campaign.simulated !== true) {
      return NextResponse.json(
        { error: 'Solo se generan destinatarios ficticios en campañas simuladas' },
        { status: 400 }
      );
    }
    if (campaign.estado !== 'borrador') {
      return NextResponse.json(
        { error: 'Solo se pueden generar destinatarios en borrador' },
        { status: 400 }
      );
    }

    const canal = (campaign.canal as CanalCampaign) || 'email';
    const recipients = generateFakeCampaignRecipients(parsed.data.count, canal);
    const orgId = String(campaign.orgId || '');
    const stored = await saveAllRecipientChunks(orgId, parsed.data.campaignId, recipients);

    await campRef.update({
      'stats.total': stored.recipientCount,
      'stats.pendientes': stored.recipientCount,
      'stats.enviados': 0,
      'stats.leidos': 0,
      'stats.errores': 0,
    });

    return NextResponse.json({
      ok: true,
      recipientCount: stored.recipientCount,
      chunkCount: stored.chunkCount,
    });
  } catch (e: unknown) {
    console.error('POST /api/admin/campaigns/generate-recipients', e);
    const msg = e instanceof Error ? e.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
