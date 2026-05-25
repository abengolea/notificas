#!/usr/bin/env node
/**
 * Genera un enlace de restablecimiento de contraseña (Firebase Auth) y opcionalmente
 * lo envía por correo usando la colección `mail` + Cloud Function sendEmail (igual que contacto).
 *
 * Requiere .env.local con credenciales Admin (como export:users-excel / migrate).
 * La URL de continuación debe estar en Authentication → Authorized domains.
 *
 * Uso:
 *   node scripts/send-password-reset-link.js
 *   node scripts/send-password-reset-link.js --email=otro@dominio.com
 *   node scripts/send-password-reset-link.js --continue-url=https://tu-dominio.com/login
 *   node scripts/send-password-reset-link.js --print-only
 *
 * Variables útiles:
 *   NEXT_PUBLIC_APP_URL  → URL base para /login si no pasás --continue-url
 *   FIREBASE_SENDEMAIL_URL → override de la función sendEmail (opcional)
 */

const path = require("path");
const { config } = require("dotenv");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

config({ path: path.join(process.cwd(), ".env.local") });

const DEFAULT_SENDEMAIL_URL = "https://sendemail-ju7n3yysfq-uc.a.run.app";
const DEFAULT_FROM = "contacto@notificas.com";

function parseArgs(argv) {
  let email = "abengolea@hotmail.com";
  let continueUrl = "";
  let printOnly = false;
  for (const a of argv) {
    if (a.startsWith("--email=")) email = a.slice("--email=".length).trim().toLowerCase();
    if (a.startsWith("--continue-url=")) continueUrl = a.slice("--continue-url=".length).trim();
    if (a === "--print-only" || a === "--no-send") printOnly = true;
  }
  if (!continueUrl) {
    const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    continueUrl = base ? `${base}/login` : "";
  }
  return { email, continueUrl, printOnly };
}

function initAdmin() {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "Faltan FIREBASE_PROJECT_ID (o NEXT_PUBLIC), FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY en .env.local",
    );
    process.exit(1);
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

  return { auth: getAuth(), db: getFirestore() };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHref(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

async function main() {
  const { email, continueUrl, printOnly } = parseArgs(process.argv.slice(2));

  if (!continueUrl) {
    console.error(
      "Definí la URL de continuación: variable NEXT_PUBLIC_APP_URL en .env.local o flag --continue-url=https://.../login",
    );
    process.exit(1);
  }

  const { auth, db } = initAdmin();

  let link;
  try {
    link = await auth.generatePasswordResetLink(email, {
      url: continueUrl,
      handleCodeInApp: false,
    });
  } catch (e) {
    console.error("generatePasswordResetLink falló:", e?.message || e);
    if (String(e?.message || "").includes("USER_NOT_FOUND") || e?.code === "auth/user-not-found") {
      console.error(`No existe usuario en Firebase Auth con el email: ${email}`);
    }
    process.exit(1);
  }

  console.log("\n--- Enlace (copiar si hace falta) ---\n");
  console.log(link);
  console.log("\n-------------------------------------\n");

  if (printOnly) {
    console.log("Modo --print-only: no se creó documento ni se llamó a sendEmail.");
    return;
  }

  const mailRef = db.collection("mail").doc();
  const mailId = mailRef.id;
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const from = (process.env.DEFAULT_CONTACT_FROM_EMAIL || DEFAULT_FROM).trim();

  const subject = "Notificas — enlace para definir tu contraseña";
  const html = `
<p>Hola,</p>
<p>Podés definir o restablecer tu contraseña en la nueva Notificas usando este enlace:</p>
<p><a href="${escapeHref(link)}">Abrir enlace de contraseña</a></p>
<p>Si el botón no funciona, copiá y pegá esta dirección en el navegador:</p>
<pre style="white-space:pre-wrap;word-break:break-all">${escapeHtml(link)}</pre>
<p style="color:#666;font-size:12px">Enviado por script interno (send-password-reset-link.js).</p>
`.trim();
  const text = `Definí tu contraseña en Notificas abriendo este enlace:\n\n${link}\n`;

  await mailRef.set({
    to: [email],
    message: { subject, html, text },
    createdAt: FieldValue.serverTimestamp(),
    timestamp: new Date().toISOString(),
    uniqueId,
    createdBy: "script:send-password-reset-link",
    from,
    contactRequest: true,
  });

  const fnUrl = (process.env.FIREBASE_SENDEMAIL_URL || DEFAULT_SENDEMAIL_URL).replace(/\/$/, "");
  console.log(`Llamando sendEmail (${fnUrl}) con docId=${mailId} …`);

  const cfRes = await fetch(fnUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ docId: mailId }),
  });

  const cfBody = await cfRes.json().catch(() => ({}));
  if (!cfRes.ok) {
    console.error("sendEmail respondió error:", cfRes.status, cfBody);
    process.exit(1);
  }

  console.log("Listo:", cfBody);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
