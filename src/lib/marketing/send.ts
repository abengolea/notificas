import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_CAMPAIGNS, MARKETING_CONTACTS, MARKETING_SENDS } from "./collections";
import { countryName } from "./countries";
import { assembleMarketingHtml } from "./html";
import { recordMarketingEvent } from "./events";
import { namedRecipientSource, contactMatchesSource } from "./lists";
import { marketingFromHeader, marketingFromName, marketingReplyTo } from "./types";
import { marketingUnsubUrl } from "./tokens";

const BATCH = Math.max(1, Math.min(20, Number(process.env.MARKETING_SEND_BATCH || 8) || 8));

type ResendSendResult = {
  id?: string;
  message_id?: string;
};

export async function sendMarketingEmailViaResend(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  sendId: string;
  contactId: string;
}): Promise<{ ok: true; emailId: string; messageId: string | null } | { ok: false; error: string }> {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY no configurada" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: marketingFromHeader(),
      to: [input.to],
      reply_to: marketingReplyTo(),
      subject: input.subject,
      html: input.html,
      text: input.text,
      tags: [
        { name: "marketing_send_id", value: input.sendId },
        { name: "marketing_contact_id", value: input.contactId },
      ],
      headers: {
        "List-Unsubscribe": `<${marketingUnsubUrl(input.contactId)}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "X-Notificas-Marketing-Send": input.sendId,
      },
    }),
  });
  const body = (await res.json().catch(() => ({}))) as ResendSendResult & { message?: string };
  if (!res.ok) {
    return { ok: false, error: body.message || `resend_${res.status}` };
  }
  return {
    ok: true,
    emailId: String(body.id || ""),
    messageId: body.message_id ? String(body.message_id) : null,
  };
}

export async function tickMarketingCampaign(campaignId: string): Promise<{
  processed: number;
  remaining: number;
  done: boolean;
  errors: number;
}> {
  const db = getAdminDb();
  const campRef = db.collection(MARKETING_CAMPAIGNS).doc(campaignId);
  const campSnap = await campRef.get();
  if (!campSnap.exists) throw Object.assign(new Error("Campaña no encontrada"), { status: 404 });
  const camp = campSnap.data() || {};
  if (camp.status !== "sending") {
    const queued = await db
      .collection(MARKETING_SENDS)
      .where("campaignId", "==", campaignId)
      .where("status", "==", "queued")
      .limit(1)
      .get();
    return { processed: 0, remaining: queued.size, done: camp.status === "sent" || camp.status === "cancelled", errors: 0 };
  }

  const queuedSnap = await db
    .collection(MARKETING_SENDS)
    .where("campaignId", "==", campaignId)
    .where("status", "==", "queued")
    .limit(BATCH)
    .get();

  if (queuedSnap.empty) {
    await campRef.update({
      status: "sent",
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { processed: 0, remaining: 0, done: true, errors: 0 };
  }

  let processed = 0;
  let errors = 0;
  for (const doc of queuedSnap.docs) {
    const send = doc.data();
    const contactSnap = await db.collection(MARKETING_CONTACTS).doc(String(send.contactId)).get();
    const contact = contactSnap.data() || {};
    const fields = {
      nombre: String(contact.name || send.name || ""),
      empresa: String(contact.company || send.company || ""),
      pais: countryName(String(send.country || contact.country || "")),
      cargo: String(contact.title || ""),
      email: String(send.email || ""),
    };
    const subject = String(camp.subject || send.subject || "").replace(
      /\{\{\s*([a-zA-Z_]+)\s*\}\}/g,
      (_m, key: string) => fields[key.toLowerCase() as keyof typeof fields] || "",
    );
    const rawHtml = String(camp.htmlBody || "");
    const assembled = assembleMarketingHtml({
      bodyHtml: rawHtml.includes("<") ? rawHtml : `<p>${rawHtml.replace(/\n/g, "<br/>")}</p>`,
      sendId: doc.id,
      contactId: String(send.contactId),
      fields,
    });
    const customText = String(camp.textBody || "").trim();
    const text = customText ? `${customText}\n\nBaja: ${marketingUnsubUrl(String(send.contactId))}` : assembled.text;

    const result = await sendMarketingEmailViaResend({
      to: String(send.email),
      subject,
      html: assembled.html,
      text,
      sendId: doc.id,
      contactId: String(send.contactId),
    });

    if (!result.ok) {
      errors += 1;
      await doc.ref.update({
        status: "failed",
        lastError: result.error,
        updatedAt: FieldValue.serverTimestamp(),
      });
      await campRef.update({
        "stats.queued": FieldValue.increment(-1),
        "stats.failed": FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      processed += 1;
      continue;
    }

    await doc.ref.update({
      resendEmailId: result.emailId || null,
      rfcMessageId: result.messageId || null,
      sentAt: new Date().toISOString(),
      lastError: null,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await recordMarketingEvent({
      sendId: doc.id,
      campaignId,
      contactId: String(send.contactId),
      type: "sent",
    });
    // Commercial outreach only: delivery/open live in marketing_sends. No Polygon.
    processed += 1;
  }

  const still = await db
    .collection(MARKETING_SENDS)
    .where("campaignId", "==", campaignId)
    .where("status", "==", "queued")
    .limit(1)
    .get();
  const done = still.empty;
  if (done) {
    await campRef.update({
      status: "sent",
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  return { processed, remaining: done ? 0 : BATCH, done, errors };
}

export async function enqueueCampaignSends(campaignId: string): Promise<{ queued: number }> {
  const db = getAdminDb();
  const campRef = db.collection(MARKETING_CAMPAIGNS).doc(campaignId);
  const campSnap = await campRef.get();
  if (!campSnap.exists) throw Object.assign(new Error("Campaña no encontrada"), { status: 404 });
  const camp = campSnap.data() || {};
  if (camp.status === "sending" || camp.status === "sent") {
    throw Object.assign(new Error("La campaña ya está en envío o fue enviada."), { status: 409 });
  }
  if (camp.status === "cancelled") {
    throw Object.assign(new Error("La campaña está cancelada."), { status: 409 });
  }

  const source = namedRecipientSource(camp);
  if (source.kind !== "list") {
    throw Object.assign(new Error("Cargá una lista de destinatarios en la campaña."), { status: 400 });
  }
  let q: FirebaseFirestore.Query = db.collection(MARKETING_CONTACTS).where("listIds", "array-contains", source.listId);
  const snap = await q.limit(5000).get();
  const include = new Set<string>(
    Array.isArray(camp.includeStages) && camp.includeStages.length
      ? camp.includeStages.map(String)
      : ["new", "sent", "opened", "clicked", "replied"],
  );

  const existing = await db.collection(MARKETING_SENDS).where("campaignId", "==", campaignId).get();
  const already = new Set(existing.docs.map((d) => String(d.data().contactId || "")));

  let queued = 0;
  let batch = db.batch();
  let ops = 0;
  const flush = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = db.batch();
    ops = 0;
  };

  for (const doc of snap.docs) {
    const c = doc.data();
    if (!contactMatchesSource(c, source)) continue;
    const stage = String(c.stage || "new");
    if (stage === "unsubscribed" || stage === "bounced" || stage === "not_interested") continue;
    if (!include.has(stage)) continue;
    if (already.has(doc.id)) continue;
    const sendRef = db.collection(MARKETING_SENDS).doc();
    batch.set(sendRef, {
      campaignId,
      contactId: doc.id,
      email: String(c.email || ""),
      country: String(c.country || ""),
      company: String(c.company || ""),
      name: String(c.name || ""),
      subject: String(camp.subject || ""),
      status: "queued",
      resendEmailId: null,
      rfcMessageId: null,
      gmailThreadId: null,
      gmailMessageId: null,
      openCount: 0,
      clickCount: 0,
      replySnippet: null,
      lastError: null,
      sentAt: null,
      deliveredAt: null,
      openedAt: null,
      clickedAt: null,
      repliedAt: null,
      bouncedAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });
    ops += 1;
    queued += 1;
    already.add(doc.id);
    if (ops >= 400) await flush();
  }
  await flush();

  if (queued === 0) {
    return { queued: 0 };
  }

  await campRef.update({
    status: "sending",
    contactCount: queued,
    "stats.queued": FieldValue.increment(queued),
    startedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { queued };
}

export { marketingFromName };
