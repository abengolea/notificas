import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { normalizeEnviosDisponibles } from '@/lib/envios';
import { campaignFanoutIsBusy, FANOUT_BUSY_MSG, planDailySend } from '@/lib/campaign-tanda';
import { enqueueCampaignFanout, enqueueCampaignWorker } from '@/lib/cloud-tasks';
import { sealCampaignWhatsAppTemplate } from '@/lib/wa-template-seal';
import { scheduleNextDailySend } from '@/lib/campaign-daily';
import type { RecipientEntry } from '@/lib/types';

export type StartTandaOk = {
  queued: true;
  total: number;
  alreadySent: number;
  pendingThisTanda: number;
  tandaSize: number;
  dailyQuota: number;
  billedTo?: string;
};

export type StartTandaIdle = {
  queued: false;
  reason: 'tanda_completa' | 'pausada' | 'cancelada' | 'completada' | 'sin_destinatarios';
  alreadySent: number;
  total: number;
  tandaSize: number;
  dailyQuota: number;
  remainingToday: number;
  nextDailyAt?: string;
};

const SEND_BATCH = 20;

export async function countCampaignSuccess(campaignId: string): Promise<number> {
  const db = getAdminDb();
  const snap = await db
    .collection('campaign_messages')
    .where('campaignId', '==', campaignId)
    .where('estado', 'in', ['enviado', 'leido'])
    .count()
    .get();
  return snap.data().count;
}

export async function requeuePendingCampaignMessages(campaignId: string): Promise<number> {
  const db = getAdminDb();
  let queued = 0;
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q = db
      .collection('campaign_messages')
      .where('campaignId', '==', campaignId)
      .where('estado', '==', 'pendiente')
      .orderBy('__name__')
      .limit(200);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;
    const ids = snap.docs.map((d) => d.id);
    for (let i = 0; i < ids.length; i += SEND_BATCH) {
      await enqueueCampaignWorker(campaignId, ids.slice(i, i + SEND_BATCH));
      queued += Math.min(SEND_BATCH, ids.length - i);
    }
    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < 200) break;
  }
  return queued;
}

export async function startCampaignTanda(params: {
  campaignId: string;
  retryErrors?: boolean;
  upcomingQuota?: number;
  actorUid?: string;
  actorEmail?: string;
  requireStorage?: boolean;
  chargeCredits?: boolean;
  maxRecipients?: number;
}): Promise<StartTandaOk | StartTandaIdle> {
  const db = getAdminDb();
  const campRef = db.collection('campaigns').doc(params.campaignId);
  const campSnap = await campRef.get();
  if (!campSnap.exists) {
    throw Object.assign(new Error('Campaña no encontrada'), { status: 404 });
  }
  const campaign = campSnap.data()!;
  const estado = String(campaign.estado || 'borrador');
  if (estado === 'cancelada') {
    return idle('cancelada', campaign, 0, 0);
  }
  if (estado === 'completada') {
    return idle('completada', campaign, 0, 0);
  }
  if (estado === 'pausada') {
    return idle('pausada', campaign, 0, 0);
  }

  const totalRecipients = typeof campaign.recipientCount === 'number' ? campaign.recipientCount : 0;
  if (params.requireStorage !== false && (!campaign.recipientStoragePath || totalRecipients === 0)) {
    if (!campaign.recipientStoragePath) {
      throw Object.assign(new Error('Subí el CSV de destinatarios antes de enviar'), { status: 400 });
    }
    throw Object.assign(new Error('Sin destinatarios'), { status: 400 });
  }
  if (totalRecipients === 0) {
    const inline = Array.isArray(campaign.recipientData) ? (campaign.recipientData as RecipientEntry[]).length : 0;
    if (inline === 0) {
      throw Object.assign(new Error('Sin destinatarios'), { status: 400 });
    }
  }
  const total = totalRecipients || (Array.isArray(campaign.recipientData) ? campaign.recipientData.length : 0);
  if (typeof params.maxRecipients === 'number' && total > params.maxRecipients) {
    throw Object.assign(new Error(`Máximo ${params.maxRecipients} destinatarios para este plan`), { status: 400 });
  }

  const alreadySent = await countCampaignSuccess(params.campaignId);
  const remaining = Math.max(0, total - alreadySent);
  const upcomingQuota =
    typeof params.upcomingQuota === 'number'
      ? params.upcomingQuota
      : typeof campaign.tandaSize === 'number'
        ? campaign.tandaSize
        : 0;
  const plan = planDailySend({
    campaign: { ...campaign, tandaSize: upcomingQuota },
    alreadySent,
    totalRecipients: total,
    retryErrors: params.retryErrors,
  });

  if (plan.thisRun === 0) {
    let nextDailyAt: string | undefined;
    if (remaining > 0) {
      const scheduled = await scheduleNextDailySend(params.campaignId);
      nextDailyAt = scheduled.at;
    }
    return {
      queued: false,
      reason: remaining === 0 ? 'sin_destinatarios' : 'tanda_completa',
      alreadySent,
      total,
      tandaSize: upcomingQuota,
      dailyQuota: plan.dailyQuota,
      remainingToday: plan.remainingToday,
      nextDailyAt,
    };
  }

  const managedByAdmin = campaign.managedByAdmin === true;
  const chargeCredits = params.chargeCredits === true && managedByAdmin !== true;
  const senderUid = String(params.actorUid || campaign.senderUid || campaign.createdBy || '');
  const senderEmail = String(params.actorEmail || campaign.senderEmail || '');
  const prepaidAlready = typeof campaign.creditsPrepaidAmount === 'number' ? campaign.creditsPrepaidAmount : 0;
  const refundedAlready = typeof campaign.creditsRefunded === 'number' ? campaign.creditsRefunded : 0;
  const unusedPrepaid = Math.max(0, prepaidAlready - refundedAlready - alreadySent);
  const chargeNow = chargeCredits
    ? (params.retryErrors ? 0 : Math.max(0, plan.thisRun - unusedPrepaid))
    : 0;

  if (chargeNow > 0 && !senderUid) {
    throw Object.assign(new Error('La campaña no tiene remitente para descontar envíos'), { status: 400 });
  }

  const orgSnap = await db.collection('organizations').doc(String(campaign.orgId)).get();
  const org = orgSnap.data() || {};
  const billedTo = senderEmail || String(org.adminUserEmail || org.nombre || campaign.orgId);
  const previousEstado = estado;
  const startedAt = campaign.startedAt ? {} : { startedAt: FieldValue.serverTimestamp() };
  const startOffset = params.retryErrors
    ? 0
    : (typeof campaign.fanoutResumeOffset === 'number' ? campaign.fanoutResumeOffset : 0);
  const userRef = senderUid ? db.collection('users').doc(senderUid) : null;

  try {
    await db.runTransaction(async (t) => {
      const fresh = await t.get(campRef);
      const now = fresh.data() || {};
      const st = String(now.estado || '');
      if (st === 'cancelada' || st === 'pausada') {
        throw new Error(st === 'pausada' ? 'La campaña está pausada' : 'La campaña está cancelada');
      }
      if (campaignFanoutIsBusy(now)) {
        throw new Error(FANOUT_BUSY_MSG);
      }
      if (chargeNow > 0 && userRef) {
        const uSnap = await t.get(userRef);
        const c = normalizeEnviosDisponibles(uSnap.data()?.creditos);
        if (c < chargeNow) throw new Error(`Envíos insuficientes: necesitás ${chargeNow}, tenés ${c}`);
        t.update(userRef, {
          creditos: FieldValue.increment(-chargeNow),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      t.update(campRef, {
        estado: 'enviando',
        tandaSize: upcomingQuota,
        tandaCap: plan.tandaCap,
        ...plan.dayFields,
        senderUid,
        senderEmail,
        ...(chargeNow > 0 ? { creditsPrepaidAmount: prepaidAlready + chargeNow } : {}),
        'stats.total': total,
        'stats.pendientes': remaining,
        ...(params.retryErrors ? { 'stats.errores': 0 } : {}),
        enqueuedAt: FieldValue.serverTimestamp(),
        fanoutActive: true,
        fanoutLockAt: FieldValue.serverTimestamp(),
        ...startedAt,
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al iniciar envío';
    const status = msg === FANOUT_BUSY_MSG ? 409 : 400;
    throw Object.assign(new Error(msg), { status });
  }

  try {
    await sealCampaignWhatsAppTemplate(params.campaignId).catch(() => null);
    await enqueueCampaignFanout(params.campaignId, startOffset);
  } catch (e) {
    await campRef.update({ estado: previousEstado, fanoutActive: false }).catch(() => undefined);
    throw e;
  }

  return {
    queued: true,
    total,
    alreadySent,
    pendingThisTanda: plan.thisRun,
    tandaSize: upcomingQuota,
    dailyQuota: plan.dailyQuota,
    billedTo,
  };
}

function idle(
  reason: StartTandaIdle['reason'],
  campaign: FirebaseFirestore.DocumentData,
  alreadySent: number,
  total: number
): StartTandaIdle {
  return {
    queued: false,
    reason,
    alreadySent,
    total: typeof campaign.recipientCount === 'number' ? campaign.recipientCount : total,
    tandaSize: typeof campaign.tandaSize === 'number' ? campaign.tandaSize : 0,
    dailyQuota: typeof campaign.tandaDayQuota === 'number' ? campaign.tandaDayQuota : 0,
    remainingToday: 0,
  };
}
