#!/usr/bin/env node
/**
 * Alta/reinvitación real del worker piloto: mail con link /adherir/...
 * El código de WhatsApp se manda cuando el trabajador toca "Enviar código" en esa página.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/art-send-invite-test.ts
 */
import path from "path";
import { config } from "dotenv";
import { FieldValue } from "firebase-admin/firestore";

config({ path: path.join(process.cwd(), ".env.local") });

const ORG_ID = "FqNRpuT2Dzu2YmGrElbt";
const TO_EMAIL = "goyitobengolea@gmail.com";
const TO_PHONE = "+5493364645357";
const FULL_NAME = "Goyito Bengolea";
const DNI = "30111222";
const CUIL = "20301112229";
const FROM = "contacto@notificas.com";
const SENDEMAIL_URL = (
  process.env.FIREBASE_SENDEMAIL_URL || "https://sendemail-ju7n3yysfq-uc.a.run.app"
).replace(/\/$/, "");

async function sendSmtp(subject: string, text: string, html: string, extra: Record<string, unknown>) {
  const { getAdminDb } = await import("../src/lib/firebase-admin");
  const db = getAdminDb();
  const mailRef = db.collection("mail").doc();
  await mailRef.set({
    to: [TO_EMAIL],
    from: FROM,
    replyTo: FROM,
    message: { subject, html, text },
    createdAt: FieldValue.serverTimestamp(),
    timestamp: new Date().toISOString(),
    uniqueId: `${Date.now()}-art-invite-test`,
    createdBy: "script:art-send-invite-test",
    senderName: "Notificas",
    recipientName: FULL_NAME,
    recipientEmail: TO_EMAIL,
    contactRequest: true,
    source: "art_invite_test",
    sourceLabel: "Invitación adhesión ART (prueba)",
    ...extra,
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
    throw new Error(`SMTP HTTP ${cfRes.status} mail=${mailRef.id}`);
  }
  return { mailId: mailRef.id, messageId: cfBody.messageId || "" };
}

async function main() {
  const { getAdminDb } = await import("../src/lib/firebase-admin");
  const { findRecipientForSrt, upsertRecipient } = await import("../src/lib/art/store");
  const { createInvitation } = await import("../src/lib/art/invite");
  const { parseIdentityAttestation } = await import("../src/lib/art/identity-attestation");
  const { PILOT_IDENTITY_SOURCE } = await import("../src/lib/art/pilot");

  const orgSnap = await getAdminDb().collection("organizations").doc(ORG_ID).get();
  const orgName = String(orgSnap.data()?.nombre || "ART DEMO NOTIFICAS");

  let recipient = await findRecipientForSrt(ORG_ID, { email: TO_EMAIL, phone: TO_PHONE });
  if (!recipient) {
    const att = parseIdentityAttestation(
      {
        identityVerificationMethod: "ART_INTERNAL_KYC",
        identitySource: PILOT_IDENTITY_SOURCE,
        identityVerifiedBy: "script:art-send-invite-test",
        identityAssuranceLevel: "TEST_DECLARED",
      },
      { verifiedBy: "script:art-send-invite-test", source: PILOT_IDENTITY_SOURCE }
    );
    if (!att.ok) throw new Error(att.reason);
    const created = await upsertRecipient({
      orgId: ORG_ID,
      cuil: CUIL,
      dni: DNI,
      fullName: FULL_NAME,
      firstName: "Goyito",
      lastName: "Bengolea",
      phone: TO_PHONE,
      email: TO_EMAIL,
      identityPrevalidatedByArt: true,
      identityAttestation: att.value,
    });
    recipient = created.recipient;
    console.log("Trabajador creado:", recipient.id);
  } else {
    console.log("Trabajador existente:", recipient.id, "status=", recipient.status);
  }

  const inv = await createInvitation({
    orgId: ORG_ID,
    orgName,
    recipient,
    actor: "script:art-send-invite-test",
    send: false,
  });

  const dni = recipient.dni || DNI;
  const cuil = recipient.cuil || CUIL;
  const text = [
    `Hola ${recipient.fullName || FULL_NAME}.`,
    "",
    `${orgName} te invita a adherirte a notificaciones electrónicas (prueba interna).`,
    "",
    "1. Abrí este enlace:",
    inv.url,
    "2. Confirmá DNI y CUIL.",
    `   DNI: ${dni}`,
    `   CUIL: ${cuil}`,
    "3. Tocá Enviar código por WhatsApp.",
    "4. El código de 6 dígitos llega al celular; cargalo en esa misma página.",
    "",
    "Notificas",
  ].join("\n");
  const html = `<p>Hola ${recipient.fullName || FULL_NAME}.</p>
<p>${orgName} te invita a adherirte a notificaciones electrónicas (prueba interna).</p>
<ol>
<li>Abrí este enlace:<br/><a href="${inv.url}">${inv.url}</a></li>
<li>Confirmá DNI <strong>${dni}</strong> y CUIL <strong>${cuil}</strong>.</li>
<li>Tocá <strong>Enviar código por WhatsApp</strong>.</li>
<li>El código de 6 dígitos llega al celular; cargalo en esa misma página.</li>
</ol>
<p>Notificas</p>`;

  const mail = await sendSmtp(`${orgName}: adhesión a notificaciones electrónicas`, text, html, {
    inviteUrl: inv.url,
  });

  console.log("EMAIL: OK", mail.mailId, mail.messageId);
  console.log("LINK:", inv.url);
  console.log("DNI:", dni);
  console.log("CUIL:", cuil);
  console.log("WhatsApp: todavía no. Se manda cuando abras el link y toques Enviar código.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
