#!/usr/bin/env node

/**
 * Chequeo de variables de entorno para Notificas (local vía .env.local).
 *
 * Replica lo crítico de App Hosting: Firebase público/admin, NEXT_PUBLIC_APP_URL
 * bien formado (Mercado Pago back_urls), token MP presente.
 *
 * No imprime secretos ni tokens enteros — solo estado y mascarillas.
 *
 * Uso:
 *   npm run check:app-env
 *   node scripts/check-app-env.js
 *   node scripts/check-app-env.js --for-prod --file .env.production.local
 */

const fs = require("fs");
const path = require("path");

const dotenvPath = resolveArg("--file") || ".env.local";
const forProd = process.argv.includes("--for-prod");

function resolveArg(name) {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, "") : "";
}

/** @typedef {{ key: string, required?: boolean, label?: string, url?: boolean }} Entry */

/** @type {Entry[]} */
const FIREBASE_PUBLIC = [
  { key: "NEXT_PUBLIC_FIREBASE_API_KEY", required: true },
  { key: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", required: true },
  { key: "NEXT_PUBLIC_FIREBASE_PROJECT_ID", required: true },
  { key: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", required: true },
  { key: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", required: true },
  { key: "NEXT_PUBLIC_FIREBASE_APP_ID", required: true },
  { key: "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID", required: false },
  { key: "NEXT_PUBLIC_APP_URL", required: true, url: true },
];

/** @type {Entry[]} */
const FIREBASE_ADMIN = [
  { key: "FIREBASE_PROJECT_ID", required: true },
  { key: "FIREBASE_CLIENT_EMAIL", required: true },
  { key: "FIREBASE_PRIVATE_KEY", required: true },
];

/** @type {Entry[]} */
const MERCADOPAGO = [{ key: "MERCADOPAGO_ACCESS_TOKEN", required: true }];

/** Opcionales documentados (solo avisos si malformed cuando están definidos) */
const OPTIONAL_URLS = [
  { key: "MERCADOPAGO_NOTIFICATION_URL", url: true },
  { key: "MERCADOPAGO_WEBHOOK_PUBLIC_BASE_URL", url: true },
];

/** @type {Entry[]} */
const ADMIN_OPTIONAL = [
  { key: "ADMIN_PANEL_EMAIL", required: false },
  { key: "ADMIN_PANEL_PASSWORD", required: false },
  { key: "ADMIN_SESSION_SECRET", required: false },
];

function maskLen(n) {
  if (n <= 0) return "(vacío)";
  return `presente (${n} caracteres)`;
}

/** @returns {string | null} */
function formatIssue(value, opts) {
  const { skipTrimCheck, skipNewlineCheck, urlLike } = opts;
  if (value === undefined) return null;
  if (typeof value !== "string") return "no es texto";
  if (!skipTrimCheck && value.trim() !== value) {
    return "tiene espacios al inicio o al final (revisá consola Firebase / pegado desde Excel)";
  }
  if (!skipNewlineCheck && /[\r\n]/.test(value)) {
    if (urlLike) return "tiene saltos de línea; las URLs tienen que ser una sola línea";
    if (!value.includes("BEGIN PRIVATE KEY")) return "tiene saltos de línea inesperados";
  }
  return null;
}

/** @returns {string | null} */
function validateUrl(value) {
  try {
    const u = new URL(value);
    if (forProd && u.protocol !== "https:") {
      return `en modo --for-prod debe ser HTTPS (actual: ${u.protocol})`;
    }
    if (!forProd && u.protocol !== "https:" && u.protocol !== "http:") {
      return `usa http:// o https:// (actual: ${u.protocol})`;
    }
    return null;
  } catch {
    return "no es una URL válida";
  }
}

function checkGroup(title, defs, vars) {
  console.log(`${title}`);
  console.log(`${"=".repeat(title.length)}\n`);

  let bad = false;
  for (const def of defs) {
    const raw = vars.get(def.key);
    const present = raw !== undefined && String(raw).length > 0;

    const skipNl = def.key === "FIREBASE_PRIVATE_KEY";
    const skipTrim = def.key === "FIREBASE_PRIVATE_KEY";

    if (!present) {
      if (def.required) {
        console.log(`  ❌ ${def.key}: ausente`);
        bad = true;
      } else {
        console.log(`  ○  ${def.key}: no definido (opcional)`);
      }
      continue;
    }

    const v = String(raw);

    let issue = formatIssue(v, {
      skipTrimCheck: skipTrim,
      skipNewlineCheck: skipNl,
      urlLike: !!def.url,
    });
    if (
      issue === null &&
      def.key === "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" &&
      !v.includes("firebase") &&
      !v.includes(".")
    ) {
      issue = `no parece un auth domain válido (esperás algo tipo project.firebaseapp.com)`;
    }
    if (!issue && def.url) issue = validateUrl(v.trim());

    const display =
      def.key.includes("PASSWORD") ||
      def.key.includes("PRIVATE_KEY") ||
      def.key.includes("TOKEN") ||
      def.key.includes("SECRET") ||
      def.key.includes("API_KEY") ||
      def.key === "FIREBASE_CLIENT_EMAIL"
        ? maskLen(v.length)
        : v.length > 64
          ? `${v.trim().slice(0, 24)}… (${v.length} chars)`
          : v.trim();

    if (issue) {
      console.log(`  ❌ ${def.key}: ${issue}`);
      if (!def.key.includes("PRIVATE_KEY")) console.log(`     valor (recortado para debug): ${display}`);
      bad = true;
    } else {
      console.log(`  ✅ ${def.key}: ${display}`);
    }
  }
  console.log("");
  return bad;
}

function main() {
  const envAbs = path.join(process.cwd(), dotenvPath);
  console.log("Notificas — chequeo de entorno (local)");
  console.log(`Archivo: ${envAbs}${forProd ? "  (--for-prod: exige https en URL pública)\n" : "\n"}`);

  if (!fs.existsSync(envAbs)) {
    console.error(`❌ No existe ${dotenvPath}. Copiá .env.example → .env.local y completalo.\n`);
    process.exit(1);
  }

  let vars;
  try {
    const buf = fs.readFileSync(envAbs, "utf8");
    const wrongColon = buf
      .split(/\r?\n/)
      .map((line, i) => ({ line: i + 1, raw: line.trim() }))
      .filter(({ raw }) => raw && !raw.startsWith("#") && /^[A-Za-z_][A-Za-z0-9_]*\s*:/.test(raw) && !raw.includes("="));

    if (wrongColon.length) {
      console.warn("⚠️  Sintaxis KEY:valor sin = (dotenv estándar usa KEY=valor):\n");
      wrongColon.slice(0, 8).forEach(({ line, raw }) =>
        console.warn(`   línea ${line}: ${raw.slice(0, 70)}`),
      );
      if (wrongColon.length > 8) console.warn(`   … (${wrongColon.length} líneas)\n`);
      else console.warn("");
    }

    const dotenv = require("dotenv");
    vars = new Map(Object.entries(dotenv.parse(buf)));
  } catch (e) {
    console.error("❌ Error leyendo/parsing:", e.message);
    process.exit(1);
  }

  let fatal = false;
  if (checkGroup("Firebase público (NEXT_PUBLIC_*)", FIREBASE_PUBLIC, vars)) fatal = true;
  if (checkGroup("Firebase Admin (servidor)", FIREBASE_ADMIN, vars)) fatal = true;
  if (checkGroup("Mercado Pago", MERCADOPAGO, vars)) fatal = true;

  console.log(`Opcional — URLs MP / Hub (si están definidas, deben ser una línea válida)`);
  console.log(`===============================================================================\n`);
  for (const def of OPTIONAL_URLS) {
    const raw = vars.get(def.key);
    if (!raw) {
      console.log(`  ○  ${def.key}: no definido`);
      continue;
    }
    const v = String(raw);
    const issue =
      formatIssue(v, { urlLike: true }) || validateUrl(v.trim());
    if (issue) {
      console.log(`  ❌ ${def.key}: ${issue}`);
      fatal = true;
    } else {
      console.log(`  ✅ ${def.key}`);
    }
  }
  console.log("");

  checkGroup("Admin (opcional para este chequeo)", ADMIN_OPTIONAL, vars);

  if (fatal) {
    console.log("Corrige los errores arriba. En Firebase App Hosting debe ser igual: una línea por valor.");
    console.log("Referencia: apphosting.yaml y .env.example\n");
    process.exit(1);
  }

  console.log("Listo ✓ Reiniciá el dev server si modificaste el archivo.");
  console.log("(En GCP la consola no la lee este script; repetí estos criterios a mano.)\n");
  process.exit(0);
}

main();
