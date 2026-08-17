/**
 * GET /api/debug/wa-chain?campaignId=XXX
 * Diagnóstico de la cadena de tracking WA para una campaña:
 * campaign_message → mailId → mail doc → whatsappMessageId → whatsapp_ids
 *
 * Solo para debugging — remover en producción o proteger con auth.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  const campaignId = request.nextUrl.searchParams.get('campaignId') || '';
  const nombre     = request.nextUrl.searchParams.get('nombre') || '';
  if (!campaignId && !nombre) {
    return NextResponse.json({ error: 'Pasar campaignId o nombre' }, { status: 400 });
  }

  const db = getAdminDb();

  // Resolver el campaign doc por ID o por nombre
  let resolvedId = campaignId;
  let campSnap: FirebaseFirestore.DocumentSnapshot | null = null;

  if (campaignId) {
    const snap = await db.collection('campaigns').doc(campaignId).get();
    if (snap.exists) { campSnap = snap; resolvedId = snap.id; }
  }

  if (!campSnap && nombre) {
    const byName = await db.collection('campaigns')
      .where('nombre', '==', nombre)
      .limit(1).get();
    if (!byName.empty) { campSnap = byName.docs[0]; resolvedId = byName.docs[0].id; }
  }

  const campData = campSnap?.exists ? campSnap.data() : null;

  // 0b. Scan crudo de campaigns ordenado por fecha desc para ver qué ve el Admin SDK
  const campScan = await db.collection('campaigns').orderBy('createdAt', 'desc').limit(10).get();
  const campsSample = campScan.docs.map(d => ({ id: d.id, nombre: d.data().nombre, estado: d.data().estado }));

  // 0c. Scan crudo de campaign_messages (sin filtro) para ver si la colección tiene docs
  const rawScan = await db.collection('campaign_messages').limit(3).get();
  const rawSample = rawScan.docs.map(d => ({ id: d.id, campaignId: d.data().campaignId, recipientNombre: d.data().recipientNombre }));

  // 0c. Buscar campaign_messages por campaignId directamente (usando el ID resuelto)
  const msgsSnap = await db.collection('campaign_messages')
    .where('campaignId', '==', resolvedId)
    .limit(10)
    .get();

  const results = await Promise.all(msgsSnap.docs.map(async (msgDoc) => {
    const msg = msgDoc.data();
    const mailId = typeof msg.mailId === 'string' ? msg.mailId : null;

    // 2. Leer mail doc
    let mailData: Record<string, unknown> | null = null;
    let wamid: string | null = null;
    if (mailId) {
      const mailSnap = await db.doc(`mail/${mailId}`).get();
      if (mailSnap.exists) {
        const d = mailSnap.data()!;
        wamid = d.whatsappMessageId as string ?? d.tracking?.whatsappMessageId as string ?? null;
        mailData = {
          exists: true,
          recipientPhone: d.recipientPhone,
          waOnly: d.waOnly,
          whatsappMessageId: wamid,
          trackingWhatsappDelivered: d.tracking?.whatsappDelivered ?? false,
          trackingWhatsappRead: d.tracking?.whatsappRead ?? false,
          waMovements: (d.tracking?.movements ?? [])
            .filter((m: { type?: string }) => String(m.type || '').startsWith('whatsapp_'))
            .map((m: { type?: string; timestamp?: string }) => ({ type: m.type, timestamp: m.timestamp })),
        };
      } else {
        mailData = { exists: false };
      }
    }

    // 3. Leer whatsapp_ids
    let waIdEntry: Record<string, unknown> | null = null;
    let pendingEntry: Record<string, unknown> | null = null;
    if (wamid) {
      const waSnap = await db.doc(`whatsapp_ids/${wamid}`).get();
      waIdEntry = waSnap.exists
        ? { exists: true, ...waSnap.data() }
        : { exists: false };
      const pendingSnap = await db.doc(`pending_wa_webhooks/${wamid}`).get();
      pendingEntry = pendingSnap.exists
        ? { exists: true, ...pendingSnap.data() }
        : { exists: false };
    }

    return {
      msgId: msgDoc.id,
      recipientNombre: msg.recipientNombre,
      recipientTelefono: msg.recipientTelefono,
      estado: msg.estado,
      waEstado: msg.waEstado,
      mailId,
      mailDoc: mailData,
      wamid,
      whatsappIdsEntry: waIdEntry,
      pendingWebhook: pendingEntry,
      diagnostico: !mailId
        ? '❌ Sin mailId en campaign_message'
        : !mailData?.exists
        ? '❌ mail doc no encontrado'
        : !wamid
        ? '❌ Sin whatsappMessageId en mail doc (WA no se envió o no se guardó el WAMID)'
        : !waIdEntry?.exists
        ? '❌ whatsapp_ids no existe (bug fire-and-forget: deployar CF fix)'
        : mailData?.trackingWhatsappDelivered
        ? '✅ Cadena completa y Meta ya reportó delivered en este mail doc'
        : '✅ Cadena completa — si el dashboard sigue en enviado, el webhook no actualizó este mail (revisar callback URL de Meta)',
    };
  }));

  return NextResponse.json({
    campaignId: resolvedId,
    campaignDoc: campData ? {
      exists: true,
      estado: campData.estado,
      recipientCount: campData.recipientCount,
      recipientStoragePath: campData.recipientStoragePath,
      recipientChunkCount: campData.recipientChunkCount,
      stats: campData.stats,
    } : { exists: false },
    rawSampleFrom_campaigns: campsSample,
    rawSampleFrom_campaign_messages: rawSample,
    msgsFoundForCampaign: msgsSnap.size,
    messages: results,
  });
}
