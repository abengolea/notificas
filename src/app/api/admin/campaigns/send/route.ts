import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { assertAdminSession } from '@/lib/assert-admin-session';
import { getAdminDb } from '@/lib/firebase-admin';
import { enqueueCampaignFanout } from '@/lib/cloud-tasks';
import { sealCampaignWhatsAppTemplate } from '@/lib/wa-template-seal';

const bodySchema = z.object({
  campaignId: z.string().min(1),
  tandaSize: z.number().int().min(0).optional(),
  retryErrors: z.boolean().optional(),
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
    if (campaign.estado === 'cancelada') {
      return NextResponse.json({ error: 'La campaña está cancelada' }, { status: 400 });
    }

    const totalRecipients = typeof campaign.recipientCount === 'number' ? campaign.recipientCount : 0;
    if (!campaign.recipientStoragePath || totalRecipients === 0) {
      return NextResponse.json({ error: 'Subí el CSV de destinatarios antes de enviar' }, { status: 400 });
    }

    const dailyLimit =
      typeof parsed.data.tandaSize === 'number'
        ? parsed.data.tandaSize
        : typeof campaign.tandaSize === 'number'
        ? campaign.tandaSize
        : 0;

    const successSnap = await db
      .collection('campaign_messages')
      .where('campaignId', '==', parsed.data.campaignId)
      .where('estado', 'in', ['enviado', 'leido'])
      .count()
      .get();
    const alreadySent = successSnap.data().count;
    const remaining = Math.max(0, totalRecipients - alreadySent);
    const thisRun = dailyLimit > 0 ? Math.min(dailyLimit, remaining) : remaining;
    const tandaCap = alreadySent + thisRun;

    if (thisRun === 0) {
      return NextResponse.json({
        queued: false,
        reason: 'tanda_completa',
        alreadySent,
        tandaSize: dailyLimit,
        total: totalRecipients,
      });
    }

    const orgSnap = await db.collection('organizations').doc(String(campaign.orgId)).get();
    const org = orgSnap.data() || {};
    const senderUid = String(campaign.senderUid || campaign.createdBy || org.adminUserId || '');
    const senderEmail = String(campaign.senderEmail || org.adminUserEmail || '');

    const startedAt = campaign.startedAt ? {} : { startedAt: FieldValue.serverTimestamp() };
    const startOffset = parsed.data.retryErrors
      ? 0
      : (typeof campaign.fanoutResumeOffset === 'number' ? campaign.fanoutResumeOffset : 0);
    await campRef.update({
      estado: 'enviando',
      tandaSize: dailyLimit,
      tandaCap,
      senderUid,
      senderEmail,
      managedByAdmin: true,
      'stats.total': totalRecipients,
      'stats.pendientes': remaining,
      ...(parsed.data.retryErrors ? { 'stats.errores': 0 } : {}),
      enqueuedAt: FieldValue.serverTimestamp(),
      ...startedAt,
    });

    await sealCampaignWhatsAppTemplate(parsed.data.campaignId).catch(() => null);
    await enqueueCampaignFanout(parsed.data.campaignId, startOffset);

    return NextResponse.json({
      queued: true,
      total: totalRecipients,
      tandaSize: dailyLimit,
      alreadySent,
      pendingThisTanda: thisRun,
      billedTo: senderEmail || org.nombre || campaign.orgId,
    });
  } catch (e: unknown) {
    console.error('POST /api/admin/campaigns/send', e);
    const msg = e instanceof Error ? e.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
