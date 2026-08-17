import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { recordEventLeaf } from "@/lib/campaign-integrity";

// Callback URL canónica en Meta Developer Portal (app 1022568949756440):
//   https://notificas.com.ar/api/whatsapp/webhook
//   objeto: whatsapp_business_account → campo: messages
// GET: Meta verifica el webhook con hub.challenge
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && token && expected && token === expected) {
    console.log("✅ WhatsApp webhook verificado por Meta");
    return new NextResponse(challenge, { status: 200 });
  }
  console.warn("⚠️ WhatsApp webhook: token de verificación inválido");
  return new NextResponse("Forbidden", { status: 403 });
}

// POST: Meta envía eventos de estado (sent/delivered/read/failed)
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  console.log(
    `📥 WA webhook POST object=${body?.object ?? "null"} entries=${body?.entry?.length ?? 0}`
  );

  // Procesar de forma síncrona antes de retornar — Cloud Run mata promesas en background
  // al enviar la respuesta HTTP. Meta tolera hasta ~20s; nuestras queries de Firestore son <5s.
  await processWebhookBody(body).catch((e) =>
    console.error("❌ Error en whatsapp webhook:", e?.message)
  );

  return new NextResponse("OK", { status: 200 });
}

function wamidLookupKeys(wamid: string): string[] {
  const id = wamid.trim();
  if (!id) return [];
  const keys = [id];
  if (id.startsWith("wamid.")) keys.push(id.slice("wamid.".length));
  else keys.push(`wamid.${id}`);
  return [...new Set(keys)];
}

async function processWebhookBody(body: any) {
  if (!body || body.object !== "whatsapp_business_account") return;

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      for (const status of change.value?.statuses ?? []) {
        await processStatus(status).catch((e) =>
          console.error("❌ Error procesando status WA:", e?.message, status?.id)
        );
      }
    }
  }
}

async function processStatus(status: any) {
  const wamid: string = status.id;
  const statusType: string = status.status; // sent | delivered | read | failed
  const recipientPhone: string = status.recipient_id ?? "Unknown";
  const timestamp = status.timestamp
    ? new Date(parseInt(status.timestamp, 10) * 1000).toISOString()
    : new Date().toISOString();

  console.log(`📱 WA status: ${statusType} | wamid=${wamid} | phone=${recipientPhone}`);

  if (!["delivered", "read", "failed"].includes(statusType)) return;

  const db = getAdminDb();

  // Resolver mailDocId: primero por índice whatsapp_ids, luego fallback por query en mail.
  let mailDocId: string | null = null;
  for (const key of wamidLookupKeys(wamid)) {
    const idDoc = await db.doc(`whatsapp_ids/${key}`).get();
    if (idDoc.exists) {
      mailDocId = idDoc.data()!.mailDocId as string;
      break;
    }
  }
  if (!mailDocId) {
    // Fallback: buscar en colección mail por whatsappMessageId (waOnly) o tracking.whatsappMessageId
    for (const key of wamidLookupKeys(wamid)) {
      const byWamid = await db.collection("mail")
        .where("whatsappMessageId", "==", key)
        .limit(1).get();
      if (!byWamid.empty) {
        mailDocId = byWamid.docs[0].id;
        break;
      }
      const byTracking = await db.collection("mail")
        .where("tracking.whatsappMessageId", "==", key)
        .limit(1).get();
      if (!byTracking.empty) {
        mailDocId = byTracking.docs[0].id;
        break;
      }
    }
    if (mailDocId) {
      // Escribir el índice para futuros lookups
      await db.doc(`whatsapp_ids/${wamid}`).set(
        { mailDocId, recipientPhone, createdAt: new Date().toISOString() },
        { merge: true }
      );
      console.log(`🔧 whatsapp_ids reconstruido para wamid=${wamid}`);
    } else {
      // whatsapp_ids aún no existe (race condition: webhook llegó antes que el worker lo escribiera).
      // Guardar el evento pendiente — el worker lo procesará al escribir whatsapp_ids.
      await db.doc(`pending_wa_webhooks/${wamid}`).set(
        { statusType, timestamp, recipientPhone, wamid, createdAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      console.log(`⏳ Webhook ${statusType} guardado en pending_wa_webhooks/${wamid} — se procesará cuando llegue whatsapp_ids`);
      return;
    }
  }

  const mailRef = db.doc(`mail/${mailDocId}`);
  const mailSnap = await mailRef.get();
  if (!mailSnap.exists) {
    console.warn(`⚠️ Documento mail/${mailDocId} no encontrado`);
    return;
  }

  const data = mailSnap.data()!;
  const existingMovements: any[] = data.tracking?.movements ?? [];

  // Dedupe: no registrar el mismo status dos veces para el mismo wamid
  const already = existingMovements.some(
    (m) => m.whatsappMessageId === wamid && m.type === `whatsapp_${statusType}`
  );
  if (already) {
    console.log(`⚠️ whatsapp_${statusType} ya registrado para wamid=${wamid}, skip`);
    return;
  }

  const descMap: Record<string, string> = {
    delivered: `Mensaje de WhatsApp entregado al teléfono +${recipientPhone}`,
    read: `Mensaje de WhatsApp leído en el teléfono +${recipientPhone}`,
    failed: `Error de entrega en WhatsApp para +${recipientPhone}${status.errors?.[0]?.title ? ": " + status.errors[0].title : ""}`,
  };

  const movement = {
    id: crypto.randomUUID(),
    type: `whatsapp_${statusType}`,
    description: descMap[statusType],
    timestamp,
    userAgent: "Sistema (WhatsApp de Meta)",
    clientIP: "Server",
    forwardedIPs: [],
    realIP: "Server",
    browser: "WhatsApp",
    recipientEmail: data.recipientEmail ?? "Unknown",
    recipientPhone,
    whatsappMessageId: wamid,
  };

  const update: Record<string, any> = {
    "tracking.movements": FieldValue.arrayUnion(movement),
  };
  if (statusType === "delivered") {
    update["tracking.whatsappDelivered"] = true;
    update["tracking.whatsappDeliveredAt"] = FieldValue.serverTimestamp();
  } else if (statusType === "read") {
    update["tracking.whatsappRead"] = true;
    update["tracking.whatsappReadAt"] = FieldValue.serverTimestamp();
  }

  await mailRef.update(update);
  console.log(`✅ whatsapp_${statusType} registrado en mail/${mailDocId}`);

  // Propagar estado al campaign_message correspondiente
  await syncCampaignMessage(db, mailDocId, statusType);
}

async function syncCampaignMessage(db: ReturnType<typeof getAdminDb>, mailId: string, statusType: string) {
  try {
    const snap = await db.collection('campaign_messages').where('mailId', '==', mailId).limit(1).get();
    if (snap.empty) return;

    const ref = snap.docs[0].ref;
    const data = snap.docs[0].data();
    const campId = String(data.campaignId || '');

    const canal: string = (await db.collection('campaigns').doc(campId).get()).data()?.canal || 'email';
    const isWaChannel = canal === 'whatsapp' || canal === 'ambos';

    if (statusType === 'read') {
      await db.runTransaction(async (t) => {
        const fresh = await t.get(ref);
        const fd = fresh.data();
        if (!fd) return;
        const update: Record<string, unknown> = {};
        if (isWaChannel) {
          update.waEstado = 'leido';
          update.waLeidoAt = FieldValue.serverTimestamp();
        }
        // Para campaña solo-WA, el estado principal también sube a leido
        if (canal === 'whatsapp' && fd.estado !== 'leido') {
          update.estado = 'leido';
          update.leidoAt = FieldValue.serverTimestamp();
          if (campId) t.update(db.collection('campaigns').doc(campId), { 'stats.leidos': FieldValue.increment(1) });
        }
        // Para ambos: estado global a leido solo si email también está leido
        if (canal === 'ambos' && fd.emailEstado === 'leido' && fd.estado !== 'leido') {
          update.estado = 'leido';
          update.leidoAt = FieldValue.serverTimestamp();
          if (campId) t.update(db.collection('campaigns').doc(campId), { 'stats.leidos': FieldValue.increment(1) });
        }
        t.update(ref, update);
      });
    } else if (statusType === 'delivered') {
      const update: Record<string, unknown> = {};
      if (isWaChannel) { update.waEstado = 'entregado'; update.waEntregadoAt = FieldValue.serverTimestamp(); }
      if (data.estado === 'pendiente') { update.estado = 'enviado'; update.enviadoAt = FieldValue.serverTimestamp(); }
      if (Object.keys(update).length) await ref.update(update);
    } else if (statusType === 'failed') {
      await db.runTransaction(async (t) => {
        const fresh = await t.get(ref);
        const fd = fresh.data();
        if (!fd) return;
        const update: Record<string, unknown> = {};
        if (isWaChannel) { update.waEstado = 'error'; update.waError = 'WhatsApp delivery failed'; }
        // Para solo-WA, el estado global también es error
        if (canal === 'whatsapp' && fd.estado !== 'error') {
          update.estado = 'error';
          update.errorMsg = 'WhatsApp delivery failed';
          if (campId && fd.estado === 'enviado') {
            t.update(db.collection('campaigns').doc(campId), {
              'stats.enviados': FieldValue.increment(-1),
              'stats.errores': FieldValue.increment(1),
            });
          }
        }
        t.update(ref, update);
      });
    }
    if (statusType === 'delivered' || statusType === 'read') {
      void recordEventLeaf({
        campaignId: campId,
        orgId: String(data.orgId || ''),
        messageId: snap.docs[0].id,
        eventType: statusType === 'delivered' ? 'wa_delivered' : 'wa_read',
      }).catch((e) => console.warn('⚠️ Hoja Merkle WA:', e?.message));
    }
    console.log(`✅ campaign_message sincronizado: ${statusType} para mail/${mailId}`);
  } catch (e: any) {
    console.error('⚠️ Error sincronizando campaign_message desde WA webhook:', e?.message);
  }
}
