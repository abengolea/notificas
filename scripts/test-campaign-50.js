#!/usr/bin/env node
/**
 * Script de prueba: crea una campaña con 50 destinatarios de test y la dispara.
 *
 * Uso:
 *   node scripts/test-campaign-50.js --uid=<uid> --org=<orgId> [--token=<firebase-id-token>]
 *
 * Si no pasás --token, el script crea la campaña en Firestore directamente con Admin SDK
 * y llama al endpoint /api/campaigns/send internamente sin autenticación de usuario
 * (modo "dry run" de infraestructura — verifica que la cola funcione).
 *
 * Requiere en .env.local: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY,
 * NEXT_PUBLIC_APP_URL, CAMPAIGN_WORKER_SECRET.
 */

require('dotenv').config({ path: '.env.local' });

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue }      = require('firebase-admin/firestore');

// ── Firebase Admin ──────────────────────────────────────────────────────────
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

// ── Args ────────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => a.slice(2).split('='))
);
const { uid, org: orgId, token: idToken } = args;

if (!uid || !orgId) {
  console.error('Uso: node scripts/test-campaign-50.js --uid=UID --org=ORG_ID [--token=ID_TOKEN]');
  process.exit(1);
}

// ── Generador de destinatarios falsos ───────────────────────────────────────
const NOMBRES = ['Ana','Carlos','María','Juan','Laura','Pedro','Sofía','Diego','Valentina','Martín',
  'Florencia','Sebastián','Camila','Nicolás','Lucía','Mateo','Emma','Lucas','Mia','Tomás'];
const APELLIDOS = ['García','Rodríguez','López','Martínez','González','Pérez','Sánchez','Romero',
  'Torres','Díaz','Álvarez','Fernández','Moreno','Muñoz','Ruiz','Jiménez','Navarro','Castro'];

function fakeDNI() {
  return String(Math.floor(20_000_000 + Math.random() * 30_000_000));
}
function fakePhone() {
  const area = ['11','351','341','261','387'][Math.floor(Math.random() * 5)];
  const num  = String(Math.floor(10_000_000 + Math.random() * 89_999_999));
  return `+54 9 ${area} ${num}`;
}
function fakeName() {
  return `${NOMBRES[Math.floor(Math.random() * NOMBRES.length)]} ${APELLIDOS[Math.floor(Math.random() * APELLIDOS.length)]}`;
}

const TEST_DOMAIN = 'test.notificas-qa.internal'; // dominio inexistente → no llega a nadie real

function generateRecipients(n) {
  return Array.from({ length: n }, (_, i) => {
    const nombre = fakeName();
    const slug   = nombre.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '');
    return {
      email:    `${slug}.${i + 1}@${TEST_DOMAIN}`,
      nombre,
      dni:      fakeDNI(),
      legajo:   `LEG-${String(i + 1).padStart(4, '0')}`,
      telefono: fakePhone(),
    };
  });
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🧪 Test campaign — 50 destinatarios ficticios\n');

  const recipients = generateRecipients(50);

  // 1. Crear campaña en Firestore.
  const campRef = db.collection('campaigns').doc();
  const campaignId = campRef.id;

  await campRef.set({
    orgId,
    createdBy:      uid,
    senderEmail:    (await db.collection('users').doc(uid).get()).data()?.email || `test@${TEST_DOMAIN}`,
    senderUid:      uid,
    nombre:         `[TEST] Campaña 50 destinatarios ${new Date().toLocaleString('es-AR')}`,
    asunto:         'Notificación de prueba — Notificas QA',
    cuerpo:         'Estimado/a {{nombre}}, DNI {{dni}}: este es un mensaje de prueba del sistema de envíos masivos de Notificas. Legajo: {{legajo}}.',
    recipientData:  recipients,
    recipientCount: recipients.length,
    adjuntos:       [],
    estado:         'enviando',
    stats:          { total: recipients.length, enviados: 0, leidos: 0, errores: 0, pendientes: recipients.length },
    createdAt:      FieldValue.serverTimestamp(),
    enqueuedAt:     FieldValue.serverTimestamp(),
    _test:          true,
  });

  console.log(`✅ Campaña creada: ${campaignId}`);
  console.log(`   ${recipients.length} destinatarios en ${TEST_DOMAIN}\n`);

  // 2. Garantizar que el usuario tenga créditos suficientes para el test.
  const userRef  = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const creditos = userSnap.data()?.creditos ?? 0;

  if (creditos < recipients.length) {
    const faltan = recipients.length - creditos;
    console.log(`⚠️  Créditos insuficientes (tenés ${creditos}, necesitás ${recipients.length}).`);
    console.log(`   Agregando ${faltan} créditos de test temporalmente...`);
    await userRef.update({ creditos: FieldValue.increment(faltan) });
    console.log('   Créditos ajustados.\n');
  }

  // 3. Llamar al fanout worker directamente (bypasea la auth de usuario).
  const workerSecret = process.env.CAMPAIGN_WORKER_SECRET;
  const appUrl       = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9006').replace(/\/$/, '');
  const fanoutUrl    = `${appUrl}/api/campaigns/fanout`;

  if (!workerSecret) {
    console.log('⚠️  CAMPAIGN_WORKER_SECRET no definido en .env.local');
    console.log('   Creá la campaña y disparala manualmente desde la UI.');
    console.log(`   Campaign ID: ${campaignId}`);
    return;
  }

  console.log(`📤 Llamando a fanout: ${fanoutUrl}`);

  let fanoutRes;
  try {
    fanoutRes = await fetch(fanoutUrl, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'X-Worker-Secret': workerSecret,
      },
      body: JSON.stringify({ campaignId, offset: 0 }),
    });
  } catch (e) {
    console.error('❌ Error llamando al fanout (¿está corriendo el servidor?):', e.message);
    console.log(`\n   Para probar manualmente, la campaña está en Firestore: ${campaignId}`);
    console.log('   Corré `npm run dev` y disparala desde la UI.\n');
    return;
  }

  const body = await fanoutRes.json().catch(() => ({}));

  if (!fanoutRes.ok) {
    console.error('❌ Fanout error:', fanoutRes.status, body);
    return;
  }

  console.log('✅ Fanout response:', JSON.stringify(body, null, 2));
  console.log('\n📊 Monitoreando progreso cada 5 segundos...\n');

  // 4. Monitorear hasta completado o timeout.
  const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos
  const start = Date.now();

  while (Date.now() - start < TIMEOUT_MS) {
    await new Promise(r => setTimeout(r, 5_000));

    const snap = await campRef.get();
    const s    = snap.data()?.stats || {};
    const est  = snap.data()?.estado || '?';

    const bar = '█'.repeat(Math.round((s.enviados || 0) / recipients.length * 20)).padEnd(20, '░');
    process.stdout.write(
      `\r   [${bar}] ${s.enviados || 0}/${recipients.length} enviados | ` +
      `${s.errores || 0} errores | ${s.pendientes || 0} pendientes | ${est}   `
    );

    if (est === 'completada') {
      console.log('\n\n✅ Campaña completada.\n');
      break;
    }
  }

  // 5. Resumen final.
  const final = (await campRef.get()).data();
  const stats = final?.stats || {};

  console.log('── Resultado final ─────────────────────────────');
  console.log(`   Total:     ${stats.total}`);
  console.log(`   Enviados:  ${stats.enviados}`);
  console.log(`   Errores:   ${stats.errores}`);
  console.log(`   Pendientes:${stats.pendientes}`);
  console.log(`   Estado:    ${final?.estado}`);
  console.log('');
  console.log(`📥 Descargar reporte CSV:`);
  console.log(`   ${appUrl}/api/campaigns/export?campaignId=${campaignId}&orgId=${orgId}`);
  console.log('');
  console.log(`🔗 Ver en Firestore:`);
  console.log(`   https://console.firebase.google.com/project/notificas-f9953/firestore/data/campaigns/${campaignId}`);
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1); });
