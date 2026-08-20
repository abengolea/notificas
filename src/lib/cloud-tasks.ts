/**
 * Cliente Cloud Tasks via REST API directa.
 * Evita el SDK @google-cloud/tasks que tiene problemas con JSON imports ESM
 * en el standalone output de Next.js App Hosting.
 *
 * Auth:
 *  1) Metadata server de GCP (Cloud Run / App Hosting)
 *  2) Fallback local: FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (mismo SA que Admin)
 *
 * En localhost Cloud Tasks no puede invocar la app; se llama el endpoint en proceso.
 */

import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';

function queuePath(): string {
  const project  = process.env.FIREBASE_PROJECT_ID!;
  const location = process.env.CLOUD_TASKS_LOCATION || 'us-central1';
  const queue    = process.env.CLOUD_TASKS_QUEUE    || 'campaign-notifications';
  return `projects/${project}/locations/${location}/queues/${queue}`;
}

function workerUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  return `${base}${path}`;
}

function isLocalWorkerUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

async function getTokenFromMetadata(): Promise<string | null> {
  try {
    const res = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      {
        headers: { 'Metadata-Flavor': 'Google' },
        signal: AbortSignal.timeout(800),
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as { access_token: string };
    return data.access_token;
  } catch {
    return null;
  }
}

async function getTokenFromServiceAccount(): Promise<string> {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Cloud Tasks: sin metadata GCP y faltan FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY'
    );
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  const credential = getApp().options.credential;
  if (!credential) {
    throw new Error('Cloud Tasks: no hay credential de Firebase Admin');
  }

  const { access_token } = await credential.getAccessToken();
  return access_token;
}

/** Obtiene un access token: metadata GCP o service account local. */
async function getGcpAccessToken(): Promise<string> {
  const fromMeta = await getTokenFromMetadata();
  if (fromMeta) return fromMeta;
  return getTokenFromServiceAccount();
}

/** En local: invoca el worker HTTP directo (Cloud Tasks no llega a localhost). */
async function enqueueLocal(path: string, payload: unknown): Promise<void> {
  const res = await fetch(workerUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Worker-Secret': (process.env.CAMPAIGN_WORKER_SECRET || '').trim(),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Local worker ${path} failed ${res.status}: ${text.slice(0, 300)}`);
  }
}

async function enqueueTask(
  path: string,
  payload: unknown,
  taskId?: string,
  delaySeconds = 0,
  opts?: { dispatchDeadlineSeconds?: number; localDetach?: boolean }
): Promise<void> {
  const url = workerUrl(path);

  if (isLocalWorkerUrl(url)) {
    if (delaySeconds > 0 || opts?.localDetach) {
      const waitMs = delaySeconds > 0 ? delaySeconds * 1000 : 0;
      setTimeout(() => {
        void enqueueLocal(path, payload).catch((e) =>
          console.warn('⚠️ Local delayed task failed:', e?.message)
        );
      }, waitMs);
      return;
    }
    await enqueueLocal(path, payload);
    return;
  }

  const token = await getGcpAccessToken();
  const parent = queuePath();

  const task: Record<string, unknown> = {
    httpRequest: {
      httpMethod: 'POST',
      url,
      headers: {
        'Content-Type':    'application/json',
        'X-Worker-Secret': (process.env.CAMPAIGN_WORKER_SECRET || '').trim(),
      },
      body: Buffer.from(JSON.stringify(payload)).toString('base64'),
    },
  };

  if (delaySeconds > 0) {
    task.scheduleTime = new Date(Date.now() + delaySeconds * 1000).toISOString();
  }

  if (opts?.dispatchDeadlineSeconds) {
    task.dispatchDeadline = `${opts.dispatchDeadlineSeconds}s`;
  }

  if (taskId) {
    const safeName = taskId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 499);
    task.name = `${parent}/tasks/${safeName}`;
  }

  const res = await fetch(
    `https://cloudtasks.googleapis.com/v2/${parent}/tasks`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ task }),
    }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: { code?: number; message?: string } };
    if (body?.error?.code === 409) return; // ALREADY_EXISTS — idempotente, ok
    throw new Error(`Cloud Tasks API error ${res.status}: ${body?.error?.message}`);
  }
}

/** Encola el fanout que crea campaign_messages y encola los sends. */
export async function enqueueCampaignFanout(campaignId: string, offset: number): Promise<void> {
  await enqueueTask(
    '/api/campaigns/fanout',
    { campaignId, offset },
    `fanout-${campaignId}-${offset}`
  );
}

/** Arranca el lote diario (día calendario Argentina). */
export async function enqueueCampaignDaily(
  campaignId: string,
  dayKey: string,
  delaySeconds: number
): Promise<void> {
  const safeDay = dayKey.replace(/[^0-9-]/g, '');
  await enqueueTask(
    '/api/campaigns/daily',
    { campaignId, dayKey: safeDay },
    `daily-${campaignId}-${safeDay}`,
    delaySeconds
  );
}

/** Encola un worker que procesa un batch de campaign_messages. */
export async function enqueueCampaignWorker(
  campaignId: string,
  messageDocIds: string[]
): Promise<void> {
  const first = messageDocIds[0] || 'x';
  const last = messageDocIds[messageDocIds.length - 1] || first;
  await enqueueTask(
    '/api/campaigns/worker',
    { campaignId, messageDocIds },
    `send-${campaignId}-${first}-${last}-${messageDocIds.length}`
  );
}

export async function enqueueCampaignCsvExport(payload: {
  campaignId: string;
  version?: number;
  exportDocId?: string;
}): Promise<void> {
  const stamp = Date.now().toString(36);
  const label = payload.exportDocId
    ? `csv-export-${payload.campaignId}-${payload.exportDocId}-${stamp}`
    : `csv-export-${payload.campaignId}-v${payload.version || 0}-${stamp}`;
  await enqueueTask(
    '/api/campaigns/export/worker',
    payload,
    label,
    0,
    { dispatchDeadlineSeconds: 1800, localDetach: true }
  );
}

/** Cierra (o intenta cerrar) una tanda Merkle. delaySeconds=0 = inmediato. */
export async function enqueueIntegrityClose(
  campaignId: string,
  batchId: string,
  delaySeconds = 0
): Promise<void> {
  const suffix = delaySeconds > 0 ? `d${delaySeconds}` : 'now';
  await enqueueTask(
    '/api/campaigns/integrity/close',
    { campaignId, batchId, force: delaySeconds > 0 },
    `integrity-${campaignId}-${batchId}-${suffix}`,
    delaySeconds
  );
}
