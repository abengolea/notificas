#!/usr/bin/env node
/**
 * Convierte saldos mal importados (créditos legacy ×200 por envío) a cantidad de envíos.
 *
 * Regla: si `creditos` > umbral (default 30), nuevo saldo = ceil(creditos / divisor), mínimo 1.
 * Ej.: 20000 → 100, 650 → 4 (3,25 redondea arriba), 150 → 1.
 *
 * Requiere .env.local con credenciales Admin (igual que migrate/export).
 *
 * Uso:
 *   npm run migrate:creditos-to-envios -- --dry-run
 *   npm run migrate:creditos-to-envios -- --limit=1
 *   npm run migrate:creditos-to-envios
 *   npm run migrate:creditos-to-envios -- --min=31 --divisor=200
 *   npm run migrate:creditos-to-envios -- --legacy-only
 */

const fs = require("fs");
const path = require("path");
const { config } = require("dotenv");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

config({ path: path.join(process.cwd(), ".env.local") });

const DEFAULT_MIN = 31;
const DEFAULT_DIVISOR = 200;
const BATCH_SIZE = 400;

function parseArgs(argv) {
  let dryRun = false;
  let legacyOnly = false;
  let min = DEFAULT_MIN;
  let divisor = DEFAULT_DIVISOR;
  let limit = 0;
  let output = "";

  for (const a of argv) {
    if (a === "--dry-run") dryRun = true;
    if (a === "--legacy-only") legacyOnly = true;
    if (a.startsWith("--min=")) min = Number(a.slice("--min=".length));
    if (a.startsWith("--divisor=")) divisor = Number(a.slice("--divisor=".length));
    if (a.startsWith("--limit=")) limit = Number(a.slice("--limit=".length));
    if (a.startsWith("--output=")) output = path.resolve(process.cwd(), a.slice("--output=".length));
  }

  if (!Number.isFinite(min) || min < 0) {
    console.error("--min debe ser un número >= 0");
    process.exit(1);
  }
  if (!Number.isFinite(divisor) || divisor <= 0) {
    console.error("--divisor debe ser un número > 0");
    process.exit(1);
  }

  if (!output) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    output = path.join(process.cwd(), "data", "exports", `creditos-to-envios-${stamp}.json`);
  }

  if (limit !== 0 && (!Number.isFinite(limit) || limit < 1)) {
    console.error("--limit debe ser un entero >= 1");
    process.exit(1);
  }

  return { dryRun, legacyOnly, min, divisor, limit, output };
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

function toEnvios(creditos, divisor) {
  return Math.max(1, Math.ceil(creditos / divisor));
}

async function main() {
  const { dryRun, legacyOnly, min, divisor, limit, output } = parseArgs(process.argv.slice(2));
  const db = initAdmin();

  console.error(
    dryRun ? "[DRY-RUN] " : "",
    `Conversión créditos→envíos: creditos > ${min - 1} → ceil(creditos / ${divisor}), mín. 1`,
    legacyOnly ? "(solo migrationSource=legacy)" : "",
    limit > 0 ? `(máx. ${limit} usuario(s))` : "",
  );

  const snap = await db.collection("users").get();
  const planned = [];

  for (const doc of snap.docs) {
    const d = doc.data() || {};
    if (legacyOnly && d.migrationSource !== "legacy") continue;

    const prev =
      typeof d.creditos === "number" && Number.isFinite(d.creditos) ? Math.floor(d.creditos) : 0;
    if (prev < min) continue;

    const next = toEnvios(prev, divisor);
    if (next === prev) continue;

    planned.push({
      uid: doc.id,
      email: d.email || "",
      nombre: d.nombre || d.displayName || "",
      antes: prev,
      despues: next,
    });
  }

  planned.sort((a, b) => b.antes - a.antes);

  const totalEligible = planned.length;
  const toApply = limit > 0 ? planned.slice(0, limit) : planned;

  console.error(
    `Usuarios a actualizar: ${toApply.length}${limit > 0 ? ` (prueba, de ${totalEligible} elegibles)` : ""} (de ${snap.size} en users)`,
  );

  if (toApply.length === 0) {
    console.error("Nada que hacer.");
    return;
  }

  const preview = toApply.slice(0, 15);
  for (const row of preview) {
    console.error(`  ${row.email || row.uid}: ${row.antes} → ${row.despues}`);
  }
  if (toApply.length > preview.length) {
    console.error(`  … y ${toApply.length - preview.length} más`);
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(
    output,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        dryRun,
        min,
        divisor,
        limit: limit || null,
        eligibleCount: totalEligible,
        count: toApply.length,
        rows: toApply,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.error(`Reporte: ${output}`);

  if (dryRun) {
    console.error("Ejecutá sin --dry-run para aplicar los cambios.");
    return;
  }

  let updated = 0;
  for (let i = 0; i < toApply.length; i += BATCH_SIZE) {
    const chunk = toApply.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const row of chunk) {
      const ref = db.collection("users").doc(row.uid);
      batch.update(ref, {
        creditos: row.despues,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    updated += chunk.length;
    console.error(`  batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} usuarios`);
  }

  for (const row of toApply) {
    await db.collection("user_transactions").add({
      userId: row.uid,
      tipo: "ajuste",
      descripcion: `Migración créditos→envíos (÷${divisor}, redondeo arriba): ${row.antes} → ${row.despues}`,
      creditos: row.despues - row.antes,
      monto: 0,
      fecha: FieldValue.serverTimestamp(),
    });
  }

  console.error(`Listo. ${updated} usuarios actualizados, ${toApply.length} movimientos en user_transactions.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
