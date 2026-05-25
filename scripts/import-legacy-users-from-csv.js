#!/usr/bin/env node
/**
 * Importa usuarios legacy (CSV) a Firebase Auth + Firestore `users/{uid}`.
 * Idempotente por email normalizado: si ya existe Auth, actualiza Firestore (merge).
 *
 * Requisitos: mismas variables que `.env.local` (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).
 *
 * Uso:
 *   npm run migrate:legacy-users
 *   npm run migrate:legacy-users -- --file=./mi-lista.csv
 *   npm run migrate:legacy-users -- --dry-run
 *
 * Por defecto lee: ./data/migrations/legacy-users.csv
 * Copiá ahí el export (cabecera: id,email,firstname,lastname,phonenumber,creditos_en_haber,cantidad_comprobantes).
 */

const fs = require("fs");
const path = require("path");
const { config } = require("dotenv");
const { randomBytes } = require("crypto");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

config({ path: path.join(process.cwd(), ".env.local") });

const {
  readLegacyCsvRows,
  buildLegacyDisplayName,
  isPlausibleEmail,
} = require("./lib/legacy-migration-csv");

const LEGACY_SOURCE = "legacy";

function parseArgs(argv) {
  let file = path.join(process.cwd(), "data", "migrations", "legacy-users.csv");
  let dryRun = false;
  let syncCredits = true;
  for (const a of argv) {
    if (a === "--dry-run") dryRun = true;
    if (a.startsWith("--file=")) file = path.resolve(process.cwd(), a.slice("--file=".length));
    if (a === "--no-sync-credits") syncCredits = false;
  }
  return { file, dryRun, syncCredits };
}

function guessTipo(fullName) {
  const n = (fullName || "").toUpperCase();
  if (
    /S\.?\s*R\.?\s*L\.?|S\.?\s*A\.?\s*I\.?\s*C\.?|\bS\.?\s*A\.?\b|FUNDACI[ÓO]N|ASOCIACI[ÓO]N|CONSORCIO/i.test(
      n,
    )
  ) {
    return "empresa";
  }
  return "individual";
}

function normalizePhone(raw) {
  const s = String(raw || "").replace(/[^\d+]/g, "").trim();
  if (s.length >= 8) return s.slice(0, 40);
  return "00000000";
}

function randomPassword() {
  return randomBytes(24).toString("hex");
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
  const { file: fileArg, dryRun, syncCredits } = parseArgs(process.argv.slice(2));
  const defaultCsv = path.join(process.cwd(), "data", "migrations", "legacy-users.csv");
  const exampleCsv = path.join(process.cwd(), "data", "migrations", "legacy-users.example.csv");

  let file = fileArg;
  if (!fs.existsSync(file)) {
    if (dryRun && file === defaultCsv && fs.existsSync(exampleCsv)) {
      console.warn(
        "Aviso: no existe data/migrations/legacy-users.csv — dry-run usando legacy-users.example.csv",
      );
      file = exampleCsv;
    } else {
      console.error(`No existe el archivo: ${file}`);
      console.error(
        "Copiá tu export como data/migrations/legacy-users.csv, o indicá la ruta: --file=.\\ruta\\lista.csv",
      );
      if (fs.existsSync(exampleCsv)) {
        console.error(`Ejemplo (PowerShell): Copy-Item "${exampleCsv}" "${defaultCsv}"`);
      }
      process.exit(1);
    }
  }

  const { db, auth } = dryRun ? { db: null, auth: null } : initAdmin();

  const rows = readLegacyCsvRows(file);
  if (!dryRun) {
    console.error(`Migración: ${rows.length} filas; esto puede tardar varios minutos (sin salida entre medias hasta el resumen)…`);
  }

  let authCreated = 0;
  let firestoreCreated = 0;
  let firestoreMerged = 0;
  let skipped = 0;
  const skipReasons = {
    invalid_email: 0,
    duplicate_email_row: 0,
    native_account_conflict: 0,
  };

  const seen = new Set();

  function isNativeFirestoreDoc(d) {
    return d?.migrationSource !== LEGACY_SOURCE && d?.legacyUserId == null;
  }

  for (const row of rows) {
    if (!row.email) {
      skipped++;
      skipReasons.invalid_email++;
      continue;
    }
    if (!isPlausibleEmail(row.email)) {
      skipped++;
      skipReasons.invalid_email++;
      continue;
    }
    if (seen.has(row.email)) {
      skipped++;
      skipReasons.duplicate_email_row++;
      continue;
    }
    seen.add(row.email);

    if (!dryRun && (seen.size === 1 || seen.size % 25 === 0)) {
      console.error(`Migración: ${seen.size}/${rows.length} emails en curso…`);
    }

    const displayName = buildLegacyDisplayName(row.firstname, row.lastname, row.email);
    const tipo = guessTipo(displayName);
    const telefono = normalizePhone(row.phonenumber);
    const cuitPlaceholder = "00-00000000-0";

    const firestorePayload = {
      uid: null,
      email: row.email,
      tipo,
      perfil: {
        nombre: displayName,
        cuit: cuitPlaceholder,
        telefono,
        verificado: true,
      },
      creditos: row.creditos,
      estado: "activo",
      createdAt: FieldValue.serverTimestamp(),
      lastLogin: FieldValue.serverTimestamp(),
      migrationSource: LEGACY_SOURCE,
      legacyUserId: row.legacyUserId,
      mustSetPassword: true,
      passwordSetAt: null,
      legacyCantidadComprobantes: row.cantidadComprobantes,
    };

    if (dryRun) {
      continue;
    }

    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(row.email);
    } catch (e) {
      if (e?.code !== "auth/user-not-found") {
        console.error(`Error Auth línea ${row.line}:`, e?.message ?? e);
        process.exit(1);
      }
      userRecord = await auth.createUser({
        email: row.email,
        password: randomPassword(),
        displayName,
        emailVerified: true,
        disabled: false,
      });
      authCreated++;
    }

    const uid = userRecord.uid;
    const userRef = db.collection("users").doc(uid);
    const existing = await userRef.get();

    if (existing.exists) {
      const d = existing.data() || {};
      if (isNativeFirestoreDoc(d)) {
        skipped++;
        skipReasons.native_account_conflict++;
        continue;
      }

      const alreadyCompleted =
        d.migrationSource === LEGACY_SOURCE && d.mustSetPassword === false;

      if (alreadyCompleted) {
        if (syncCredits) {
          await userRef.set(
            {
              creditos: row.creditos,
              legacyCantidadComprobantes: row.cantidadComprobantes,
            },
            { merge: true },
          );
        }
        firestoreMerged++;
        continue;
      }

      const merge = {
        uid,
        email: row.email,
        tipo,
        perfil: {
          nombre: displayName,
          cuit: cuitPlaceholder,
          telefono,
          verificado: true,
        },
        estado: "activo",
        migrationSource: LEGACY_SOURCE,
        legacyUserId: row.legacyUserId == null ? FieldValue.delete() : row.legacyUserId,
        mustSetPassword: true,
        passwordSetAt: null,
        legacyCantidadComprobantes: row.cantidadComprobantes,
      };
      if (syncCredits) merge.creditos = row.creditos;
      await userRef.set(merge, { merge: true });
      firestoreMerged++;
      continue;
    }

    const payload = {
      ...firestorePayload,
      uid,
      creditos: row.creditos,
    };
    await userRef.set(payload);
    firestoreCreated++;
  }

  if (dryRun) {
    console.log(`Dry-run: ${seen.size} filas válidas (sin escribir en Firebase).`);
    process.exit(0);
  }

  console.log(
    JSON.stringify(
      {
        file,
        authUsersCreated: authCreated,
        firestoreCreated,
        firestoreMerged,
        skipped,
        skipReasons,
        note: "Contraseña: los usuarios deben usar «Olvidé mi contraseña» o la página de activación migrada.",
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
