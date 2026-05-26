#!/usr/bin/env node
/**
 * Exporta perfiles de la colección Firestore `users` a un archivo Excel (.xlsx).
 *
 * Requiere .env.local con credenciales Admin (igual que migrate/repair).
 *
 * Uso:
 *   npm run export:users-excel
 *   npm run export:users-excel -- --legacy-only
 *   npm run export:users-excel -- --output=data/exports/mis-usuarios.xlsx
 */

const fs = require("fs");
const path = require("path");
const { config } = require("dotenv");
const XLSX = require("xlsx");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

config({ path: path.join(process.cwd(), ".env.local") });

function parseArgs(argv) {
  let legacyOnly = false;
  let output = "";
  for (const a of argv) {
    if (a === "--legacy-only") legacyOnly = true;
    if (a.startsWith("--output=")) output = path.resolve(process.cwd(), a.slice("--output=".length));
  }
  if (!output) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const base = legacyOnly ? "usuarios-migrados" : "usuarios-firestore";
    output = path.join(process.cwd(), "data", "exports", `${base}-${stamp}.xlsx`);
  }
  return { legacyOnly, output };
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

  return getFirestore();
}

function cellValue(v) {
  if (v == null) return "";
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return v;
}

async function main() {
  const { legacyOnly, output } = parseArgs(process.argv.slice(2));
  const db = initAdmin();

  console.error(legacyOnly ? "Exportando usuarios con migrationSource=legacy…" : "Exportando todos los users…");

  const snap = await db.collection("users").get();
  const rows = [];

  for (const doc of snap.docs) {
    const d = doc.data() || {};
    if (legacyOnly && d.migrationSource !== "legacy") continue;

    const perfil = typeof d.perfil === "object" && d.perfil ? d.perfil : {};
    rows.push({
      uid: doc.id,
      email: cellValue(d.email),
      nombre: cellValue(perfil.nombre),
      telefono: cellValue(perfil.telefono),
      cuit: cellValue(perfil.cuit),
      tipo: cellValue(d.tipo),
      estado: cellValue(d.estado),
      creditos: typeof d.creditos === "number" ? d.creditos : "",
      migrationSource: cellValue(d.migrationSource),
      legacyUserId: d.legacyUserId != null ? d.legacyUserId : "",
      mustSetPassword: d.mustSetPassword === true ? "sí" : d.mustSetPassword === false ? "no" : "",
      emailVerificadoPerfil: perfil.verificado === true ? "sí" : perfil.verificado === false ? "no" : "",
      createdAt: cellValue(d.createdAt),
      lastLogin: cellValue(d.lastLogin),
    });
  }

  rows.sort((a, b) => String(a.email).localeCompare(String(b.email)));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, legacyOnly ? "Migrados" : "Usuarios");

  const dir = path.dirname(output);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  XLSX.writeFile(wb, output);

  console.log(
    JSON.stringify(
      {
        output,
        totalDocsInFirestore: snap.size,
        exportedRows: rows.length,
        legacyOnly,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
