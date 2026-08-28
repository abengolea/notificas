import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { retryAfterSeconds, windowStartMs } from "@/lib/public-api/rate-limit-config";
import { MCP_COLLECTIONS } from "@/mcp/collections";
import { McpToolError } from "@/mcp/errors";
import type { McpToolKind } from "@/mcp/protocol";

export type McpRateBucket = "read" | "prepare" | "write";

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export function mcpRateLimits(): Record<McpRateBucket, { user: number; tenant: number }> {
  return {
    read: {
      user: envInt("MCP_RATE_LIMIT_READ", 60),
      tenant: envInt("MCP_RATE_LIMIT_TENANT_READ", 120),
    },
    prepare: {
      user: envInt("MCP_RATE_LIMIT_PREPARE", 20),
      tenant: envInt("MCP_RATE_LIMIT_TENANT_PREPARE", 40),
    },
    write: {
      user: envInt("MCP_RATE_LIMIT_WRITE", 5),
      tenant: envInt("MCP_RATE_LIMIT_TENANT_WRITE", 10),
    },
  };
}

export function kindToBucket(kind: McpToolKind): McpRateBucket {
  return kind;
}

export async function consumeMcpRateLimit(opts: {
  userId: string;
  orgId: string;
  bucket: McpRateBucket;
}): Promise<void> {
  const cfg = mcpRateLimits();
  const now = Date.now();
  const start = windowStartMs(now);
  const db = getAdminDb();
  const checks: Array<{ key: string; limit: number }> = [
    { key: `user_${opts.userId}_${opts.bucket}_${start}`, limit: cfg[opts.bucket].user },
    { key: `org_${opts.orgId}_${opts.bucket}_${start}`, limit: cfg[opts.bucket].tenant },
  ];
  for (const check of checks) {
    const ref = db.collection(MCP_COLLECTIONS.mcpRateLimits).doc(check.key);
    const retry = await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      const count = typeof snap.data()?.count === "number" ? snap.data()!.count : 0;
      if (count >= check.limit) return retryAfterSeconds(now);
      t.set(
        ref,
        {
          userId: opts.userId,
          orgId: opts.orgId,
          bucket: opts.bucket,
          windowStart: start,
          count: FieldValue.increment(1),
          expiresAtMs: start + 2 * 60 * 1000,
        },
        { merge: true }
      );
      return 0;
    });
    if (retry > 0) {
      throw new McpToolError("RATE_LIMITED", `Too many requests. Retry after ${retry} seconds.`, 429);
    }
  }
}
