#!/usr/bin/env node
/**
 * Suma envíos gratis a colegiados de un colegio que ya tienen cuenta en Notificas.
 *
 * Uso:
 *   node scripts/grant-envios-colegio.js --dry-run
 *   node scripts/grant-envios-colegio.js --cantidad=3 --nombre "San Nicol"
 *   node scripts/grant-envios-colegio.js --cantidad=3 --college-id=abc123
 *
 * Requiere .env.local (Firebase Admin). Si el colegio tiene legalmevColegioId, la nómina sale de LegalMev.
 */

const fs = require("fs");
const path = require("path");
const { createHash } = require("crypto");
const { config } = require("dotenv");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

config({ path: path.join(process.cwd(), ".env.local") });

const COLEGIO_COLLEGES = "colegio_discount_colleges";
const COLEGIO_MEMBERS_SUB = "members";
const BATCH_SIZE = 400;
const BONUS_TAG = "colegio_bonus_san_nicol_v1";
const PENDING_COLLECTION = "colegio_pending_envios";

function memberDocId(email) {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

function parseArgs(argv) {
  let dryRun = false;
  let cantidad = 3;
  let nombre = "san nicol";
  let collegeId = "";
  let limit = 0;
  let output = "";
  let skipIdempotency = false;
  let onlyPending = false;
  let onlyAccounts = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    if (a === "--skip-idempotency") skipIdempotency = true;
    if (a === "--only-pending") onlyPending = true;
    if (a === "--only-accounts") onlyAccounts = true;
    if (a.startsWith("--cantidad=")) cantidad = Number(a.slice("--cantidad=".length));
    if (a.startsWith("--limit=")) limit = Number(a.slice("--limit=".length));
    if (a.startsWith("--output=")) output = path.resolve(process.cwd(), a.slice("--output=".length));
    if (a.startsWith("--college-id=")) collegeId = a.slice("--college-id=".length).trim();
    if (a === "--nombre" && argv[i + 1]) {
      nombre = argv[++i];
    }
  }

  if (!Number.isFinite(cantidad) || cantidad < 1 || cantidad > 100) {
    console.error("--cantidad debe ser un entero entre 1 y 100");
    process.exit(1);
  }
  if (limit !== 0 && (!Number.isFinite(limit) || limit < 1)) {
    console.error("--limit debe ser >= 1");
    process.exit(1);
  }

  if (!output) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    output = path.join(process.cwd(), "data", "exports", `grant-envios-colegio-${stamp}.json`);
  }

  return { dryRun, cantidad, nombre, collegeId, limit, output, skipIdempotency, onlyPending, onlyAccounts };
}

function initAdmin() {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    console.error("Faltan credenciales Firebase Admin en .env.local");
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

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

async function fetchLegalMevMembers(colegioId) {
  const base = (process.env.LEGALMEV_URL || process.env.NEXT_PUBLIC_LEGALMEV_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const secret = (
    process.env.NOTIFICAS_LEGALMEV_SHARED_SECRET ||
    process.env.LEGALMEV_NOTIFICAS_SHARED_SECRET ||
    ""
  ).trim();
  if (!base || !secret) {
    return null;
  }
  const res = await fetch(
    `${base}/api/integrations/notificas/colegios/${encodeURIComponent(colegioId)}/members`,
    { headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(60_000) },
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(j.members)) {
    console.error("LegalMev members HTTP", res.status, j);
    return { colegioName: "", members: [] };
  }
  return {
    colegioName: typeof j.colegioName === "string" ? j.colegioName : "",
    members: j.members.filter((m) => typeof m.email === "string" && m.email.includes("@")),
  };
}

async function loadCollege(db, nombre, collegeId) {
  const snap = await db.collection(COLEGIO_COLLEGES).get();
  if (snap.empty) {
    console.error("No hay colegios en colegio_discount_colleges");
    process.exit(1);
  }
  if (collegeId) {
    const doc = snap.docs.find((d) => d.id === collegeId);
    if (!doc) {
      console.error("No existe college-id:", collegeId);
      process.exit(1);
    }
    return { id: doc.id, ...doc.data() };
  }
  const re = new RegExp(nombre.replace(/\s+/g, "\\s*"), "i");
  const doc =
    snap.docs.find((d) => re.test(String(d.data().nombreColegio || ""))) ||
    snap.docs.find((d) => /san\s*nicol/i.test(String(d.data().nombreColegio || ""))) ||
    snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

async function loadRoster(db, college) {
  const lmId =
    typeof college.legalmevColegioId === "string" && college.legalmevColegioId.trim()
      ? college.legalmevColegioId.trim()
      : "";
  if (lmId) {
    const lm = await fetchLegalMevMembers(lmId);
    if (!lm) {
      console.error("Colegio vinculado a LegalMev pero faltan LEGALMEV_URL / NOTIFICAS_LEGALMEV_SHARED_SECRET");
      process.exit(1);
    }
    return {
      colegioNombre: lm.colegioName || college.nombreColegio || "",
      members: lm.members.map((m) => ({
        email: normalizeEmail(m.email),
        nombre: m.name || m.email,
        estado: m.estado === "suspendido" ? "suspendido" : "activo",
      })),
    };
  }

  const sub = await db
    .collection(COLEGIO_COLLEGES)
    .doc(college.id)
    .collection(COLEGIO_MEMBERS_SUB)
    .limit(5000)
    .get();
  return {
    colegioNombre: college.nombreColegio || "",
    members: sub.docs
      .map((d) => {
        const data = d.data() || {};
        return {
          email: normalizeEmail(data.email),
          nombre: String(data.nombre || data.email || "").trim(),
          estado: data.estado === "suspendido" ? "suspendido" : "activo",
        };
      })
      .filter((m) => m.email.includes("@")),
  };
}

async function alreadyGranted(db, uid) {
  const snap = await db
    .collection("user_transactions")
    .where("userId", "==", uid)
    .where("bonusTag", "==", BONUS_TAG)
    .limit(1)
    .get();
  return !snap.empty;
}

async function grantPendingForEmails(db, rows, meta, dryRun) {
  const descripcion = meta.descripcion;
  let created = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const refs = chunk.map((r) => db.collection(PENDING_COLLECTION).doc(memberDocId(r.email)));
    const snaps = await db.getAll(...refs);

    const batch = db.batch();
    let ops = 0;

    for (let j = 0; j < chunk.length; j++) {
      const row = chunk[j];
      const existing = snaps[j];
      if (existing.exists) {
        const d = existing.data() || {};
        if (d.redeemedAt || d.bonusTag === BONUS_TAG) {
          skipped++;
          continue;
        }
      }
      if (dryRun) {
        created++;
        continue;
      }
      batch.set(
        refs[j],
        {
          email: row.email,
          creditos: meta.cantidad,
          bonusTag: BONUS_TAG,
          descripcion,
          collegeId: meta.collegeId,
          colegioNombre: meta.colegioNombre,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      ops++;
      created++;
    }

    if (!dryRun && ops > 0) {
      await batch.commit();
      console.error(`  batch pendientes ${Math.floor(i / BATCH_SIZE) + 1}: ${ops}`);
    }
  }

  return { created, skipped };
}

async function main() {
  const { dryRun, cantidad, nombre, collegeId, limit, output, skipIdempotency, onlyPending, onlyAccounts } =
    parseArgs(process.argv.slice(2));
  const db = initAdmin();

  const college = await loadCollege(db, nombre, collegeId);
  const { colegioNombre, members: roster } = await loadRoster(db, college);

  console.error(
    dryRun ? "[DRY-RUN] " : "",
    `Regalo +${cantidad} envío(s) — colegio: ${colegioNombre || college.nombreColegio} (${college.id})`,
  );
  console.error(`Nómina: ${roster.length} matriculado(s)`);

  const usersSnap = await db.collection("users").get();
  const uidByEmail = new Map();
  for (const doc of usersSnap.docs) {
    const email = normalizeEmail(doc.data()?.email);
    if (email) uidByEmail.set(email, doc.id);
  }

  const activos = roster.filter((m) => m.estado !== "suspendido");
  const planned = [];
  const sinCuenta = [];
  const yaOtorgado = [];

  for (const m of activos) {
    const uid = uidByEmail.get(m.email);
    if (!uid) {
      sinCuenta.push(m);
      continue;
    }
    if (!skipIdempotency && (await alreadyGranted(db, uid))) {
      yaOtorgado.push({ ...m, uid });
      continue;
    }
    planned.push({ ...m, uid });
  }

  const toApply = onlyPending ? [] : limit > 0 ? planned.slice(0, limit) : planned;
  const toPending = onlyAccounts ? [] : limit > 0 ? sinCuenta.slice(0, limit) : sinCuenta;

  console.error(
    `Con cuenta: ${activos.length - sinCuenta.length} | Sin cuenta: ${sinCuenta.length} | Ya tenían bono: ${yaOtorgado.length} | A acreditar ahora: ${toApply.length} | Reserva pendiente: ${toPending.length}`,
  );

  const preview = toApply.slice(0, 12);
  for (const row of preview) {
    console.error(`  +${cantidad} → ${row.email} (${row.uid})`);
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
        cantidad,
        bonusTag: BONUS_TAG,
        colegio: { id: college.id, nombre: colegioNombre || college.nombreColegio },
        rosterTotal: roster.length,
        activos: activos.length,
        sinCuenta: sinCuenta.length,
        yaOtorgado: yaOtorgado.length,
        count: toApply.length,
        pendingCount: toPending.length,
        rows: toApply,
        sinCuentaEmails: sinCuenta.slice(0, 50).map((m) => m.email),
      },
      null,
      2,
    ),
    "utf8",
  );
  console.error(`Reporte: ${output}`);

  const descripcion = `Regalo colegio ${colegioNombre || college.nombreColegio || "abogados"} (+${cantidad} envíos)`;
  const meta = {
    cantidad,
    descripcion,
    collegeId: college.id,
    colegioNombre: colegioNombre || college.nombreColegio || "",
  };

  if (toApply.length === 0 && toPending.length === 0) {
    console.error("Nada que acreditar ni reservar.");
    return;
  }

  if (dryRun) {
    if (toPending.length > 0) {
      console.error(`[DRY-RUN] Se reservarían +${cantidad} envío(s) pendientes para ${toPending.length} matriculado(s) sin cuenta.`);
    }
    console.error("Ejecutá sin --dry-run para aplicar.");
    return;
  }

  let updated = 0;

  if (toApply.length > 0) {
    for (let i = 0; i < toApply.length; i += BATCH_SIZE) {
      const chunk = toApply.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const row of chunk) {
        batch.update(db.collection("users").doc(row.uid), {
          creditos: FieldValue.increment(cantidad),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
      updated += chunk.length;
      console.error(`  batch usuarios ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length}`);
    }

    for (const row of toApply) {
      await db.collection("user_transactions").add({
        userId: row.uid,
        tipo: "regalo",
        descripcion,
        creditos: cantidad,
        monto: 0,
        bonusTag: BONUS_TAG,
        fecha: FieldValue.serverTimestamp(),
      });
    }
    console.error(`Cuentas activas: ${updated} usuario(s) con +${cantidad} envío(s).`);
  }

  if (toPending.length > 0) {
    console.error(`Reservando +${cantidad} envío(s) pendientes para ${toPending.length} matriculado(s) sin cuenta…`);
    const { created, skipped } = await grantPendingForEmails(db, toPending, meta, false);
    console.error(
      `Pendientes: ${created} reserva(s) nueva(s), ${skipped} ya existían. Se acreditan al registrarse o iniciar sesión.`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
