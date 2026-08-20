#!/usr/bin/env npx tsx
/**
 * Carga y casos de borde del export CSV streaming.
 *
 *   npx tsx scripts/test-campaign-csv-export.ts --org=<orgId> --rows=1000
 *   npx tsx scripts/test-campaign-csv-export.ts --org=<orgId> --rows=15000
 *   npx tsx scripts/test-campaign-csv-export.ts --org=<orgId> --rows=1000 --fail --retry
 *   npx tsx scripts/test-campaign-csv-export.ts --org=<orgId> --rows=1000 --v2
 *   npx tsx scripts/test-campaign-csv-export.ts --synthetic=150000
 *
 * Requiere .env.local (Firebase Admin + bucket).
 */
import { createHash } from 'crypto';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminBucket, getAdminDb } from '../src/lib/firebase-admin';
import {
  csvRow,
  CAMPAIGN_EXPORT_HEADERS,
} from '../src/lib/campaign-export-csv';
import {
  campaignCsvFileName,
  getCsvExport,
  getLatestFullExports,
  runCsvExportJob,
  signCsvExportDownload,
  startFullCsvExport,
  toCsvExportPublic,
} from '../src/lib/campaign-csv-export';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  if (process.argv.includes(`--${name}`)) return '1';
  return undefined;
}

function rssMb(): number {
  return Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10;
}

async function seedMessages(opts: {
  db: FirebaseFirestore.Firestore;
  campaignId: string;
  orgId: string;
  rows: number;
}): Promise<{ mailWrites: number }> {
  const { db, campaignId, orgId, rows } = opts;
  const batchSize = 400;
  let mailWrites = 0;
  for (let i = 0; i < rows; i += batchSize) {
    const batch = db.batch();
    const end = Math.min(rows, i + batchSize);
    for (let n = i; n < end; n++) {
      const id = `csvload-${campaignId}-${String(n).padStart(6, '0')}`;
      const mailId = `csvmail-${campaignId}-${String(n).padStart(6, '0')}`;
      const nombre = n % 17 === 0 ? `García, "José" ${n}` : `Persona ${String(n).padStart(6, '0')}`;
      batch.set(db.collection('campaign_messages').doc(id), {
        campaignId,
        orgId,
        mailId,
        recipientNombre: nombre,
        recipientDni: String(20000000 + n),
        recipientEmail: n % 5 === 0 ? `user,${n}@test.example` : `user${n}@test.example`,
        recipientTelefono: `+5491100${String(n).padStart(6, '0')}`,
        estado: 'enviado',
        waEstado: 'entregado',
      });
      batch.set(db.collection('mail').doc(mailId), {
        campaignId,
        recipientPhone: `+5491100${String(n).padStart(6, '0')}`,
        whatsappMessageId: `wamid.test.${n}`,
        waRequestSnapshot: { templateName: 'tpl_test', templateId: 'id_test', templateLang: 'es_AR', templateHash: 'ab'.repeat(32) },
      });
      mailWrites += 1;
    }
    await batch.commit();
    process.stdout.write(`\r  seed ${end}/${rows}`);
  }
  process.stdout.write('\n');
  return { mailWrites };
}

async function cleanupSeed(db: FirebaseFirestore.Firestore, campaignId: string, rows: number) {
  const batchSize = 400;
  for (let i = 0; i < rows; i += batchSize) {
    const batch = db.batch();
    const end = Math.min(rows, i + batchSize);
    for (let n = i; n < end; n++) {
      const id = `csvload-${campaignId}-${String(n).padStart(6, '0')}`;
      const mailId = `csvmail-${campaignId}-${String(n).padStart(6, '0')}`;
      batch.delete(db.collection('campaign_messages').doc(id));
      batch.delete(db.collection('mail').doc(mailId));
    }
    await batch.commit();
  }
}

async function syntheticStream(rows: number) {
  const started = Date.now();
  const peak = { rss: rssMb() };
  const hash = createHash('sha256');
  let byteSize = 0;
  const write = (s: string) => {
    const buf = Buffer.from(s, 'utf8');
    hash.update(buf);
    byteSize += buf.length;
    const r = rssMb();
    if (r > peak.rss) peak.rss = r;
  };
  write(`\uFEFF${csvRow([...CAMPAIGN_EXPORT_HEADERS])}\r\n`);
  for (let n = 1; n <= rows; n++) {
    const fields = Array.from({ length: CAMPAIGN_EXPORT_HEADERS.length }, (_, i) =>
      i === 0 ? n : i === 6 ? `García, "José" ${n}` : `v${n}-${i}`
    );
    write(`${csvRow(fields)}\r\n`);
    if (n % 20000 === 0) process.stdout.write(`\r  synthetic ${n}/${rows} rss=${rssMb()}MB`);
  }
  process.stdout.write('\n');
  console.log(JSON.stringify({
    mode: 'synthetic-no-firestore',
    rows,
    byteSize,
    sha256: hash.digest('hex'),
    durationMs: Date.now() - started,
    rssPeakMb: peak.rss,
    rssEndMb: rssMb(),
  }, null, 2));
}

async function postReadyChecks(
  db: FirebaseFirestore.Firestore,
  campaignId: string,
  orgId: string,
  createdBy: string,
  version: number,
  otherOrg: string | undefined,
  v2: boolean
) {
  const noRegen = await startFullCsvExport({ campaignId, orgId, createdBy });
  console.log('segunda Generar no regenera:', { started: noRegen.started, version: noRegen.record.version, status: noRegen.record.status });
  const second = await signCsvExportDownload({ campaignId, orgId, version });
  console.log('segunda descarga (signed, sin regenerar):', second.fileName, second.url.slice(0, 48) + '…');

  if (otherOrg) {
    try {
      await signCsvExportDownload({ campaignId, orgId: otherOrg, version });
      throw new Error('otra org no debería descargar');
    } catch (e) {
      console.log('otra org bloqueada:', e instanceof Error ? e.message : e);
    }
  }

  if (v2) {
    const s2 = await startFullCsvExport({ campaignId, orgId, createdBy, newVersion: true });
    const rec2 = await runCsvExportJob({ campaignId, version: s2.record.version });
    const v1 = await getCsvExport(db, campaignId, version);
    console.log('v2 ready', { version: rec2.version, sha256: rec2.sha256, rowCount: rec2.rowCount });
    console.log('v1 intacta', { status: v1?.status, sha256: v1?.sha256, storagePath: v1?.storagePath });
    if (v1?.status !== 'ready') throw new Error('v1 se perdió');
  }
}

async function main() {
  const synthetic = Number(arg('synthetic') || 0);
  if (synthetic > 0) {
    await syntheticStream(synthetic);
    return;
  }

  let orgId = arg('org');
  const rows = Number(arg('rows') || 1000);
  const fail = Boolean(arg('fail'));
  const retry = Boolean(arg('retry'));
  const v2 = Boolean(arg('v2'));
  const keep = Boolean(arg('keep'));
  const otherOrg = arg('otherOrg');
  const db = getAdminDb();
  if (!orgId) {
    const orgs = await db.collection('organizations').limit(1).get();
    orgId = orgs.docs[0]?.id;
  }
  if (!orgId) {
    console.error('Falta --org=ORG_ID (o usá --synthetic=N)');
    process.exit(1);
  }
  const campaignId = `csv-export-load-${rows}-${Date.now().toString(36)}`;
  await db.collection('campaigns').doc(campaignId).set({
    orgId,
    nombre: 'Prueba CSV "Familia", carga',
    canal: 'whatsapp',
    estado: 'completada',
    recipientCount: rows,
    createdAt: FieldValue.serverTimestamp(),
  });
  console.log(`campaña ${campaignId}  filas=${rows}  rss0=${rssMb()}MB`);
  const tSeed = Date.now();
  const seeded = await seedMessages({ db, campaignId, orgId, rows });
  console.log(`seed ${Date.now() - tSeed}ms  mailWrites=${seeded.mailWrites}`);

  const createdBy = 'csv-load-test';
  const start1 = await startFullCsvExport({ campaignId, orgId, createdBy });
  const startDup = await startFullCsvExport({ campaignId, orgId, createdBy });
  console.log('doble generar (segunda no debe mintar v2):', {
    first: start1.record.version,
    firstStarted: start1.started,
    secondStarted: startDup.started,
    secondVersion: startDup.record.version,
  });

  const peak = { rss: rssMb() };
  const timer = setInterval(() => {
    const r = rssMb();
    if (r > peak.rss) peak.rss = r;
  }, 200);

  try {
    if (fail) {
      const t0 = Date.now();
      try {
        await runCsvExportJob({ campaignId, version: start1.record.version, failAfterRows: 50 });
        throw new Error('el fail inyectado no disparó');
      } catch (e) {
        console.log('fallo a mitad:', e instanceof Error ? e.message : e);
      }
      const failed = await getCsvExport(db, campaignId, start1.record.version);
      console.log('estado tras fallo:', failed?.status, failed?.error, 'storagePath=', failed?.storagePath || '(vacío)');
      if (failed?.status !== 'failed') throw new Error('status debería ser failed');
      if (failed.storagePath) throw new Error('no debe quedar objeto ready');
      if (!retry) throw new Error('pasá --retry para completar');
      const again = await startFullCsvExport({ campaignId, orgId, createdBy, retry: true });
      console.log('retry started', again.started, 'v', again.record.version);
      const rec = await runCsvExportJob({ campaignId, version: again.record.version });
      console.log('retry ready', {
        status: rec.status,
        rowCount: rec.rowCount,
        byteSize: rec.byteSize,
        sha256: rec.sha256,
        mailReads: rec.mailReads,
        mailFetchMs: rec.mailFetchMs,
        messageReads: rec.messageReads,
        durationMs: rec.durationMs || Date.now() - t0,
        rssPeakMb: peak.rss,
      });
      await postReadyChecks(db, campaignId, orgId, createdBy, rec.version, otherOrg, v2);
    } else {
      const rec = await runCsvExportJob({ campaignId, version: start1.record.version });
      const pub = toCsvExportPublic(rec);
      console.log('v1 ready', {
        ...pub,
        mailReads: rec.mailReads,
        mailFetchMs: rec.mailFetchMs,
        messageReads: rec.messageReads,
        durationMs: rec.durationMs,
        rssPeakMb: peak.rss,
        rssEndMb: rssMb(),
        fileName: rec.fileName || campaignCsvFileName('x', campaignId, 1),
      });
      await postReadyChecks(db, campaignId, orgId, createdBy, rec.version, otherOrg, v2);
    }

    const latest = await getLatestFullExports(db, campaignId);
    console.log('latest', {
      ready: latest.ready?.version,
      failed: latest.failed?.version,
      inFlight: latest.inFlight?.status,
    });
  } finally {
    clearInterval(timer);
    if (!keep) {
      await cleanupSeed(db, campaignId, rows);
      console.log('seed borrado (--keep para conservar)');
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
