import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { createMailDocumentAdmin } from '@/lib/email-server';
import {
  DEFAULT_CONTACT_FROM_EMAIL,
  getCampaignAutoPauseNotifyEmail,
} from '@/lib/mail-defaults';
import { invokeSendEmail } from '@/lib/send-mail-via-cf';
import {
  campaignLimitUserMessage,
  classifyCampaignLimitFromUnknown,
  type CampaignLimitHit,
  type CampaignLimitSource,
} from '@/lib/campaign-limit';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sourceLabel(source: CampaignLimitSource): string {
  if (source === 'whatsapp') return 'WhatsApp / Meta';
  if (source === 'polygon') return 'Polygon';
  return 'Google Cloud';
}

async function notifyAdminCampaignAutoPause(
  campaignId: string,
  hit: CampaignLimitHit,
  reason: string
): Promise<void> {
  const to = getCampaignAutoPauseNotifyEmail();
  const db = getAdminDb();
  const snap = await db.collection('campaigns').doc(campaignId).get();
  const data = snap.data() || {};
  const nombre = String(data.nombre || campaignId);
  const orgId = String(data.orgId || '');
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://notificas.com.ar').replace(/\/$/, '');
  const adminUrl = `${base}/admin/campanas/${campaignId}`;
  const origen = sourceLabel(hit.source);

  const html = [
    `<p>Una campaña de Notificas <strong>se pausó sola</strong>.</p>`,
    `<p><strong>Campaña:</strong> ${escapeHtml(nombre)}</p>`,
    `<p><strong>Motivo:</strong> límite de ${escapeHtml(origen)}</p>`,
    `<p>${escapeHtml(reason)}</p>`,
    `<p>Los destinatarios que no se enviaron siguen pendientes. Cuando el límite se despeje, reanudá desde el panel.</p>`,
    `<p><a href="${escapeHtml(adminUrl)}">${escapeHtml(adminUrl)}</a></p>`,
    orgId ? `<p style="color:#666;font-size:12px">org: ${escapeHtml(orgId)} · id: ${escapeHtml(campaignId)}</p>` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const text = [
    'Una campaña de Notificas se pausó sola.',
    `Campaña: ${nombre}`,
    `Motivo: límite de ${origen}`,
    reason,
    `Panel: ${adminUrl}`,
  ].join('\n');

  const docId = await createMailDocumentAdmin({
    to,
    from: DEFAULT_CONTACT_FROM_EMAIL,
    replyTo: DEFAULT_CONTACT_FROM_EMAIL,
    subject: `[Campaña pausada] ${nombre} — ${origen}`,
    html,
    text,
    senderName: 'Notificas',
    recipientName: 'Admin Notificas',
    recipientEmail: to,
    createdBy: 'campaign-auto-pause',
    contactRequest: true,
  });

  const sent = await invokeSendEmail(docId);
  if (!sent.ok) {
    throw new Error(sent.error || 'No se pudo enviar el aviso de pausa');
  }
}

export function autoPauseClearFields(): Record<string, unknown> {
  return {
    autoPauseSource: FieldValue.delete(),
    autoPauseReason: FieldValue.delete(),
    autoPauseCode: FieldValue.delete(),
    autoPausedAt: FieldValue.delete(),
  };
}

export function manualPauseFields(): Record<string, unknown> {
  return {
    estado: 'pausada',
    pausedAt: FieldValue.serverTimestamp(),
    fanoutActive: false,
    ...autoPauseClearFields(),
  };
}

export async function pauseCampaignForLimit(
  campaignId: string,
  hit: CampaignLimitHit
): Promise<{ paused: boolean; already: boolean }> {
  const db = getAdminDb();
  const campRef = db.collection('campaigns').doc(campaignId);
  const reason = campaignLimitUserMessage(hit);

  return db.runTransaction(async (t) => {
    const snap = await t.get(campRef);
    if (!snap.exists) return { paused: false, already: false };
    const st = String(snap.data()?.estado || '');
    if (st === 'pausada') return { paused: false, already: true };
    if (st !== 'enviando') return { paused: false, already: false };

    t.update(campRef, {
      estado: 'pausada',
      pausedAt: FieldValue.serverTimestamp(),
      fanoutActive: false,
      autoPauseSource: hit.source,
      autoPauseCode: hit.code,
      autoPauseReason: reason,
      autoPausedAt: FieldValue.serverTimestamp(),
    });
    console.warn(`⏸ Campaña ${campaignId} auto-pausada (${hit.source} ${hit.code}): ${reason}`);
    return { paused: true, already: false };
  }).then(async (result) => {
    if (result.paused) {
      try {
        await notifyAdminCampaignAutoPause(campaignId, hit, reason);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`⚠️ Campaña ${campaignId} pausada, pero falló el mail a admin:`, msg);
      }
    }
    return result;
  });
}

export async function pauseCampaignIfLimit(
  campaignId: string,
  err: unknown,
  extra?: { httpStatus?: number; errorCode?: unknown; limitHit?: unknown; limitSource?: unknown }
): Promise<CampaignLimitHit | null> {
  const hit = classifyCampaignLimitFromUnknown(err, extra);
  if (!hit) return null;
  await pauseCampaignForLimit(campaignId, hit);
  return hit;
}
