#!/usr/bin/env node
/**
 * Warm-up progresivo para campañas WhatsApp de alto volumen.
 *
 * Uso:
 *   node scripts/warmup-campaign.js --campaign=<campaignId> --org=<orgId> --dia=<1|2|3>
 *
 * Días de warm-up recomendados para 150k destinatarios:
 *   Día 1:  10.000  (valida calidad del número y tasa de entrega)
 *   Día 2:  40.000  (escala al Tier 2 de Meta)
 *   Día 3: 100.000  (el resto)
 *
 * Requiere: FIREBASE_PROJECT_ID, CAMPAIGN_WORKER_SECRET en env.
 */

const https = require('https');

const PLANES = {
  1: { tandaSize: 10_000,  tasaMsgSeg: 2   },  // ~1.4hs
  2: { tandaSize: 40_000,  tasaMsgSeg: 5   },  // ~2.2hs
  3: { tandaSize: 100_000, tasaMsgSeg: 10  },  // ~2.8hs
};

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => a.slice(2).split('='))
);

const { campaign: campaignId, org: orgId, dia } = args;
const plan = PLANES[Number(dia)];

if (!campaignId || !orgId || !plan) {
  console.error('Uso: node scripts/warmup-campaign.js --campaign=ID --org=ID --dia=1|2|3');
  process.exit(1);
}

const PROJECT = process.env.FIREBASE_PROJECT_ID || 'notificas-f9953';
const LOCATION = process.env.CLOUD_TASKS_LOCATION || 'us-central1';
const QUEUE    = process.env.CLOUD_TASKS_QUEUE    || 'campaign-notifications';

async function setQueueRate(tasksPerSecond) {
  const { execSync } = require('child_process');
  console.log(`\n⚡ Ajustando cola a ${tasksPerSecond} dispatches/segundo...`);
  try {
    execSync(
      `gcloud tasks queues update ${QUEUE} --location=${LOCATION} --project=${PROJECT} ` +
      `--max-dispatches-per-second=${tasksPerSecond}`,
      { stdio: 'inherit' }
    );
    console.log('✅ Velocidad de cola actualizada.');
  } catch (e) {
    console.error('❌ Error actualizando cola (¿tenés gcloud configurado?):', e.message);
    process.exit(1);
  }
}

async function updateCampaignTandaSize(tandaSize) {
  // Llama a Firestore Admin directamente vía Firebase REST API.
  // Por simplicidad, imprime el comando para hacerlo manualmente.
  console.log(`\n📋 Para limitar la tanda, ejecutar en Firebase Console o via SDK:`);
  console.log(`   campaigns/${campaignId}  →  tandaSize: ${tandaSize}`);
  console.log(`\n   O con firebase-admin:`);
  console.log(`   db.collection('campaigns').doc('${campaignId}').update({ tandaSize: ${tandaSize} })`);
}

function calcularTiempo(total, tasksPerSeg, batchSize = 20) {
  const tasks = Math.ceil(total / batchSize);
  const segundos = tasks / tasksPerSeg;
  const horas = Math.floor(segundos / 3600);
  const mins  = Math.floor((segundos % 3600) / 60);
  return `~${horas}h ${mins}min`;
}

async function main() {
  console.log(`\n🚀 Warm-up día ${dia} — Campaña ${campaignId}`);
  console.log(`   Tanda: ${plan.tandaSize.toLocaleString()} destinatarios`);
  console.log(`   Velocidad cola: ${plan.tasaMsgSeg} tasks/seg`);
  console.log(`   Tiempo estimado: ${calcularTiempo(plan.tandaSize, plan.tasaMsgSeg)}`);
  console.log('');

  // 1. Ajustar velocidad de la cola de Cloud Tasks.
  await setQueueRate(plan.tasaMsgSeg);

  // 2. Indicar cómo configurar tandaSize en la campaña.
  await updateCampaignTandaSize(plan.tandaSize);

  console.log(`\n✅ Configuración lista. Próximos pasos:`);
  console.log(`   1. Actualizá tandaSize en Firestore (ver arriba)`);
  console.log(`   2. Disparar el envío desde la UI de Notificas (o vía API)`);
  console.log(`   3. Monitorear en Firebase Console → Firestore → campaigns/${campaignId}`);
  console.log(`   4. Mañana correr: node scripts/warmup-campaign.js --campaign=${campaignId} --org=${orgId} --dia=${Number(dia)+1}`);
  console.log('');

  if (Number(dia) === 1) {
    console.log(`⚠️  IMPORTANTE (Día 1):`);
    console.log(`   - Revisá la tasa de entrega luego de los primeros 1.000 envíos`);
    console.log(`   - Si hay muchos rechazos (>15%), pausar y revisar la calidad de la base`);
    console.log(`   - Verificar que el template de Meta esté aprobado antes de arrancar`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
