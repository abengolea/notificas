#!/usr/bin/env node
/**
 * Ajusta la velocidad de la cola Cloud Tasks.
 *
 * Uso:
 *   node scripts/warmup-campaign.js --campaign=<campaignId> --org=<orgId> --dia=<1|2|3>
 *
 * El límite diario se edita en la campaña (campo tandaSize / "Envíos por día").
 * Un cambio a mitad de campaña rige al día siguiente (tandaDayQuota queda congelado hoy).
 * Día 1 = 2.000 (cupo actual de Meta). Subilo en la UI cuando WhatsApp lo permita.
 *
 * Requiere: FIREBASE_PROJECT_ID, CAMPAIGN_WORKER_SECRET en env.
 */

const https = require('https');

const PLANES = {
  1: { tandaSize: 2_000,   tasaMsgSeg: 1,  yaEnviados: 0     },  // cupo actual Meta
  2: { tandaSize: 10_000,  tasaMsgSeg: 2,  yaEnviados: 2_000 },  // solo si Meta ya subió el límite
  3: { tandaSize: 50_000,  tasaMsgSeg: 5,  yaEnviados: 10_000 },
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
  const nuevos = plan.tandaSize - plan.yaEnviados;
  console.log(`\n🚀 Warm-up día ${dia} — Campaña ${campaignId}`);
  console.log(`   Tope acumulado (tandaSize): ${plan.tandaSize.toLocaleString()}`);
  console.log(`   Envíos nuevos de este día: ${nuevos.toLocaleString()}`);
  console.log(`   Velocidad cola: ${plan.tasaMsgSeg} tasks/seg`);
  console.log(`   Tiempo estimado: ${calcularTiempo(nuevos, plan.tasaMsgSeg)}`);
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
