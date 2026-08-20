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

  const subject = "Notificas — restablecé tu contraseña";
  let logoOrigin = "";
  try {
    logoOrigin = new URL(continueUrl).origin;
  } catch {
    logoOrigin = "";
  }
  const logoUrl = logoOrigin ? `${logoOrigin}/notificasLogo.jpg` : "";
  const year = new Date().getFullYear();
  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Restablecé tu contraseña</title>
  <style>
    body, table, td, a { font-family: "Inter", -apple-system, Segoe UI, Roboto, Arial, sans-serif !important; }
    body { margin: 0; padding: 0; background-color: #F8FAFC; color: #1E293B; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #F8FAFC; padding: 24px 0; }
    .container { width: 100%; max-width: 800px; background: #ffffff; margin: 0 auto; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0; }
    .header { background: #0D9488; color: #ffffff; padding: 20px 24px; }
    .badge { display: inline-block; background: #1E3A8A; color: #fff; font-size: 12px; letter-spacing: .4px; padding: 4px 8px; border-radius: 999px; }
    .title { margin: 10px 0 0 0; font-size: 20px; line-height: 1.3; font-weight: 700; }
    .content { padding: 24px; }
    .lead { font-size: 16px; line-height: 1.6; margin: 0 0 16px 0; }
    .btn { display: inline-block; background: #0D9488; color: #ffffff !important; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 700; }
    .muted { color: #64748B; font-size: 12px; line-height: 1.6; }
    .divider { height: 1px; background: #E2E8F0; margin: 20px 0; }
    .footer { padding: 16px 24px 24px; }
  </style>
</head>
<body>
  <table role="presentation" class="wrapper" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" class="container" cellspacing="0" cellpadding="0">
          <tr>
            <td class="header">
              ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Notificas" width="40" height="40" style="display:block;border-radius:8px;border:0;margin-bottom:12px;" />` : ""}
              <span class="badge">CUENTA</span>
              <div class="title">Restablecé tu contraseña</div>
              <div style="margin-top:6px;font-size:13px;opacity:.9;">
                Mensaje automático de <strong>Notificas.com</strong>
              </div>
            </td>
          </tr>
          <tr>
            <td class="content">
              <p class="lead">Hola,</p>
              <p class="lead">Recibimos un pedido para definir o restablecer tu contraseña en Notificas. Usá el botón siguiente para continuar.</p>
              <p class="lead">Después de este paso, ingresá desde:
                <a href="${escapeHref(continueUrl)}" style="color:#0D9488;">${escapeHtml(continueUrl)}</a>
              </p>
              <p style="margin: 20px 0;">
                <a class="btn" href="${escapeHref(link)}" target="_blank" rel="noopener">Restablecer contraseña</a>
              </p>
              <p class="muted">
                Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br>
                <a href="${escapeHref(link)}" target="_blank" rel="noopener" style="color:inherit;">${escapeHtml(link)}</a>
              </p>
              <div class="divider"></div>
              <p class="muted">
                Mensaje automático de Notificas.com. No respondas a este correo; si necesitás ayuda, escribinos a
                <a href="mailto:contacto@notificas.com" style="color:inherit;">contacto@notificas.com</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td class="footer">
              <div class="muted">
                ${year} Notificas.com · Este mensaje fue destinado a ${escapeHtml(email)}.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  const text = `Restablecé tu contraseña en Notificas abriendo este enlace:\n\n${link}\n\nLuego ingresá en: ${continueUrl}\n`;

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

  const secret = (process.env.POLYGON_CERTIFY_SECRET || process.env.CAMPAIGN_WORKER_SECRET || "").trim();
  const cfRes = await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "X-Certify-Secret": secret } : {}),
    },
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
