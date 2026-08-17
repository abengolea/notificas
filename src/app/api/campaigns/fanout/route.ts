import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, getAdminBucket } from '@/lib/firebase-admin';
import { enqueueCampaignFanout, enqueueCampaignWorker } from '@/lib/cloud-tasks';
import { ensureSendBatch, resolveOpenSendBatchId, tandaIndexFromOffset } from '@/lib/campaign-integrity';
import { RECIPIENT_CHUNK_SIZE } from '@/lib/campaign-recipients';
import { isSyntheticCampaignEmail, phoneDigits } from '@/lib/parse-campaign-csv';
import type { RecipientEntry } from '@/lib/types';

// Destinatarios que procesa cada invocación del fanout (un archivo de Storage).
const FANOUT_PAGE = RECIPIENT_CHUNK_SIZE;
// Destinatarios que recibe cada worker de envío.
const SEND_BATCH = 20;
// 0 = sin límite cuando el doc no trae tandaSize.
// El default de UI (2000) vive en campaign-tanda.ts y se persiste en campaign.tandaSize.
const DEFAULT_TANDA_SIZE = 0;

/** Clave única: email real, o teléfono en dígitos (ignora emails sintéticos WA). */
function recipientKey(email: string, telefono: string): string {
  const e = email.trim().toLowerCase();
  if (e && !isSyntheticCampaignEmail(e)) return e;
  const t = phoneDigits(telefono);
  return t ? `wa:${t}` : `noop:${Math.random()}`;
}

/** Variantes para `in` de Firestore: valor guardado, dígitos, y E.164 con `+`. */
function phoneQueryVariants(telefono: string): string[] {
  const raw = telefono.trim();
  if (!raw) return [];
  const digits = phoneDigits(raw);
  const variants = new Set<string>([raw]);
  if (digits) {
    variants.add(digits);
    variants.add(`+${digits}`);
  }
  return [...variants];
}

function verifyWorkerSecret(request: NextRequest): boolean {
  const secret = (process.env.CAMPAIGN_WORKER_SECRET || '').trim();
  if (!secret) return false;
  return (request.headers.get('X-Worker-Secret') || '').trim() === secret;
}

export async function POST(request: NextRequest) {
  if (!verifyWorkerSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { campaignId: string; offset: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { campaignId, offset, tandaSize } = body as {
    campaignId: string;
    offset: number;
    tandaSize?: number;
  };
  if (!campaignId || typeof offset !== 'number') {
    return NextResponse.json({ error: 'Parámetros requeridos: campaignId, offset' }, { status: 400 });
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

  // Tope de ESTA corrida: campaign.tandaCap (yaEnviados + límite diario), no el número que ve el usuario.
  const effectiveTandaSize: number =
    (typeof campaign.tandaCap === 'number' && campaign.tandaCap > 0)
      ? campaign.tandaCap
      : (typeof campaign.tandaSize === 'number' && campaign.tandaSize > 0)
      ? campaign.tandaSize
      : (typeof tandaSize === 'number' && tandaSize > 0)
      ? tandaSize
      : DEFAULT_TANDA_SIZE;

  // Cargar destinatarios: Storage (150k+) → recipientData inline → recipient_lists.
  let allRecipients: RecipientEntry[] = [];

  if (campaign.recipientStoragePath) {
    // 150k+: leer chunk desde Firebase Storage.
    const bucket = getAdminBucket();
    const chunkIndex = Math.floor(offset / FANOUT_PAGE);
    const file = bucket.file(`${campaign.recipientStoragePath}/chunk_${chunkIndex}.json`);
    const [content] = await file.download();
    const chunkRecipients: RecipientEntry[] = JSON.parse(content.toString('utf-8'));
    const limited = applyTandaLimit(chunkRecipients, offset, effectiveTandaSize);
    if (limited.page.length === 0) {
      await campRef.update({ fanoutResumeOffset: offset });
      return NextResponse.json({ done: true, offset, reason: 'tanda_agotada' });
    }
    const hasMoreChunks = chunkIndex + 1 < (campaign.recipientChunkCount ?? 0);
    if (hasMoreChunks && !limited.tandaAgotada) {
      await enqueueCampaignFanout(campaignId, limited.nextOffset);
    } else if (limited.tandaAgotada) {
      await campRef.update({ fanoutResumeOffset: limited.nextOffset });
    }
    return await processFanoutPage(db, campaign, campaignId, limited.page, offset);
  } else if (Array.isArray(campaign.recipientData) && campaign.recipientData.length > 0) {
    allRecipients = campaign.recipientData as RecipientEntry[];
  } else if (Array.isArray(campaign.recipientEmails) && campaign.recipientEmails.length > 0) {
    allRecipients = (campaign.recipientEmails as string[]).map((email) => ({
      email: String(email).trim().toLowerCase(),
      nombre: String(email).split('@')[0],
    }));
  } else if (campaign.recipientListId) {
    // Fallback: leer desde subcolección paginada en recipient_lists.
    const listSnap = await db
      .collection('recipient_list_entries')
      .where('listId', '==', campaign.recipientListId)
      .orderBy('createdAt')
      .offset(offset)
      .limit(FANOUT_PAGE)
      .get();
    const listPage = listSnap.docs.map((d) => d.data() as RecipientEntry);
    const limited = applyTandaLimit(listPage, offset, effectiveTandaSize);
    if (limited.page.length === 0) {
      await campRef.update({ fanoutResumeOffset: offset });
      return NextResponse.json({ done: true, offset, reason: 'tanda_agotada' });
    }
    const hasMore = listPage.length === FANOUT_PAGE;
    if (hasMore && !limited.tandaAgotada) {
      await enqueueCampaignFanout(campaignId, limited.nextOffset);
    } else if (limited.tandaAgotada) {
      await campRef.update({ fanoutResumeOffset: limited.nextOffset });
    }
    return await processFanoutPage(db, campaign, campaignId, limited.page, offset);
  }

  const pageLimit = effectiveTandaSize > 0
    ? Math.min(FANOUT_PAGE, effectiveTandaSize - offset)
    : FANOUT_PAGE;

  const page = allRecipients.slice(offset, offset + pageLimit);
  if (page.length === 0) {
    return NextResponse.json({ done: true, offset });
  }

  const nextOffset = offset + page.length;
  const tandaAgotada = effectiveTandaSize > 0 && nextOffset >= effectiveTandaSize;
  if (nextOffset < allRecipients.length && !tandaAgotada) {
    await enqueueCampaignFanout(campaignId, nextOffset);
  } else if (tandaAgotada) {
    await campRef.update({ fanoutResumeOffset: nextOffset });
  }

  return await processFanoutPage(db, campaign, campaignId, page, offset);
}

/** Corta la página si el tope de tanda se alcanza a mitad de chunk. */
function applyTandaLimit(
  page: RecipientEntry[],
  offset: number,
  tandaSize: number
): { page: RecipientEntry[]; nextOffset: number; tandaAgotada: boolean } {
  let sliced = page;
  if (tandaSize > 0) {
    const remaining = tandaSize - offset;
    if (remaining <= 0) {
      return { page: [], nextOffset: offset, tandaAgotada: true };
    }
    sliced = page.slice(0, remaining);
  }
  const nextOffset = offset + sliced.length;
  return {
    page: sliced,
    nextOffset,
    tandaAgotada: tandaSize > 0 && nextOffset >= tandaSize,
  };
}

async function processFanoutPage(
  db: FirebaseFirestore.Firestore,
  campaign: FirebaseFirestore.DocumentData,
  campaignId: string,
  page: RecipientEntry[],
  offset: number
) {
  // Dedup: consultar solo los destinatarios de esta página, no toda la colección.
  // Antes se hacía un .get() sin límite que leía todos los campaign_messages en cada fanout.
  const existingByKey = new Map<string, { id: string; estado: string }>();
  const base = db.collection('campaign_messages').where('campaignId', '==', campaignId);
  const IN_CHUNK = 30;
  const canal = String(campaign.canal || 'email');
  const waCanal = canal === 'whatsapp' || canal === 'ambos';

  const absorb = (snap: FirebaseFirestore.QuerySnapshot) =>
    snap.docs.forEach(d => {
      const data = d.data();
      const email = String(data.recipientEmail || '');
      const telefono = String(data.recipientTelefono || '');
      const entry = { id: d.id, estado: String(data.estado || 'pendiente') };
      existingByKey.set(recipientKey(email, telefono), entry);
      const digits = phoneDigits(telefono);
      if (digits && waCanal) existingByKey.set(`wa:${digits}`, entry);
    });

  const emails = [...new Set(
    page
      .map(r => (r.email || '').trim().toLowerCase())
      .filter(e => e && !isSyntheticCampaignEmail(e))
  )];
  for (let i = 0; i < emails.length; i += IN_CHUNK) {
    absorb(await base.where('recipientEmail', 'in', emails.slice(i, i + IN_CHUNK)).get());
  }

  // Dedup por teléfono: canal WA/ambos siempre; email-only solo si no hay email real.
  // Firestore `in` admite 30 valores: splitear variantes (E.164 + dígitos) en chunks.
  const phoneVariants = new Set<string>();
  for (const r of page) {
    const hasRealEmail = Boolean((r.email || '').trim()) && !isSyntheticCampaignEmail(r.email);
    if (!waCanal && hasRealEmail) continue;
    for (const variant of phoneQueryVariants(r.telefono || '')) {
      phoneVariants.add(variant);
    }
  }
  const phones = [...phoneVariants];
  for (let i = 0; i < phones.length; i += IN_CHUNK) {
    absorb(await base.where('recipientTelefono', 'in', phones.slice(i, i + IN_CHUNK)).get());
  }

  // Crear campaign_messages en batch para los nuevos/pendientes.
  const toProcess: string[] = []; // docIds a encolar en workers
  const batchOps = db.batch();
  let batchCount = 0;
  const tandaIndex = tandaIndexFromOffset(offset);
  const integrityBatchId = await resolveOpenSendBatchId(campaignId, tandaIndex);

  for (const row of page) {
    const email = (row.email || '').trim().toLowerCase();
    const key = recipientKey(email, row.telefono || '');
    const phoneKey = phoneDigits(row.telefono) ? `wa:${phoneDigits(row.telefono)}` : '';
    const existing = existingByKey.get(key) || (phoneKey ? existingByKey.get(phoneKey) : undefined);

    if (existing?.estado === 'enviado' || existing?.estado === 'leido') continue;

    if (existing) {
      toProcess.push(existing.id);
    } else {
      const ref = db.collection('campaign_messages').doc();
      batchOps.set(ref, {
        campaignId,
        orgId: campaign.orgId,
        recipientEmail: email,
        recipientNombre: row.nombre || null,
        recipientDni: row.dni || null,
        recipientLegajo: row.legajo || null,
        recipientTelefono: row.telefono || null,
        estado: 'pendiente',
        creditApplied: false,
        sendTandaIndex: tandaIndex,
        ...(campaign.simulated === true ? {} : { integritySendBatchId: integrityBatchId }),
        createdAt: FieldValue.serverTimestamp(),
      });
      toProcess.push(ref.id);
      batchCount += 1;
    }
  }

  if (batchCount > 0) {
    await batchOps.commit();
    if (campaign.simulated !== true) {
      await ensureSendBatch({
        campaignId,
        orgId: String(campaign.orgId || ''),
        tandaIndex,
        expectedIncrement: batchCount,
        batchId: integrityBatchId,
      });
    }
  }

  // Encolar workers en batches de SEND_BATCH.
  for (let i = 0; i < toProcess.length; i += SEND_BATCH) {
    await enqueueCampaignWorker(campaignId, toProcess.slice(i, i + SEND_BATCH));
  }

  return NextResponse.json({ ok: true, page: offset, created: batchCount, enqueued: toProcess.length });
}
