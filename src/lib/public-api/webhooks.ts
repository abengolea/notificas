import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { encryptSecret, randomSecret } from "@/lib/public-api/crypto";
import { invalidRequest, notFound } from "@/lib/public-api/errors";
import { newEventId, newWebhookEndpointId } from "@/lib/public-api/ids";
import { resolveAndValidateWebhookUrl } from "@/lib/public-api/ssrf";
import type { PublicApiAuthContext } from "@/lib/public-api/types";
import { COLLECTIONS } from "@/lib/public-api/types";
import type { WebhookEventType } from "@/lib/public-api/validation";
import { enqueuePublicApiWebhookDeliver } from "@/lib/cloud-tasks";
import { nextWebhookDelaySeconds } from "@/lib/public-api/webhook-retry";
import { assertTenant } from "@/lib/public-api/tenant";

export { assertTenant } from "@/lib/public-api/tenant";

export type WebhookEndpointRecord = {
  id: string;
  orgId: string;
  url: string;
  events: WebhookEventType[];
  secretEncrypted: string;
  secretPrefix: string;
  status: "active" | "disabled";
  environment: "live" | "test";
  description?: string;
  createdAt: unknown;
  lastAttemptAt?: unknown;
  lastStatus?: number | null;
  lastError?: string | null;
};

export function publicWebhookEndpointView(row: WebhookEndpointRecord) {
  return {
    id: row.id,
    url: row.url,
    events: row.events,
    status: row.status,
    environment: row.environment,
    secret_prefix: row.secretPrefix,
    description: row.description || null,
    created_at: toIso(row.createdAt),
    last_attempt_at: toIso(row.lastAttemptAt),
    last_status: row.lastStatus ?? null,
    last_error: row.lastError ?? null,
  };
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

export async function createWebhookEndpoint(
  ctx: PublicApiAuthContext,
  input: { url: string; events: WebhookEventType[]; description?: string }
): Promise<{ endpoint: ReturnType<typeof publicWebhookEndpointView>; secret: string }> {
  const requireHttps = ctx.environment === "live" || process.env.NODE_ENV === "production";
  const ssrf = await resolveAndValidateWebhookUrl(input.url, { requireHttps });
  if (!ssrf.ok) throw invalidRequest(ssrf.code, ssrf.message, "url");

  const secret = `whsec_${randomSecret(24)}`;
  const id = newWebhookEndpointId();
  const record: WebhookEndpointRecord = {
    id,
    orgId: ctx.orgId,
    url: input.url.trim(),
    events: input.events,
    secretEncrypted: encryptSecret(secret),
    secretPrefix: secret.slice(0, 12),
    status: "active",
    environment: ctx.environment,
    description: input.description,
    createdAt: FieldValue.serverTimestamp(),
  };
  await getAdminDb().collection(COLLECTIONS.webhookEndpoints).doc(id).set(record);
  return { endpoint: publicWebhookEndpointView(record), secret };
}

export async function listWebhookEndpoints(ctx: PublicApiAuthContext) {
  const snap = await getAdminDb()
    .collection(COLLECTIONS.webhookEndpoints)
    .where("orgId", "==", ctx.orgId)
    .where("environment", "==", ctx.environment)
    .get();
  return snap.docs.map((d) => publicWebhookEndpointView({ id: d.id, ...(d.data() as Omit<WebhookEndpointRecord, "id">) }));
}

export async function getWebhookEndpoint(ctx: PublicApiAuthContext, id: string) {
  const snap = await getAdminDb().collection(COLLECTIONS.webhookEndpoints).doc(id).get();
  if (!snap.exists) throw notFound("webhook_endpoint_not_found", "Webhook endpoint not found.");
  const data = { id: snap.id, ...(snap.data() as Omit<WebhookEndpointRecord, "id">) };
  assertTenant(data.orgId, ctx.orgId);
  if (data.environment !== ctx.environment) throw notFound("webhook_endpoint_not_found", "Webhook endpoint not found.");
  return data;
}

export async function updateWebhookEndpoint(
  ctx: PublicApiAuthContext,
  id: string,
  patch: { url?: string; events?: WebhookEventType[]; enabled?: boolean; description?: string }
) {
  const current = await getWebhookEndpoint(ctx, id);
  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (patch.url) {
    const requireHttps = ctx.environment === "live" || process.env.NODE_ENV === "production";
    const ssrf = await resolveAndValidateWebhookUrl(patch.url, { requireHttps });
    if (!ssrf.ok) throw invalidRequest(ssrf.code, ssrf.message, "url");
    updates.url = patch.url.trim();
  }
  if (patch.events) updates.events = patch.events;
  if (typeof patch.enabled === "boolean") updates.status = patch.enabled ? "active" : "disabled";
  if (patch.description !== undefined) updates.description = patch.description;
  await getAdminDb().collection(COLLECTIONS.webhookEndpoints).doc(id).update(updates);
  return getWebhookEndpoint(ctx, id);
}

export type PublicApiEventPayload = {
  type: WebhookEventType;
  orgId: string;
  environment: "live" | "test";
  data: Record<string, unknown>;
};

/**
 * Crea un evento único y encola una entrega por endpoint suscripto.
 * Los reintentos reenvían el mismo event_id.
 */
export async function emitPublicApiEvent(payload: PublicApiEventPayload): Promise<void> {
  const db = getAdminDb();
  const eventId = newEventId();
  const createdAt = new Date().toISOString();
  const body = {
    id: eventId,
    type: payload.type,
    created_at: createdAt,
    data: payload.data,
  };

  await db.collection(COLLECTIONS.webhookEvents).doc(eventId).set({
    orgId: payload.orgId,
    environment: payload.environment,
    type: payload.type,
    createdAt: FieldValue.serverTimestamp(),
    data: payload.data,
  });

  const snap = await db
    .collection(COLLECTIONS.webhookEndpoints)
    .where("orgId", "==", payload.orgId)
    .where("status", "==", "active")
    .where("environment", "==", payload.environment)
    .get();

  for (const doc of snap.docs) {
    const ep = doc.data() as WebhookEndpointRecord;
    const events = Array.isArray(ep.events) ? ep.events : [];
    if (!events.includes(payload.type)) continue;
    const deliveryId = `${eventId}_${doc.id}`;
    await db.collection(COLLECTIONS.webhookDeliveries).doc(deliveryId).set({
      id: deliveryId,
      eventId,
      endpointId: doc.id,
      orgId: payload.orgId,
      url: ep.url,
      type: payload.type,
      payload: body,
      attempt: 0,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });
    const delay = nextWebhookDelaySeconds(0) ?? 0;
    await enqueuePublicApiWebhookDeliver({ deliveryId }, delay).catch((e) =>
      console.warn("public-api webhook enqueue failed", e instanceof Error ? e.message : e)
    );
  }
}
