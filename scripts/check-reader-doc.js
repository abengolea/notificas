/**
 * Verifica si un documento mail/{id} existe en Firestore y si el token k coincide.
 *
 * Uso (desde la raíz del repo):
 *   node scripts/check-reader-doc.js <mailId> [k]
 *
 * Ejemplos:
 *   node scripts/check-reader-doc.js L0WLQVwPw9lk9W12IAHw
 *   node scripts/check-reader-doc.js L0WLQVwPw9lk9W12IAHw e5af234f872075ea472cffbb8b4a636f
 *
 * Credenciales: lee FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 * desde .env.local (o .env). Si no las encuentra, usa Application Default Credentials.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ── Colores ──────────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  red:   '\x1b[31m',
  green: '\x1b[32m',
  yellow:'\x1b[33m',
  cyan:  '\x1b[36m',
  bold:  '\x1b[1m',
  dim:   '\x1b[2m',
};
const ok  = `${C.green}✅${C.reset}`;
const err = `${C.red}❌${C.reset}`;
const warn = `${C.yellow}⚠️ ${C.reset}`;
const info = `${C.cyan}ℹ️ ${C.reset}`;

// ── Leer .env.local o .env ────────────────────────────────────────────────────
function loadEnvFile() {
  const candidates = ['.env.local', '.env'];
  for (const name of candidates) {
    const filePath = path.join(process.cwd(), name);
    if (!fs.existsSync(filePath)) continue;
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // Quitar comillas envolventes
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
    console.log(`${info} Credenciales cargadas desde ${name}`);
    return;
  }
  console.log(`${warn} No se encontró .env.local ni .env — usando Application Default Credentials`);
}

// ── Inicializar Admin SDK ─────────────────────────────────────────────────────
function initAdmin() {
  if (admin.apps.length) return;

  const projectId   = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
    console.log(`${ok} Admin SDK inicializado con service account (proyecto: ${C.bold}${projectId}${C.reset})`);
  } else {
    const missing = [];
    if (!projectId)   missing.push('FIREBASE_PROJECT_ID');
    if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
    if (!privateKey)  missing.push('FIREBASE_PRIVATE_KEY');
    console.log(`${warn} Variables faltantes: ${missing.join(', ')}`);
    console.log(`${info} Intentando con Application Default Credentials...`);
    admin.initializeApp({ projectId: projectId || undefined });
  }
}

// ── Formatear Timestamp de Firestore ─────────────────────────────────────────
function fmtTimestamp(val) {
  if (!val) return 'null';
  if (val._seconds !== undefined) {
    return new Date(val._seconds * 1000).toISOString();
  }
  if (val.toDate) return val.toDate().toISOString();
  return String(val);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const [,, mailId, kParam] = process.argv;

  if (!mailId) {
    console.error(`\nUso: node scripts/check-reader-doc.js <mailId> [k]\n`);
    console.error(`Ejemplo:`);
    console.error(`  node scripts/check-reader-doc.js L0WLQVwPw9lk9W12IAHw e5af234f872075ea472cffbb8b4a636f\n`);
    process.exit(1);
  }

  loadEnvFile();
  initAdmin();

  const db = admin.firestore();

  console.log(`\n${C.bold}── Verificando mail/${mailId} ──${C.reset}\n`);

  let snap;
  try {
    snap = await db.collection('mail').doc(mailId).get();
  } catch (e) {
    console.error(`${err} Error al leer Firestore: ${e.message}`);
    if (e.code === 7 || e.message.includes('PERMISSION_DENIED')) {
      console.error(`${warn} La service account no tiene acceso a Firestore. Verificá los permisos IAM.`);
    }
    process.exit(1);
  }

  // ── ¿Existe el documento? ──────────────────────────────────────────────────
  if (!snap.exists) {
    console.log(`${err} ${C.bold}El documento NO existe${C.reset} en Firestore.`);
    console.log(`\n${C.yellow}Causas posibles:${C.reset}`);
    console.log(`  1. El email fue enviado por processIncomingEmail y el docRef.set() falló.`);
    console.log(`  2. El mailId en la URL no corresponde al proyecto Firebase correcto.`);
    console.log(`  3. El documento fue eliminado manualmente.\n`);
    process.exit(0);
  }

  const data = snap.data();
  console.log(`${ok} ${C.bold}El documento EXISTE${C.reset}`);

  // ── Campos clave ───────────────────────────────────────────────────────────
  console.log(`\n${C.cyan}── Campos principales ──${C.reset}`);
  console.log(`  to              : ${JSON.stringify(data.to)}`);
  console.log(`  recipientEmail  : ${data.recipientEmail ?? C.dim + 'no definido' + C.reset}`);
  console.log(`  senderName      : ${data.senderName ?? C.dim + 'no definido' + C.reset}`);
  console.log(`  source          : ${data.source ?? C.dim + 'no definido' + C.reset}`);
  console.log(`  createdAt       : ${fmtTimestamp(data.createdAt)}`);

  // ── Delivery ───────────────────────────────────────────────────────────────
  console.log(`\n${C.cyan}── Delivery ──${C.reset}`);
  if (!data.delivery) {
    console.log(`  ${warn} Campo delivery ausente — el email puede no haberse enviado aún`);
  } else {
    const state = data.delivery.state;
    const stateColor = state === 'DELIVERED' ? C.green : state === 'ERROR' ? C.red : C.yellow;
    console.log(`  state   : ${stateColor}${state}${C.reset}`);
    console.log(`  time    : ${fmtTimestamp(data.delivery.time)}`);
    if (data.delivery.error) console.log(`  error   : ${C.red}${data.delivery.error}${C.reset}`);
  }

  // ── Tracking token ─────────────────────────────────────────────────────────
  console.log(`\n${C.cyan}── Tracking token ──${C.reset}`);
  const storedToken =
    (data.tracking && typeof data.tracking.token === 'string' ? data.tracking.token : null) ??
    (typeof data.trackingToken === 'string' ? data.trackingToken : null);

  if (!storedToken) {
    console.log(`  ${err} ${C.bold}tracking.token AUSENTE${C.reset} — el email fue enviado pero la Cloud Function no escribió el token.`);
    console.log(`  ${warn} El reader devolverá 401 "Enlace no válido" hasta que se reenvíe.`);
  } else {
    console.log(`  stored  : ${C.green}${storedToken}${C.reset}`);
    if (data.tracking?.sentAt) {
      console.log(`  sentAt  : ${fmtTimestamp(data.tracking.sentAt)}`);
    }

    if (kParam) {
      console.log(`\n${C.cyan}── Comparación con k del enlace ──${C.reset}`);
      if (storedToken === kParam) {
        console.log(`  ${ok} ${C.bold}Token COINCIDE${C.reset} — el enlace es válido.`);
        console.log(`  ${info} Si el reader muestra "Mensaje no encontrado", el problema es otro (p. ej. Admin SDK en producción).`);
      } else {
        console.log(`  ${err} ${C.bold}Token NO coincide${C.reset}`);
        console.log(`  URL k   : ${C.red}${kParam}${C.reset}`);
        console.log(`  stored  : ${C.yellow}${storedToken}${C.reset}`);
        console.log(`  ${warn} El reader devolverá 401 "Enlace no válido".`);
        console.log(`  ${info} Puede que se haya enviado un segundo email con un token diferente.`);
      }
    } else {
      console.log(`  ${info} Pasá el token ?k=... como segundo argumento para compararlo.`);
    }
  }

  // ── Historial de movimientos ───────────────────────────────────────────────
  const movements = data.tracking?.movements ?? [];
  if (movements.length > 0) {
    console.log(`\n${C.cyan}── Movimientos (${movements.length}) ──${C.reset}`);
    for (const m of movements) {
      const ts = m.timestamp ? new Date(m.timestamp).toLocaleString('es-AR') : '?';
      console.log(`  [${ts}] ${m.type} — ${m.description ?? ''}`);
    }
  }

  // ── message.html ──────────────────────────────────────────────────────────
  console.log(`\n${C.cyan}── Contenido ──${C.reset}`);
  const hasHtml = Boolean(data.message?.html?.trim());
  console.log(`  message.html    : ${hasHtml ? ok + ' presente (' + data.message.html.length + ' chars)' : warn + ' vacío'}`);
  console.log(`  message.subject : ${data.message?.subject ?? C.dim + 'no definido' + C.reset}`);

  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(`\n${'\x1b[31m'}Error inesperado:${'\x1b[0m'}`, e.message);
    process.exit(1);
  });
