/**
 * Cliente Cloud Tasks via REST API directa.
 * Evita el SDK @google-cloud/tasks que tiene problemas con JSON imports ESM
 * en el standalone output de Next.js App Hosting.
 * Auth: metadata server de GCP (funciona en Cloud Run / App Hosting automáticamente).
 */

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

/** Obtiene un access token de la cuenta de servicio via metadata server de GCP. */
async function getGcpAccessToken(): Promise<string> {
  const res = await fetch(
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    { headers: { 'Metadata-Flavor': 'Google' } }
  );
  if (!res.ok) throw new Error(`Metadata server error: ${res.status}`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

async function enqueueTask(path: string, payload: unknown, taskId?: string): Promise<void> {
  const token = await getGcpAccessToken();
  const parent = queuePath();

  const task: Record<string, unknown> = {
    httpRequest: {
      httpMethod: 'POST',
      url: workerUrl(path),
      headers: {
        'Content-Type':    'application/json',
        'X-Worker-Secret': process.env.CAMPAIGN_WORKER_SECRET || '',
      },
      body: Buffer.from(JSON.stringify(payload)).toString('base64'),
    },
  };

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

/** Encola un worker que procesa un batch de campaign_messages. */
export async function enqueueCampaignWorker(
  campaignId: string,
  messageDocIds: string[]
): Promise<void> {
  await enqueueTask(
    '/api/campaigns/worker',
    { campaignId, messageDocIds },
    `send-${campaignId}-${messageDocIds[0]}`
  );
}
