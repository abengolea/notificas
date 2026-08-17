import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyAuthToken } from '@/lib/auth-helper';
import { getAdminDb } from '@/lib/firebase-admin';
import { normalizeEnviosDisponibles } from '@/lib/envios';
import { getOrgIfMember, maxRecipientsForPlan } from '@/lib/org-server';
import { enqueueCampaignFanout } from '@/lib/cloud-tasks';
import { sealCampaignWhatsAppTemplate } from '@/lib/wa-template-seal';
import type { RecipientEntry } from '@/lib/types';
import { z } from 'zod';

const bodySchema = z.object({
  campaignId: z.string().min(1),
  orgId: z.string().min(1),
  retryErrors: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { decoded, errorResponse } = await verifyAuthToken(request);
    if (errorResponse) return errorResponse;
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization Bearer requerido' }, { status: 401 });
    }

    const jsonBody = await request.json();
    const parsed = bodySchema.safeParse(jsonBody);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = getAdminDb();
    const uid = decoded!.uid;

    const orgGate = await getOrgIfMember(uid, parsed.data.orgId, decoded!.email);
    if (!orgGate) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const campRef = db.collection('campaigns').doc(parsed.data.campaignId);
    const campSnap = await campRef.get();
    if (!campSnap.exists) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });

    const campaign = campSnap.data()!;
    if (String(campaign.orgId) !== parsed.data.orgId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    if (campaign.estado === 'cancelada') {
      return NextResponse.json({ error: 'La campaña está cancelada' }, { status: 400 });
    }

    const plan = String(orgGate.data.plan || 'starter');
    const maxRecipients = maxRecipientsForPlan(plan);

    const useStorage = !!campaign.recipientStoragePath;
    let recipientData: RecipientEntry[] = [];
    let totalRecipients: number;

    if (useStorage) {
      // 150k+: no cargamos todos los destinatarios en memoria.
      totalRecipients = typeof campaign.recipientCount === 'number' ? campaign.recipientCount : 0;
      if (totalRecipients === 0) {
        return NextResponse.json({ error: 'Sin destinatarios (Storage vacío)' }, { status: 400 });
      }
    } else {
      recipientData = Array.isArray(campaign.recipientData)
        ? (campaign.recipientData as RecipientEntry[])
        : [];
      if (recipientData.length === 0 && Array.isArray(campaign.recipientEmails)) {
        recipientData = (campaign.recipientEmails as string[]).map((email) => ({
          email: String(email).trim().toLowerCase(),
          nombre: String(email).split('@')[0],
        }));
      }
      totalRecipients = recipientData.length;
      if (totalRecipients === 0) {
        return NextResponse.json({ error: 'Sin destinatarios' }, { status: 400 });
      }
    }

    if (totalRecipients > maxRecipients) {
      return NextResponse.json(
        { error: `Máximo ${maxRecipients} destinatarios para el plan ${plan}` },
        { status: 400 }
      );
    }

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const creditosInicial = normalizeEnviosDisponibles(userSnap.data()?.creditos);

    const successCount = await db
      .collection('campaign_messages')
      .where('campaignId', '==', parsed.data.campaignId)
      .where('estado', 'in', ['enviado', 'leido'])
      .count()
      .get();
    const successTotal = successCount.data().count;
    const remaining = Math.max(0, totalRecipients - successTotal);
    const dailyLimit =
      typeof campaign.tandaSize === 'number' && campaign.tandaSize > 0 ? campaign.tandaSize : remaining;
    const thisRun = parsed.data.retryErrors ? remaining : (dailyLimit > 0 ? Math.min(dailyLimit, remaining) : remaining);
    const tandaCap = successTotal + thisRun;
    const pendingCount = thisRun;

    if (thisRun === 0) {
      return NextResponse.json({
        queued: false,
        reason: 'tanda_completa',
        alreadySent: successTotal,
        total: totalRecipients,
      });
    }

    const prepaidAlready = typeof campaign.creditsPrepaidAmount === 'number' ? campaign.creditsPrepaidAmount : 0;
    const refundedAlready = typeof campaign.creditsRefunded === 'number' ? campaign.creditsRefunded : 0;
    const unusedPrepaid = Math.max(0, prepaidAlready - refundedAlready - successTotal);
    const chargeNow = parsed.data.retryErrors ? 0 : Math.max(0, thisRun - unusedPrepaid);

    if (creditosInicial < chargeNow) {
      return NextResponse.json(
        {
          error: `Envíos insuficientes: necesitás ${chargeNow}, tenés ${creditosInicial}`,
        },
        { status: 400 }
      );
    }

    const senderEmail = decoded!.email || '';
    const previousEstado = String(campaign.estado || 'borrador');
    const startedAt = campaign.startedAt ? {} : { startedAt: FieldValue.serverTimestamp() };
    const startOffset = parsed.data.retryErrors
      ? 0
      : (typeof campaign.fanoutResumeOffset === 'number' ? campaign.fanoutResumeOffset : 0);

    try {
      await db.runTransaction(async (t) => {
        const uSnap = await t.get(userRef);
        const c = normalizeEnviosDisponibles(uSnap.data()?.creditos);
        if (c < chargeNow) throw new Error(`Envíos insuficientes: necesitás ${chargeNow}, tenés ${c}`);
        if (chargeNow > 0) {
          t.update(userRef, {
            creditos: FieldValue.increment(-chargeNow),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        t.update(campRef, {
          estado: 'enviando',
          senderEmail,
          senderUid: uid,
          tandaCap,
          creditsPrepaidAmount: prepaidAlready + chargeNow,
          'stats.total': totalRecipients,
          'stats.pendientes': remaining,
          ...(parsed.data.retryErrors ? { 'stats.errores': 0 } : {}),
          enqueuedAt: FieldValue.serverTimestamp(),
          ...startedAt,
        });
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al reservar créditos';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    try {
      await sealCampaignWhatsAppTemplate(parsed.data.campaignId).catch(() => null);
      await enqueueCampaignFanout(parsed.data.campaignId, startOffset);
    } catch (e) {
      await campRef.update({ estado: previousEstado }).catch(() => undefined);
      throw e;
    }

    return NextResponse.json({ queued: true, total: totalRecipients, pending: pendingCount });
  } catch (e: unknown) {
    console.error('POST /api/campaigns/send', e);
    const msg = e instanceof Error ? e.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
