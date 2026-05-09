#!/usr/bin/env node

/**
 * Crea (si no existen) un usuario Firebase Auth y una organización de prueba para el módulo /empresa.
 * Requiere las mismas credenciales Admin que las API routes (.env.local).
 *
 * Uso:
 *   node scripts/seed-demo-empresa.js
 *   npm run seed:demo-empresa
 *
 * Opcional en .env.local:
 *   DEMO_EMPRESA_EMAIL=demo.empresa@notificas.local
 *   DEMO_EMPRESA_PASSWORD=TuClaveSegura123
 */

const path = require("path");
const { config } = require("dotenv");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

config({ path: path.join(process.cwd(), ".env.local") });

const DEFAULT_EMAIL = "demo.empresa@notificas.local";
const DEFAULT_PASSWORD = "DemoEmpresa2026!";
const DEMO_CUIT = "30-70856329-7"; // formato válido para el alta admin

function initAdmin() {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "Faltan FIREBASE_PROJECT_ID (o NEXT_PUBLIC_FIREBASE_PROJECT_ID), FIREBASE_CLIENT_EMAIL y/o FIREBASE_PRIVATE_KEY en .env.local",
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
  const email = (process.env.DEMO_EMPRESA_EMAIL || DEFAULT_EMAIL).trim().toLowerCase();
  const password = (process.env.DEMO_EMPRESA_PASSWORD || DEFAULT_PASSWORD).trim();

  if (password.length < 6) {
    console.error("La contraseña demo debe tener al menos 6 caracteres (Firebase).");
    process.exit(1);
  }

  const { db, auth } = initAdmin();

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
    console.log(`Usuario ya existía: ${email} (uid ${userRecord.uid})`);
  } catch (e) {
    if (e?.code !== "auth/user-not-found") {
      console.error(e);
      process.exit(1);
    }
    userRecord = await auth.createUser({
      email,
      password,
      emailVerified: true,
      displayName: "Empresa Demo Notificas",
    });
    console.log(`Usuario creado: ${email} (uid ${userRecord.uid})`);
  }

  const uid = userRecord.uid;

  // Si la org. quedó con otro adminUserId (cuenta Auth recreada) pero el email admin coincide, alineamos.
  const byEmail = await db.collection("organizations").where("adminUserEmail", "==", email).limit(5).get();
  for (const d of byEmail.docs) {
    const row = d.data();
    if (row.adminUserId !== uid || !Array.isArray(row.members) || !row.members.includes(uid)) {
      await d.ref.update({
        adminUserId: uid,
        members: FieldValue.arrayUnion(uid),
      });
      console.log(`Organización ${d.id}: sincronizado adminUserId/members con el usuario actual (${email}).`);
    }
  }

  const existing = await db.collection("organizations").where("adminUserId", "==", uid).limit(1).get();

  if (!existing.empty) {
    const id = existing.docs[0].id;
    console.log(`Organización ya existía (admin de ${email}): id=${id}`);
    printHowToLogin(email, password);
    return;
  }

  const ref = db.collection("organizations").doc();
  await ref.set({
    nombre: "Empresa Demo S.A. (prueba)",
    cuit: DEMO_CUIT,
    tipo: "empresa",
    adminUserId: uid,
    adminUserEmail: email,
    members: [uid],
    plan: "business",
    logoUrl: null,
    createdAt: FieldValue.serverTimestamp(),
    createdBySeedScript: true,
  });

  console.log(`Organización creada: id=${ref.id} / admin ${email}`);
  printHowToLogin(email, password);
}

function printHowToLogin(email, password) {
  console.log("\n--- Acceso módulo empresas (local) ---");
  console.log(`  URL:    /login?next=/empresa`);
  console.log(`  Email:  ${email}`);
  console.log(`  Clave:  ${password}`);
  console.log("---");
  console.log("Tras iniciar sesión deberías ver el selector de organización en /empresa.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
