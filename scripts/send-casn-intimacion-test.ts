/**
 * Envío de prueba: intimación de matrícula (Colegio de Abogados de San Nicolás).
 * Correo con carta extendida + WhatsApp con plantilla colegio_de_abogados_intimacion_matricula.
 * Mismo enlace de lector en ambos canales.
 *
 *   npx tsx scripts/send-casn-intimacion-test.ts
 *   npx tsx scripts/send-casn-intimacion-test.ts --nombre="Alejo Maiztegui" --email=alejo@x.com --phone=+5493364654267
 */
import path from "path";
import { execFileSync } from "child_process";
import { config } from "dotenv";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { buildCampaignMailHtml, campaignBodyToHtmlFragment } from "../src/lib/campaign-email-html";
import { DEFAULT_CONTACT_FROM_EMAIL, DEFAULT_FIREBASE_SENDEMAIL_URL } from "../src/lib/mail-defaults";
import { toWhatsAppPhone } from "../src/lib/parse-campaign-csv";

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
const TO_PHONE = toWhatsAppPhone(argValue("--phone", "+5493364645357")) || "";
const RECIPIENT_NAME = argValue("--nombre", "Adrian Bengolea");
const SENDER_NAME = "Colegio de Abogados de San Nicolás";
const WA_TEMPLATE = "colegio_de_abogados_intimacion_matricula";
const WA_BODY = `Estimado/a {{1}},

El Colegio de Abogados de San Nicolás le envía una intimación oficial referida a su matrícula profesional.

Lea el documento completo en el siguiente enlace:
{{2}}

Esta es una comunicación formal del Colegio. La lectura queda registrada.`;

const LETTER = `San Nicolás de los Arroyos, 6 de octubre de 2026.

Al Dr. ${RECIPIENT_NAME}
Matrícula profesional: Tomo 8, Folio 84
Domicilio electrónico: ${TO_EMAIL}

INTIMACIÓN POR CUOTAS DE MATRÍCULA PROFESIONAL IMPAGAS
— Envío de prueba —

De nuestra consideración:

El Colegio de Abogados del Departamento Judicial de San Nicolás le intimó formalmente, en su carácter de colegiado, a regularizar la deuda que registra en concepto de cuotas de matrícula profesional.

Según los registros de Tesorería, su matrícula (Tomo 8, Folio 84) adeuda 4 (cuatro) cuotas, por un total de $ 180.000 (pesos ciento ochenta mil). Esa deuda mantiene vencida la obligación de pago prevista en la normativa interna del Colegio y en las disposiciones aplicables a la matrícula.

Se le intimó a cancelar el importe indicado, o a acreditar el pago ya efectuado, dentro del plazo de diez (10) días hábiles contados desde la recepción de esta comunicación.

En caso de persistir el incumplimiento, el Colegio podrá disponer la baja de la matrícula profesional, con los efectos que la normativa aplicable asigna a esa medida, sin perjuicio de las acciones de cobro que correspondan.

El presente constituye una comunicación formal del Colegio. La apertura del enlace de acceso queda registrada como constancia de lectura. El mismo acceso le es remitido en forma simultánea por WhatsApp.

Queda a su disposición Tesorería del Colegio para consultas sobre el estado de cuenta y las formas de pago.

Colegio de Abogados del Departamento Judicial de San Nicolás`;

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
  if (!TO_PHONE) {
    console.error("Teléfono inválido");
    process.exit(1);
  }
  const db = initAdmin();
  const existing = await db.collection("wa_templates").where("orgId", "==", ORG_ID).get();
  const already = existing.docs.some(
    (d) => String(d.data()?.templateName || "") === WA_TEMPLATE,
  );
  if (!already) {
    await db.collection("wa_templates").add({
      orgId: ORG_ID,
      label: "Intimación matrícula (Colegio San Nicolás)",
      templateName: WA_TEMPLATE,
      templateLang: "es_AR",
      templateVariables: ["nombre", "url_lectura"],
      urlButton: false,
      templateBody: WA_BODY,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log("Plantilla guardada en org Empresa Prueba");
  }

  const subject = "Intimación por cuotas de matrícula profesional impagas";
  const html = buildCampaignMailHtml({
    recipientEmail: TO_EMAIL,
    recipientName: RECIPIENT_NAME,
    sender: SENDER_NAME,
    bodyHtml: campaignBodyToHtmlFragment(LETTER),
    attachments: [],
    mode: "teaser",
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
    uniqueId: `${Date.now()}-casn-intimacion-test`,
    createdBy: CREATED_BY,
    orgId: ORG_ID,
    senderName: SENDER_NAME,
    recipientName: RECIPIENT_NAME,
    recipientEmail: TO_EMAIL,
    recipientPhone: TO_PHONE,
    recipientDni: "25715970",
    recipientLegajo: "T8-F84",
    recipientMonto: "180000",
    recipientCuotas: "4",
    waTemplateName: WA_TEMPLATE,
    waTemplateLang: "es_AR",
    waTemplateVariables: ["nombre", "url_lectura"],
    source: "casn_intimacion_test",
    sourceLabel: "Prueba intimación CASN",
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
  console.log("to", TO_EMAIL, TO_PHONE);
  console.log("template", WA_TEMPLATE);
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
  console.log("whatsappId", cfBody.whatsappId || data.whatsappMessageId || "");
  console.log("whatsappError", cfBody.whatsappError || "");
  console.log("readerUrl", data.readerUrl || "");
  console.log("delivery.state", delivery.state || "");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
