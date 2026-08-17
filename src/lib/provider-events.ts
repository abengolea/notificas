import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

export type ProviderName = "meta" | "smtp";

export type ProviderEventInput = {
  mailId?: string | null;
  campaignId?: string | null;
  campaignMessageId?: string | null;
  provider: ProviderName;
  eventType: string;
  providerMessageId?: string | null;
  recipient?: string | null;
  providerTimestamp?: string | null;
  raw: unknown;
};

const MAX_RAW_CHARS = 80_000;

function clipRaw(raw: unknown): unknown {
  try {
    const json = JSON.stringify(raw);
    if (!json) return null;
    if (json.length <= MAX_RAW_CHARS) return JSON.parse(json);
    return { _truncated: true, preview: json.slice(0, MAX_RAW_CHARS) };
  } catch {
    return { _unserializable: true };
  }
}

/** Append-only: el cliente no puede escribir esta colección (catch-all deny). */
export async function recordProviderEvent(input: ProviderEventInput): Promise<string> {
  const db = getAdminDb();
  const ref = db.collection("provider_events").doc();
  await ref.set({
    mailId: input.mailId || null,
    campaignId: input.campaignId || null,
    campaignMessageId: input.campaignMessageId || null,
    provider: input.provider,
    eventType: input.eventType,
    providerMessageId: input.providerMessageId || null,
    recipient: input.recipient || null,
    providerTimestamp: input.providerTimestamp || null,
    raw: clipRaw(input.raw),
    receivedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function listProviderEventsForMail(mailId: string, limit = 20) {
  const snap = await getAdminDb()
    .collection("provider_events")
    .where("mailId", "==", mailId)
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
