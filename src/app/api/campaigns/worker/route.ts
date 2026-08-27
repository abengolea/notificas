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
import { recordEventLeaf, recordSendError, recordSendLeaf, sendBatchId } from '@/lib/campaign-integrity';
import { sealEvidenceSnapshot } from '@/lib/evidence-snapshot';
import { hashWhatsAppBody, sealedWhatsAppRenderedBody } from '@/lib/whatsapp-evidence';
import { sourceRowCanonical } from '@/lib/campaign-source-canonical';
import { sha256Hex } from '@/lib/merkle';
import { certifyWhatsAppPayloadIfNeeded } from '@/lib/certification-polygon';
import { recipientWhatsAppVars, sealCampaignWhatsAppTemplate } from '@/lib/wa-template-seal';
import { usesNotificasDefaultTemplate } from '@/lib/wa-template-fields';
import { maybeCompleteCampaign } from '@/lib/campaign-complete';
import { campaignIsStopped } from '@/lib/campaign-daily';
import { pauseCampaignIfLimit } from '@/lib/campaign-auto-pause';
import { waitCampaignSendGap } from '@/lib/campaign-send-pace';
import { completeSimulatedSend, isCampaignSimulated } from '@/lib/campaign-simulate';
import { presentRecipientValue, recipientValueText } from '@/lib/parse-campaign-csv';
import type { CampaignAttachment, RecipientEntry } from '@/lib/types';
import { registerPublicApiNotification, syncPublicApiNotificationFromMail } from '@/lib/public-api/status-sync';

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
    const waBodyHash = await hashWhatsAppBody(mail.waRequestSnapshot);
    const renderedWa = sealedWhatsAppRenderedBody(mail.waRequestSnapshot);
    const contentHash =
      mail.waOnly && renderedWa ? await computeContentHash(renderedWa) : params.contentHash;
    const campSnap = await db.collection('campaigns').doc(params.campaignId).get();
    const camp = campSnap.data() || {};
    let templateSealHash = String(camp.waTemplateSeal?.hash || '');
    if (!templateSealHash && camp.waTemplateName) {
      const sealed = await sealCampaignWhatsAppTemplate(params.campaignId);
      templateSealHash = sealed?.hash || '';
    }
    const waVars = recipientWhatsAppVars(
      Array.isArray(camp.waTemplateVariables) ? camp.waTemplateVariables : undefined,
      {
        nombre: String(mail.recipientName || ''),
        dni: String(mail.recipientDni || ''),
        legajo: String(mail.recipientLegajo || ''),
        dias: String(mail.recipientDias || ''),
        fecha: String(mail.recipientFecha || ''),
        monto: String(mail.recipientMonto || ''),
        cuotas: presentRecipientValue(mail.recipientCuotas) ? recipientValueText(mail.recipientCuotas) : '',
        email: params.email,
        telefono: params.phone,
      }
    );
    const msgSnap2 = await db.collection('campaign_messages').doc(params.messageDocId).get();
    const msgNow = msgSnap2.data() || {};
    const dni = String(mail.recipientDni || msgNow.recipientDni || '');
    const nombre = String(mail.recipientName || msgNow.recipientNombre || '');
    const monto = String(mail.recipientMonto || msgNow.recipientMonto || '');
    const cuotas = presentRecipientValue(mail.recipientCuotas)
      ? recipientValueText(mail.recipientCuotas)
      : presentRecipientValue(msgNow.recipientCuotas)
        ? recipientValueText(msgNow.recipientCuotas)
        : '';
    const rowHash =
      String(msgNow.sourceRowHash || '') ||
      (await sha256Hex(
        sourceRowCanonical({
          email: params.email,
          nombre,
          dni,
          telefono: params.phone,
          monto,
          cuotas,
        })
      ));

    await recordSendLeaf({
      campaignId: params.campaignId,
      orgId: params.orgId,
      messageId: params.messageDocId,
      batchId: params.batchId,
      email: params.email,
      phone: params.phone,
      contentHash,
      attachmentHashes: params.attachmentHashes,
      smtpMessageId,
      wamid,
      waBodyHash,
      templateSealHash,
      waVars,
      dni,
      nombre,
      monto,
      cuotas,
      rowHash,
    });

    await db.collection('mail').doc(params.mailId).update({
      'polygonCertifications.contentHash': contentHash,
      ...(waBodyHash ? { 'polygonCertifications.waBodyHash': waBodyHash } : {}),
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
): Promise<'sent' | 'error' | 'skipped' | 'limit_paused'> {
  const msgRef = db.collection('campaign_messages').doc(messageDocId);
  const msgSnap = await msgRef.get();
  if (!msgSnap.exists) return 'skipped';

  const msg = msgSnap.data()!;
  // Un error ya contabilizado no se vuelve a tirar el dado (Cloud Tasks reintenta el lote).
  // El reintento manual resetea a pendiente en fanout/resend.
  if (msg.estado === 'enviado' || msg.estado === 'leido' || msg.estado === 'error') return 'skipped';

  const campNow = await db.collection('campaigns').doc(campaignId).get();
  if (campaignIsStopped(campNow.data() || {})) return 'skipped';

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
    dias: msg.recipientDias || undefined,
    fecha: msg.recipientFecha || undefined,
    monto: msg.recipientMonto || undefined,
    cuotas: presentRecipientValue(msg.recipientCuotas) ? recipientValueText(msg.recipientCuotas) : undefined,
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
          recipientDias: row.dias || undefined,
          recipientFecha: row.fecha || undefined,
          recipientMonto: row.monto || undefined,
          recipientCuotas: presentRecipientValue(row.cuotas) ? recipientValueText(row.cuotas) : undefined,
          createdBy: uid,
          campaignId,
          campaignMessageId: messageDocId,
          attachments: adjuntos.length ? adjuntos : undefined,
          ...(usesNotificasDefaultTemplate(campaign.waTemplateName) ? {} : campaign.waTemplateName ? {
            waTemplateName: campaign.waTemplateName,
            waTemplateLang: campaign.waTemplateLang || 'es_AR',
            waTemplateVariables: campaign.waTemplateVariables || null,
            ...(campaign.waUrlButton === true ? { waUrlButton: true } : {}),
          } : {}),
          ...(waOnly ? { waOnly: true } : {}),
          ...(isCampaignSimulated(campaign) ? { simulated: true } : {}),
          ...(typeof campaign.publicApiBatchId === 'string' && campaign.publicApiBatchId
            ? {
                orgId,
                publicApiId: typeof msg.publicApiId === 'string' ? msg.publicApiId : undefined,
                apiSource: 'public_api',
                apiBatchId: String(campaign.publicApiBatchId),
                testMode: campaign.publicApiTestMode === true,
                apiKeyId: typeof campaign.apiKeyId === 'string' ? campaign.apiKeyId : undefined,
                apiReference: typeof campaign.apiReference === 'string' ? campaign.apiReference : undefined,
              }
            : {}),
        });
        await msgRef.update({
          mailId,
          mailClaimLock: FieldValue.delete(),
          mailClaimAt: FieldValue.delete(),
          estado: 'pendiente',
        });
        if (typeof campaign.publicApiBatchId === 'string' && campaign.publicApiBatchId && mailId) {
          const ntfId = typeof msg.publicApiId === 'string' ? msg.publicApiId : undefined;
          if (ntfId) {
            void registerPublicApiNotification({
              id: ntfId,
              orgId,
              mailId,
              channel: canal === 'email' ? 'email' : 'whatsapp',
              batchId: String(campaign.publicApiBatchId),
              testMode: campaign.publicApiTestMode === true,
              apiKeyId: typeof campaign.apiKeyId === 'string' ? campaign.apiKeyId : undefined,
              reference: typeof campaign.apiReference === 'string' ? campaign.apiReference : null,
              recipientPhone: row.telefono,
              recipientEmail: emailRaw,
              recipientName: row.nombre,
            }).catch(() => undefined);
          }
        }
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

  // Reintento: el mail doc pudo crearse con un template viejo. Siempre copiar el de la campaña.
  if (canal === 'whatsapp' || canal === 'ambos') {
    const tplName = String(campaign.waTemplateName || '').trim();
    const useDefault = usesNotificasDefaultTemplate(tplName);
    const waSync: Record<string, unknown> = {
      waTemplateLang: String(campaign.waTemplateLang || 'es_AR'),
      waUrlButton: useDefault ? false : campaign.waUrlButton === true,
      recipientDni: row.dni || FieldValue.delete(),
      recipientLegajo: row.legajo || FieldValue.delete(),
      recipientDias: row.dias || FieldValue.delete(),
      recipientFecha: row.fecha || FieldValue.delete(),
      recipientMonto: row.monto || FieldValue.delete(),
      recipientCuotas: presentRecipientValue(row.cuotas) ? recipientValueText(row.cuotas) : FieldValue.delete(),
      recipientPhone: row.telefono || FieldValue.delete(),
    };
    if (useDefault) {
      waSync.waTemplateName = FieldValue.delete();
      waSync.waTemplateVariables = FieldValue.delete();
    } else {
      waSync.waTemplateName = tplName;
      waSync.waTemplateVariables = Array.isArray(campaign.waTemplateVariables)
        ? campaign.waTemplateVariables
        : FieldValue.delete();
    }
    await db.collection('mail').doc(mailId).update(waSync);
  }

  if (isCampaignSimulated(campaign)) {
    const sim = await completeSimulatedSend({
      campaign,
      campaignId,
      messageDocId,
      mailId,
      canal,
      recipientEmail: email,
      recipientPhone: String(row.telefono || ''),
    });
    if (sim.status === 'error') {
      await recordSendError({
        campaignId,
        messageId: messageDocId,
        batchId,
        errorCode: 'sim_error',
        email: emailRaw,
        phone: String(row.telefono || ''),
        contentHash,
      });
      return 'error';
    }
    await recordSendIntegrity({
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
    const waCanal = canal === 'whatsapp' || canal === 'ambos';
    if (waCanal && sim.delivered) {
      await recordEventLeaf({
        campaignId,
        orgId,
        messageId: messageDocId,
        eventType: 'wa_delivered',
      }).catch((e) => console.warn('⚠️ Hoja Merkle wa_delivered (sim):', e?.message));
    }
    if (waCanal && sim.waRead) {
      await recordEventLeaf({
        campaignId,
        orgId,
        messageId: messageDocId,
        eventType: 'wa_read',
      }).catch((e) => console.warn('⚠️ Hoja Merkle wa_read (sim):', e?.message));
    }
    if (sim.readerOpen) {
      await recordEventLeaf({
        campaignId,
        orgId,
        messageId: messageDocId,
        eventType: 'email_read',
      }).catch((e) => console.warn('⚠️ Hoja Merkle email_read (sim):', e?.message));
    }
    return 'sent';
  }

  // Un envío a Meta cada 2 s (y la cola solo despacha 1 worker a la vez).
  await waitCampaignSendGap();
  const cfResult = await invokeSendEmail(mailId);

  if (cfResult.skipped) return 'skipped';

  if (!cfResult.ok) {
    const limit = await pauseCampaignIfLimit(campaignId, cfResult.error, {
      httpStatus: cfResult.httpStatus,
      errorCode: cfResult.errorCode,
      limitHit: cfResult.limitHit,
      limitSource: cfResult.limitSource,
    });
    if (limit) return 'limit_paused';

    const errUpdate: Record<string, unknown> = {
      estado: 'error',
      errorMsg: cfResult.error || 'Error en Cloud Function de envío',
    };
    if (canal === 'email' || canal === 'ambos') errUpdate.emailEstado = 'error';
    if (canal === 'whatsapp' || canal === 'ambos') errUpdate.waEstado = 'error';
    await msgRef.update(errUpdate);
    await recordSendError({
      campaignId,
      messageId: messageDocId,
      batchId,
      errorCode: cfResult.error?.slice(0, 64) || 'cf_error',
      email: emailRaw,
      phone: String(row.telefono || ''),
      contentHash,
    });
    void syncPublicApiNotificationFromMail(mailId, 'failed').catch(() => undefined);
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

  await recordSendIntegrity({
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
  await sealEvidenceSnapshot(mailId).catch((e) =>
    console.warn('⚠️ [worker] No se pudo sellar snapshot:', e instanceof Error ? e.message : e)
  );
  await certifyWhatsAppPayloadIfNeeded(mailId).catch((e) =>
    console.warn('⚠️ [worker] No se pudo persistir hash WA:', e instanceof Error ? e.message : e)
  );

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
          occurredAt: typeof pending.timestamp === 'string' ? pending.timestamp : undefined,
          meta:
            typeof pending.payloadHash === 'string' && pending.payloadHash
              ? {
                  wamid,
                  status: st,
                  metaTimestamp: typeof pending.timestamp === 'string' ? pending.timestamp : undefined,
                  recipientId: typeof pending.recipientPhone === 'string' ? pending.recipientPhone : undefined,
                  rawPayloadHash: pending.payloadHash,
                }
              : undefined,
        }).catch((e) => console.warn('⚠️ Hoja de hecho WA pendiente:', e?.message));
      }
      await db.doc(`pending_wa_webhooks/${wamid}`).delete();
      console.log(`✅ Evento WA pendiente '${st}' procesado para wamid=${wamid}`);
    }
  }
  void syncPublicApiNotificationFromMail(mailId, 'sent').catch(() => undefined);
  return 'sent';
}

async function applyWorkerStats(
  campRef: FirebaseFirestore.DocumentReference,
  sent: number,
  errors: number
): Promise<void> {
  const done = sent + errors;
  if (done <= 0) return;
  const updates: Record<string, unknown> = {
    'stats.pendientes': FieldValue.increment(-done),
  };
  if (sent > 0) updates['stats.enviados'] = FieldValue.increment(sent);
  if (errors > 0) updates['stats.errores'] = FieldValue.increment(errors);
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await campRef.update(updates);
      return;
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 100 * 2 ** attempt));
    }
  }
  throw last instanceof Error ? last : new Error('No se pudieron actualizar stats');
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
  if (campaign.estado === 'cancelada' || campaign.estado === 'pausada') {
    return NextResponse.json({ skipped: true, reason: String(campaign.estado) });
  }

  let sent = 0, errors = 0, skipped = 0;
  let paused: { source: string; code: string } | null = null;

  const flushStatsAndRethrow = async (err: unknown): Promise<never> => {
    await applyWorkerStats(campRef, sent, errors).catch(() => undefined);
    throw err;
  };

  for (const messageDocId of messageDocIds) {
    try {
      const result = await processMessage(db, campaign, campaignId, messageDocId);
      if (result === 'sent') sent++;
      else if (result === 'error') errors++;
      else if (result === 'limit_paused') {
        skipped++;
        paused = { source: 'limit', code: 'paused' };
        break;
      } else skipped++;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      const limit = await pauseCampaignIfLimit(campaignId, e);
      if (limit) {
        skipped++;
        paused = { source: limit.source, code: limit.code };
        break;
      }
      if (e instanceof WorkerRetryError) await flushStatsAndRethrow(e);
      console.error(`[campaign-worker] Error procesando ${messageDocId}:`, message);
      try {
        const failed = await db.collection('campaign_messages').doc(messageDocId).get();
        const failedData = failed.data();
        const st = String(failedData?.estado || '');
        if (st === 'enviado' || st === 'leido') {
          sent++;
          continue;
        }
        if (st === 'error') {
          skipped++;
          continue;
        }
        await db.collection('campaign_messages').doc(messageDocId).update({
          estado: 'error',
          errorMsg: message || 'Error interno del worker',
        });
        if (failedData?.integritySendBatchId) {
          await recordSendError({
            campaignId,
            messageId: messageDocId,
            batchId: String(failedData.integritySendBatchId),
            errorCode: (message || 'worker_error').slice(0, 64),
            email: String(failedData.recipientEmail || ''),
            phone: String(failedData.recipientTelefono || ''),
            contentHash: String(failedData.integrity?.send?.contentHash || failedData.contentHash || ''),
          });
        }
        errors++;
      } catch (inner: unknown) {
        const innerLimit = await pauseCampaignIfLimit(campaignId, inner);
        if (innerLimit) {
          paused = { source: innerLimit.source, code: innerLimit.code };
          break;
        }
        // Si esto falla, Cloud Tasks reintentará la tarea completa.
      }
    }
  }

  try {
    await applyWorkerStats(campRef, sent, errors);
  } catch (e: unknown) {
    const limit = await pauseCampaignIfLimit(campaignId, e);
    if (!limit) throw e;
    paused = paused || { source: limit.source, code: limit.code };
  }
  await maybeCompleteCampaign(campRef);

  return NextResponse.json({
    ok: true,
    sent,
    errors,
    skipped,
    ...(paused ? { paused: true, pauseSource: paused.source, pauseCode: paused.code } : {}),
  });
}
