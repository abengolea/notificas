import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_MCP_AUDIT } from "@/lib/marketing/collections";

export async function writeCrmMcpAudit(entry: {
  requestId: string;
  actor?: string;
  tool?: string;
  workspaceId?: string;
  result: "ok" | "error" | "denied";
  durationMs: number;
  errorCode?: string;
  client?: string;
}): Promise<void> {
  try {
    await getAdminDb().collection(MARKETING_MCP_AUDIT).add({
      ...entry,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.warn("crm mcp audit skipped", e instanceof Error ? e.message : e);
  }
}
