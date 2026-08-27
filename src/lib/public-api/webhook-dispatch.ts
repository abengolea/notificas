import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { enqueuePublicApiWebhookDeliver } from "@/lib/cloud-tasks";
import { decryptSecret } from "@/lib/public-api/crypto";
import { COLLECTIONS } from "@/lib/public-api/types";
import { resolveAndValidateWebhookUrl } from "@/lib/public-api/ssrf";
import { signWebhookPayload } from "@/lib/public-api/webhook-signature";
import { nextWebhookDelaySeconds, shouldRetryWebhookStatus } from "@/lib/public-api/webhook-retry";
import type { WebhookEndpointRecord } from "@/lib/public-api/webhooks";

const DELIVER_TIMEOUT_MS = 10_000;

export async function deliverWebhookJob(deliveryId: string): Promise<void> {
  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.webhookDeliveries).doc(deliveryId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const delivery = snap.data()!;
  if (delivery.status === "delivered") return;

  const epSnap = await db.collection(COLLECTIONS.webhookEndpoints).doc(String(delivery.endpointId)).get();
  if (!epSnap.exists) {
    await ref.update({ status: "abandoned", lastError: "endpoint_missing" });
    return;
  }
  const endpoint = { id: epSnap.id, ...(epSnap.data() as Omit<WebhookEndpointRecord, "id">) };
  if (endpoint.status !== "active") {
    await ref.update({ status: "abandoned", lastError: "endpoint_disabled" });
    return;
  }

  const requireHttps = endpoint.environment === "live" || process.env.NODE_ENV === "production";
  const ssrf = await resolveAndValidateWebhookUrl(String(delivery.url || endpoint.url), { requireHttps });
  if (!ssrf.ok) {
    await ref.update({
      status: "failed",
      lastError: ssrf.code,
      lastAttemptAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  let secret: string;
  try {
    secret = decryptSecret(endpoint.secretEncrypted);
  } catch {
    await ref.update({ status: "abandoned", lastError: "secret_unavailable" });
    return;
  }

  const eventId = String(delivery.eventId);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const rawBody = JSON.stringify(delivery.payload);
  const signature = signWebhookPayload(secret, eventId, timestamp, rawBody);

  const attempt = typeof delivery.attempt === "number" ? delivery.attempt : 0;
  let status: number | null = null;
  let networkError = false;
  let lastError: string | null = null;

  try {
    const res = await fetch(String(delivery.url || endpoint.url), {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Notificas-Webhooks/1.0",
        "notificas-id": eventId,
        "notificas-timestamp": timestamp,
        "notificas-signature": signature,
      },
      body: rawBody,
      signal: AbortSignal.timeout(DELIVER_TIMEOUT_MS),
    });
    status = res.status;
    if (status >= 400) lastError = `http_${status}`;
  } catch (e) {
    networkError = true;
    lastError = e instanceof Error ? e.name : "network_error";
  }

  const ok = status != null && status >= 200 && status < 300;
  const endpointPatch: Record<string, unknown> = {
    lastAttemptAt: FieldValue.serverTimestamp(),
    lastStatus: status,
    lastError,
  };

  if (ok) {
    await ref.update({
      status: "delivered",
      attempt: attempt + 1,
      lastStatus: status,
      lastError: null,
      deliveredAt: FieldValue.serverTimestamp(),
    });
    await epSnap.ref.update(endpointPatch);
    return;
  }

  const nextAttempt = attempt + 1;
  const delay = nextWebhookDelaySeconds(nextAttempt);
  const retry = delay != null && shouldRetryWebhookStatus(status, networkError);

  await ref.update({
    status: retry ? "pending" : "failed",
    attempt: nextAttempt,
    lastStatus: status,
    lastError,
    lastAttemptAt: FieldValue.serverTimestamp(),
  });
  await epSnap.ref.update(endpointPatch);

  if (retry && delay != null) {
    await enqueuePublicApiWebhookDeliver({ deliveryId }, delay);
  }
}
