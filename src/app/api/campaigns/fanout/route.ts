import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { enqueueCampaignFanout, enqueueCampaignWorker } from '@/lib/cloud-tasks';
import type { RecipientEntry } from '@/lib/types';

// Destinatarios que procesa cada invocación del fanout.
const FANOUT_PAGE = 500;
// Destinatarios que recibe cada worker de envío.
const SEND_BATCH = 20;

function verifyWorkerSecret(request: NextRequest): boolean {
  const secret = process.env.CAMPAIGN_WORKER_SECRET;
  if (!secret) return false;
  return request.headers.get('X-Worker-Secret') === secret;
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

  const { campaignId, offset } = body;
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

  // Cargar destinatarios: soporta recipientData en doc o recipient_lists (para volúmenes grandes).
  let allRecipients: RecipientEntry[] = [];

  if (Array.isArray(campaign.recipientData) && campaign.recipientData.length > 0) {
    allRecipients = campaign.recipientData as RecipientEntry[];
  } else if (campaign.recipientListId) {
    // Para 150k+: leer desde subcolección paginada en recipient_lists.
    const listSnap = await db
      .collection('recipient_list_entries')
      .where('listId', '==', campaign.recipientListId)
      .orderBy('createdAt')
      .offset(offset)
      .limit(FANOUT_PAGE)
      .get();
    allRecipients = listSnap.docs.map((d) => d.data() as RecipientEntry);
    // Para listas paginadas, tratar allRecipients como la página completa.
    if (allRecipients.length === FANOUT_PAGE) {
      await enqueueCampaignFanout(campaignId, offset + FANOUT_PAGE);
    }
    return await processFanoutPage(db, campaign, campaignId, allRecipients, offset);
  }

  // Slice para esta página del fanout.
  const page = allRecipients.slice(offset, offset + FANOUT_PAGE);
  if (page.length === 0) {
    return NextResponse.json({ done: true, offset });
  }

  // Encolar próximo fanout si quedan más.
  if (offset + FANOUT_PAGE < allRecipients.length) {
    await enqueueCampaignFanout(campaignId, offset + FANOUT_PAGE);
  }

  return await processFanoutPage(db, campaign, campaignId, page, offset);
}

async function processFanoutPage(
  db: FirebaseFirestore.Firestore,
  campaign: FirebaseFirestore.DocumentData,
  campaignId: string,
  page: RecipientEntry[],
  offset: number
) {
  // Cargar mensajes ya existentes para evitar duplicados.
  const existingSnap = await db
    .collection('campaign_messages')
    .where('campaignId', '==', campaignId)
    .get();

  const existingByEmail = new Map<string, { id: string; estado: string }>();
  existingSnap.docs.forEach((d) => {
    const data = d.data();
    existingByEmail.set(String(data.recipientEmail || '').toLowerCase(), {
      id: d.id,
      estado: String(data.estado || 'pendiente'),
    });
  });

  // Crear campaign_messages en batch para los nuevos/pendientes.
  const toProcess: string[] = []; // docIds a encolar en workers
  const batchOps = db.batch();
  let batchCount = 0;

  for (const row of page) {
    const email = row.email.trim().toLowerCase();
    const existing = existingByEmail.get(email);

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
        createdAt: FieldValue.serverTimestamp(),
      });
      toProcess.push(ref.id);
      batchCount += 1;
    }
  }

  if (batchCount > 0) {
    await batchOps.commit();
  }

  // Encolar workers en batches de SEND_BATCH.
  for (let i = 0; i < toProcess.length; i += SEND_BATCH) {
    await enqueueCampaignWorker(campaignId, toProcess.slice(i, i + SEND_BATCH));
  }

  return NextResponse.json({ ok: true, page: offset, created: batchCount, enqueued: toProcess.length });
}
