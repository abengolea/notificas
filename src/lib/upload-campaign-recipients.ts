import { RECIPIENT_CHUNK_SIZE } from '@/lib/campaign-recipients';
import {
  csvCamposRequeridos,
  detectCsvSeparatorError,
  missingCsvTemplateColumns,
  parseCsvDataLine,
  parseCsvHeaderLine,
  phoneDigits,
} from '@/lib/parse-campaign-csv';
import type { CanalCampaign, RecipientEntry } from '@/lib/types';

const UPLOAD_CONCURRENCY = 4;
const RETRIES = 3;

export type UploadRecipientsProgress = {
  uploadedChunks: number;
  chunkCount: number;
  parsed?: number;
  skipped?: number;
};

async function postJson(
  endpoint: string,
  body: Record<string, unknown>,
  token?: string
): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    credentials: token ? 'same-origin' : 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `Error al subir destinatarios (${res.status})`);
  }
}

async function postOriginalCsv(
  endpoint: string,
  campaignId: string,
  orgId: string,
  file: File,
  token?: string
): Promise<void> {
  const originalEndpoint = endpoint.replace(/upload-recipients\/?$/, 'upload-csv-original');
  const fd = new FormData();
  fd.append('campaignId', campaignId);
  fd.append('orgId', orgId);
  fd.append('file', file);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(originalEndpoint, {
    method: 'POST',
    headers,
    credentials: token ? 'same-origin' : 'include',
    body: fd,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `Error al guardar el CSV original (${res.status})`);
  }
}

async function withRetry(fn: () => Promise<void>): Promise<void> {
  let last: unknown;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      await fn();
      return;
    } catch (e) {
      last = e;
      if (attempt < RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
      }
    }
  }
  throw last instanceof Error ? last : new Error('Error al subir destinatarios');
}

/**
 * Sube destinatarios de a 500 para no mandar 150k en un solo POST.
 */
export async function uploadCampaignRecipients(opts: {
  campaignId: string;
  orgId: string;
  recipients: RecipientEntry[];
  token?: string;
  endpoint?: string;
  onProgress?: (p: UploadRecipientsProgress) => void;
}): Promise<void> {
  const {
    campaignId,
    orgId,
    recipients,
    token,
    endpoint = '/api/campaigns/upload-recipients',
    onProgress,
  } = opts;
  if (recipients.length === 0) {
    throw new Error('Sin destinatarios');
  }

  const chunkCount = Math.ceil(recipients.length / RECIPIENT_CHUNK_SIZE);
  let uploadedChunks = 0;

  for (let i = 0; i < chunkCount; i += UPLOAD_CONCURRENCY) {
    const batchIdx = Array.from(
      { length: Math.min(UPLOAD_CONCURRENCY, chunkCount - i) },
      (_, j) => i + j
    );
    await Promise.all(
      batchIdx.map((chunkIndex) =>
        withRetry(() =>
          postJson(
            endpoint,
            {
              campaignId,
              orgId,
              chunkIndex,
              recipients: recipients.slice(
                chunkIndex * RECIPIENT_CHUNK_SIZE,
                (chunkIndex + 1) * RECIPIENT_CHUNK_SIZE
              ),
            },
            token
          )
        )
      )
    );
    uploadedChunks += batchIdx.length;
    onProgress?.({ uploadedChunks, chunkCount });
  }

  await withRetry(() =>
    postJson(
      endpoint,
      {
        campaignId,
        orgId,
        finalize: true,
        chunkCount,
        recipientCount: recipients.length,
      },
      token
    )
  );
}

/**
 * Un solo archivo CSV (aunque tenga 150k filas). Lo parte en tandas internas
 * para no mandar todo en un POST, y sube varias tandas en paralelo.
 */
export async function uploadCampaignCsvInChunks(opts: {
  campaignId: string;
  orgId: string;
  file: File;
  canal: CanalCampaign;
  extraColumns?: string[];
  token?: string;
  endpoint?: string;
  onProgress?: (p: UploadRecipientsProgress) => void;
}): Promise<{ recipientCount: number; skipped: number; chunkCount: number }> {
  const {
    campaignId,
    orgId,
    file,
    canal,
    extraColumns = [],
    token,
    endpoint = '/api/admin/campaigns/upload-recipients',
    onProgress,
  } = opts;

  await withRetry(() => postOriginalCsv(endpoint, campaignId, orgId, file, token));

  const text = await file.text();
  const lines = text.split(/\r?\n/);
  const headerLine = lines.find((l) => l.trim()) || '';
  const sepErr = detectCsvSeparatorError(headerLine);
  if (sepErr) throw new Error(sepErr);
  const cols = parseCsvHeaderLine(headerLine, canal);
  if (!cols) {
    throw new Error(`CSV inválido. Campos requeridos: ${csvCamposRequeridos(canal, extraColumns)}`);
  }
  const missingExtras = missingCsvTemplateColumns(headerLine, extraColumns);
  if (missingExtras.length) {
    throw new Error(
      `Al CSV le faltan columnas del template: ${missingExtras.join(', ')}. Encabezado esperado: ${csvCamposRequeridos(canal, extraColumns)}`
    );
  }

  const needPhone = canal === 'whatsapp' || canal === 'ambos';
  const seenPhones = new Set<string>();
  let buffer: RecipientEntry[] = [];
  let chunkIndex = 0;
  let uploadedChunks = 0;
  let parsed = 0;
  let skipped = 0;
  const queue: { idx: number; slice: RecipientEntry[] }[] = [];

  const report = () => {
    onProgress?.({
      uploadedChunks,
      chunkCount: Math.max(chunkIndex, 1),
      parsed,
      skipped,
    });
  };

  const flushQueue = async (flushAll: boolean) => {
    while (queue.length >= UPLOAD_CONCURRENCY || (flushAll && queue.length > 0)) {
      const batch = queue.splice(0, UPLOAD_CONCURRENCY);
      await Promise.all(
        batch.map((job) =>
          withRetry(() =>
            postJson(
              endpoint,
              { campaignId, orgId, chunkIndex: job.idx, recipients: job.slice },
              token
            )
          )
        )
      );
      uploadedChunks += batch.length;
      report();
    }
  };

  const enqueueChunk = async (slice: RecipientEntry[]) => {
    queue.push({ idx: chunkIndex, slice });
    chunkIndex += 1;
    await flushQueue(false);
  };

  for (let r = 1; r < lines.length; r++) {
    const line = lines[r];
    if (!line || !line.trim()) continue;
    const row = parseCsvDataLine(line, cols, canal, r, extraColumns);
    if (!row) {
      skipped += 1;
      continue;
    }
    if (needPhone) {
      const key = phoneDigits(row.telefono);
      if (key && seenPhones.has(key)) {
        skipped += 1;
        continue;
      }
      if (key) seenPhones.add(key);
    }
    buffer.push(row);
    parsed += 1;
    if (buffer.length >= RECIPIENT_CHUNK_SIZE) {
      await enqueueChunk(buffer);
      buffer = [];
    }
  }

  if (buffer.length > 0) {
    await enqueueChunk(buffer);
  }
  await flushQueue(true);

  if (parsed === 0) {
    throw new Error('Ninguna fila válida en el CSV');
  }

  const chunkCount = chunkIndex;
  await withRetry(() =>
    postJson(
      endpoint,
      { campaignId, orgId, finalize: true, chunkCount, recipientCount: parsed },
      token
    )
  );
  onProgress?.({ uploadedChunks: chunkCount, chunkCount, parsed, skipped });
  return { recipientCount: parsed, skipped, chunkCount };
}
