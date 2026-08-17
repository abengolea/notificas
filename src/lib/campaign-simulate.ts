import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';

export type SimulatedRates = {
  failRate: number;
  waDeliveredRate: number;
  waReadRate: number;
  readerOpenRate: number;
};

export const DEFAULT_SIMULATION_RATES: SimulatedRates = {
  failRate: 0.03,
  waDeliveredRate: 0.94,
  waReadRate: 0.58,
  readerOpenRate: 0.36,
};

export function isCampaignSimulated(campaign: { simulated?: unknown } | null | undefined): boolean {
  return campaign?.simulated === true;
}

function roll(p: number): boolean {
  return Math.random() < p;
}

function uuid(): string {
  return crypto.randomUUID();
}

type SimulatedPlan = {
  fail: boolean;
  delivered: boolean;
  waRead: boolean;
  readerOpen: boolean;
  trackingToken: string;
  wamid?: string;
};

function ratesFromCampaign(campaign: FirebaseFirestore.DocumentData): SimulatedRates {
  const raw = campaign.simulation && typeof campaign.simulation === 'object'
    ? (campaign.simulation as Partial<SimulatedRates>)
    : {};
  return {
    failRate: typeof raw.failRate === 'number' ? raw.failRate : DEFAULT_SIMULATION_RATES.failRate,
    waDeliveredRate: typeof raw.waDeliveredRate === 'number' ? raw.waDeliveredRate : DEFAULT_SIMULATION_RATES.waDeliveredRate,
    waReadRate: typeof raw.waReadRate === 'number' ? raw.waReadRate : DEFAULT_SIMULATION_RATES.waReadRate,
    readerOpenRate: typeof raw.readerOpenRate === 'number' ? raw.readerOpenRate : DEFAULT_SIMULATION_RATES.readerOpenRate,
  };
}

function planOutcome(canal: string, rates: SimulatedRates): SimulatedPlan {
  const wa = canal === 'whatsapp' || canal === 'ambos';
  const trackingToken = uuid();
  if (roll(rates.failRate)) {
    return { fail: true, delivered: false, waRead: false, readerOpen: false, trackingToken };
  }
  const delivered = wa ? roll(rates.waDeliveredRate) : true;
  return {
    fail: false,
    delivered,
    waRead: wa && delivered && roll(rates.waReadRate),
    readerOpen: delivered && roll(rates.readerOpenRate),
    trackingToken,
    wamid: wa ? `wamid.SIM.${uuid().replace(/-/g, '')}` : undefined,
  };
}

function movement(partial: Record<string, unknown>) {
  return {
    id: uuid(),
    timestamp: new Date().toISOString(),
    userAgent: 'Sistema (simulación admin)',
    clientIP: 'Simulated',
    browser: 'Simulated',
    ...partial,
  };
}

export type SimulatedSendResult =
  | { status: 'error' }
  | { status: 'sent'; delivered: boolean; waRead: boolean; readerOpen: boolean };

/**
 * Completa un envío simulado: no llama Mailgun ni Meta.
 * Marca el mail + campaign_message y, al azar, delivered / read / apertura del reader.
 * La integridad Merkle/Polygon la registra el worker (tandas de 500).
 */
export async function completeSimulatedSend(params: {
  campaign: FirebaseFirestore.DocumentData;
  campaignId: string;
  messageDocId: string;
  mailId: string;
  canal: string;
  recipientEmail: string;
  recipientPhone: string;
}): Promise<SimulatedSendResult> {
  const { campaign, campaignId, messageDocId, mailId, canal } = params;
  const db = getAdminDb();
  const plan = planOutcome(canal, ratesFromCampaign(campaign));
  const wa = canal === 'whatsapp' || canal === 'ambos';
  const email = canal === 'email' || canal === 'ambos' || !canal;
  const now = FieldValue.serverTimestamp();
  const phone = (params.recipientPhone || '').replace(/\D/g, '') || 'Unknown';

  const occurredAt = new Date();
  const movements: Record<string, unknown>[] = [
    movement({
      type: 'simulated_send',
      description: 'Envío simulado (no salió a Mailgun ni WhatsApp)',
      recipientEmail: params.recipientEmail || 'Unknown',
    }),
  ];
  const tracking: Record<string, unknown> = {
    token: plan.trackingToken,
    simulated: true,
  };
  if (plan.wamid) tracking.whatsappMessageId = plan.wamid;

  const mailUpdate: Record<string, unknown> = {
    simulated: true,
    trackingToken: plan.trackingToken,
    delivery: {
      time: occurredAt,
      info: 'simulated',
    },
  };
  if (plan.wamid) mailUpdate.whatsappMessageId = plan.wamid;

  if (plan.fail) {
    (mailUpdate.delivery as Record<string, unknown>).state = 'ERROR';
    (mailUpdate.delivery as Record<string, unknown>).error = 'Simulación: fallo de entrega';
    movements.push(movement({
      type: wa ? 'whatsapp_failed' : 'email_failed',
      description: `Simulación: error de entrega${wa ? ` al teléfono +${phone}` : ''}`,
      recipientPhone: phone,
    }));
    tracking.movements = movements;
    mailUpdate.tracking = tracking;
    await db.collection('mail').doc(mailId).update(mailUpdate);

    const errUpdate: Record<string, unknown> = {
      estado: 'error',
      errorMsg: 'Simulación: fallo de entrega',
      creditApplied: true,
    };
    if (email) errUpdate.emailEstado = 'error';
    if (wa) errUpdate.waEstado = 'error';
    await db.collection('campaign_messages').doc(messageDocId).update(errUpdate);
    return { status: 'error' };
  }

  (mailUpdate.delivery as Record<string, unknown>).state = 'DELIVERED';

  const msgUpdate: Record<string, unknown> = {
    estado: 'enviado',
    enviadoAt: now,
    creditApplied: true,
    errorMsg: null,
    simulated: true,
  };
  if (email) {
    msgUpdate.emailEstado = 'enviado';
    msgUpdate.emailEnviadoAt = now;
  }
  if (wa) {
    msgUpdate.waEstado = 'enviado';
    msgUpdate.waEnviadoAt = now;
    msgUpdate.waWmidMissing = !plan.wamid;
  }

  if (wa && plan.delivered) {
    tracking.whatsappDelivered = true;
    tracking.whatsappDeliveredAt = occurredAt;
    movements.push(movement({
      type: 'whatsapp_delivered',
      description: `Mensaje de WhatsApp entregado al teléfono +${phone} (simulado)`,
      recipientPhone: phone,
      whatsappMessageId: plan.wamid,
    }));
    msgUpdate.waEstado = 'entregado';
    msgUpdate.waEntregadoAt = now;
  }

  if (wa && plan.waRead) {
    tracking.whatsappRead = true;
    tracking.whatsappReadAt = occurredAt;
    movements.push(movement({
      type: 'whatsapp_read',
      description: `Mensaje de WhatsApp leído en el teléfono +${phone} (simulado)`,
      recipientPhone: phone,
      whatsappMessageId: plan.wamid,
    }));
    msgUpdate.waEstado = 'leido';
    msgUpdate.waLeidoAt = now;
  }

  if (plan.readerOpen) {
    tracking.opened = true;
    tracking.openedAt = occurredAt;
    tracking.openCount = 1;
    movements.push(movement({
      type: 'reader_magic_open',
      description: 'El destinatario abrió el mensaje para leerlo (simulado)',
      source: wa && !email ? 'reader_whatsapp' : 'reader_email',
      isFirstOpen: true,
      recipientEmail: params.recipientEmail || 'Unknown',
    }));
    if (email) {
      msgUpdate.emailEstado = 'leido';
      msgUpdate.emailLeidoAt = now;
      msgUpdate.emailClickAt = now;
      msgUpdate.emailClickCount = 1;
    }
    if (wa) {
      msgUpdate.waClickAt = now;
      msgUpdate.waClickCount = 1;
      if (!email && msgUpdate.waEstado !== 'leido') {
        msgUpdate.waEstado = 'leido';
        msgUpdate.waLeidoAt = now;
      }
    }
  }

  const emailRead = !email || msgUpdate.emailEstado === 'leido';
  const waReadOk = !wa || msgUpdate.waEstado === 'leido';
  if (emailRead && waReadOk) {
    msgUpdate.estado = 'leido';
    msgUpdate.leidoAt = now;
  }

  tracking.movements = movements;
  mailUpdate.tracking = tracking;
  await db.collection('mail').doc(mailId).update(mailUpdate);

  if (plan.wamid) {
    await db.collection('whatsapp_ids').doc(plan.wamid).set(
      { mailDocId: mailId, recipientPhone: phone, simulated: true, createdAt: new Date().toISOString() },
      { merge: true }
    );
  }

  await db.collection('campaign_messages').doc(messageDocId).update(msgUpdate);

  if (msgUpdate.estado === 'leido') {
    await db.collection('campaigns').doc(campaignId).update({
      'stats.leidos': FieldValue.increment(1),
    });
  }

  return {
    status: 'sent',
    delivered: Boolean(wa && plan.delivered),
    waRead: Boolean(wa && plan.waRead),
    readerOpen: plan.readerOpen,
  };
}
