import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { MCP_COLLECTIONS } from "@/mcp/collections";

export async function writeMcpAudit(entry: {
  requestId: string;
  userId?: string;
  orgId?: string;
  tool?: string;
  method?: string;
  result: "ok" | "error" | "denied";
  notificationId?: string;
  campaignId?: string;
  client?: string;
  durationMs: number;
  errorCode?: string;
}): Promise<void> {
  try {
    await getAdminDb().collection(MCP_COLLECTIONS.mcpAudit).add({
      ...entry,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.warn("mcp audit skipped", e instanceof Error ? e.message : e);
  }
}
