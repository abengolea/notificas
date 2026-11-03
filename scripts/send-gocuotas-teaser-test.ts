/**
 * Prueba de la idea 1 (mixta): el correo es un sobre con enlace al lector.
 * El texto de la intimación no va en Gmail; aparece al abrir el reader.
 *
 *   npx tsx scripts/send-gocuotas-teaser-test.ts
 *   npx tsx scripts/send-gocuotas-teaser-test.ts --email=otro@dominio.com
 */
import path from "path";
import { execFileSync } from "child_process";
import { config } from "dotenv";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { buildCampaignMailHtml, campaignBodyToHtmlFragment } from "../src/lib/campaign-email-html";
import { DEFAULT_CONTACT_FROM_EMAIL, DEFAULT_FIREBASE_SENDEMAIL_URL } from "../src/lib/mail-defaults";

config({ path: path.join(process.cwd(), ".env.local") });

function argValue(flag: string, fallback: string): string {
  const prefix = `${flag}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : fallback;
}

const GCP_PROJECT = "notificas-f9953";
const ORG_ID = "18bacwReKihMUrOAxl2m";
const CREATED_BY = "YaPRt8ahI5giIFlRDXbMcfaAXo12";
const TO_EMAIL = argValue("--email", "abengolea1@gmail.com").toLowerCase();
const RECIPIENT_NAME = argValue("--nombre", "Adrian Bengolea");
const SENDER_NAME = "GOcuotas";

const LETTER = `[PRUEBA INTERNA — no es una deuda real ni un envío a clientes]

Estimado/a ${RECIPIENT_NAME},

GOcuotas Legales S.A. le notifica que registra una deuda pendiente de cancelación.

DNI: 25.715.970
N° de cuenta: GCL-00001
Monto: $ 130.000
Vencimiento: 14/02/2026
Días de mora: 180

Este texto es el que vería el destinatario al abrir el enlace (el lector certificado). En Gmail solo ve el aviso y el botón «Acceder a la notificación».

Para regularizar o consultar el estado de cuenta:
cobranzas@gocuotas.com.ar
www.gocuotas.com.ar/pagos

GOcuotas Legales S.A.`;

function gcloudSecret(name: string): string {
  try {
    const out = execFileSync(
      "gcloud",
      ["secrets", "versions", "access", "latest", `--secret=${name}`, `--project=${GCP_PROJECT}`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return String(out || "")
      .replace(/^\uFEFF/, "")
      .trim();
  } catch {
    return "";
  }
}

function initAdmin() {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Faltan credenciales Firebase Admin en .env.local");
  }
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
    });
  }
  return getFirestore();
}

async function main() {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(TO_EMAIL)) {
    console.error("Email inválido:", TO_EMAIL);
    process.exit(1);
  }

  const db = initAdmin();
  const subject = "Notificación de GOcuotas";
  const html = buildCampaignMailHtml({
    recipientEmail: TO_EMAIL,
    recipientName: RECIPIENT_NAME,
    sender: SENDER_NAME,
    bodyHtml: campaignBodyToHtmlFragment(LETTER),
    attachments: [],
    mode: "teaser",
    previewText: "GOcuotas le envió una comunicación. Ábrala para ver el contenido.",
  });

  const mailRef = db.collection("mail").doc();
  const mailId = mailRef.id;
  await mailRef.set({
    to: [TO_EMAIL],
    from: DEFAULT_CONTACT_FROM_EMAIL,
    replyTo: "adrianbengolea@notificas.com",
    message: {
      subject,
      html,
      text: LETTER,
      content: LETTER,
      contentText: LETTER,
    },
    createdAt: FieldValue.serverTimestamp(),
    timestamp: new Date().toISOString(),
    uniqueId: `${Date.now()}-gocuotas-teaser-test`,
    createdBy: CREATED_BY,
    orgId: ORG_ID,
    senderName: SENDER_NAME,
    recipientName: RECIPIENT_NAME,
    recipientEmail: TO_EMAIL,
    source: "gocuotas_teaser_test",
    sourceLabel: "Prueba sobre GOcuotas (idea 1)",
  });

  const fnUrl = (process.env.FIREBASE_SENDEMAIL_URL || DEFAULT_FIREBASE_SENDEMAIL_URL).replace(
    /\/$/,
    "",
  );
  let secret = (process.env.POLYGON_CERTIFY_SECRET || process.env.CAMPAIGN_WORKER_SECRET || "").trim();
  if (!secret) secret = gcloudSecret("POLYGON_CERTIFY_SECRET");
  if (!secret) {
    console.error("Falta POLYGON_CERTIFY_SECRET (env o gcloud). Doc creado:", mailId);
    process.exit(1);
  }

  console.log("mailId", mailId);
  console.log("to", TO_EMAIL);
  console.log("mode", "teaser (sobre + lector)");
  console.log("sendEmail", fnUrl);

  const cfRes = await fetch(fnUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Certify-Secret": secret },
    body: JSON.stringify({ docId: mailId }),
  });
  const cfBody = (await cfRes.json().catch(() => ({}))) as Record<string, unknown>;
  const snap = await mailRef.get();
  const data = snap.data() || {};
  const delivery = (data.delivery || {}) as Record<string, unknown>;

  if (!cfRes.ok || cfBody.success === false) {
    console.error("ENVÍO: ERROR", cfRes.status, cfBody, delivery);
    process.exit(1);
  }

  console.log("ENVÍO: OK");
  console.log("emailMessageId", cfBody.messageId || delivery.info || "");
  console.log("readerUrl", data.readerUrl || "");
  console.log("delivery.state", delivery.state || "");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
