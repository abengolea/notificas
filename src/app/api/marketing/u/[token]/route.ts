import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_CONTACTS, MARKETING_SENDS } from "@/lib/marketing/collections";
import { recordMarketingEvent } from "@/lib/marketing/events";
import { marketingContactEmail } from "@/lib/marketing/types";
import { verifyMarketingToken } from "@/lib/marketing/tokens";

async function latestSendForContact(contactId: string): Promise<{
  sendId: string;
  campaignId: string;
  email: string;
} | null> {
  try {
    const snap = await getAdminDb()
      .collection(MARKETING_SENDS)
      .where("contactId", "==", contactId)
      .limit(5)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const data = doc.data() || {};
    return {
      sendId: doc.id,
      campaignId: String(data.campaignId || ""),
      email: String(data.email || ""),
    };
  } catch {
    return null;
  }
}

async function unsubscribe(contactId: string): Promise<boolean> {
  const db = getAdminDb();
  const ref = db.collection(MARKETING_CONTACTS).doc(contactId);
  const snap = await ref.get();
  const existing = snap.exists ? snap.data() || {} : {};
  let lastSendId = String(existing.lastSendId || "");
  let lastCampaignId = String(existing.lastCampaignId || "");
  let email = String(existing.email || "");
  if (!lastSendId || !email) {
    const send = await latestSendForContact(contactId);
    if (send) {
      lastSendId = lastSendId || send.sendId;
      lastCampaignId = lastCampaignId || send.campaignId;
      email = email || send.email;
    }
  }

  const nowIso = new Date().toISOString();
  if (snap.exists) {
    await ref.update({
      stage: "unsubscribed",
      stageManual: true,
      lastUnsubscribedAt: nowIso,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    await ref.set({
      email,
      emailKey: email,
      name: "",
      company: "",
      title: "",
      country: "AR",
      notes: "",
      tags: [],
      listIds: [],
      stage: "unsubscribed",
      stageManual: true,
      source: "unsub",
      lastCampaignId: lastCampaignId || null,
      lastSendId: lastSendId || null,
      lastUnsubscribedAt: nowIso,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  if (lastSendId && lastCampaignId) {
    await recordMarketingEvent({
      sendId: lastSendId,
      campaignId: lastCampaignId,
      contactId,
      type: "unsubscribed",
    });
  }
  return true;
}

function page(ok: boolean): NextResponse {
  const from = marketingContactEmail();
  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Notificas</title></head>
<body style="font-family:Georgia,serif;background:#f4f6f8;color:#1f2a33;margin:0;padding:48px 20px;text-align:center;">
  <p style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#3a7d82;">Notificas</p>
  <h1 style="font-size:28px;font-weight:400;">${ok ? "Te dimos de baja" : "No pudimos procesar la baja"}</h1>
  <p style="color:#5b6b75;max-width:28rem;margin:0 auto;">${
    ok
      ? "No vas a recibir más correos de este listado comercial. Los envíos certificados de Notificas no se ven afectados."
      : `El enlace no es válido o ya venció. Si seguís recibiendo correos, escribinos a ${from}.`
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
