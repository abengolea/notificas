#!/usr/bin/env node
/**
 * Manda un aviso de rebote a processIncomingEmail (el "cable" que Donweb no tiene).
 *
 * 1) Prueba contra un envío ya existente:
 *    node scripts/send-email-bounce.js --mail-id=ID_DEL_MAIL
 *    node scripts/send-email-bounce.js --smtp-id="<message-id@vps>"
 *
 * 2) Pipe en el VPS / cPanel (el correo crudo por stdin):
 *    cat rebote.eml | node scripts/send-email-bounce.js
 *
 * Lee POLYGON_CERTIFY_SECRET de .env.local. No lo imprime.
 */

const path = require("path");
const { config } = require("dotenv");

config({ path: path.join(process.cwd(), ".env.local") });

const DEFAULT_URL =
  "https://us-central1-notificas-f9953.cloudfunctions.net/processIncomingEmail";

function parseArgs(argv) {
  let mailId = "";
  let smtpId = "";
  let reason = "El servidor de destino rechazó el mensaje (prueba)";
  for (const a of argv) {
    if (a.startsWith("--mail-id=")) mailId = a.slice("--mail-id=".length).trim();
    if (a.startsWith("--smtp-id=")) smtpId = a.slice("--smtp-id=".length).trim();
    if (a.startsWith("--reason=")) reason = a.slice("--reason=".length).trim();
    if (a === "--help" || a === "-h") return { help: true };
  }
  return { mailId, smtpId, reason, help: false };
}

function usage() {
  console.log(`Uso:
  node scripts/send-email-bounce.js --mail-id=abc123
  node scripts/send-email-bounce.js --smtp-id="<id@servidor>"
  cat rebote.eml | node scripts/send-email-bounce.js

Necesitás POLYGON_CERTIFY_SECRET en .env.local (el mismo de Secret Manager).`);
}

function syntheticBounce({ mailId, smtpId, reason }) {
  const headerLines = [
    mailId ? `X-Notificas-Mail-Id: ${mailId}` : "",
    smtpId ? `Original-Message-ID: ${smtpId}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    from: "MAILER-DAEMON@vps-1711372-x.dattaweb.com",
    to: "contacto@notificas.com",
    subject: "Undeliverable: Delivery Status Notification",
    text: `This is the mail system at host vps-1711372-x.dattaweb.com.

${reason}

${headerLines}
`,
    ...(mailId ? { mailId } : {}),
    ...(smtpId ? { smtpMessageId: smtpId, messageId: smtpId } : {}),
    reason,
  };
}

async function bounceFromStdin() {
  const raw = await new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => resolve(chunks.join("")));
    process.stdin.on("error", reject);
  });
  if (!raw.trim()) {
    throw new Error("stdin vacío: no hay correo para reenviar");
  }
  const from = (raw.match(/^From:\s*(.+)$/im) || [])[1] || "MAILER-DAEMON@localhost";
  const subject = (raw.match(/^Subject:\s*(.+)$/im) || [])[1] || "Undeliverable";
  return {
    from: from.replace(/[<>]/g, "").trim(),
    to: "contacto@notificas.com",
    subject: subject.trim(),
    text: raw,
  };
}

async function postBounce(payload, secret) {
  const base = (process.env.BOUNCE_WEBHOOK_URL || DEFAULT_URL).replace(/\/$/, "");
  const url = new URL(base);
  url.searchParams.set("token", secret);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Certify-Secret": secret,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { status: res.status, json };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }

  const secret = (process.env.POLYGON_CERTIFY_SECRET || "").trim();
  if (!secret) {
    console.error("Falta POLYGON_CERTIFY_SECRET en .env.local");
    process.exit(1);
  }

  const piped = !process.stdin.isTTY;
  let payload;
  if (args.mailId || args.smtpId) {
    payload = syntheticBounce(args);
  } else if (piped) {
    payload = await bounceFromStdin();
  } else {
    usage();
    process.exit(1);
  }

  const { status, json } = await postBounce(payload, secret);
  console.log("HTTP", status);
  console.log(JSON.stringify(json, null, 2));

  if (status === 401 || status === 403) {
    console.error("Rechazado: el token no coincide o la función no está desplegada con el secreto.");
    process.exit(1);
  }
  if (!json || json.matched === false) {
    console.error("Llegó, pero no se asoció a ningún mail. Pasá --mail-id o --smtp-id del envío real.");
    process.exit(2);
  }
  if (json.bounce || json.ok || json.mailId) {
    console.log("Listo. En el dashboard tiene que decir: Rebotó (no llegó al buzón).");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
