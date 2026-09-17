/**
 * Envía un correo comercial de muestra (logo + tipografía de carta) por Resend.
 *
 *   npx tsx scripts/marketing/send-preview.ts
 *   npx tsx scripts/marketing/send-preview.ts --to=otro@dominio.com
 *
 * From: contacto@notificas.com. Baja y pixel apuntan a producción.
 */
import path from "path";
import { execFileSync } from "child_process";
import { config } from "dotenv";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../../src/lib/firebase-admin";
import { MARKETING_CONTACTS, MARKETING_SENDS } from "../../src/lib/marketing/collections";
import { contactIdForEmail } from "../../src/lib/marketing/csv";
import { assembleMarketingHtml } from "../../src/lib/marketing/html";
import {
  outreachOfferBodyHtml,
  outreachOfferText,
  OUTREACH_PREHEADER,
  OUTREACH_SUBJECT,
} from "../../src/lib/marketing/offer-letter";
import { sendMarketingEmailViaResend } from "../../src/lib/marketing/send";
import { marketingUnsubUrl } from "../../src/lib/marketing/tokens";

config({ path: path.join(process.cwd(), ".env.local") });

const DEFAULT_TO = "abengolea1@gmail.com";
const GCP_PROJECT = "notificas-f9953";

function gcloudSecret(name: string): string {
  try {
    const bin = process.platform === "win32" ? "gcloud.cmd" : "gcloud";
    const out = execFileSync(
      bin,
      ["secrets", "versions", "access", "latest", `--secret=${name}`, `--project=${GCP_PROJECT}`],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        shell: process.platform === "win32",
      },
    );
    return String(out || "")
      .replace(/^\uFEFF/, "")
      .trim();
  } catch {
    return "";
  }
}

function parseTo(argv: string[]): string {
  let to = DEFAULT_TO;
  for (const a of argv) {
    if (a.startsWith("--to=")) to = a.slice("--to=".length).trim().toLowerCase();
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error("Email inválido:", to);
    process.exit(1);
  }
  return to;
}

async function main() {
  if (!process.env.RESEND_API_KEY?.trim()) {
    process.env.RESEND_API_KEY = gcloudSecret("RESEND_API_KEY");
  }
  const trackingSecret = gcloudSecret("TRACKING_HMAC_SECRET");
  if (trackingSecret) process.env.MARKETING_HMAC_SECRET = trackingSecret;

  const to = parseTo(process.argv.slice(2));
  const fields = {
    nombre: "Adrián",
    empresa: "Notificas",
    pais: "Argentina",
    cargo: "",
    email: to,
  };
  const contactId = contactIdForEmail(to);
  const db = getAdminDb();
  const sendRef = db.collection(MARKETING_SENDS).doc();
  const now = new Date().toISOString();

  await db.collection(MARKETING_CONTACTS).doc(contactId).set(
    {
      email: to,
      emailKey: to,
      name: fields.nombre,
      company: fields.empresa,
      title: "",
      country: "AR",
      notes: "Preview de correo comercial",
      tags: [],
      listIds: [],
      stage: "sent",
      stageManual: false,
      source: "manual",
      lastCampaignId: null,
      lastSendId: sendRef.id,
      lastSentAt: now,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const assembled = assembleMarketingHtml({
    bodyHtml: outreachOfferBodyHtml(fields),
    sendId: sendRef.id,
    contactId,
    fields,
    preheader: OUTREACH_PREHEADER,
    trackLinks: false,
  });
  const unsubUrl = marketingUnsubUrl(contactId);
  const text = `${outreachOfferText(fields)}\n\nBaja: ${unsubUrl}`;

  const result = await sendMarketingEmailViaResend({
    to,
    subject: OUTREACH_SUBJECT,
    html: assembled.html,
    text,
    sendId: sendRef.id,
    contactId,
  });

  if (!result.ok) {
    console.error("No se pudo enviar:", result.error);
    process.exit(1);
  }

  await sendRef.set({
    campaignId: "",
    contactId,
    email: to,
    country: "AR",
    company: fields.empresa,
    name: fields.nombre,
    subject: OUTREACH_SUBJECT,
    status: "sent",
    resendEmailId: result.emailId || null,
    rfcMessageId: result.messageId || null,
    gmailThreadId: null,
    gmailMessageId: null,
    openCount: 0,
    clickCount: 0,
    replySnippet: null,
    lastError: null,
    sentAt: now,
    deliveredAt: null,
    openedAt: null,
    clickedAt: null,
    repliedAt: null,
    bouncedAt: null,
    createdAt: FieldValue.serverTimestamp(),
  });

  console.log(`Enviado a ${to}`);
  console.log(`resend id: ${result.emailId}`);
  console.log(`baja: ${unsubUrl}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
