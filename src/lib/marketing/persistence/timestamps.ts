import { Timestamp } from "firebase-admin/firestore";

export const MARKETING_INSTANT_KEYS = [
  "createdAt",
  "updatedAt",
  "deletedAt",
  "addedAt",
  "dueAt",
  "completedAt",
  "firstContactAt",
  "lastContactAt",
  "nextFollowUpAt",
  "nextActionAt",
  "reviewedAt",
  "sentAt",
  "openedAt",
  "clickedAt",
  "repliedAt",
  "bouncedAt",
  "startedAt",
  "activatedAt",
  "archivedAt",
  "connectionSentAt",
  "connectedAt",
  "messageSentAt",
  "followUpSentAt",
  "interestedAt",
  "notInterestedAt",
  "doNotContactAt",
  "linkedinLastContactAt",
  "linkedinNextActionAt",
] as const;

export type MarketingInstantKey = (typeof MARKETING_INSTANT_KEYS)[number];

const INSTANT_SET = new Set<string>(MARKETING_INSTANT_KEYS);

export function nowIso(): string {
  return new Date().toISOString();
}

export function toFirestoreTimestamp(
  value: string | null | undefined,
): Timestamp | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`ISO inválido para Timestamp: ${value}`);
  }
  return Timestamp.fromDate(date);
}

export function fromFirestoreTimestamp(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") return value;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "object" && value && "toDate" in value && typeof (value as Timestamp).toDate === "function") {
    try {
      return (value as Timestamp).toDate().toISOString();
    } catch {
      return null;
    }
  }
  const secs = (value as { seconds?: number; _seconds?: number }).seconds
    ?? (value as { _seconds?: number })._seconds;
  if (typeof secs === "number") return new Date(secs * 1000).toISOString();
  return null;
}

export function timestampsToFirestore(
  record: Record<string, unknown>,
  keys: readonly string[] = MARKETING_INSTANT_KEYS,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...record };
  for (const key of keys) {
    if (!(key in out)) continue;
    const converted = toFirestoreTimestamp(out[key] as string | null | undefined);
    if (converted === undefined) delete out[key];
    else out[key] = converted;
  }
  return out;
}

export function timestampsFromFirestore(
  record: Record<string, unknown>,
  keys: readonly string[] = MARKETING_INSTANT_KEYS,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...record };
  for (const key of keys) {
    if (!(key in out)) continue;
    const converted = fromFirestoreTimestamp(out[key]);
    if (converted === undefined) delete out[key];
    else out[key] = converted;
  }
  return out;
}

export function isMarketingInstantKey(key: string): boolean {
  return INSTANT_SET.has(key);
}

export function omitUndefined<T extends Record<string, unknown>>(record: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}
