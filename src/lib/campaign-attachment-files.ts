import { createHash } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminBucket, getAdminDb } from '@/lib/firebase-admin';
import {
  buildAttachmentReport,
  normalizeAttachmentName,
  type AttachmentReport,
} from '@/lib/campaign-attachment-name';
import { recipientStoragePath } from '@/lib/campaign-recipients-storage';
import type { CampaignAttachment, RecipientEntry } from '@/lib/types';

/**
 * Adjunto por columna: cada archivo subido queda en `campaigns/{id}/attachment_files/{docId}`.
 * El documento se busca por el nombre normalizado, así el worker encuentra el archivo de cada mensaje
 * con una lectura, sin cargar un mapa gigante dentro del documento de la campaña.
 * Esta subcolección solo la leen y escriben las rutas del servidor (las reglas de Firestore no la exponen).
 */
const SUBCOLLECTION = 'attachment_files';

export function attachmentFileDocId(name: string): string {
  return createHash('sha1').update(normalizeAttachmentName(name)).digest('hex');
}

function filesCollection(campaignId: string) {
  return getAdminDb().collection('campaigns').doc(campaignId).collection(SUBCOLLECTION);
}

export async function saveCampaignAttachmentFile(
  campaignId: string,
  attachment: CampaignAttachment,
  storagePath: string
): Promise<void> {
  await filesCollection(campaignId)
    .doc(attachmentFileDocId(attachment.nombre))
    .set({
      key: normalizeAttachmentName(attachment.nombre),
      nombre: attachment.nombre,
      url: attachment.url,
      hash: attachment.hash,
      size: attachment.size,
      storagePath,
      uploadedAt: FieldValue.serverTimestamp(),
    });
}

/** El archivo que pide una fila del CSV, o null si todavía no se subió. */
export async function getCampaignAttachmentFile(
  campaignId: string,
  name: string
): Promise<CampaignAttachment | null> {
  if (!normalizeAttachmentName(name)) return null;
  const snap = await filesCollection(campaignId).doc(attachmentFileDocId(name)).get();
  if (!snap.exists) return null;
  const d = snap.data() || {};
  if (typeof d.url !== 'string' || !d.url) return null;
  return {
    nombre: String(d.nombre || name),
    url: d.url,
    hash: String(d.hash || ''),
    size: typeof d.size === 'number' ? d.size : 0,
  };
}

/** Nombres originales de todos los archivos subidos a la campaña. */
export async function listCampaignAttachmentFileNames(campaignId: string): Promise<string[]> {
  const snap = await filesCollection(campaignId).select('nombre').get();
  return snap.docs.map((d) => String(d.get('nombre') || '')).filter(Boolean);
}

/** Lo que pide cada fila de la lista (una entrada por destinatario, en orden). */
export async function listCampaignRowAttachmentNames(campaignId: string): Promise<string[]> {
  const snap = await getAdminDb().collection('campaigns').doc(campaignId).get();
  const data = snap.data() || {};
  const orgId = String(data.orgId || '');
  const chunkCount = typeof data.recipientChunkCount === 'number' ? data.recipientChunkCount : 0;
  if (!orgId || chunkCount <= 0) return [];

  const bucket = getAdminBucket();
  const basePath = typeof data.recipientStoragePath === 'string' && data.recipientStoragePath
    ? data.recipientStoragePath
    : recipientStoragePath(orgId, campaignId);

  const names: string[] = [];
  const CONCURRENT = 8;
  for (let i = 0; i < chunkCount; i += CONCURRENT) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(CONCURRENT, chunkCount - i) }, async (_, j) => {
        const [buf] = await bucket.file(`${basePath}/chunk_${i + j}.json`).download();
        const rows = JSON.parse(buf.toString('utf8')) as RecipientEntry[];
        return rows.map((r) => r.adjunto ?? '');
      })
    );
    for (const part of batch) names.push(...part);
  }
  return names;
}

export async function buildCampaignAttachmentReport(campaignId: string): Promise<AttachmentReport> {
  const [rowNames, fileNames] = await Promise.all([
    listCampaignRowAttachmentNames(campaignId),
    listCampaignAttachmentFileNames(campaignId),
  ]);
  return buildAttachmentReport({ rowNames, fileNames });
}
