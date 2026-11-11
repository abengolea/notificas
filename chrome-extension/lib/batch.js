export const BATCH_SIZE = 20;
export const BATCH_KEY = "assistantBatch";
export const QUEUE_KEY = "assistantQueue";

export function emptyBatch() {
  return {
    status: "idle",
    target: BATCH_SIZE,
    lotePrepared: 0,
    loteFailed: 0,
    totalPrepared: 0,
    sentDetected: 0,
    currentName: "",
    error: "",
    tabId: null,
    campaignId: "",
    resume: false,
    items: [],
  };
}

export function fingerprint(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function messagesMatch(prepared, outbound) {
  const a = fingerprint(prepared);
  const b = fingerprint(outbound);
  if (!a || !b) return false;
  if (a === b) return true;
  const head = a.slice(0, 80);
  if (a.length >= 40 && b.includes(head)) return true;
  const other = b.slice(0, 80);
  if (b.length >= 40 && a.includes(other)) return true;
  return false;
}

export async function readBatch() {
  const data = await chrome.storage.local.get(BATCH_KEY);
  const raw = data[BATCH_KEY];
  if (!raw || typeof raw !== "object") return emptyBatch();
  return {
    ...emptyBatch(),
    ...raw,
    items: Array.isArray(raw.items) ? raw.items : [],
  };
}

export async function writeBatch(batch) {
  await chrome.storage.local.set({ [BATCH_KEY]: batch });
  return batch;
}

export async function readQueue() {
  const data = await chrome.storage.local.get(QUEUE_KEY);
  const raw = data[QUEUE_KEY] || {};
  return {
    campaignId: typeof raw.campaignId === "string" ? raw.campaignId : "",
    seenMemberIds: Array.isArray(raw.seenMemberIds) ? raw.seenMemberIds.filter(Boolean) : [],
  };
}

export async function writeQueue(queue) {
  await chrome.storage.local.set({ [QUEUE_KEY]: queue });
}

export async function rememberSeen(memberId, campaignId) {
  if (!memberId) return;
  const queue = await readQueue();
  if (campaignId !== undefined) queue.campaignId = campaignId;
  if (!queue.seenMemberIds.includes(memberId)) queue.seenMemberIds.push(memberId);
  await writeQueue(queue);
}
