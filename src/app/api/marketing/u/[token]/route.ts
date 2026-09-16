import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_CONTACTS } from "@/lib/marketing/collections";
import { recordMarketingEvent } from "@/lib/marketing/events";
import { verifyMarketingToken } from "@/lib/marketing/tokens";
import { FieldValue } from "firebase-admin/firestore";

async function unsubscribe(contactId: string): Promise<boolean> {
  const db = getAdminDb();
  const ref = db.collection(MARKETING_CONTACTS).doc(contactId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const data = snap.data() || {};
  await ref.update({
    stage: "unsubscribed",
    stageManual: true,
    updatedAt: FieldValue.serverTimestamp(),
  });
  if (data.lastSendId && data.lastCampaignId) {
    await recordMarketingEvent({
      sendId: String(data.lastSendId),
      campaignId: String(data.lastCampaignId),
      contactId,
      type: "unsubscribed",
    });
  }
  return true;
}

function page(ok: boolean): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Notificas</title></head>
<body style="font-family:Georgia,serif;background:#f4f6f8;color:#1f2a33;margin:0;padding:48px 20px;text-align:center;">
  <p style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#3a7d82;">Notificas</p>
  <h1 style="font-size:28px;font-weight:400;">${ok ? "Te dimos de baja" : "No pudimos procesar la baja"}</h1>
  <p style="color:#5b6b75;max-width:28rem;margin:0 auto;">${
    ok
      ? "No vas a recibir más correos de este listado comercial. Los envíos certificados de Notificas no se ven afectados."
      : "El enlace no es válido o ya venció. Si seguís recibiendo correos, escribinos a contacto@notificas.com.ar."
  }</p>
</body></html>`;
  return new NextResponse(html, {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const contactId = verifyMarketingToken(token, "u");
  if (!contactId) return page(false);
  try {
    const ok = await unsubscribe(contactId);
    return page(ok);
  } catch (e) {
    console.error("marketing unsub GET", e);
    return page(false);
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const contactId = verifyMarketingToken(token, "u");
  if (!contactId) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    await unsubscribe(contactId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("marketing unsub POST", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
