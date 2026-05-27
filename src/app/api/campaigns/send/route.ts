import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, type DocumentData, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { verifyAuthToken } from '@/lib/auth-helper';
import { getAdminDb } from '@/lib/firebase-admin';
import { createMailDocumentAdmin } from '@/lib/email-server';
import {
  buildCampaignMailHtml,
  campaignBodyToHtmlFragment,
  personalizeCampaignText,
} from '@/lib/campaign-email-html';
import { normalizeEnviosDisponibles } from '@/lib/envios';
import { getOrgIfMember, maxRecipientsForPlan } from '@/lib/org-server';
import type { CampaignAttachment, RecipientEntry } from '@/lib/types';
import { z } from 'zod';

const bodySchema = z.object({
  campaignId: z.string().min(1),
  orgId: z.string().min(1),
});

function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9006').replace(/\/$/, '');
}

type MsgState = 'pendiente' | 'enviado' | 'leido' | 'error';

function attachmentsForCampaignRecipient(campaign: DocumentData, emailKey: string): CampaignAttachment[] {
  const glob = Array.isArray(campaign.adjuntos) ? (campaign.adjuntos as CampaignAttachment[]) : [];
  const por = campaign.adjuntosPorDestinatario as Record<string, unknown> | undefined;
  const key = emailKey.trim().toLowerCase();
  let extra: CampaignAttachment[] = [];
  if (por && typeof por === 'object' && por !== null && !Array.isArray(por)) {
    const row = por[key];
    if (Array.isArray(row)) {
      extra = row as CampaignAttachment[];
    }
  }
  return [...glob, ...extra];
}

function aggregateStats(docs: QueryDocumentSnapshot[], totalRecipients: number) {
  let enviados = 0;
  let leidos = 0;
  let errores = 0;
  let pendientes = 0;

  const byEmail = new Set<string>();
  docs.forEach((d) => {
    const data = d.data();
    const em = String(data.recipientEmail || '').toLowerCase();
    byEmail.add(em);
    const st = data.estado as MsgState;
    if (st === 'leido') {
      leidos += 1;
      enviados += 1;
    } else if (st === 'enviado') {
      enviados += 1;
    } else if (st === 'error') {
      errores += 1;
    } else if (st === 'pendiente') {
      pendientes += 1;
    }
  });

  const sinFila = Math.max(0, totalRecipients - byEmail.size);
  pendientes += sinFila;

  return {
    total: totalRecipients,
    enviados,
    leidos,
    errores,
    pendientes,
  };
}

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
    if (campaign.estado !== 'enviando') {
      return NextResponse.json({ error: 'La campaña debe estar en estado enviando' }, { status: 400 });
    }

    const plan = String(orgGate.data.plan || 'starter');
    const maxRecipients = maxRecipientsForPlan(plan);

    let recipientData: RecipientEntry[] = Array.isArray(campaign.recipientData)
      ? (campaign.recipientData as RecipientEntry[])
      : [];
    if (recipientData.length === 0 && Array.isArray(campaign.recipientEmails)) {
      recipientData = (campaign.recipientEmails as string[]).map((email) => ({
        email: String(email).trim().toLowerCase(),
        nombre: String(email).split('@')[0],
      }));
    }

    if (recipientData.length === 0) {
      return NextResponse.json({ error: 'Sin destinatarios' }, { status: 400 });
    }
    if (recipientData.length > maxRecipients) {
      return NextResponse.json(
        { error: `Máximo ${maxRecipients} destinatarios para el plan ${plan}` },
        { status: 400 }
      );
    }

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const creditosInicial = normalizeEnviosDisponibles(userSnap.data()?.creditos);

    const loadMsgIndex = async () => {
      const existingSnap = await db
        .collection('campaign_messages')
        .where('campaignId', '==', parsed.data.campaignId)
        .get();
      const byEmail = new Map<string, { id: string; estado: MsgState; creditApplied?: boolean; mailId?: string }>();
      existingSnap.docs.forEach((docItem) => {
        const data = docItem.data();
        const em = String(data.recipientEmail || '').toLowerCase();
        byEmail.set(em, {
          id: docItem.id,
          estado: (data.estado as MsgState) || 'pendiente',
          creditApplied: !!data.creditApplied,
          mailId: typeof data.mailId === 'string' ? data.mailId : undefined,
        });
      });
      return { snap: existingSnap, byEmail };
    };

    const { byEmail } = await loadMsgIndex();

    const trabajo = recipientData.filter((row) => {
      const email = row.email.trim().toLowerCase();
      const cur = byEmail.get(email);
      if (!cur) return true;
      if (cur.estado === 'enviado' || cur.estado === 'leido') return false;
      if (cur.estado === 'error') return true;
      if (cur.estado === 'pendiente') return true;
      return false;
    });

    const cobrosEsperados = trabajo.filter((row) => {
      const email = row.email.trim().toLowerCase();
      const cur = byEmail.get(email);
      if (!cur) return true;
      if (cur.estado === 'error') return true;
      if (cur.estado === 'pendiente' && !cur.creditApplied) return true;
      return false;
    }).length;

    if (creditosInicial < cobrosEsperados) {
      return NextResponse.json(
        {
          error: `Envíos insuficientes: necesitás ${cobrosEsperados}, tenés ${creditosInicial}`,
        },
        { status: 400 }
      );
    }

    const senderEmail = decoded!.email || '';

    let sent = 0;
    let errCount = 0;

    const refreshCampaignStats = async () => {
      const snap = await db
        .collection('campaign_messages')
        .where('campaignId', '==', parsed.data.campaignId)
        .get();
      const stats = aggregateStats(snap.docs, recipientData.length);
      await campRef.update({ stats });
      return stats;
    };

    await refreshCampaignStats();

    const processOne = async (row: RecipientEntry) => {
      const email = row.email.trim().toLowerCase();
      const adjuntos = attachmentsForCampaignRecipient(campaign, email);
      let cur = byEmail.get(email);

      const subject = personalizeCampaignText(String(campaign.asunto || 'Notificación'), {
        nombre: row.nombre,
        dni: row.dni,
        legajo: row.legajo,
      });
      const bodyHtml = campaignBodyToHtmlFragment(
        personalizeCampaignText(String(campaign.cuerpo || ''), {
          nombre: row.nombre,
          dni: row.dni,
          legajo: row.legajo,
        })
      );
      const html = buildCampaignMailHtml({
        recipientEmail: email,
        recipientName: row.nombre || email.split('@')[0],
        sender: senderEmail || 'contacto@notificas.com',
        bodyHtml,
        attachments: adjuntos,
      });

      let mailId: string;
      let messageDocId: string;

      if (cur?.estado === 'pendiente' && cur.mailId) {
        mailId = cur.mailId;
        messageDocId = cur.id;
      } else if (cur?.estado === 'error' && cur.id) {
        mailId = await createMailDocumentAdmin({
          to: email,
          subject,
          html,
          from: 'contacto@notificas.com',
          replyTo: senderEmail || undefined,
          senderName: senderEmail || undefined,
          recipientName: row.nombre || email.split('@')[0],
          recipientEmail: email,
          recipientPhone: row.telefono?.trim() || undefined,
          createdBy: uid,
          campaignId: parsed.data.campaignId,
          attachments: adjuntos.length ? adjuntos : undefined,
        });
        messageDocId = cur.id;
        await db.collection('campaign_messages').doc(messageDocId).update({
          mailId,
          estado: 'pendiente',
          errorMsg: null,
          creditApplied: false,
          txHashEnvio: null,
        });
        byEmail.set(email, { id: messageDocId, estado: 'pendiente', mailId, creditApplied: false });
        cur = byEmail.get(email);
      } else {
        mailId = await createMailDocumentAdmin({
          to: email,
          subject,
          html,
          from: 'contacto@notificas.com',
          replyTo: senderEmail || undefined,
          senderName: senderEmail || undefined,
          recipientName: row.nombre || email.split('@')[0],
          recipientEmail: email,
          recipientPhone: row.telefono?.trim() || undefined,
          createdBy: uid,
          campaignId: parsed.data.campaignId,
          attachments: adjuntos.length ? adjuntos : undefined,
        });
        const msgRef = db.collection('campaign_messages').doc();
        messageDocId = msgRef.id;
        await msgRef.set({
          campaignId: parsed.data.campaignId,
          orgId: parsed.data.orgId,
          mailId,
          recipientEmail: email,
          recipientNombre: row.nombre,
          recipientDni: row.dni || null,
          recipientLegajo: row.legajo || null,
          estado: 'pendiente',
          creditApplied: false,
          createdAt: FieldValue.serverTimestamp(),
        });
        byEmail.set(email, { id: messageDocId, estado: 'pendiente', mailId, creditApplied: false });
        cur = byEmail.get(email);
      }

      try {
        const res = await fetch(`${appBaseUrl()}/api/sendEmail`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          body: JSON.stringify({ docId: mailId }),
        });
        const resBody = (await res.json().catch(() => ({}))) as {
          error?: string;
          polygonTxHash?: string;
        };

        if (!res.ok) {
          throw new Error(resBody.error || `sendEmail ${res.status}`);
        }

        const txHash = resBody.polygonTxHash;

        await db.runTransaction(async (t) => {
          const msgRefTx = db.collection('campaign_messages').doc(messageDocId);
          const msgSnap = await t.get(msgRefTx);
          const m = msgSnap.data() || {};
          if (!m.creditApplied) {
            const uSnap = await t.get(userRef);
            const c = normalizeEnviosDisponibles(uSnap.data()?.creditos);
            if (c < 1) throw new Error('Sin envíos');
            t.update(userRef, { creditos: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() });
          }
          t.update(msgRefTx, {
            creditApplied: true,
            estado: 'enviado',
            enviadoAt: FieldValue.serverTimestamp(),
            txHashEnvio: txHash || null,
            errorMsg: null,
          });
        });

        sent += 1;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error desconocido';
        await db.collection('campaign_messages').doc(messageDocId).update({
          estado: 'error',
          errorMsg: msg,
        });
        errCount += 1;
      }
    };

    const BATCH = 10;
    for (let i = 0; i < trabajo.length; i += BATCH) {
      const chunk = trabajo.slice(i, i + BATCH);
      await Promise.all(chunk.map((r) => processOne(r)));
      await refreshCampaignStats();
    }

    const finalStats = await refreshCampaignStats();
    if (finalStats.pendientes === 0) {
      await campRef.update({
        estado: 'completada',
        completedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ success: true, sent, errors: errCount });
  } catch (e: unknown) {
    console.error('POST /api/campaigns/send', e);
    const msg = e instanceof Error ? e.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
