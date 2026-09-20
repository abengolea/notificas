/**
 * Aplica la plantilla institucional a una campaña en borrador y envía una prueba.
 * No dispara la campaña.
 *
 *   npx tsx scripts/marketing/send-campaign-test.ts
 *   npx tsx scripts/marketing/send-campaign-test.ts --campaign=Af8FbR2oqUUlKxJdFZY6
 *   npx tsx scripts/marketing/send-campaign-test.ts --to=otro@dominio.com
 */
import path from "path";
import { execFileSync } from "child_process";
import { config } from "dotenv";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../../src/lib/firebase-admin";
import { MARKETING_CAMPAIGNS, MARKETING_CONTACTS, MARKETING_SENDS } from "../../src/lib/marketing/collections";
import { persistCampaignEmail, PREVIEW_MERGE_FIELDS } from "../../src/lib/marketing/campaign-email";
import { contactIdForEmail } from "../../src/lib/marketing/csv";
import { assembleMarketingHtml } from "../../src/lib/marketing/html";
import { sendMarketingEmailViaResend } from "../../src/lib/marketing/send";

config({ path: path.join(process.cwd(), ".env.local") });

const DEFAULT_TO = "abengolea1@gmail.com";
const DEFAULT_CAMPAIGN_ID = "jKO4Z30A7iHi6RDx4Z6n";
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

function argValue(argv: string[], name: string, fallback: string): string {
  for (const a of argv) {
    if (a.startsWith(`${name}=`)) return a.slice(`${name}=`.length).trim();
  }
  return fallback;
}

function eyebrowFromName(name: string): string {
  const parts = name
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part && !/^primera aproximación$/i.test(part));
  return parts.slice(0, 2).join(" · ");
}

async function main() {
  if (!process.env.RESEND_API_KEY?.trim()) {
    process.env.RESEND_API_KEY = gcloudSecret("RESEND_API_KEY");
  }
  const trackingSecret = gcloudSecret("TRACKING_HMAC_SECRET");
  if (trackingSecret) process.env.MARKETING_HMAC_SECRET = trackingSecret;

  const argv = process.argv.slice(2);
  const to = argValue(argv, "--to", DEFAULT_TO).toLowerCase();
  const campaignId = argValue(argv, "--campaign", DEFAULT_CAMPAIGN_ID);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error("Email inválido:", to);
    process.exit(1);
  }

  const db = getAdminDb();
  const campRef = db.collection(MARKETING_CAMPAIGNS).doc(campaignId);
  const campSnap = await campRef.get();
  if (!campSnap.exists) {
    throw new Error(`Campaña ${campaignId} no encontrada`);
  }
  const camp = campSnap.data() || {};
  console.log("campaign", campaignId, "status", camp.status);
  if (String(camp.status || "draft") !== "draft") {
    throw new Error(`La campaña no está en borrador (${camp.status}). No se envía prueba desde este script.`);
  }

  const existing =
    camp.emailContent && typeof camp.emailContent === "object" ? camp.emailContent : {};
  const snapshot = persistCampaignEmail({
    ...existing,
    htmlBody: String(camp.htmlBody || ""),
    name: String(camp.name || ""),
    subject: String(camp.subject || ""),
    title: String(camp.subject || "Notificas"),
    campaignName: String(camp.name || ""),
    eyebrow: String((existing as { eyebrow?: string }).eyebrow || "") || eyebrowFromName(String(camp.name || "")),
    preheader: String((existing as { preheader?: string }).preheader || "") || String(camp.subject || ""),
  });
  await campRef.update({
    htmlBody: snapshot.htmlBody,
    textBody: snapshot.textBody,
    emailContent: snapshot.emailContent,
    templateId: snapshot.templateId,
    templateVersion: snapshot.templateVersion,
    htmlSnapshotAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const subject = String(camp.subject || "Notificas");
  const fields = {
    ...PREVIEW_MERGE_FIELDS,
    email: to,
  };
  const contactId = contactIdForEmail(to);
  const sendRef = db.collection(MARKETING_SENDS).doc();
  const now = new Date().toISOString();

  await db.collection(MARKETING_CONTACTS).doc(contactId).set(
    {
      email: to,
      emailKey: to,
      name: fields.nombre,
      company: fields.empresa,
      title: fields.cargo,
      country: "AR",
      notes: "Envío de prueba de campaña comercial",
      tags: ["test-send"],
      listIds: [],
      stage: "sent",
      stageManual: false,
      source: "manual",
      lastCampaignId: campaignId,
      lastSendId: sendRef.id,
      lastSentAt: now,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const assembled = assembleMarketingHtml({
    bodyHtml: snapshot.htmlBody,
    textBody: snapshot.textBody,
    sendId: sendRef.id,
    contactId,
    fields,
    trackLinks: false,
  });

  if (!assembled.html.includes("notificas-wordmark.png") || !assembled.html.includes("#F4F8FD")) {
    throw new Error("El HTML de prueba no tiene la plantilla institucional. No se envía.");
  }

  const result = await sendMarketingEmailViaResend({
    to,
    subject,
    html: assembled.html,
    text: assembled.text,
    sendId: sendRef.id,
    contactId,
  });

  if (!result.ok) {
    console.error("No se pudo enviar:", result.error);
    process.exit(1);
  }

  await sendRef.set({
    campaignId,
    contactId,
    email: to,
    country: "AR",
    company: fields.empresa,
    name: fields.nombre,
    subject,
    status: "sent",
    testSend: true,
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

  const after = await campRef.get();
  console.log(`Prueba enviada a ${to}`);
  console.log(`resend id: ${result.emailId}`);
  console.log(`asunto: ${subject}`);
  console.log(`campaña: ${campaignId}`);
  console.log(`templateId: ${after.data()?.templateId}`);
  console.log(`estado campaña: ${after.data()?.status}`);
  console.log("campaignSent", false);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
