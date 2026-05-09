/**
 * Normaliza en Firestore colección `mail`:
 * - `to`: texto → [minúsculas]; lista → elementos email en minúsculas / trim.
 * - `recipientEmail`: minúsculas / trim.
 * Opcionalmente `senderName` cuando parece dirección de correo (mejora consulta Enviados).
 *
 * Usa las mismas credenciales Admin que Next (vars de entorno).
 *
 * Uso:
 *   node scripts/normalize-mail-recipient-fields.js --dry-run
 *   node scripts/normalize-mail-recipient-fields.js
 *
 * Carga `.env` y `.env.local` desde la raíz del repo si existen.
 */

const path = require("path");
const fs = require("fs");

const cwd = process.cwd();
for (const name of [".env", ".env.local"]) {
  const p = path.join(cwd, name);
  if (fs.existsSync(p)) {
    require("dotenv").config({ path: p });
  }
}

const admin = require("firebase-admin");
const { FieldPath } = require("firebase-admin/firestore");

const DRY_RUN = process.argv.includes("--dry-run");

function normEmail(val) {
  if (typeof val !== "string") return val;
  return val.trim().toLowerCase();
}

function normalizeToField(to) {
  if (Array.isArray(to)) {
    const mapped = to.map((e) =>
      typeof e === "string" ? normEmail(e) : e,
    );
    const changed =
      mapped.length !== to.length ||
      mapped.some((x, i) => x !== to[i]);
    return { value: mapped, changed };
  }
  if (typeof to === "string" && to.trim()) {
    return { value: [normEmail(to)], changed: true };
  }
  return { value: to, changed: false };
}

function buildUpdates(data) {
  const updates = {};

  const toNorm = normalizeToField(data.to);
  if (toNorm.changed) {
    updates.to = toNorm.value;
  }

  if (typeof data.recipientEmail === "string" && data.recipientEmail.trim()) {
    const n = normEmail(data.recipientEmail);
    if (n !== data.recipientEmail) {
      updates.recipientEmail = n;
    }
  }

  if (
    typeof data.senderName === "string" &&
    data.senderName.includes("@")
  ) {
    const n = normEmail(data.senderName);
    if (n !== data.senderName) {
      updates.senderName = n;
    }
  }

  return updates;
}

async function main() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "Faltan variables: FIREBASE_PROJECT_ID (o NEXT_PUBLIC_FIREBASE_PROJECT_ID), FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.",
    );
    console.error("Defínelas en .env.local igual que para las APIs Next.");
    process.exit(1);
  }

  privateKey = privateKey.replace(/\\n/g, "\n");

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  const db = admin.firestore();
  const PAGE = 350;
  /** @type {FirebaseFirestore.DocumentSnapshot | undefined} */
  let cursor;
  let examined = 0;
  let wouldUpdate = 0;
  let committed = 0;

  console.log(DRY_RUN ? "Modo --dry-run (no se escribe nada)." : "Aplicando actualizaciones…");
  console.log("Proyecto:", projectId);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = db.collection("mail").orderBy(FieldPath.documentId()).limit(PAGE);
    if (cursor) {
      q = q.startAfter(cursor);
    }

    const snap = await q.get();
    if (snap.empty) break;

    let batch = db.batch();
    let ops = 0;

    for (const doc of snap.docs) {
      examined++;
      const updates = buildUpdates(doc.data());

      if (Object.keys(updates).length === 0) continue;

      wouldUpdate++;

      console.log(`${doc.id}:`, JSON.stringify(updates));

      if (!DRY_RUN) {
        batch.update(doc.ref, updates);
        ops++;
      }

      if (!DRY_RUN && ops >= 400) {
        await batch.commit();
        committed += ops;
        batch = db.batch();
        ops = 0;
      }
    }

    if (!DRY_RUN && ops > 0) {
      await batch.commit();
      committed += ops;
    }

    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE) break;
  }

  console.log("---");
  console.log(`Documentos leídos: ${examined}`);
  console.log(
    DRY_RUN
      ? `Llevarían cambio (revisa arriba): ${wouldUpdate} — ejecuta sin --dry-run para aplicar.`
      : `Documentos actualizados: ${wouldUpdate}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
