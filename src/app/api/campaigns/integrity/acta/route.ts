import { NextRequest, NextResponse } from 'next/server';
import { requireCampaignOrgAccess } from '@/lib/campaign-access';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyCampaignMessage, verifyIntegrityBatch, parseSendLeafPayload } from '@/lib/campaign-integrity';
import { buildActaDestinatarioPdf, buildActaTandaPdf, type ActaLeafRow } from '@/lib/campaign-integrity-pdf';
import { findEvidenceSnapshot } from '@/lib/evidence-snapshot';
import {
  listProviderEventsForCampaignMessage,
  listProviderEventsForMail,
} from '@/lib/provider-events';
import { recordIssuedDocument, sha256Hex } from '@/lib/issued-documents';
import { campaignVerifyRef } from '@/lib/verify-hints';
import { formatEvidenceTimestamp } from '@/lib/pdf-evidence-format';
import { describeWhatsAppSentContent } from '@/lib/whatsapp-evidence';
import { isRealSmtpMessageId } from '@/lib/email-delivery-label';

function formatSealedAt(v: unknown): string | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleString('es-AR');
  }
  if (typeof v === 'object' && v && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
    try {
      return (v as { toDate: () => Date }).toDate().toLocaleString('es-AR');
    } catch {
      return undefined;
    }
  }
  if (typeof v === 'object' && v && ('_seconds' in v || 'seconds' in v)) {
    const secs = Number((v as { _seconds?: number; seconds?: number })._seconds ?? (v as { seconds?: number }).seconds);
    if (Number.isFinite(secs)) return new Date(secs * 1000).toLocaleString('es-AR');
  }
  return undefined;
}

function toIso(v: unknown): string | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') {
    if (/^\d+$/.test(v.trim())) {
      const n = Number(v);
      const ms = n < 1e12 ? n * 1000 : n;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
    }
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toISOString();
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    const ms = v < 1e12 ? v * 1000 : v;
    return new Date(ms).toISOString();
  }
  if (typeof v === 'object' && v && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
    try {
      return (v as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  if (typeof v === 'object' && v && ('_seconds' in v || 'seconds' in v)) {
    const secs = Number((v as { _seconds?: number; seconds?: number })._seconds ?? (v as { seconds?: number }).seconds);
    if (Number.isFinite(secs)) return new Date(secs * 1000).toISOString();
  }
  return undefined;
}

function providerEventTime(ev: Record<string, unknown>): string | undefined {
  return toIso(ev.providerTimestamp) || toIso(ev.receivedAt);
}

function firstEventTime(
  events: Array<Record<string, unknown>>,
  pred: (ev: Record<string, unknown>) => boolean
): string | undefined {
  for (const ev of events) {
    if (!pred(ev)) continue;
    const t = providerEventTime(ev);
    if (t) return t;
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  const campaignId = request.nextUrl.searchParams.get('campaignId') || '';
  const orgId = request.nextUrl.searchParams.get('orgId') || '';
  const batchId = request.nextUrl.searchParams.get('batchId') || '';
  const messageId = request.nextUrl.searchParams.get('messageId') || '';
  if (!campaignId || !orgId || (!batchId && !messageId)) {
    return NextResponse.json({ error: 'campaignId, orgId y batchId o messageId requeridos' }, { status: 400 });
  }

  const denied = await requireCampaignOrgAccess(request, orgId, campaignId);
  if (denied) return denied;

  const db = getAdminDb();
  const orgSnap = await db.collection('organizations').doc(orgId).get();
  const org = orgSnap.data() || {};
  const campSnap = await db.collection('campaigns').doc(campaignId).get();
  const campaign = campSnap.data() || {};

  if (messageId) {
    try {
    const msgSnap = await db.collection('campaign_messages').doc(messageId).get();
    if (!msgSnap.exists || String(msgSnap.data()?.campaignId) !== campaignId) {
      return NextResponse.json({ error: 'Destinatario no encontrado' }, { status: 404 });
    }
    const msg = msgSnap.data()!;
    const mailId = typeof msg.mailId === 'string' ? msg.mailId : '';
    const snapshot = await findEvidenceSnapshot({ mailId, campaignMessageId: messageId });
    const verified = await verifyCampaignMessage(campaignId, messageId);
    const evByType = Object.fromEntries(verified.events.map((ev) => [ev.type, ev]));

    const providerFromMail = mailId ? await listProviderEventsForMail(mailId) : [];
    const providerFromMsg = await listProviderEventsForCampaignMessage(messageId);
    const seen = new Set<string>();
    const providerEvents: Array<Record<string, unknown>> = [];
    for (const ev of [...providerFromMail, ...providerFromMsg]) {
      if (seen.has(ev.id)) continue;
      seen.add(ev.id);
      providerEvents.push(ev as Record<string, unknown>);
    }

    const smtpId = isRealSmtpMessageId(snapshot?.smtp?.messageId) ? String(snapshot!.smtp.messageId) : '';
    const smtpAcceptedAt =
      firstEventTime(
        providerEvents,
        (e) =>
          e.provider === 'smtp' &&
          e.eventType === 'accepted' &&
          isRealSmtpMessageId(e.providerMessageId)
      ) || (smtpId ? toIso(snapshot?.sealedAt) : undefined);
    const emailOpenedAt =
      firstEventTime(providerEvents, (e) => e.eventType === 'email_read' || e.eventType === 'opened') ||
      toIso(evByType.email_read?.occurredAt);
    const waDeliveredAt =
      firstEventTime(providerEvents, (e) => e.provider === 'meta' && e.eventType === 'delivered') ||
      toIso(evByType.wa_delivered?.occurredAt);
    const waReadAt =
      firstEventTime(providerEvents, (e) => e.provider === 'meta' && e.eventType === 'read') ||
      toIso(evByType.wa_read?.occurredAt);
    const waSentAt =
      firstEventTime(providerEvents, (e) => e.provider === 'meta' && e.eventType === 'sent') ||
      (snapshot?.whatsapp.wamid ? toIso(snapshot.sealedAt) : undefined);

    const webhookPreserved = (type: string) =>
      providerEvents.some(
        (e) =>
          e.provider === 'meta' &&
          e.eventType === type &&
          e.signatureValid === true &&
          Boolean(e.httpBody || e.payloadHash)
      );

    const pdf = await buildActaDestinatarioPdf({
      orgNombre: String(snapshot?.sender.orgNombre || org.nombre || ''),
      orgCuit: snapshot?.sender.orgCuit || (typeof org.cuit === 'string' ? org.cuit : undefined),
      campaignId,
      campaignNombre: String(campaign.nombre || ''),
      campaignAsunto: snapshot?.subject || (typeof campaign.asunto === 'string' ? campaign.asunto : undefined),
      generatedAt: formatEvidenceTimestamp(new Date()),
      messageId,
      canal:
        (typeof campaign.canal === 'string' && campaign.canal) ||
        snapshot?.channel ||
        undefined,
      recipientNombre: snapshot?.recipient.nombre || '',
      recipientEmail: snapshot?.recipient.email || '',
      recipientTelefono: snapshot?.recipient.phone || '',
      recipientDni: snapshot?.recipient.dni || undefined,
      recipientLegajo: snapshot?.recipient.legajo || undefined,
      asuntoPersonalizado: snapshot?.subject || '',
      cuerpoPersonalizado: snapshot?.contentText || '',
      whatsappSent: describeWhatsAppSentContent(
        snapshot?.whatsapp.requestSnapshot,
        snapshot?.whatsapp.templateVariables
      ),
      attachments: (snapshot?.attachments || []).map((a) => ({ nombre: a.fileName, hash: a.hash })),
      evidenceSealed: Boolean(snapshot),
      smtpMessageId: smtpId || undefined,
      wamid: snapshot?.whatsapp.wamid || verified.send.wamid || undefined,
      phoneNumberId: snapshot?.whatsapp.phoneNumberId || undefined,
      wabaId: snapshot?.whatsapp.wabaId || undefined,
      chronology: {
        emailEnviadoAt: smtpAcceptedAt,
        emailLeidoAt: emailOpenedAt,
        waEnviadoAt: waSentAt,
        waEntregadoAt: waDeliveredAt,
        waLeidoAt: waReadAt,
        waDeliveredWebhookPreserved: webhookPreserved('delivered'),
        waReadWebhookPreserved: webhookPreserved('read'),
      },
      intact: verified.intact,
      summary: verified.summary,
      contentHash: snapshot?.contentHash || verified.content.currentHash,
      storedHash: verified.content.storedHash,
      contentMatch: verified.content.match,
      send: {
        batchId: verified.send.batchId,
        txHash: verified.send.txHash,
        merkleRoot: verified.send.merkleRoot,
        leafHash: verified.send.leafHash,
        merkleValid: verified.send.merkleValid,
        onChainMatch: verified.send.onChainMatch,
      },
      events: verified.events,
      verifyRef: campaignVerifyRef('campaign_acta_recipient', campaignId, messageId),
    });
    const hash = sha256Hex(pdf);
    await recordIssuedDocument(db, {
      hash,
      kind: 'campaign_acta_recipient',
      campaignId,
      orgId,
      orgNombre: String(snapshot?.sender.orgNombre || org.nombre || ''),
      campaignNombre: String(campaign.nombre || ''),
      messageId,
      recipientNombre: String(snapshot?.recipient.nombre || ''),
      txHash: verified.send.txHash,
      fileName: `acta-destinatario-${messageId}.pdf`,
    });
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="acta-destinatario-${messageId}.pdf"`,
      },
    });
    } catch (e) {
      console.error('GET /api/campaigns/integrity/acta (destinatario)', e);
      return NextResponse.json({ error: 'Error al generar el acta PDF' }, { status: 500 });
    }
  }

  const batchRef = db.collection('campaigns').doc(campaignId).collection('integrity_batches').doc(batchId);
  const batchSnap = await batchRef.get();
  if (!batchSnap.exists) {
    return NextResponse.json({ error: 'Tanda no encontrada' }, { status: 404 });
  }

  const batch = batchSnap.data()!;
  const leavesSnap = await batchRef.collection('leaves').get();
  type LeafDoc = {
    id: string;
    messageId?: string;
    leafHash?: string;
    leafPayload?: string;
    leafIndex?: number;
    contentHash?: string;
    eventType?: string;
    occurredAt?: string;
    kind?: string;
    dni?: string;
    nombre?: string;
    monto?: string;
    cuotas?: string;
  };
  const rawLeaves: LeafDoc[] = leavesSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<LeafDoc, 'id'>) }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const messageIds = [...new Set(rawLeaves.map((l) => String(l.messageId || '')).filter(Boolean))];
  const msgById = new Map<string, FirebaseFirestore.DocumentData>();
  for (let i = 0; i < messageIds.length; i += 100) {
    const chunk = messageIds.slice(i, i + 100);
    const refs = chunk.map((id) => db.collection('campaign_messages').doc(id));
    const snaps = await db.getAll(...refs);
    for (const s of snaps) {
      if (s.exists) msgById.set(s.id, s.data()!);
    }
  }

  const leaves: ActaLeafRow[] = rawLeaves.map((leaf, i) => {
    const parsed = parseSendLeafPayload(typeof leaf.leafPayload === 'string' ? leaf.leafPayload : undefined);
    const sealedSend = (msgById.get(String(leaf.messageId || ''))?.integrity?.send || {}) as Record<string, unknown>;
    return {
      leafIndex: typeof leaf.leafIndex === 'number' ? leaf.leafIndex : i,
      messageId: String(leaf.messageId || ''),
      leafHash: String(leaf.leafHash || ''),
      kind: typeof leaf.kind === 'string' ? leaf.kind : undefined,
      contentHash: parsed?.contentHash || (typeof leaf.contentHash === 'string' ? leaf.contentHash : undefined),
      eventType: typeof leaf.eventType === 'string' ? leaf.eventType : undefined,
      occurredAt: typeof leaf.occurredAt === 'string' ? leaf.occurredAt : undefined,
      nombre: parsed?.nombre || String(leaf.nombre || sealedSend.nombre || ''),
      email: parsed?.email || '',
      telefono: parsed?.phone || '',
      dni: parsed?.dni || String(leaf.dni || sealedSend.dni || ''),
    };
  });

  try {
    const batchVerify =
      String(batch.status || '') === 'anchored'
        ? await verifyIntegrityBatch(campaignId, batchId).catch(() => null)
        : null;
    const pdf = await buildActaTandaPdf({
      orgNombre: String(org.nombre || ''),
      orgCuit: typeof org.cuit === 'string' ? org.cuit : undefined,
      campaignId,
      campaignNombre: String(campaign.nombre || ''),
      campaignAsunto: typeof campaign.asunto === 'string' ? campaign.asunto : undefined,
      batchId,
      kind: batch.kind === 'event' ? 'event' : 'send',
      status: String(batch.status || 'open'),
      leafCount: leaves.length,
      merkleRoot: typeof batch.merkleRoot === 'string' ? batch.merkleRoot : undefined,
      txHash: typeof batch.txHash === 'string' ? batch.txHash : undefined,
      payload: typeof batch.payload === 'string' ? batch.payload : undefined,
      sealedAt: formatSealedAt(batch.sealedAt),
      generatedAt: formatEvidenceTimestamp(new Date()),
      leaves,
      verifyRef: campaignVerifyRef('campaign_acta', campaignId, batchId),
      leavesDigest: batchVerify?.computedDigest || undefined,
      digestMatch: batchVerify?.digestMatch ?? null,
    });

    const hash = sha256Hex(pdf);
    const safeBatch = batchId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
    const fileName = `acta-tanda-${campaignId}-${safeBatch}.pdf`;
    await recordIssuedDocument(db, {
      hash,
      kind: 'campaign_acta',
      campaignId,
      orgId,
      orgNombre: String(org.nombre || ''),
      campaignNombre: String(campaign.nombre || ''),
      batchId,
      txHash: typeof batch.txHash === 'string' ? batch.txHash : null,
      fileName,
    });
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (e) {
    console.error('GET /api/campaigns/integrity/acta', e);
    return NextResponse.json({ error: 'Error al generar el acta PDF' }, { status: 500 });
  }
}
