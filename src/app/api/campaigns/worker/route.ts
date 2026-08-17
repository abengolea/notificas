import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { createMailDocumentAdmin } from '@/lib/email-server';
import {
  buildCampaignMailHtml,
  campaignBodyToHtmlFragment,
  personalizeCampaignText,
} from '@/lib/campaign-email-html';
import { normalizeEnviosDisponibles } from '@/lib/envios';
import { invokeSendEmail } from '@/lib/send-mail-via-cf';
import { computeContentHash } from '@/lib/certification';
import { closeOpenBatches, recordEventLeaf, recordSendError, recordSendLeaf, sendBatchId } from '@/lib/campaign-integrity';
import { completeSimulatedSend, isCampaignSimulated } from '@/lib/campaign-simulate';
import type { CampaignAttachment, RecipientEntry } from '@/lib/types';

class WorkerRetryError extends Error {
  readonly retry = true;
  constructor(message: string) {
    super(message);
    this.name = 'WorkerRetryError';
  }
}

function verifyWorkerSecret(request: NextRequest): boolean {
  const secret = (process.env.CAMPAIGN_WORKER_SECRET || '').trim();
  if (!secret) return false;
  return (request.headers.get('X-Worker-Secret') || '').trim() === secret;
}

function attachmentsFor(campaign: FirebaseFirestore.DocumentData, emailKey: string): CampaignAttachment[] {
  const glob = Array.isArray(campaign.adjuntos) ? (campaign.adjuntos as CampaignAttachment[]) : [];
  const por = campaign.adjuntosPorDestinatario as Record<string, unknown> | undefined;
  const key = emailKey.trim().toLowerCase();
  let extra: CampaignAttachment[] = [];
  if (por && typeof por === 'object' && !Array.isArray(por)) {
    const row = por[key];
    if (Array.isArray(row)) extra = row as CampaignAttachment[];
  }
  return [...glob, ...extra];
}

async function recordSendIntegrity(params: {
  campaignId: string;
  orgId: string;
  messageDocId: string;
  batchId: string;
  email: string;
  phone: string;
  contentHash: string;
  attachmentHashes: string[];
  mailId: string;
}): Promise<void> {
  try {
    const db = getAdminDb();
    const mailSnap = await db.collection('mail').doc(params.mailId).get();
    const mail = mailSnap.data() || {};
    const smtpMessageId = String(mail.smtpMessageId || mail.delivery?.info || mail.tracking?.messageId || '');
    const wamid = String(mail.whatsappMessageId || mail.tracking?.whatsappMessageId || '');

    await recordSendLeaf({
      campaignId: params.campaignId,
      orgId: params.orgId,
      messageId: params.messageDocId,
      batchId: params.batchId,
      email: params.email,
      phone: params.phone,
      contentHash: params.contentHash,
      attachmentHashes: params.attachmentHashes,
      smtpMessageId,
      wamid,
    });

    await db.collection('mail').doc(params.mailId).update({
      'polygonCertifications.contentHash': params.contentHash,
      'polygonCertifications.updatedAt': new Date(),
    }).catch(() => undefined);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('⚠️ [worker] Error registrando hoja Merkle:', message);
  }
}

async function processMessage(
  db: FirebaseFirestore.Firestore,
  campaign: FirebaseFirestore.DocumentData,
  campaignId: string,
  messageDocId: string
): Promise<'sent' | 'error' | 'skipped'> {
  const msgRef = db.collection('campaign_messages').doc(messageDocId);
  const msgSnap = await msgRef.get();
  if (!msgSnap.exists) return 'skipped';

  const msg = msgSnap.data()!;
  if (msg.estado === 'enviado' || msg.estado === 'leido') return 'skipped';

  const canal: string = campaign.canal || 'email';
  const emailRaw = String(msg.recipientEmail || '').toLowerCase();
  // Tratar emails sintéticos (generados por CSV parser cuando no hay email real) como "sin email".
  const isSyntheticEmail = emailRaw.endsWith('@notificas.internal') || emailRaw.endsWith('@wa.internal');
  const waOnly = canal === 'whatsapp' && (!emailRaw || isSyntheticEmail);
  // Para campañas WA-only usamos dirección interna solo para el mail doc de tracking.
  const email = (!waOnly && emailRaw) ? emailRaw : `wa-${(msg.recipientTelefono || '').replace(/\D/g, '')}@notificas.internal`;
  const row: RecipientEntry = {
    email: emailRaw,
    nombre: msg.recipientNombre || email.split('@')[0],
    dni: msg.recipientDni || undefined,
    legajo: msg.recipientLegajo || undefined,
    telefono: msg.recipientTelefono || undefined,
  };

  const senderEmail = String(campaign.senderEmail || campaign.createdBy || 'contacto@notificas.com');
  const uid = String(campaign.senderUid || campaign.createdBy || '');
  const subject = personalizeCampaignText(String(campaign.asunto || 'Notificación'), row);
  const bodyPlain = personalizeCampaignText(String(campaign.cuerpo || ''), row);
  const bodyHtml = campaignBodyToHtmlFragment(bodyPlain);
  const contentHash = await computeContentHash(bodyPlain);
  const batchId = String(msg.integritySendBatchId || sendBatchId(0));
  const orgId = String(msg.orgId || campaign.orgId || '');
  const html = buildCampaignMailHtml({
    recipientEmail: email,
    recipientName: row.nombre || email.split('@')[0],
    sender: senderEmail,
    bodyHtml,
    attachments: attachmentsFor(campaign, email),
  });
  const adjuntos = attachmentsFor(campaign, email);

  // Crear mail doc si todavía no existe (claim atómico para no duplicar Meta).
  let mailId = typeof msg.mailId === 'string' ? msg.mailId : null;
  if (!mailId) {
    const claim = await db.runTransaction(async (t) => {
      const fresh = await t.get(msgRef);
      const d = fresh.data();
      if (!d) return { kind: 'missing' as const };
      if (typeof d.mailId === 'string' && d.mailId) return { kind: 'existing' as const, id: d.mailId };
      const lockAt = typeof d.mailClaimAt === 'number' ? d.mailClaimAt : 0;
      if (d.mailClaimLock && Date.now() - lockAt < 120_000) return { kind: 'busy' as const };
      t.update(msgRef, { mailClaimLock: true, mailClaimAt: Date.now() });
      return { kind: 'claimed' as const };
    });
    if (claim.kind === 'missing') return 'skipped';
    if (claim.kind === 'busy') throw new WorkerRetryError('mailId en creación');
    if (claim.kind === 'existing') {
      mailId = claim.id;
    } else {
      try {
        mailId = await createMailDocumentAdmin({
          to: email,
          subject,
          html,
          text: bodyPlain,
          from: 'contacto@notificas.com',
          replyTo: senderEmail.includes('@') ? senderEmail : undefined,
          senderName: senderEmail,
          recipientName: row.nombre || email.split('@')[0],
          recipientEmail: email,
          recipientPhone: row.telefono?.trim() || undefined,
          recipientDni: row.dni || undefined,
          recipientLegajo: row.legajo || undefined,
          createdBy: uid,
          campaignId,
          campaignMessageId: messageDocId,
          attachments: adjuntos.length ? adjuntos : undefined,
          ...(campaign.waTemplateName ? {
            waTemplateName: campaign.waTemplateName,
            waTemplateLang: campaign.waTemplateLang || 'es_AR',
            waTemplateVariables: campaign.waTemplateVariables || null,
          } : {}),
          ...(waOnly ? { waOnly: true } : {}),
          ...(isCampaignSimulated(campaign) ? { simulated: true } : {}),
        });
        await msgRef.update({
          mailId,
          mailClaimLock: FieldValue.delete(),
          mailClaimAt: FieldValue.delete(),
          estado: 'pendiente',
        });
      } catch (e) {
        await msgRef.update({
          mailClaimLock: FieldValue.delete(),
          mailClaimAt: FieldValue.delete(),
        }).catch(() => undefined);
        throw e;
      }
    }
  }

  if (!mailId) throw new WorkerRetryError('mailId ausente');

  if (isCampaignSimulated(campaign)) {
    return completeSimulatedSend({
      campaign,
      campaignId,
      messageDocId,
      mailId,
      canal,
      recipientEmail: email,
      recipientPhone: String(row.telefono || ''),
    });
  }

  // Invocar Cloud Function (maneja internamente email y/o WA según lo que tenga el mail doc).
  const cfResult = await invokeSendEmail(mailId);

  if (!cfResult.ok) {
    const errUpdate: Record<string, unknown> = {
      estado: 'error',
      errorMsg: cfResult.error || 'Error en Cloud Function de envío',
    };
    if (canal === 'email' || canal === 'ambos') errUpdate.emailEstado = 'error';
    if (canal === 'whatsapp' || canal === 'ambos') errUpdate.waEstado = 'error';
    await msgRef.update(errUpdate);
    await recordSendError({ campaignId, messageId: messageDocId, batchId });
    return 'error';
  }

  // Escribir whatsapp_ids aquí (en el worker de Next.js, garantizando await antes de responder HTTP).
  // El CF escribe el WAMID en mail.whatsappMessageId antes de responder; lo indexamos en whatsapp_ids
  // para que el webhook de Meta resuelva wamid → mailDocId → campaign_message.
  let wamid: string | undefined;
  if (canal === 'whatsapp' || canal === 'ambos') {
    const mailSnap = await db.collection('mail').doc(mailId).get();
    const mailData = mailSnap.data();
    wamid = (mailData?.whatsappMessageId || mailData?.tracking?.whatsappMessageId) as string | undefined;
    if (wamid) {
      await db.collection('whatsapp_ids').doc(wamid).set({ mailDocId: mailId }, { merge: true });
    } else {
      console.warn(
        `[campaign-worker] WAMID ausente tras CF HTTP 200. mailId=${mailId} message=${messageDocId}`
      );
    }
  }

  void recordSendIntegrity({
    campaignId,
    orgId,
    messageDocId,
    batchId,
    email: emailRaw,
    phone: String(row.telefono || ''),
    contentHash,
    attachmentHashes: adjuntos.map((a) => a.hash).filter(Boolean),
    mailId,
  });

  // Descontar crédito y marcar enviado.
  // No degradar waEstado si un webhook (o pending) ya lo subió a entregado/leido.
  const userRef = db.collection('users').doc(uid);
  await db.runTransaction(async (t) => {
    const msgT = await t.get(msgRef);
    const m = msgT.data()!;
    if (m.estado === 'leido') return;
    if (m.estado === 'enviado' && m.creditApplied) return;
    if (!m.creditApplied) {
      const prepaid = typeof campaign.creditsPrepaidAmount === 'number' && campaign.creditsPrepaidAmount > 0;
      if (!prepaid && campaign.managedByAdmin !== true) {
        const uSnap = await t.get(userRef);
        const c = normalizeEnviosDisponibles(uSnap.data()?.creditos);
        if (c < 1) throw new Error('Sin envíos disponibles');
        t.update(userRef, { creditos: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() });
      }
    }
    const now = FieldValue.serverTimestamp();
    const channelUpdate: Record<string, unknown> = {
      creditApplied: true,
      errorMsg: null,
    };
    if (m.estado !== 'enviado' && m.estado !== 'leido') {
      channelUpdate.estado = 'enviado';
      channelUpdate.enviadoAt = now;
    }
    if (canal === 'email' || canal === 'ambos') {
      if (m.emailEstado !== 'leido') {
        channelUpdate.emailEstado = 'enviado';
        channelUpdate.emailEnviadoAt = now;
      }
    }
    if (canal === 'whatsapp' || canal === 'ambos') {
      const wa = String(m.waEstado || '');
      if (wa !== 'entregado' && wa !== 'leido') {
        channelUpdate.waEstado = 'enviado';
        channelUpdate.waEnviadoAt = now;
      }
      channelUpdate.waWmidMissing = !wamid;
    }
    t.update(msgRef, channelUpdate);
  });

  // Procesar eventos WA que llegaron antes de whatsapp_ids (después de marcar enviado,
  // para no pisar entregado/leido con el transaction de arriba).
  if (wamid) {
    const pendingSnap = await db.doc(`pending_wa_webhooks/${wamid}`).get();
    if (pendingSnap.exists) {
      const pending = pendingSnap.data()!;
      const st = pending.statusType as string;
      const now = FieldValue.serverTimestamp();
      const update: Record<string, unknown> = {};
      if (st === 'delivered') {
        update.waEstado = 'entregado';
        update.waEntregadoAt = now;
      } else if (st === 'read') {
        update.waEstado = 'leido';
        update.waLeidoAt = now;
        update.estado = 'leido';
        update.leidoAt = now;
        await db.collection('campaigns').doc(campaignId).update({ 'stats.leidos': FieldValue.increment(1) });
      } else if (st === 'failed') {
        update.waEstado = 'error';
      }
      if (Object.keys(update).length) await msgRef.update(update);
      if (st === 'delivered' || st === 'read') {
        void recordEventLeaf({
          campaignId,
          orgId,
          messageId: messageDocId,
          eventType: st === 'delivered' ? 'wa_delivered' : 'wa_read',
        }).catch((e) => console.warn('⚠️ Hoja de hecho WA pendiente:', e?.message));
      }
      await db.doc(`pending_wa_webhooks/${wamid}`).delete();
      console.log(`✅ Evento WA pendiente '${st}' procesado para wamid=${wamid}`);
    }
  }
  return 'sent';
}

async function applyStatsDelta(
  campRef: FirebaseFirestore.DocumentReference,
  delta: { enviados: number; errores: number }
): Promise<void> {
  const processed = delta.enviados + delta.errores;
  if (processed <= 0) return;

  const updates: Record<string, unknown> = {};
  if (delta.enviados) updates['stats.enviados'] = FieldValue.increment(delta.enviados);
  if (delta.errores) updates['stats.errores'] = FieldValue.increment(delta.errores);
  updates['stats.pendientes'] = FieldValue.increment(-processed);
  await campRef.update(updates);

  const campSnap = await campRef.get();
  const campData = campSnap.data() ?? {};
  const st = (campData.stats || {}) as { pendientes?: number; enviados?: number; total?: number };
  const pendientes = typeof st.pendientes === 'number' ? st.pendientes : 0;
  if (pendientes > 0) return;

  await campRef.update({
    estado: 'completada',
    completedAt: FieldValue.serverTimestamp(),
    'stats.pendientes': 0,
  });

  const prepaid = typeof campData.creditsPrepaidAmount === 'number' ? campData.creditsPrepaidAmount : 0;
  const alreadyRefunded = typeof campData.creditsRefunded === 'number' ? campData.creditsRefunded : 0;
  const success = typeof st.enviados === 'number' ? st.enviados : 0;
  const refund = Math.max(0, prepaid - success - alreadyRefunded);
  const uid = String(campData.senderUid || campData.createdBy || '');
  if (refund > 0 && uid && campData.managedByAdmin !== true) {
    await getAdminDb().collection('users').doc(uid).update({
      creditos: FieldValue.increment(refund),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await campRef.update({ creditsRefunded: alreadyRefunded + refund });
  }

  if (!isCampaignSimulated(campData)) {
    void closeOpenBatches(campRef.id, true).catch((e) =>
      console.warn('⚠️ [worker] No se pudieron cerrar tandas al completar:', e?.message)
    );
  }
}

export async function POST(request: NextRequest) {
  if (!verifyWorkerSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { campaignId: string; messageDocIds: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { campaignId, messageDocIds } = body;
  if (!campaignId || !Array.isArray(messageDocIds) || messageDocIds.length === 0) {
    return NextResponse.json({ error: 'Parámetros requeridos: campaignId, messageDocIds' }, { status: 400 });
  }

  const db = getAdminDb();
  const campRef = db.collection('campaigns').doc(campaignId);
  const campSnap = await campRef.get();
  if (!campSnap.exists) {
    return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
  }

  const campaign = campSnap.data()!;
  if (campaign.estado === 'cancelada') {
    return NextResponse.json({ skipped: true, reason: 'cancelada' });
  }

  let sent = 0, errors = 0;

  for (const messageDocId of messageDocIds) {
    try {
      const result = await processMessage(db, campaign, campaignId, messageDocId);
      if (result === 'sent') sent++;
      else if (result === 'error') errors++;
    } catch (e: unknown) {
      if (e instanceof WorkerRetryError) throw e;
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[campaign-worker] Error procesando ${messageDocId}:`, message);
      errors++;
      try {
        const failed = await db.collection('campaign_messages').doc(messageDocId).get();
        const failedData = failed.data();
        await db.collection('campaign_messages').doc(messageDocId).update({
          estado: 'error',
          errorMsg: message || 'Error interno del worker',
        });
        if (failedData?.integritySendBatchId) {
          await recordSendError({
            campaignId,
            messageId: messageDocId,
            batchId: String(failedData.integritySendBatchId),
          });
        }
      } catch {
        // Si esto falla, Cloud Tasks reintentará la tarea completa.
      }
    }
  }

  await applyStatsDelta(campRef, { enviados: sent, errores: errors });

  return NextResponse.json({ ok: true, sent, errors });
}
