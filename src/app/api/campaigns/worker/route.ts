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
import { certificarEnvio } from '@/lib/certification-polygon';
import { computeContentHash } from '@/lib/certification';
import type { CampaignAttachment, RecipientEntry } from '@/lib/types';

function verifyWorkerSecret(request: NextRequest): boolean {
  const secret = process.env.CAMPAIGN_WORKER_SECRET;
  if (!secret) return false;
  return request.headers.get('X-Worker-Secret') === secret;
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

async function certifyInBackground(mailId: string): Promise<void> {
  try {
    const db = getAdminDb();
    const snap = await db.collection('mail').doc(mailId).get();
    const data = snap.data();
    if (!data) return;
    const toEmail = Array.isArray(data.to) ? data.to[0] : data.recipientEmail || data.to || '';
    const fromUserId = data.createdBy || 'campaign-worker';
    const contentHash = await computeContentHash(data.message?.contentText || '');
    const txHash = await Promise.race([
      certificarEnvio(mailId, fromUserId, toEmail, contentHash),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout certificación Polygon (>40s)')), 40_000)
      ),
    ]);
    await db.collection('mail').doc(mailId).update({
      'polygonCertifications.send': txHash,
      'polygonCertifications.contentHash': contentHash,
      'polygonCertifications.updatedAt': new Date(),
    });
  } catch (err: any) {
    console.error('⚠️ [worker] Error certificando Polygon:', err?.message);
  }
}

async function processMessage(
  db: FirebaseFirestore.Firestore,
  campaign: FirebaseFirestore.DocumentData,
  campaignId: string,
  messageDocId: string
): Promise<void> {
  const msgRef = db.collection('campaign_messages').doc(messageDocId);
  const msgSnap = await msgRef.get();
  if (!msgSnap.exists) return;

  const msg = msgSnap.data()!;

  // Idempotencia: si ya fue enviado, no hacer nada.
  if (msg.estado === 'enviado' || msg.estado === 'leido') return;

  const email = String(msg.recipientEmail || '').toLowerCase();
  const row: RecipientEntry = {
    email,
    nombre: msg.recipientNombre || email.split('@')[0],
    dni: msg.recipientDni || undefined,
    legajo: msg.recipientLegajo || undefined,
    telefono: msg.recipientTelefono || undefined,
  };

  const senderEmail = String(campaign.senderEmail || campaign.createdBy || 'contacto@notificas.com');
  const uid = String(campaign.senderUid || campaign.createdBy || '');
  const subject = personalizeCampaignText(String(campaign.asunto || 'Notificación'), row);
  const bodyHtml = campaignBodyToHtmlFragment(
    personalizeCampaignText(String(campaign.cuerpo || ''), row)
  );
  const html = buildCampaignMailHtml({
    recipientEmail: email,
    recipientName: row.nombre || email.split('@')[0],
    sender: senderEmail,
    bodyHtml,
    attachments: attachmentsFor(campaign, email),
  });
  const adjuntos = attachmentsFor(campaign, email);

  // Crear mail doc si todavía no existe (idempotente: si ya existe, reusar).
  let mailId = typeof msg.mailId === 'string' ? msg.mailId : null;
  if (!mailId) {
    mailId = await createMailDocumentAdmin({
      to: email,
      subject,
      html,
      from: 'contacto@notificas.com',
      replyTo: senderEmail.includes('@') ? senderEmail : undefined,
      senderName: senderEmail,
      recipientName: row.nombre || email.split('@')[0],
      recipientEmail: email,
      recipientPhone: row.telefono?.trim() || undefined,
      createdBy: uid,
      campaignId,
      attachments: adjuntos.length ? adjuntos : undefined,
    });
    // Persistir mailId antes de enviar para que reintentos sean idempotentes.
    await msgRef.update({ mailId, estado: 'pendiente' });
  }

  // Llamar a la Cloud Function de envío (SMTP + WhatsApp).
  const cfResult = await invokeSendEmail(mailId);

  if (!cfResult.ok) {
    await msgRef.update({
      estado: 'error',
      errorMsg: cfResult.error || 'Error en Cloud Function de envío',
    });
    return;
  }

  // Certificar en Polygon sin bloquear el worker.
  void certifyInBackground(mailId);

  // Descontar crédito y marcar enviado en una transacción atómica.
  const userRef = db.collection('users').doc(uid);
  await db.runTransaction(async (t) => {
    const msgT = await t.get(msgRef);
    const m = msgT.data()!;
    // Doble chequeo dentro de la transacción para evitar cobros duplicados.
    if (m.estado === 'enviado' || m.estado === 'leido') return;
    if (!m.creditApplied) {
      const uSnap = await t.get(userRef);
      const c = normalizeEnviosDisponibles(uSnap.data()?.creditos);
      if (c < 1) throw new Error('Sin envíos disponibles');
      t.update(userRef, {
        creditos: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    t.update(msgRef, {
      creditApplied: true,
      estado: 'enviado',
      enviadoAt: FieldValue.serverTimestamp(),
      errorMsg: null,
    });
  });
}

async function refreshStats(
  db: FirebaseFirestore.Firestore,
  campaignId: string,
  campRef: FirebaseFirestore.DocumentReference
): Promise<void> {
  const allMsgs = await db
    .collection('campaign_messages')
    .where('campaignId', '==', campaignId)
    .get();

  let enviados = 0, leidos = 0, errores = 0, pendientes = 0;
  allMsgs.docs.forEach((d) => {
    const st = d.data().estado as string;
    if (st === 'leido') { leidos++; enviados++; }
    else if (st === 'enviado') enviados++;
    else if (st === 'error') errores++;
    else pendientes++;
  });

  const campSnap = await campRef.get();
  const totalRecipients = (campSnap.data()?.recipientData as unknown[])?.length || allMsgs.size;
  const pendientesTotal = pendientes + Math.max(0, totalRecipients - allMsgs.size);

  await campRef.update({
    stats: { total: totalRecipients, enviados, leidos, errores, pendientes: pendientesTotal },
  });

  if (pendientesTotal === 0) {
    await campRef.update({
      estado: 'completada',
      completedAt: FieldValue.serverTimestamp(),
    });
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
      await processMessage(db, campaign, campaignId, messageDocId);
      sent++;
    } catch (e: any) {
      console.error(`[campaign-worker] Error procesando ${messageDocId}:`, e?.message);
      errors++;
      try {
        await db.collection('campaign_messages').doc(messageDocId).update({
          estado: 'error',
          errorMsg: e?.message || 'Error interno del worker',
        });
      } catch {
        // Si esto falla, Cloud Tasks reintentará la tarea completa.
      }
    }
  }

  await refreshStats(db, campaignId, campRef);

  return NextResponse.json({ ok: true, sent, errors });
}
