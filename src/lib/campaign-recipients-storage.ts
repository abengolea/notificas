import { createHash } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminBucket, getAdminDb, getEvidenceBucket } from '@/lib/firebase-admin';
import { RECIPIENT_CHUNK_SIZE } from '@/lib/campaign-recipients';
import type { RecipientEntry } from '@/lib/types';

export const MAX_CAMPAIGN_SOURCE_BYTES = 32 * 1024 * 1024;

export function campaignSourceObjectPath(orgId: string, campaignId: string, sha256: string, ext: string) {
  const safeExt = ext === 'json' ? 'json' : 'csv';
  return `campaign-source/${orgId}/${campaignId}/${sha256}.${safeExt}`;
}

export function recipientStoragePath(orgId: string, campaignId: string): string {
  return `campaign-recipients/${orgId}/${campaignId}`;
}

export async function saveRecipientChunk(
  orgId: string,
  campaignId: string,
  chunkIndex: number,
  recipients: RecipientEntry[]
): Promise<void> {
  const bucket = getAdminBucket();
  const basePath = recipientStoragePath(orgId, campaignId);
  const file = bucket.file(`${basePath}/chunk_${chunkIndex}.json`);
  await file.save(JSON.stringify(recipients), { contentType: 'application/json', resumable: false });
  await getAdminDb().collection('campaigns').doc(campaignId).update({
    recipientStoragePath: basePath,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function finalizeRecipientUpload(
  orgId: string,
  campaignId: string,
  chunkCount: number,
  recipientCount: number
): Promise<{ stored: number }> {
  const bucket = getAdminBucket();
  const basePath = recipientStoragePath(orgId, campaignId);
  const [files] = await bucket.getFiles({ prefix: `${basePath}/chunk_` });
  const stored = files.filter((f) => /\/chunk_\d+\.json$/.test(f.name)).length;
  if (stored < chunkCount) {
    throw new Error(`Faltan archivos: hay ${stored} de ${chunkCount}`);
  }
  await getAdminDb().collection('campaigns').doc(campaignId).update({
    recipientStoragePath: basePath,
    recipientChunkCount: chunkCount,
    recipientCount,
    recipientData: FieldValue.delete(),
    recipientEmails: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await sealJsonChunksDigest(orgId, campaignId).catch((e) =>
    console.warn('⚠️ No se pudo lacrar digest de chunks:', e instanceof Error ? e.message : e)
  );
  return { stored };
}

export async function saveAllRecipientChunks(
  orgId: string,
  campaignId: string,
  recipients: RecipientEntry[]
): Promise<{ chunkCount: number; recipientCount: number }> {
  const bucket = getAdminBucket();
  const basePath = recipientStoragePath(orgId, campaignId);
  const chunkCount = Math.ceil(recipients.length / RECIPIENT_CHUNK_SIZE);
  const CONCURRENT = 10;
  for (let i = 0; i < chunkCount; i += CONCURRENT) {
    const batch = Array.from({ length: Math.min(CONCURRENT, chunkCount - i) }, (_, j) => {
      const idx = i + j;
      const chunk = recipients.slice(idx * RECIPIENT_CHUNK_SIZE, (idx + 1) * RECIPIENT_CHUNK_SIZE);
      const file = bucket.file(`${basePath}/chunk_${idx}.json`);
      return file.save(JSON.stringify(chunk), { contentType: 'application/json', resumable: false });
    });
    await Promise.all(batch);
  }
  await getAdminDb().collection('campaigns').doc(campaignId).update({
    recipientStoragePath: basePath,
    recipientChunkCount: chunkCount,
    recipientCount: recipients.length,
    recipientData: FieldValue.delete(),
    recipientEmails: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await sealJsonChunksDigest(orgId, campaignId).catch((e) =>
    console.warn('⚠️ No se pudo lacrar digest de chunks:', e instanceof Error ? e.message : e)
  );
  return { chunkCount, recipientCount: recipients.length };
}

export type SealedCampaignSource = {
  sha256: string;
  path: string;
  byteLength: number;
  fileName: string;
  kind: 'csv' | 'json_chunks';
};

/** Archivo original (CSV) en el bucket de evidencia. Primera escritura gana por hash. */
export async function sealCampaignOriginalBytes(opts: {
  orgId: string;
  campaignId: string;
  bytes: Buffer;
  fileName: string;
  kind?: 'csv' | 'json_chunks';
}): Promise<SealedCampaignSource> {
  const kind = opts.kind || 'csv';
  const sha256 = createHash('sha256').update(opts.bytes).digest('hex');
  const ext = kind === 'json_chunks' ? 'json' : 'csv';
  const path = campaignSourceObjectPath(opts.orgId, opts.campaignId, sha256, ext);
  const file = getEvidenceBucket().file(path);
  try {
    await file.save(opts.bytes, {
      resumable: false,
      contentType: kind === 'json_chunks' ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8',
      metadata: {
        cacheControl: 'private,max-age=31536000',
        metadata: {
          campaignId: opts.campaignId,
          orgId: opts.orgId,
          originalFileName: opts.fileName.slice(0, 200),
        },
      },
      preconditionOpts: { ifGenerationMatch: 0 },
    });
  } catch (e: unknown) {
    const code = typeof e === 'object' && e && 'code' in e ? Number((e as { code?: number }).code) : 0;
    if (code !== 412) throw e;
  }

  await getAdminDb().collection('campaigns').doc(opts.campaignId).update({
    sourceOrigin: {
      kind,
      sha256,
      path,
      fileName: opts.fileName.slice(0, 200),
      byteLength: opts.bytes.length,
      sealedAt: FieldValue.serverTimestamp(),
    },
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { sha256, path, byteLength: opts.bytes.length, fileName: opts.fileName, kind };
}

/** Si no hubo CSV, huella de los chunks JSON ya guardados (lo que el fanout va a leer). */
export async function sealJsonChunksDigest(orgId: string, campaignId: string): Promise<SealedCampaignSource | null> {
  const db = getAdminDb();
  const camp = await db.collection('campaigns').doc(campaignId).get();
  const existing = camp.data()?.sourceOrigin as { sha256?: string } | undefined;
  if (existing?.sha256) return null;

  const basePath = recipientStoragePath(orgId, campaignId);
  const [files] = await getAdminBucket().getFiles({ prefix: `${basePath}/chunk_` });
  const chunks = files.filter((f) => /\/chunk_\d+\.json$/.test(f.name)).sort((a, b) => a.name.localeCompare(b.name));
  if (chunks.length === 0) return null;

  const hash = createHash('sha256');
  for (const f of chunks) {
    const [buf] = await f.download();
    hash.update(f.name);
    hash.update('\n');
    hash.update(buf);
  }
  const digestHex = hash.digest('hex');
  const manifest = Buffer.from(
    JSON.stringify({
      kind: 'json_chunks',
      campaignId,
      files: chunks.map((f) => f.name),
      digest: digestHex,
    }),
    'utf8'
  );
  return sealCampaignOriginalBytes({
    orgId,
    campaignId,
    bytes: manifest,
    fileName: 'chunks-manifest.json',
    kind: 'json_chunks',
  });
}
