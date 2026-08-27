import { createHash } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { conflict, invalidRequest } from "@/lib/public-api/errors";
import { isValidIdempotencyKey } from "@/lib/public-api/validation";
import { COLLECTIONS } from "@/lib/public-api/types";

export { canonicalJson, requestFingerprint } from "@/lib/public-api/idempotency-hash";

const TTL_MS = 24 * 60 * 60 * 1000;

export function idempotencyDocId(orgId: string, environment: string, key: string): string {
  return createHash("sha256").update(`${orgId}\n${environment}\n${key}`).digest("hex");
}

export type IdempotencyHit = {
  status: number;
  body: unknown;
};

export async function beginIdempotency(opts: {
  orgId: string;
  environment: string;
  key: string | null;
  fingerprint: string;
}): Promise<{ key: string | null; replay?: IdempotencyHit; docId?: string }> {
  if (!opts.key) return { key: null };
  if (!isValidIdempotencyKey(opts.key)) {
    throw invalidRequest("invalid_idempotency_key", "The Idempotency-Key header is invalid.", "Idempotency-Key");
  }
  const db = getAdminDb();
  const docId = idempotencyDocId(opts.orgId, opts.environment, opts.key);
  const ref = db.collection(COLLECTIONS.apiIdempotency).doc(docId);

  const result = await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) {
      t.set(ref, {
        orgId: opts.orgId,
        environment: opts.environment,
        key: opts.key,
        fingerprint: opts.fingerprint,
        status: "processing",
        createdAt: FieldValue.serverTimestamp(),
        expiresAtMs: Date.now() + TTL_MS,
      });
      return { kind: "started" as const };
    }
    const data = snap.data()!;
    const expired = typeof data.expiresAtMs === "number" && data.expiresAtMs < Date.now();
    if (expired) {
      t.set(ref, {
        orgId: opts.orgId,
        environment: opts.environment,
        key: opts.key,
        fingerprint: opts.fingerprint,
        status: "processing",
        createdAt: FieldValue.serverTimestamp(),
        expiresAtMs: Date.now() + TTL_MS,
      });
      return { kind: "started" as const };
    }
    if (data.fingerprint !== opts.fingerprint) {
      return { kind: "mismatch" as const };
    }
    if (data.status === "completed" && typeof data.responseStatus === "number") {
      return {
        kind: "replay" as const,
        hit: { status: data.responseStatus as number, body: data.responseBody },
      };
    }
    return { kind: "in_progress" as const };
  });

  if (result.kind === "mismatch") {
    throw conflict(
      "idempotency_key_reused",
      "This Idempotency-Key was already used with a different request body."
    );
  }
  if (result.kind === "in_progress") {
    throw conflict("idempotency_in_progress", "A request with this Idempotency-Key is still being processed.");
  }
  if (result.kind === "replay") return { key: opts.key, replay: result.hit, docId };
  return { key: opts.key, docId };
}

export async function completeIdempotency(docId: string | undefined, status: number, body: unknown): Promise<void> {
  if (!docId) return;
  await getAdminDb().collection(COLLECTIONS.apiIdempotency).doc(docId).update({
    status: "completed",
    responseStatus: status,
    responseBody: body,
    completedAt: FieldValue.serverTimestamp(),
  });
}

export async function failIdempotency(docId: string | undefined): Promise<void> {
  if (!docId) return;
  await getAdminDb().collection(COLLECTIONS.apiIdempotency).doc(docId).delete().catch(() => undefined);
}
