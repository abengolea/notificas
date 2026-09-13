import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { ART_COLLECTIONS } from "@/lib/art/collections";
import { newEventId } from "@/lib/public-api/ids";
import { canonicalAuditPayload, hashAuditEvent, resolveBlockchainStatus, shouldAnchorOnChain } from "@/lib/art/audit-logic";
import type { ArtAuditEventType, ArtBlockchainStatus } from "@/lib/art/types";
import { artPilotAuditMetadata } from "@/lib/art/pilot";
import { emitPublicApiEvent } from "@/lib/public-api/webhooks";
import { ART_WEBHOOK_EVENT_TYPES, type ArtWebhookEventType } from "@/lib/art/types";

export async function appendArtAuditEvent(input: {
  orgId: string;
  recipientId: string | null;
  type: ArtAuditEventType;
  actor: string;
  source: string;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
  environment?: "live" | "test";
}): Promise<{ eventId: string; eventHash: string; polygonTxHash: string | null; blockchainStatus: ArtBlockchainStatus }> {
  const db = getAdminDb();
  const eventId = newEventId();
  const timestamp = new Date().toISOString();
  let previousHash: string | null = null;
  if (input.recipientId) {
    const rec = await db.collection(ART_COLLECTIONS.recipients).doc(input.recipientId).get();
    previousHash = typeof rec.data()?.lastEventHash === "string" ? rec.data()!.lastEventHash : null;
  }
  const metadata = { ...(input.metadata || {}), ...artPilotAuditMetadata() };
  const payload = canonicalAuditPayload({
    eventId,
    timestamp,
    orgId: input.orgId,
    recipientId: input.recipientId,
    type: input.type,
    actor: input.actor,
    source: input.source,
    previousHash,
    metadata,
  });
  const eventHash = hashAuditEvent(payload);

  let polygonTxHash: string | null = null;
  let attempted = false;
  let failed = false;
  const chainConfigured = Boolean(process.env.POLYGON_PRIVATE_KEY);
  if (shouldAnchorOnChain(input.type) && chainConfigured) {
    attempted = true;
    try {
      const { sendPolygonTransaction } = await import("@/lib/blockchain");
      polygonTxHash = await sendPolygonTransaction(`ART_${input.type}|${eventId}|${eventHash}`);
      if (!polygonTxHash) failed = true;
    } catch (e) {
      failed = true;
      console.warn("[art] polygon anchor skipped:", e instanceof Error ? e.message : e);
    }
  }
  const blockchainStatus = resolveBlockchainStatus({
    eventHash,
    polygonTxHash,
    chainConfigured,
    attempted,
    failed,
  });

  await db.collection(ART_COLLECTIONS.auditEvents).doc(eventId).set({
    eventId,
    timestamp,
    orgId: input.orgId,
    recipientId: input.recipientId,
    type: input.type,
    actor: input.actor,
    source: input.source,
    ip: input.ip || null,
    userAgent: input.userAgent || null,
    metadata,
    previousHash,
    eventHash,
    polygonTxHash,
    blockchainStatus,
    createdAt: FieldValue.serverTimestamp(),
  });

  if (input.recipientId) {
    await db.collection(ART_COLLECTIONS.recipients).doc(input.recipientId).update({
      lastEventHash: eventHash,
      updatedAt: FieldValue.serverTimestamp(),
    }).catch(() => undefined);
  }

  return { eventId, eventHash, polygonTxHash, blockchainStatus };
}

export async function emitArtWebhook(input: {
  orgId: string;
  type: ArtWebhookEventType;
  data: Record<string, unknown>;
  environment?: "live" | "test";
}): Promise<void> {
  if (!(ART_WEBHOOK_EVENT_TYPES as readonly string[]).includes(input.type)) return;
  const { artModuleAvailableForOrg } = await import("@/lib/art/pilot");
  if (!artModuleAvailableForOrg(input.orgId)) return;
  try {
    await emitPublicApiEvent({
      type: input.type as never,
      orgId: input.orgId,
      environment: input.environment || "live",
      data: input.data,
    });
  } catch (e) {
    console.warn("[art] webhook emit failed:", e instanceof Error ? e.message : e);
  }
}
