#!/usr/bin/env node
/**
 * Pone en 0 todos los saldos `creditos` negativos en users.
 *
 * Uso:
 *   npm run migrate:clamp-negative-creditos -- --dry-run
 *   npm run migrate:clamp-negative-creditos
 */

const fs = require("fs");
const path = require("path");
const { config } = require("dotenv");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

config({ path: path.join(process.cwd(), ".env.local") });

const BATCH_SIZE = 400;

function parseArgs(argv) {
  let dryRun = false;
  let output = "";

  for (const a of argv) {
    if (a === "--dry-run") dryRun = true;
    if (a.startsWith("--output=")) output = path.resolve(process.cwd(), a.slice("--output=".length));
  }

  if (!output) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    output = path.join(process.cwd(), "data", "exports", `clamp-negative-creditos-${stamp}.json`);
  }

  return { dryRun, output };
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

async function main() {
  const { dryRun, output } = parseArgs(process.argv.slice(2));
  const db = initAdmin();

  console.error(dryRun ? "[DRY-RUN] " : "", "Ajuste saldos negativos → 0 en users.creditos");

  const snap = await db.collection("users").get();
  const planned = [];

  for (const doc of snap.docs) {
    const d = doc.data() || {};
    const prev =
      typeof d.creditos === "number" && Number.isFinite(d.creditos) ? Math.floor(d.creditos) : 0;
    if (prev >= 0) continue;

    planned.push({
      uid: doc.id,
      email: d.email || "",
      antes: prev,
      despues: 0,
    });
  }

  planned.sort((a, b) => a.antes - b.antes);

  console.error(`Usuarios con saldo negativo: ${planned.length} (de ${snap.size} en users)`);

  if (planned.length === 0) {
    console.error("Nada que hacer.");
    return;
  }

  for (const row of planned.slice(0, 20)) {
    console.error(`  ${row.email || row.uid}: ${row.antes} → 0`);
  }
  if (planned.length > 20) {
    console.error(`  … y ${planned.length - 20} más`);
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(
    output,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        dryRun,
        count: planned.length,
        rows: planned,
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
  for (let i = 0; i < planned.length; i += BATCH_SIZE) {
    const chunk = planned.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const row of chunk) {
      batch.update(db.collection("users").doc(row.uid), {
        creditos: 0,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    updated += chunk.length;
    console.error(`  batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} usuarios`);
  }

  for (const row of planned) {
    await db.collection("user_transactions").add({
      userId: row.uid,
      tipo: "ajuste",
      descripcion: `Ajuste saldo negativo → 0: ${row.antes} → 0`,
      creditos: -row.antes,
      monto: 0,
      fecha: FieldValue.serverTimestamp(),
    });
  }

  console.error(`Listo. ${updated} usuarios actualizados.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
