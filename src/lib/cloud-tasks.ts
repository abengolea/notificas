import { CloudTasksClient } from '@google-cloud/tasks';

let _client: CloudTasksClient | null = null;

function getClient(): CloudTasksClient {
  if (!_client) _client = new CloudTasksClient();
  return _client;
}

function queuePath(): string {
  const project = process.env.FIREBASE_PROJECT_ID!;
  const location = process.env.CLOUD_TASKS_LOCATION || 'us-central1';
  const queue = process.env.CLOUD_TASKS_QUEUE || 'campaign-notifications';
  return `projects/${project}/locations/${location}/queues/${queue}`;
}

function workerUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  return `${base}${path}`;
}

async function enqueueTask(path: string, payload: unknown, taskId?: string): Promise<void> {
  const task: Record<string, unknown> = {
    httpRequest: {
      httpMethod: 'POST',
      url: workerUrl(path),
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Secret': process.env.CAMPAIGN_WORKER_SECRET || '',
      },
      body: Buffer.from(JSON.stringify(payload)).toString('base64'),
    },
  };
  if (taskId) {
    const safeName = taskId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 499);
    task.name = `${queuePath()}/tasks/${safeName}`;
  }
  try {
    await getClient().createTask({ parent: queuePath(), task });
  } catch (e: any) {
    if (e?.code === 6) return; // ALREADY_EXISTS — idempotente, ok
    throw e;
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
  // Usa el primer docId como parte del nombre para deduplicar reintentos.
  await enqueueTask(
    '/api/campaigns/worker',
    { campaignId, messageDocIds },
    `send-${campaignId}-${messageDocIds[0]}`
  );
}
