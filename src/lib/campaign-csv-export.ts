import { createHash, randomUUID } from 'crypto';
import { finished } from 'stream/promises';
import { Writable } from 'stream';
import { FieldPath, FieldValue, type Firestore } from 'firebase-admin/firestore';
import { getAdminBucket, getAdminDb } from '@/lib/firebase-admin';
import { recordIssuedDocument, sha256Hex } from '@/lib/issued-documents';
import {
  CAMPAIGN_EXPORT_HEADERS,
  buildCampaignExportFields,
  buildCampaignUploadFields,
  csvRow,
  type CampaignExportContext,
} from '@/lib/campaign-export-csv';
import { csvHeaderColumns } from '@/lib/parse-campaign-csv';
import { csvColumnsFromWaVariables, usesNotificasDefaultTemplate } from '@/lib/wa-template-fields';
import { publicAppBase } from '@/lib/public-verify-url';

export const CSV_EXPORT_PAGE = 200;
export const CSV_EXPORTS_SUBCOLLECTION = 'csv_exports';

export type CsvExportStatus = 'pending' | 'generating' | 'ready' | 'failed';

export type CsvExportKind = 'full' | 'filtered';
export type CsvExportFormat = 'results' | 'upload';

export type CsvExportRecord = {
  campaignId: string;
  orgId: string;
  version: number;
  kind: CsvExportKind;
  status: CsvExportStatus;
  storagePath: string;
  tempStoragePath?: string;
  fileName: string;
  sha256: string;
  rowCount: number;
  byteSize: number;
  generatedAt: unknown;
  createdBy: string;
  createdAt: unknown;
  error?: string;
  messageReads?: number;
  mailReads?: number;
  mailFetchMs?: number;
  durationMs?: number;
  heartbeatAt?: unknown;
  workerNonce?: string;
  filterEstado?: string;
  filterFlag?: string;
  format?: CsvExportFormat;
};

export type CsvExportPublic = {
  campaignId: string;
  orgId: string;
  version: number;
  kind: CsvExportKind;
  status: CsvExportStatus;
  fileName: string;
  sha256: string;
  rowCount: number;
  byteSize: number;
  generatedAt: string | null;
  createdBy: string;
  error?: string;
};

const HEARTBEAT_STALE_MS = 3 * 60 * 1000;

export function csvExportDocId(version: number): string {
  return `v${version}`;
}

export function csvExportsRef(db: Firestore, campaignId: string) {
  return db.collection('campaigns').doc(campaignId).collection(CSV_EXPORTS_SUBCOLLECTION);
}

export function sanitizeExportSlug(nombre: string, campaignId: string): string {
  const raw = String(nombre || campaignId || 'campana');
  const slug = raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .toLowerCase();
  return slug || campaignId.replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 16).toLowerCase() || 'campana';
}

export function csvExportDateStamp(d = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

export function campaignCsvFileName(nombre: string, campaignId: string, version: number, at = new Date()): string {
  return `${sanitizeExportSlug(nombre, campaignId)}-${csvExportDateStamp(at)}-resultados-v${version}.csv`;
}

export function campaignCsvStoragePrefix(orgId: string, campaignId: string, version: number): string {
  return `campaign-exports/${orgId}/${campaignId}/v${version}`;
}

export function formatCsvBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0 B';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const digits = v >= 100 || i === 0 ? 0 : v >= 10 ? 1 : 1;
  return `${v.toLocaleString('es-AR', { maximumFractionDigits: digits, minimumFractionDigits: digits })} ${units[i]}`;
}

export function toCsvExportPublic(data: CsvExportRecord): CsvExportPublic {
  return {
    campaignId: data.campaignId,
    orgId: data.orgId,
    version: data.version,
    kind: data.kind || 'full',
    status: data.status,
    fileName: data.fileName || '',
    sha256: data.sha256 || '',
    rowCount: Number(data.rowCount) || 0,
    byteSize: Number(data.byteSize) || 0,
    generatedAt: timestampToIso(data.generatedAt),
    createdBy: data.createdBy || '',
    error: data.error || undefined,
  };
}

function timestampToIso(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && v && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
    try {
      return (v as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (typeof v === 'object' && v && ('seconds' in v || '_seconds' in v)) {
    const secs = Number((v as { seconds?: number; _seconds?: number }).seconds ?? (v as { _seconds?: number })._seconds);
    if (Number.isFinite(secs)) return new Date(secs * 1000).toISOString();
  }
  return null;
}

function heartbeatAgeMs(v: unknown): number {
  const iso = timestampToIso(v);
  if (!iso) return Number.POSITIVE_INFINITY;
  return Date.now() - new Date(iso).getTime();
}

async function fetchMailDocs(
  db: FirebaseFirestore.Firestore,
  mailIds: string[]
): Promise<Map<string, FirebaseFirestore.DocumentData>> {
  const result = new Map<string, FirebaseFirestore.DocumentData>();
  const CHUNK = 100;
  for (let i = 0; i < mailIds.length; i += CHUNK) {
    const chunk = mailIds.slice(i, i + CHUNK);
    const snaps = await Promise.all(chunk.map((id) => db.collection('mail').doc(id).get()));
    snaps.forEach((snap) => {
      if (snap.exists) result.set(snap.id, snap.data()!);
    });
  }
  return result;
}

type MessageQueryPhase = {
  estado?: string;
  flag?: string;
  waEstado?: string;
};

function problemasPhases(canal: string): MessageQueryPhase[] {
  const phases: MessageQueryPhase[] = [{ estado: 'error' }];
  if (canal === 'whatsapp' || canal === 'ambos') {
    phases.push({ waEstado: 'enviado' });
  }
  return phases;
}

function exportPhases(estado: string, flag: string, canal: string): MessageQueryPhase[] {
  if (flag === 'problemas') return problemasPhases(canal);
  return [{ estado, flag }];
}

function messagesQuery(
  db: FirebaseFirestore.Firestore,
  campaignId: string,
  phase: MessageQueryPhase,
): FirebaseFirestore.Query {
  let q: FirebaseFirestore.Query = db.collection('campaign_messages').where('campaignId', '==', campaignId);
  if (phase.flag === 'waWmidMissing') q = q.where('waWmidMissing', '==', true);
  else if (phase.waEstado) q = q.where('waEstado', '==', phase.waEstado);
  else if (phase.estado && phase.estado !== 'all' && phase.estado !== 'todos') q = q.where('estado', '==', phase.estado);
  return q;
}

export function campaignUploadHeaders(campaign: FirebaseFirestore.DocumentData): string[] {
  const canal = String(campaign.canal || 'email') as 'email' | 'whatsapp' | 'ambos';
  const extra = usesNotificasDefaultTemplate(String(campaign.waTemplateName || ''))
    ? []
    : csvColumnsFromWaVariables(Array.isArray(campaign.waTemplateVariables) ? campaign.waTemplateVariables : []);
  return csvHeaderColumns(canal, extra);
}

function exportCtx(
  campaignId: string,
  campaign: FirebaseFirestore.DocumentData,
  org: FirebaseFirestore.DocumentData
): CampaignExportContext {
  const appBase = publicAppBase();
  return {
    campaignId,
    campaignNombre: String(campaign.nombre || ''),
    remitente: String(org.nombre || campaign.senderEmail || campaign.createdBy || ''),
    cuitRemitente: typeof org.cuit === 'string' ? org.cuit : '',
    canal: String(campaign.canal || ''),
    appBase,
  };
}

type ByteSink = {
  write(buf: Buffer): Promise<void>;
  end(): Promise<void>;
};

function gcsWriteSink(file: { createWriteStream: (opts: Record<string, unknown>) => Writable }): ByteSink {
  const stream = file.createWriteStream({
    resumable: true,
    contentType: 'text/csv; charset=utf-8',
    metadata: { cacheControl: 'private, max-age=0' },
  });
  const done = finished(stream);
  return {
    write(buf: Buffer) {
      return new Promise((resolve, reject) => {
        if (stream.destroyed) {
          reject(new Error('Write stream cerrado'));
          return;
        }
        const onErr = (e: Error) => reject(e);
        stream.once('error', onErr);
        if (stream.write(buf)) {
          stream.off('error', onErr);
          resolve();
        } else {
          stream.once('drain', () => {
            stream.off('error', onErr);
            resolve();
          });
        }
      });
    },
    async end() {
      stream.end();
      await done;
    },
  };
}

export type CsvStreamStats = {
  sha256: string;
  rowCount: number;
  byteSize: number;
  messageReads: number;
  mailReads: number;
  mailFetchMs: number;
};

export async function streamCampaignCsvPages(opts: {
  db: Firestore;
  campaignId: string;
  ctx: CampaignExportContext;
  sink: ByteSink;
  estado?: string;
  flag?: string;
  format?: CsvExportFormat;
  uploadHeaders?: string[];
  failAfterRows?: number;
  onHeartbeat?: (rows: number) => Promise<void>;
}): Promise<CsvStreamStats> {
  const hash = createHash('sha256');
  let byteSize = 0;
  let rowCount = 0;
  let messageReads = 0;
  let mailReads = 0;
  let mailFetchMs = 0;
  let pages = 0;
  const format: CsvExportFormat = opts.format === 'upload' ? 'upload' : 'results';
  const uploadHeaders = opts.uploadHeaders && opts.uploadHeaders.length ? opts.uploadHeaders : ['nombre', 'dni'];
  const seenIds = new Set<string>();

  const write = async (chunk: string) => {
    const buf = Buffer.from(chunk, 'utf8');
    hash.update(buf);
    byteSize += buf.length;
    await opts.sink.write(buf);
  };

  await write(`\uFEFF${csvRow(format === 'upload' ? uploadHeaders : [...CAMPAIGN_EXPORT_HEADERS])}\r\n`);

  const estado = opts.estado || 'all';
  const flag = opts.flag || '';
  const phases = exportPhases(estado, flag, String(opts.ctx.canal || ''));

  for (const phase of phases) {
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    for (;;) {
      let q = messagesQuery(opts.db, opts.campaignId, phase)
        .orderBy('recipientNombre')
        .orderBy(FieldPath.documentId())
        .limit(CSV_EXPORT_PAGE);
      if (lastDoc) q = q.startAfter(lastDoc);
      let pageSnap: FirebaseFirestore.QuerySnapshot;
      try {
        pageSnap = await q.get();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/index|FAILED_PRECONDITION/i.test(msg)) throw e;
        let q2 = messagesQuery(opts.db, opts.campaignId, phase)
          .orderBy('recipientNombre')
          .limit(CSV_EXPORT_PAGE);
        if (lastDoc) q2 = q2.startAfter(lastDoc);
        pageSnap = await q2.get();
      }
      if (pageSnap.empty) break;
      messageReads += pageSnap.size;

      let mailDocs = new Map<string, FirebaseFirestore.DocumentData>();
      if (format !== 'upload') {
        const mailIds = pageSnap.docs
          .map((d) => d.data().mailId as string | undefined)
          .filter((id): id is string => !!id);
        const uniqueMailIds = [...new Set(mailIds)];
        const t0 = Date.now();
        mailDocs = uniqueMailIds.length ? await fetchMailDocs(opts.db, uniqueMailIds) : new Map();
        mailFetchMs += Date.now() - t0;
        mailReads += uniqueMailIds.length;
      }

      for (const d of pageSnap.docs) {
        if (seenIds.has(d.id)) continue;
        seenIds.add(d.id);
        rowCount += 1;
        if (opts.failAfterRows && rowCount >= opts.failAfterRows) {
          throw new Error(`Fallo inyectado tras ${rowCount} filas`);
        }
        const m = d.data();
        if (format === 'upload') {
          await write(`${csvRow(buildCampaignUploadFields(m, uploadHeaders))}\r\n`);
        } else {
          const mail = m.mailId ? (mailDocs.get(m.mailId) ?? {}) : {};
          await write(`${csvRow(buildCampaignExportFields(rowCount, d.id, m, mail, opts.ctx))}\r\n`);
        }
      }

      lastDoc = pageSnap.docs[pageSnap.docs.length - 1];
      pages += 1;
      if (opts.onHeartbeat) {
        await opts.onHeartbeat(rowCount);
      }
      if (pageSnap.size < CSV_EXPORT_PAGE) break;
    }
  }

  await opts.sink.end();
  return {
    sha256: hash.digest('hex'),
    rowCount,
    byteSize,
    messageReads,
    mailReads,
    mailFetchMs,
  };
}

async function deleteGcsQuiet(path: string | undefined): Promise<void> {
  if (!path) return;
  try {
    await getAdminBucket().file(path).delete({ ignoreNotFound: true });
  } catch {
    /* ignore */
  }
}

export async function getCsvExportByDocId(
  db: Firestore,
  campaignId: string,
  docId: string
): Promise<CsvExportRecord | null> {
  const snap = await csvExportsRef(db, campaignId).doc(docId).get();
  if (!snap.exists) return null;
  return snap.data() as CsvExportRecord;
}

export async function getCsvExport(
  db: Firestore,
  campaignId: string,
  version: number
): Promise<CsvExportRecord | null> {
  return getCsvExportByDocId(db, campaignId, csvExportDocId(version));
}

export async function getLatestFullExports(db: Firestore, campaignId: string): Promise<{
  latest: CsvExportRecord | null;
  ready: CsvExportRecord | null;
  inFlight: CsvExportRecord | null;
  failed: CsvExportRecord | null;
}> {
  const camp = await db.collection('campaigns').doc(campaignId).get();
  const latestVersion = Number(camp.data()?.csvExportLatestVersion) || 0;
  const readyVersion = Number(camp.data()?.csvExportReadyVersion) || 0;
  const lockVersion = Number(camp.data()?.csvExportLockVersion) || 0;

  const [latest, ready, inFlight] = await Promise.all([
    latestVersion ? getCsvExport(db, campaignId, latestVersion) : Promise.resolve(null),
    readyVersion ? getCsvExport(db, campaignId, readyVersion) : Promise.resolve(null),
    lockVersion ? getCsvExport(db, campaignId, lockVersion) : Promise.resolve(null),
  ]);

  const failed =
    latest && latest.status === 'failed' && latest.kind !== 'filtered' ? latest : null;

  return { latest, ready, inFlight, failed };
}

export async function startFullCsvExport(opts: {
  campaignId: string;
  orgId: string;
  createdBy: string;
  newVersion?: boolean;
  retry?: boolean;
}): Promise<{ record: CsvExportRecord; started: boolean; httpStatus: number }> {
  const db = getAdminDb();
  const campRef = db.collection('campaigns').doc(opts.campaignId);

  const started = await db.runTransaction(async (tx) => {
    const campSnap = await tx.get(campRef);
    if (!campSnap.exists) throw Object.assign(new Error('Campaña no encontrada'), { httpStatus: 404 });
    const camp = campSnap.data()!;
    if (String(camp.orgId) !== opts.orgId) {
      throw Object.assign(new Error('Campaña no encontrada'), { httpStatus: 404 });
    }

    const lockVersion = Number(camp.csvExportLockVersion) || 0;
    const latestVersion = Number(camp.csvExportLatestVersion) || 0;
    const readyVersion = Number(camp.csvExportReadyVersion) || 0;

    if (lockVersion) {
      const lockSnap = await tx.get(csvExportsRef(db, opts.campaignId).doc(csvExportDocId(lockVersion)));
      const rec = (lockSnap.data() || {}) as CsvExportRecord;
      return { record: rec, started: false, httpStatus: 200 };
    }

    if (opts.retry) {
      if (!latestVersion) throw Object.assign(new Error('No hay un export para reintentar'), { httpStatus: 400 });
      const latestRef = csvExportsRef(db, opts.campaignId).doc(csvExportDocId(latestVersion));
      const latestSnap = await tx.get(latestRef);
      const rec = latestSnap.data() as CsvExportRecord | undefined;
      if (!rec || rec.status !== 'failed') {
        throw Object.assign(new Error('Solo se puede reintentar un export failed'), { httpStatus: 409 });
      }
      const next: CsvExportRecord = {
        ...rec,
        status: 'pending',
        error: '',
        sha256: '',
        rowCount: 0,
        byteSize: 0,
        storagePath: '',
        tempStoragePath: '',
        createdBy: opts.createdBy,
      };
      tx.set(latestRef, {
        status: 'pending',
        error: FieldValue.delete(),
        sha256: '',
        rowCount: 0,
        byteSize: 0,
        storagePath: '',
        tempStoragePath: '',
        createdBy: opts.createdBy,
        workerNonce: '',
      }, { merge: true });
      tx.update(campRef, { csvExportLockVersion: latestVersion, csvExportStatus: 'pending' });
      return { record: { ...next, status: 'pending' as const }, started: true, httpStatus: 202 };
    }

    if (!opts.newVersion && readyVersion) {
      const readySnap = await tx.get(csvExportsRef(db, opts.campaignId).doc(csvExportDocId(readyVersion)));
      const rec = readySnap.data() as CsvExportRecord;
      return { record: rec, started: false, httpStatus: 200 };
    }

    const version = latestVersion + 1;
    const fileName = campaignCsvFileName(String(camp.nombre || ''), opts.campaignId, version);
    const record: CsvExportRecord = {
      campaignId: opts.campaignId,
      orgId: opts.orgId,
      version,
      kind: 'full',
      status: 'pending',
      storagePath: '',
      fileName,
      sha256: '',
      rowCount: 0,
      byteSize: 0,
      generatedAt: null,
      createdBy: opts.createdBy,
      createdAt: FieldValue.serverTimestamp(),
    };
    tx.set(csvExportsRef(db, opts.campaignId).doc(csvExportDocId(version)), record);
    tx.update(campRef, {
      csvExportLatestVersion: version,
      csvExportLockVersion: version,
      csvExportStatus: 'pending',
    });
    return { record, started: true, httpStatus: 202 };
  });

  return started;
}

export async function startFilteredCsvExport(opts: {
  campaignId: string;
  orgId: string;
  createdBy: string;
  estado: string;
  flag: string;
  format?: CsvExportFormat;
}): Promise<{ record: CsvExportRecord; exportDocId: string; started: boolean }> {
  const db = getAdminDb();
  const campSnap = await db.collection('campaigns').doc(opts.campaignId).get();
  if (!campSnap.exists || String(campSnap.data()?.orgId) !== opts.orgId) {
    throw Object.assign(new Error('Campaña no encontrada'), { httpStatus: 404 });
  }
  const camp = campSnap.data()!;
  const id = `adhoc-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const version = 0;
  const format: CsvExportFormat = opts.format === 'upload' ? 'upload' : 'results';
  const suffix =
    opts.flag === 'problemas'
      ? 'para-empresa'
      : opts.flag === 'waWmidMissing'
        ? 'wamid'
        : (opts.estado && opts.estado !== 'all' && opts.estado !== 'todos' ? opts.estado : 'vista');
  const fileName = `${sanitizeExportSlug(String(camp.nombre || ''), opts.campaignId)}-${csvExportDateStamp()}-${suffix}.csv`;
  const record: CsvExportRecord = {
    campaignId: opts.campaignId,
    orgId: opts.orgId,
    version,
    kind: 'filtered',
    status: 'pending',
    storagePath: '',
    fileName,
    sha256: '',
    rowCount: 0,
    byteSize: 0,
    generatedAt: null,
    createdBy: opts.createdBy,
    createdAt: FieldValue.serverTimestamp(),
    filterEstado: opts.estado,
    filterFlag: opts.flag,
    format,
  };
  await csvExportsRef(db, opts.campaignId).doc(id).set(record);
  return { record, exportDocId: id, started: true };
}

export async function runCsvExportJob(opts: {
  campaignId: string;
  version?: number;
  exportDocId?: string;
  failAfterRows?: number;
}): Promise<CsvExportRecord> {
  const db = getAdminDb();
  const campSnap = await db.collection('campaigns').doc(opts.campaignId).get();
  if (!campSnap.exists) throw new Error('Campaña no encontrada');
  const campaign = campSnap.data()!;
  const orgId = String(campaign.orgId || '');
  const docId = opts.exportDocId || csvExportDocId(opts.version || 0);
  const exportRef = csvExportsRef(db, opts.campaignId).doc(docId);
  const exportSnap = await exportRef.get();
  if (!exportSnap.exists) throw new Error('Export no encontrado');
  const current = exportSnap.data() as CsvExportRecord;

  if (current.status === 'ready' && current.storagePath) {
    return current;
  }

  if (
    current.status === 'generating' &&
    current.workerNonce &&
    heartbeatAgeMs(current.heartbeatAt) < HEARTBEAT_STALE_MS
  ) {
    return current;
  }

  const workerNonce = randomUUID();
  const version = current.kind === 'filtered' ? 0 : current.version;
  const fileName = current.fileName || campaignCsvFileName(String(campaign.nombre || ''), opts.campaignId, version || 1);
  const prefix =
    current.kind === 'filtered'
      ? `campaign-exports/${orgId}/${opts.campaignId}/adhoc/${docId}`
      : campaignCsvStoragePrefix(orgId, opts.campaignId, version);
  const tempStoragePath = `${prefix}/generating/${workerNonce}.csv.partial`;
  const storagePath = current.kind === 'filtered' ? `${prefix}/results.csv` : `${prefix}/${fileName}`;

  await deleteGcsQuiet(current.tempStoragePath);
  if (current.status !== 'ready') await deleteGcsQuiet(current.storagePath);

  await exportRef.update({
    status: 'generating',
    workerNonce,
    tempStoragePath,
    fileName,
    storagePath: '',
    error: FieldValue.delete(),
    heartbeatAt: FieldValue.serverTimestamp(),
  });
  if (current.kind === 'full') {
    await db.collection('campaigns').doc(opts.campaignId).update({
      csvExportLockVersion: version,
      csvExportStatus: 'generating',
    }).catch(() => undefined);
  }

  const orgSnap = await db.collection('organizations').doc(orgId).get();
  const ctx = exportCtx(opts.campaignId, campaign, orgSnap.data() || {});
  const bucket = getAdminBucket();
  const tempFile = bucket.file(tempStoragePath);
  const startedAt = Date.now();

  try {
    const format: CsvExportFormat = current.format === 'upload' ? 'upload' : 'results';
    const stats = await streamCampaignCsvPages({
      db,
      campaignId: opts.campaignId,
      ctx,
      sink: gcsWriteSink(tempFile),
      estado: current.filterEstado || 'all',
      flag: current.filterFlag || '',
      format,
      uploadHeaders: format === 'upload' ? campaignUploadHeaders(campaign) : undefined,
      failAfterRows: opts.failAfterRows,
      onHeartbeat: async (rows) => {
        await exportRef.update({
          heartbeatAt: FieldValue.serverTimestamp(),
          rowCount: rows,
        }).catch(() => undefined);
      },
    });

    const [meta] = await tempFile.getMetadata();
    const storedSize = Number(meta.size || 0);
    if (storedSize <= 0 || stats.byteSize <= 0) {
      throw new Error('Archivo CSV vacío');
    }
    if (storedSize !== stats.byteSize) {
      throw new Error(`Tamaño GCS (${storedSize}) distinto del hash stream (${stats.byteSize})`);
    }
    if (!stats.sha256 || stats.sha256.length !== 64) {
      throw new Error('SHA-256 inválido');
    }

    const head = await tempFile.download({ start: 0, end: 160 });
    const headText = head[0].toString('utf8');
    if (format === 'upload') {
      if (!headText.includes('nombre') || !headText.includes('dni')) {
        throw new Error('Encabezado CSV ausente');
      }
    } else if (!headText.includes('Campaign ID') || !headText.includes('Notification ID')) {
      throw new Error('Encabezado CSV ausente');
    }

    const finalFile = bucket.file(storagePath);
    await tempFile.copy(finalFile);
    await deleteGcsQuiet(tempStoragePath);

    const durationMs = Date.now() - startedAt;
    const ready: Partial<CsvExportRecord> = {
      status: 'ready',
      storagePath,
      tempStoragePath: '',
      fileName,
      sha256: stats.sha256,
      rowCount: stats.rowCount,
      byteSize: stats.byteSize,
      generatedAt: FieldValue.serverTimestamp(),
      messageReads: stats.messageReads,
      mailReads: stats.mailReads,
      mailFetchMs: stats.mailFetchMs,
      durationMs,
      workerNonce,
    };
    await exportRef.set(ready, { merge: true });

    if (current.kind === 'full') {
      await db.collection('campaigns').doc(opts.campaignId).update({
        csvExportLockVersion: 0,
        csvExportReadyVersion: version,
        csvExportStatus: 'ready',
        csvExportHash: stats.sha256,
        csvExportFileName: fileName,
        csvExportAt: FieldValue.serverTimestamp(),
        csvExportVersion: version,
        csvExportRowCount: stats.rowCount,
        csvExportByteSize: stats.byteSize,
      });
      await recordIssuedDocument(db, {
        hash: stats.sha256,
        kind: 'campaign_export',
        campaignId: opts.campaignId,
        orgId,
        ...(typeof campaign.orgNombre === 'string' ? { orgNombre: campaign.orgNombre } : {}),
        campaignNombre: String(campaign.nombre || ''),
        fileName,
      });
    }

    const done = await exportRef.get();
    return done.data() as CsvExportRecord;
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    await deleteGcsQuiet(tempStoragePath);
    await exportRef.set({
      status: 'failed',
      error: err.slice(0, 500),
      tempStoragePath: '',
      storagePath: '',
      heartbeatAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    if (current.kind === 'full') {
      await db.collection('campaigns').doc(opts.campaignId).update({
        csvExportLockVersion: 0,
        csvExportStatus: 'failed',
      }).catch(() => undefined);
    }
    throw e;
  }
}

export async function signCsvExportDownload(opts: {
  campaignId: string;
  orgId: string;
  version?: number;
  exportDocId?: string;
}): Promise<{ url: string; fileName: string; expiresAt: string; record: CsvExportRecord }> {
  const db = getAdminDb();
  const camp = await db.collection('campaigns').doc(opts.campaignId).get();
  if (!camp.exists || String(camp.data()?.orgId) !== opts.orgId) {
    throw Object.assign(new Error('Campaña no encontrada'), { httpStatus: 404 });
  }
  const docId = opts.exportDocId || csvExportDocId(opts.version || Number(camp.data()?.csvExportReadyVersion) || 0);
  if (!opts.exportDocId && !(opts.version || Number(camp.data()?.csvExportReadyVersion))) {
    throw Object.assign(new Error('No hay un CSV listo'), { httpStatus: 404 });
  }
  const rec = (await csvExportsRef(db, opts.campaignId).doc(docId).get()).data() as CsvExportRecord | undefined;
  if (!rec) throw Object.assign(new Error('Export no encontrado'), { httpStatus: 404 });
  if (rec.orgId && rec.orgId !== opts.orgId) {
    throw Object.assign(new Error('No autorizado'), { httpStatus: 403 });
  }
  if (rec.status !== 'ready' || !rec.storagePath) {
    throw Object.assign(new Error('El CSV todavía no está listo'), { httpStatus: 409 });
  }
  const expires = Date.now() + 10 * 60 * 1000;
  const [url] = await getAdminBucket().file(rec.storagePath).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires,
    responseDisposition: `attachment; filename="${rec.fileName.replace(/"/g, '')}"`,
    responseType: 'text/csv; charset=utf-8',
  });
  return { url, fileName: rec.fileName, expiresAt: new Date(expires).toISOString(), record: rec };
}

/** Hash incremental de un buffer partido en chunks — para tests. */
export function sha256Incremental(chunks: Buffer[]): string {
  const h = createHash('sha256');
  for (const c of chunks) h.update(c);
  return h.digest('hex');
}

export { sha256Hex };
