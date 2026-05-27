#!/usr/bin/env node
/**
 * Vincula un colegio de Notificas con su documento en LegalMev (legalmevColegioId).
 * Uso:
 *   node scripts/link-colegio-legalmev.js
 *   node scripts/link-colegio-legalmev.js --nombre "San Nicol"
 *
 * Requiere en .env.local de Notificas: LEGALMEV_URL, NOTIFICAS_LEGALMEV_SHARED_SECRET
 */

const path = require("path");
const { config } = require("dotenv");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

config({ path: path.join(process.cwd(), ".env.local") });

function initNotificasAdmin() {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    console.error("Faltan credenciales Firebase Admin en .env.local de Notificas");
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

async function fetchLegalMevColegios() {
  const base = (process.env.LEGALMEV_URL || "").trim().replace(/\/+$/, "");
  const secret = (process.env.NOTIFICAS_LEGALMEV_SHARED_SECRET || "").trim();
  if (!base || !secret) {
    console.error("Faltan LEGALMEV_URL y/o NOTIFICAS_LEGALMEV_SHARED_SECRET en .env.local");
    process.exit(1);
  }
  const res = await fetch(`${base}/api/integrations/notificas/colegios`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("LegalMev respondió", res.status, j);
    process.exit(1);
  }
  return j.colegios || [];
}

async function main() {
  const needle = process.argv.includes("--nombre")
    ? process.argv[process.argv.indexOf("--nombre") + 1] || "san nicol"
    : "san nicol";

  const colegios = await fetchLegalMevColegios();
  const lm =
    colegios.find((c) => new RegExp(needle.replace(/\s+/g, "\\s*"), "i").test(c.name)) ||
    colegios.find((c) => c.convenioActivo) ||
    colegios[0];

  if (!lm) {
    console.error("No hay colegios en LegalMev");
    process.exit(1);
  }

  console.log("LegalMev:", lm.id, lm.name, `(${lm.memberCount} activos, convenio=${lm.convenioActivo})`);

  const db = initNotificasAdmin();
  const snap = await db.collection("colegio_discount_colleges").get();
  if (snap.empty) {
    console.error("No hay colegios en Notificas. Creá uno en /admin/plans primero.");
    process.exit(1);
  }

  let target =
    snap.docs.find((d) => {
      const n = String(d.data().nombreColegio || "");
      return new RegExp(needle.replace(/\s+/g, "\\s*"), "i").test(n);
    }) || snap.docs[0];

  await target.ref.set(
    {
      legalmevColegioId: lm.id,
      nombreColegio: lm.name,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  console.log("Notificas vinculado:", target.id, "→", lm.id);
  console.log("Listo. Verificá en /admin/plans → Colegios de abogados.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
