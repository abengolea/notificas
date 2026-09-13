#!/usr/bin/env node
/**
 * Prueba de entrega ART: un mail y un WhatsApp AUTH OTP al worker piloto.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/art-otp-delivery-test.ts
 *
 * Destinos fijos (allowlist piloto). No persiste challenges en Firestore ART.
 */
import path from "path";
import { config } from "dotenv";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

config({ path: path.join(process.cwd(), ".env.local") });

const TO_EMAIL = "goyitobengolea@gmail.com";
const TO_PHONE = "3364645357";
const FROM = "contacto@notificas.com";
const SENDEMAIL_URL = (
  process.env.FIREBASE_SENDEMAIL_URL || "https://sendemail-ju7n3yysfq-uc.a.run.app"
).replace(/\/$/, "");

function otp6(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function initAdmin() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Faltan credenciales Admin en .env.local");
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

async function sendTestEmail(code: string): Promise<{ ok: boolean; detail: string }> {
  const db = initAdmin();
  const subject = "Notificas ART: prueba de entrega";
  const text = [
    "Prueba de entrega ART (no es una adhesión).",
    `Código de prueba: ${code}`,
    `Fecha: ${new Date().toISOString()}`,
  ].join("\n");
  const html = `<p>Prueba de entrega ART (no es una adhesión).</p><p>Código de prueba: <strong>${code}</strong></p>`;
  const mailRef = db.collection("mail").doc();
  await mailRef.set({
    to: [TO_EMAIL],
    from: FROM,
    replyTo: FROM,
    message: { subject, html, text },
    createdAt: FieldValue.serverTimestamp(),
    timestamp: new Date().toISOString(),
    uniqueId: `${Date.now()}-art-otp-delivery-test`,
    createdBy: "script:art-otp-delivery-test",
    senderName: "Notificas",
    recipientName: "Goyito",
    recipientEmail: TO_EMAIL,
    contactRequest: true,
    source: "art_otp_delivery_test",
    sourceLabel: "Script prueba OTP ART",
  });
  const secret = (process.env.POLYGON_CERTIFY_SECRET || process.env.CAMPAIGN_WORKER_SECRET || "").trim();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers["X-Certify-Secret"] = secret;
  const cfRes = await fetch(SENDEMAIL_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ docId: mailRef.id }),
  });
  const cfBody = (await cfRes.json().catch(() => ({}))) as { success?: boolean; messageId?: string };
  if (!cfRes.ok || cfBody.success === false) {
    return { ok: false, detail: `HTTP ${cfRes.status} mail=${mailRef.id}` };
  }
  return { ok: true, detail: `mail=${mailRef.id} messageId=${cfBody.messageId || "?"}` };
}

async function main() {
  const code = otp6();
  const { sendWhatsAppAuthOtp, whatsAppOtpToDigits, artWhatsAppOtpTemplateName } = await import(
    "../src/lib/art/whatsapp-auth-otp"
  );
  const waTo = whatsAppOtpToDigits(TO_PHONE);
  console.log("Prueba de entrega ART");
  console.log("Email:", TO_EMAIL);
  console.log("WhatsApp:", waTo || TO_PHONE);
  console.log("Template:", artWhatsAppOtpTemplateName());
  console.log("Código de prueba:", code);

  const email = await sendTestEmail(code).catch((e: unknown) => ({
    ok: false as const,
    detail: e instanceof Error ? e.message : "email_failed",
  }));
  console.log(email.ok ? "EMAIL: OK" : "EMAIL: ERROR", email.detail);

  const wa = await sendWhatsAppAuthOtp({ toPhone: TO_PHONE, code });
  if (wa.ok) {
    console.log("WHATSAPP: OK", `lang=${wa.language} waMessageId=${wa.waMessageId || "?"}`);
  } else {
    console.log("WHATSAPP: ERROR", wa.error);
  }

  if (!email.ok || !wa.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
