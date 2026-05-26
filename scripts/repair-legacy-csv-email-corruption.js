#!/usr/bin/env node
/**
 * Repara emails y nombres duplicados causados por el bug de normalizeEmail en importaciones
 * anteriores (local+local@dom+dom). Re-alinea Firebase Auth + Firestore `users/{uid}` con el CSV
 * original, emparejando por `legacyUserId`.
 *
 * Uso:
 *   npm run repair:legacy-csv-corruption
 *   npm run repair:legacy-csv-corruption -- --dry-run
 *   npm run repair:legacy-csv-corruption -- --file=C:\\ruta\\usuarios.csv
 */

const path = require("path");
const { config } = require("dotenv");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const {
  readLegacyCsvRows,
  buildLegacyDisplayName,
  isPlausibleEmail,
} = require("./lib/legacy-migration-csv");

config({ path: path.join(process.cwd(), ".env.local") });

const LEGACY_SOURCE = "legacy";

function parseArgs(argv) {
  let file = path.join(process.cwd(), "data", "migrations", "legacy-users.csv");
  let dryRun = false;
  for (const a of argv) {
    if (a === "--dry-run") dryRun = true;
    if (a.startsWith("--file=")) file = path.resolve(process.cwd(), a.slice("--file=".length));
  }
  return { file, dryRun };
}

function initAdmin() {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "Faltan credenciales Admin en .env.local (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).",
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

  return { db: getFirestore(), auth: getAuth() };
}

async function main() {
  const { file, dryRun } = parseArgs(process.argv.slice(2));
  const fs = require("fs");
  if (!fs.existsSync(file)) {
    console.error(`No existe el archivo: ${file}`);
    process.exit(1);
  }

  const rows = readLegacyCsvRows(file);
  let fixed = 0;
  let alreadyOk = 0;
  let skippedNoUid = 0;
  let skippedBadCsvEmail = 0;
  let skippedNotLegacy = 0;
  let skippedAmbiguous = 0;
  let authErrors = 0;
  const authErrorSamples = [];

  const { db, auth } = initAdmin();

  if (dryRun) {
    console.error(`Dry-run: ${rows.length} filas CSV; se consulta Firebase pero no se escribe.`);
  } else {
    console.error(`Reparación: ${rows.length} filas CSV…`);
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (i > 0 && i % 50 === 0) {
      console.error(
        `${dryRun ? "Dry-run reparación" : "Reparación"}: ${i}/${rows.length} filas procesadas…`,
      );
    }
    if (row.legacyUserId == null) continue;
    if (!isPlausibleEmail(row.email)) {
      skippedBadCsvEmail++;
      continue;
    }

    const correctEmail = row.email;
    const correctName = buildLegacyDisplayName(row.firstname, row.lastname, correctEmail);

    const snap = await db
      .collection("users")
      .where("legacyUserId", "==", row.legacyUserId)
      .limit(5)
      .get();

    if (snap.empty) {
      skippedNoUid++;
      continue;
    }
    if (snap.size > 1) {
      skippedAmbiguous++;
      continue;
    }

    const doc = snap.docs[0];
    const uid = doc.id;
    const d = doc.data() || {};

    if (d.migrationSource !== LEGACY_SOURCE) {
      skippedNotLegacy++;
      continue;
    }

    const curEmail = typeof d.email === "string" ? d.email.trim().toLowerCase() : "";
    const curNombre =
      typeof d.perfil?.nombre === "string" ? d.perfil.nombre.trim() : "";

    const needEmail = curEmail !== correctEmail;
    const needNombre = curNombre !== correctName;

    if (!needEmail && !needNombre) {
      alreadyOk++;
      continue;
    }

    if (dryRun) {
      fixed++;
      continue;
    }

    try {
      if (needEmail || needNombre) {
        await auth.updateUser(uid, {
          ...(needEmail ? { email: correctEmail } : {}),
          ...(needNombre ? { displayName: correctName } : {}),
        });
      }

      await doc.ref.set(
        {
          email: correctEmail,
          perfil: {
            ...(typeof d.perfil === "object" && d.perfil ? d.perfil : {}),
            nombre: correctName,
          },
        },
        { merge: true },
      );

      fixed++;
    } catch (e) {
      authErrors++;
      if (authErrorSamples.length < 8) {
        authErrorSamples.push({
          legacyUserId: row.legacyUserId,
          message: e?.message ?? String(e),
        });
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        file,
        dryRun,
        csvRows: rows.length,
        repaired: fixed,
        alreadyOk,
        skippedNoFirestoreMatch: skippedNoUid,
        skippedBadCsvEmail,
        skippedNotLegacy,
        skippedAmbiguousQuery: skippedAmbiguous,
        authUpdateErrors: authErrors,
        authErrorSamples,
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
