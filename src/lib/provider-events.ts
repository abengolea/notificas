import { FieldValue } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
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
  signatureHeader?: string | null;
  signatureValid?: boolean | null;
  payloadHash?: string | null;
  httpBody?: string | null;
};

const MAX_RAW_CHARS = 80_000;

export function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function clipString(value: string): string | { _truncated: true; preview: string } {
  if (value.length <= MAX_RAW_CHARS) return value;
  return { _truncated: true, preview: value.slice(0, MAX_RAW_CHARS) };
}

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
    signatureHeader: input.signatureHeader || null,
    signatureValid: input.signatureValid ?? null,
    payloadHash: input.payloadHash || null,
    httpBody: input.httpBody ? clipString(input.httpBody) : null,
    receivedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function listProviderEventsForMail(mailId: string, limit = 40) {
  const snap = await getAdminDb()
    .collection("provider_events")
    .where("mailId", "==", mailId)
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listProviderEventsForCampaignMessage(campaignMessageId: string, limit = 40) {
  const snap = await getAdminDb()
    .collection("provider_events")
    .where("campaignMessageId", "==", campaignMessageId)
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
