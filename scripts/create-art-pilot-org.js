#!/usr/bin/env node

/**
 * Crea (si no existe) la organización piloto ART DEMO NOTIFICAS.
 * No modifica retención WORM ni despliega App Hosting.
 *
 * Uso:
 *   node scripts/create-art-pilot-org.js
 *
 * Env (.env.local):
 *   ART_PILOT_ADMIN_EMAIL  (o primer email de ART_PILOT_EMAIL_ALLOWLIST / ADMIN_PANEL_EMAIL)
 *   ART_PILOT_EMAIL_ALLOWLIST
 *   ART_PILOT_PHONE_ALLOWLIST
 *   ART_PILOT_SEED_WORKERS=true  (opcional; crea 2 trabajadores TEST)
 */

const path = require("path");
const { config } = require("dotenv");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

config({ path: path.join(process.cwd(), ".env.local") });

const ORG_NAME = "ART DEMO NOTIFICAS";
const ORG_CUIT = "30-99900001-9";

function splitList(raw) {
  return String(raw || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function initAdmin() {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    console.error("Faltan credenciales Admin en .env.local");
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
  return { db: getFirestore(), auth: getAuth(), projectId };
}

async function main() {
  const emails = splitList(process.env.ART_PILOT_EMAIL_ALLOWLIST).map((e) => e.toLowerCase());
  const phones = splitList(process.env.ART_PILOT_PHONE_ALLOWLIST);
  const adminEmail = (
    process.env.ART_PILOT_ADMIN_EMAIL ||
    emails[0] ||
    process.env.ADMIN_PANEL_EMAIL ||
    ""
  )
    .trim()
    .toLowerCase();
  if (!adminEmail) {
    console.error("Definí ART_PILOT_ADMIN_EMAIL o ART_PILOT_EMAIL_ALLOWLIST o ADMIN_PANEL_EMAIL");
    process.exit(1);
  }

  const { db, auth, projectId } = initAdmin();
  console.log(`Proyecto: ${projectId}`);

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(adminEmail);
    console.log(`Usuario admin existente: ${adminEmail}`);
  } catch (e) {
    if (e?.code !== "auth/user-not-found") throw e;
    console.error(`No existe Auth user ${adminEmail}. Crealo antes o usá un email ya registrado.`);
    process.exit(1);
  }

  const existing = await db.collection("organizations").where("nombre", "==", ORG_NAME).limit(5).get();
  let orgId;
  if (!existing.empty) {
    const match = existing.docs.find((d) => d.data()?.isTestOrganization === true) || existing.docs[0];
    orgId = match.id;
    await match.ref.set(
      {
        tipo: "art",
        environment: "production_pilot",
        isTestOrganization: true,
        nombre: ORG_NAME,
      },
      { merge: true }
    );
    console.log(`Organización existente actualizada: ${orgId}`);
  } else {
    const ref = db.collection("organizations").doc();
    await ref.set({
      nombre: ORG_NAME,
      cuit: ORG_CUIT,
      tipo: "art",
      adminUserId: userRecord.uid,
      adminUserEmail: adminEmail,
      members: [userRecord.uid],
      plan: "starter",
      logoUrl: null,
      environment: "production_pilot",
      isTestOrganization: true,
      createdAt: FieldValue.serverTimestamp(),
      createdByAdmin: true,
      createdForArtPilot: true,
    });
    orgId = ref.id;
    console.log(`Organización creada: ${orgId}`);
  }

  const seedWorkers = String(process.env.ART_PILOT_SEED_WORKERS || "").toLowerCase() === "true";
  if (seedWorkers) {
    if (emails.length < 2 || phones.length < 2) {
      console.error("Para sembrar trabajadores hacen falta 2 emails y 2 teléfonos en allowlist.");
      process.exit(1);
    }
    const workers = [
      {
        fullName: "TEST TRABAJADOR 01",
        dni: "99900001",
        cuil: "20999000013",
        email: emails[0],
        phone: phones[0],
      },
      {
        fullName: "TEST TRABAJADOR 02",
        dni: "99900002",
        cuil: "20999000021",
        email: emails[1],
        phone: phones[1],
      },
    ];
    for (const w of workers) {
      const id = `art_rcp_pilot_${w.dni}`;
      await db.collection("art_recipients").doc(id).set(
        {
          orgId,
          externalId: `TEST-${w.dni}`,
          dni: w.dni,
          cuil: w.cuil,
          fullName: w.fullName,
          firstName: "TEST",
          lastName: w.fullName.replace("TEST ", ""),
          phone: w.phone,
          email: w.email,
          status: "identity_pending",
          identityProvider: "ART_PREVALIDATED",
          identityPrevalidatedByArt: false,
          phoneVerified: false,
          emailVerified: false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      console.log(`Trabajador TEST preparado: ${w.fullName}`);
    }
  } else {
    console.log("Trabajadores no sembrados (ART_PILOT_SEED_WORKERS!=true).");
  }

  console.log("");
  console.log("ART_ALLOWED_ORGS=" + orgId);
  console.log("No se modificó el bucket WORM ni Object Lock.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
