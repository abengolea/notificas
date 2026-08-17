import { FieldValue } from 'firebase-admin/firestore';
import { getAdminBucket, getAdminDb } from '@/lib/firebase-admin';
import { RECIPIENT_CHUNK_SIZE } from '@/lib/campaign-recipients';
import type { RecipientEntry } from '@/lib/types';

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
  return { chunkCount, recipientCount: recipients.length };
}
