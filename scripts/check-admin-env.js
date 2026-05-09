#!/usr/bin/env node

/**
 * Comprueba que .env.local define bien las variables del panel /admin.
 * No imprime contraseña ni secreto completos (solo longitud y máscara).
 *
 * Uso: node scripts/check-admin-env.js
 *      npm run check:admin-env
 */

const fs = require("fs");
const path = require("path");

const ADMIN_KEYS = [
  "ADMIN_PANEL_EMAIL",
  "ADMIN_PANEL_PASSWORD",
  "ADMIN_SESSION_SECRET",
];

function parseEnvFile(raw) {
  const map = new Map();
  const lines = raw.split(/\r?\n/);
  const wrongColon = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (/^[A-Za-z_][A-Za-z0-9_]*\s*:/.test(trimmed) && !trimmed.includes("=")) {
      wrongColon.push({ line: i + 1, preview: trimmed.slice(0, 60) });
      continue;
    }

    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }

  return { map, wrongColon };
}

function maskHint(len) {
  if (len <= 0) return "(vacío)";
  if (len <= 4) return `••• (${len} caracteres)`;
  return `•••••• (${len} caracteres)`;
}

function looksLikeEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function main() {
  const envPath = path.join(process.cwd(), ".env.local");

  console.log("Panel admin — chequeo de .env.local\n");
  console.log(`Archivo: ${envPath}\n`);

  if (!fs.existsSync(envPath)) {
    console.error("❌ No existe .env.local en la raíz del proyecto.");
    console.error("   Copiá .env.example → .env.local y completá los valores.\n");
    process.exit(1);
  }

  let raw;
  try {
    raw = fs.readFileSync(envPath, "utf8");
  } catch (e) {
    console.error("❌ No se pudo leer .env.local:", e.message);
    process.exit(1);
  }

  const { map, wrongColon } = parseEnvFile(raw);

  if (wrongColon.length > 0) {
    console.warn("⚠️  Líneas con sintaxis incorrecta (usá KEY=valor, no KEY:valor):\n");
    wrongColon.forEach(({ line, preview }) =>
      console.warn(`   Línea ${line}: ${preview}${preview.length >= 60 ? "…" : ""}`),
    );
    console.warn("");
  }

  let ok = true;
  const issues = [];

  for (const key of ADMIN_KEYS) {
    const val = map.get(key);
    if (val === undefined) {
      console.log(`❌ ${key}: no definida`);
      ok = false;
      continue;
    }
    const trimmed = val.trim();
    if (!trimmed) {
      console.log(`❌ ${key}: definida pero vacía`);
      ok = false;
      continue;
    }

    if (key === "ADMIN_PANEL_EMAIL") {
      const email = trimmed.toLowerCase();
      if (!looksLikeEmail(email)) {
        console.log(`⚠️  ${key}: parece inválido → "${email}"`);
        issues.push("email formato dudoso");
      } else {
        console.log(`✅ ${key}: ${email}`);
      }
    } else if (key === "ADMIN_PANEL_PASSWORD") {
      console.log(`✅ ${key}: ${maskHint(trimmed.length)}`);
      if (trimmed.length < 8) {
        console.log(`   ⚠️  Muy corta (< 8). Mejor una contraseña más fuerte en local.`);
      }
    } else if (key === "ADMIN_SESSION_SECRET") {
      console.log(`✅ ${key}: ${maskHint(trimmed.length)}`);
      if (trimmed.length < 16) {
        console.log(`   ⚠️  Secreto corto. Preferí algo tipo: openssl rand -hex 32`);
      }
    }
  }

  const dupKeys = ADMIN_KEYS.filter((k) => {
    return (
      raw.split("\n").filter((l) => {
        const t = l.trim();
        return t.startsWith(`${k}=`) && !t.startsWith("#");
      }).length > 1
    );
  });
  if (dupKeys.length > 0) {
    console.warn(`\n⚠️  Claves repetidas en el archivo (gana la última): ${dupKeys.join(", ")}`);
  }

  console.log("");

  if (!ok) {
    console.log("Referencia (.env.example):\n");
    console.log("  ADMIN_PANEL_EMAIL=admin@ejemplo.com");
    console.log("  ADMIN_PANEL_PASSWORD=...");
    console.log("  ADMIN_SESSION_SECRET=...\n");
    process.exit(1);
  }

  if (issues.length) {
    console.log("Revisá los avisos arriba.\n");
    process.exit(0);
  }

  console.log("Todo listo para el panel /admin (reiniciá npm run dev si cambiaste el archivo).\n");
  process.exit(0);
}

main();
