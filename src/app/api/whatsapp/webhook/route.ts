import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

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
  // Responder 200 inmediatamente — Meta reintenta si no recibe respuesta rápida
  const body = await request.json().catch(() => null);

  // Procesamos en background sin bloquear la respuesta
  processWebhookBody(body).catch((e) =>
    console.error("❌ Error en whatsapp webhook:", e?.message)
  );

  return new NextResponse("OK", { status: 200 });
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

  const idDoc = await db.doc(`whatsapp_ids/${wamid}`).get();
  if (!idDoc.exists) {
    console.warn(`⚠️ No mailDocId para wamid=${wamid}`);
    return;
  }

  const { mailDocId } = idDoc.data()!;
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
    userAgent: "WhatsApp Cloud API",
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
}
