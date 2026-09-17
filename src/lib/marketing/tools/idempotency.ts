import { createHash } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_AI_IDEMPOTENCY } from "../collections";
import type { IdempotencyStore } from "./types";

export function crmIdempotencyKey(parts: Array<string | undefined>): string {
  return createHash("sha256")
    .update(parts.filter(Boolean).join("|"))
    .digest("hex");
}

export function createMemoryIdempotencyStore(): IdempotencyStore {
  const map = new Map<string, unknown>();
  return {
    async get(key) {
      return (map.get(key) as never) ?? null;
    },
    async set(key, value) {
      map.set(key, value);
    },
  };
}

export function createLiveIdempotencyStore(): IdempotencyStore {
  return {
    async get(key) {
      try {
        const snap = await getAdminDb().collection(MARKETING_AI_IDEMPOTENCY).doc(key).get();
        if (!snap.exists) return null;
        return (snap.data()?.result as never) ?? null;
      } catch {
        return null;
      }
    },
    async set(key, value) {
      try {
        await getAdminDb().collection(MARKETING_AI_IDEMPOTENCY).doc(key).set({
          result: value,
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (e) {
        console.warn("crm idempotency skip", e instanceof Error ? e.message : e);
      }
    },
  };
}
