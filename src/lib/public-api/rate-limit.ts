import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  getRateLimitConfig,
  retryAfterSeconds,
  windowStartMs,
  type RateBucket,
} from "@/lib/public-api/rate-limit-config";
import { rateLimited } from "@/lib/public-api/errors";
import { COLLECTIONS } from "@/lib/public-api/types";

export async function consumeRateLimit(opts: {
  apiKeyId: string;
  orgId: string;
  bucket: RateBucket;
  extra?: RateBucket;
}): Promise<{ retryAfterSeconds?: number }> {
  const cfg = getRateLimitConfig();
  const now = Date.now();
  const start = windowStartMs(now);
  const db = getAdminDb();

  const buckets: RateBucket[] = opts.extra ? ["general", opts.extra] : [opts.bucket];
  if (!buckets.includes("general")) buckets.unshift("general");

  for (const bucket of Array.from(new Set(buckets))) {
    const limit = cfg[bucket];
    const docId = `${opts.apiKeyId}_${bucket}_${start}`;
    const ref = db.collection(COLLECTIONS.apiRateLimits).doc(docId);
    const retry = await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      const count = typeof snap.data()?.count === "number" ? snap.data()!.count : 0;
      if (count >= limit) return retryAfterSeconds(now);
      t.set(
        ref,
        {
          apiKeyId: opts.apiKeyId,
          orgId: opts.orgId,
          bucket,
          windowStart: start,
          count: FieldValue.increment(1),
          expiresAtMs: start + 2 * 60 * 1000,
        },
        { merge: true }
      );
      return 0;
    });
    if (retry > 0) throw Object.assign(rateLimited(retry), { retryAfterSeconds: retry });
  }
  return {};
}
