#!/usr/bin/env node
/**
 * Demo: campaña de mora para "Empresa Prueba" — 50 deudores ficticios.
 * Simula exactamente lo que enviaría GOcuotas Legales a sus clientes en mora.
 *
 * Uso: node scripts/demo-mora-50.js
 */

require('dotenv').config({ path: '.env.local' });

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue }      = require('firebase-admin/firestore');

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

// ── Datos ficticios realistas ────────────────────────────────────────────────
const NOMBRES = [
  'Alejandro Ferreyra','Marcela Suárez','Roberto Acosta','Valeria Ríos','Gustavo Herrera',
  'Natalia Peralta','Federico Molina','Carolina Vega','Hernán Castillo','Silvia Mendoza',
  'Ariel Rojas','Daniela Paz','Jorge Vargas','Lorena Aguilar','Pablo Flores',
  'Verónica Sosa','Marcos Reyes','Graciela Torres','Rodrigo Ponce','Beatriz Gómez',
  'Sergio Medina','Andrea Campos','Claudio Luna','Patricia Núñez','Leonardo Cabrera',
  'Cecilia Ibáñez','Maximiliano Ríos','Viviana Ortega','Rubén Delgado','Claudia Fuentes',
  'Nicolás Barrera','Romina Aguirre','Santiago Díaz','Mariana Quiroga','Eduardo Salinas',
  'Adriana Benítez','Facundo Morales','Liliana Carrizo','Gastón Figueroa','Karina Ramos',
  'Damián Romero','Susana Leiva','Martín Álvarez','Nora Jiménez','Ignacio Palacios',
  'Florencia Cáceres','Hugo Domínguez','Mónica Giménez','Leandro Navarro','Teresa Rueda',
];

const PRODUCTOS = [
  'Préstamo personal','Cuotas electrodomésticos','Financiación vehicular',
  'Tarjeta de crédito','Refinanciación de deuda','Cuotas indumentaria',
];

function dni(i) {
  return String(20_000_000 + i * 317_421 % 30_000_000);
}
function legajo(i) {
  return `GCL-${String(i + 1).padStart(5, '0')}`;
}
function monto(i) {
  const base = 15_000 + (i * 7_893) % 280_000;
  return base.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}
function cuotas(i) { return 1 + (i % 6); }
function producto(i) { return PRODUCTOS[i % PRODUCTOS.length]; }
function vencimiento(i) {
  const d = new Date();
  d.setDate(d.getDate() - (10 + (i * 13) % 90));
  return d.toLocaleDateString('es-AR');
}

function generarDestinatarios() {
  return NOMBRES.map((nombre, i) => ({
    email:    `deudor.${dni(i)}@gocuotas-demo.notificas.internal`,
    nombre,
    dni:      dni(i),
    legajo:   legajo(i),
    telefono: `+54 9 11 ${String(40_000_000 + i * 1_234_567 % 59_999_999)}`,
    // Campos extra almacenados en legajo para el cuerpo del mensaje
    _monto:   monto(i),
    _cuotas:  cuotas(i),
    _producto: producto(i),
    _vencimiento: vencimiento(i),
  }));
}

// ── Campaña ──────────────────────────────────────────────────────────────────
const UID   = 'YaPRt8ahI5giIFlRDXbMcfaAXo12';
const ORG   = '18bacwReKihMUrOAxl2m';
const EMAIL = 'adrianbengolea@notificas.com';
const APP   = (process.env.NEXT_PUBLIC_APP_URL || 'https://notificas.com.ar').replace(/\/$/, '');

const ASUNTO = 'Notificación de deuda — GOcuotas Legales';

// Cuerpo con las variables disponibles en Notificas ({{nombre}}, {{dni}}, {{legajo}})
// El legajo lo usamos para meter el nro de expediente/cuenta
const CUERPO = `Estimado/a {{nombre}},

Por medio de la presente, GOcuotas Legales S.A. le notifica formalmente que registra una deuda pendiente de cancelación.

DNI: {{dni}}
N° de expediente: {{legajo}}

Le solicitamos que regularice su situación a la brevedad posible. En caso de no recibir respuesta en un plazo de 5 días hábiles, iniciaremos las acciones legales correspondientes de acuerdo con la normativa vigente.

Para consultas o acuerdos de pago, comuníquese a:
📞 0800-345-2684
📧 cobranzas@gocuotas.com.ar
🌐 www.gocuotas.com.ar/pagos

Esta notificación tiene carácter fehaciente y queda registrada con validez probatoria en blockchain.

GOcuotas Legales S.A.
CUIT: 30-71234567-8`;

async function main() {
  const destinatarios = generarDestinatarios();

  // Datos para Firestore — sin campos privados (_monto, etc.)
  const recipientData = destinatarios.map(({ _monto, _cuotas, _producto, _vencimiento, ...d }) => d);

  console.log('\n🏢 Demo campaña de mora — GOcuotas Legales\n');
  console.log(`   Remitente:     ${EMAIL}`);
  console.log(`   Organización:  Empresa Prueba (${ORG})`);
  console.log(`   Destinatarios: ${recipientData.length}`);
  console.log(`   Asunto:        ${ASUNTO}\n`);

  // Muestra preview del primer mensaje
  console.log('── Preview del mensaje (destinatario 1) ────────────────');
  const d0 = destinatarios[0];
  console.log(`   Para:    ${d0.nombre} <${d0.email}>`);
  console.log(`   DNI:     ${d0.dni}    Legajo: ${d0.legajo}`);
  console.log(`   Teléfono: ${d0.telefono}\n`);
  console.log(CUERPO
    .replace('{{nombre}}', d0.nombre)
    .replace('{{dni}}', d0.dni)
    .replace('{{legajo}}', d0.legajo)
    .split('\n').map(l => '   ' + l).join('\n'));
  console.log('────────────────────────────────────────────────────────\n');

  // Crear campaña en Firestore
  const campRef = db.collection('campaigns').doc();
  await campRef.set({
    orgId:          ORG,
    createdBy:      UID,
    senderEmail:    EMAIL,
    senderUid:      UID,
    nombre:         `[DEMO] Mora GOcuotas — ${new Date().toLocaleDateString('es-AR')}`,
    asunto:         ASUNTO,
    cuerpo:         CUERPO,
    recipientData,
    recipientCount: recipientData.length,
    adjuntos:       [],
    estado:         'enviando',
    stats:          { total: recipientData.length, enviados: 0, leidos: 0, errores: 0, pendientes: recipientData.length },
    createdAt:      FieldValue.serverTimestamp(),
    enqueuedAt:     FieldValue.serverTimestamp(),
    _demo:          true,
  });

  console.log(`✅ Campaña creada en Firestore: ${campRef.id}`);
  console.log(`   ${APP}/dashboard/campaigns/${campRef.id}\n`);

  // Asegurar créditos
  const userRef  = db.collection('users').doc(UID);
  const userSnap = await userRef.get();
  const creditos = userSnap.data()?.creditos ?? 0;
  if (creditos < recipientData.length) {
    await userRef.update({ creditos: FieldValue.increment(recipientData.length - creditos) });
    console.log(`   Créditos ajustados a ${recipientData.length} para el demo.\n`);
  }

  // Disparar fanout
  const workerSecret = process.env.CAMPAIGN_WORKER_SECRET;
  if (!workerSecret) {
    console.log('⚠️  Sin CAMPAIGN_WORKER_SECRET — abrí la UI para disparar manualmente.');
    printLinks(campRef.id);
    return;
  }

  console.log('📤 Disparando fanout...');
  const fanoutRes = await fetch(`${APP}/api/campaigns/fanout`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-Worker-Secret': workerSecret },
    body:    JSON.stringify({ campaignId: campRef.id, offset: 0 }),
  });

  if (!fanoutRes.ok) {
    const err = await fanoutRes.json().catch(() => ({}));
    console.error('❌ Fanout error:', fanoutRes.status, err);
    console.log('\n   La campaña está en Firestore. Podés dispararla desde la UI.');
    printLinks(campRef.id);
    return;
  }

  const fanoutBody = await fanoutRes.json();
  console.log('✅ Fanout OK:', JSON.stringify(fanoutBody));
  console.log('\n📊 Monitoreando... (Ctrl+C para salir)\n');

  // Monitor
  const TIMEOUT = 6 * 60 * 1000;
  const start   = Date.now();
  while (Date.now() - start < TIMEOUT) {
    await new Promise(r => setTimeout(r, 4_000));
    const snap = await campRef.get();
    const s    = snap.data()?.stats || {};
    const est  = snap.data()?.estado || '?';
    const pct  = Math.round(((s.enviados || 0) / recipientData.length) * 20);
    const bar  = '█'.repeat(pct).padEnd(20, '░');
    process.stdout.write(
      `\r   [${bar}] ${s.enviados || 0}/${recipientData.length} enviados | ` +
      `${s.errores || 0} errores | estado: ${est}   `
    );
    if (est === 'completada') { console.log('\n'); break; }
  }

  const final = (await campRef.get()).data();
  const s     = final?.stats || {};
  console.log('── Resultado ───────────────────────────────────');
  console.log(`   Enviados:   ${s.enviados} / ${s.total}`);
  console.log(`   Errores:    ${s.errores}`);
  console.log(`   Pendientes: ${s.pendientes}`);
  console.log(`   Estado:     ${final?.estado}`);
  printLinks(campRef.id);
}

function printLinks(campaignId) {
  console.log(`
── Links ────────────────────────────────────────
   Ver campaña en UI:
   ${APP}/dashboard/campaigns/${campaignId}

   Descargar reporte CSV:
   ${APP}/api/campaigns/export?campaignId=${campaignId}&orgId=${ORG}

   Ver en Firestore:
   https://console.firebase.google.com/project/notificas-f9953/firestore/data/campaigns/${campaignId}
──────────────────────────────────────────────────
  `);
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1); });
