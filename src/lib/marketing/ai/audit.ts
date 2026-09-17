import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_AI_AUDIT_LOGS } from "../collections";

export type CrmAiAuditEntry = {
  workspaceId: string;
  userId: string;
  conversationId?: string;
  tool: string;
  entityType?: string;
  entityIds?: string[];
  success: boolean;
  errorCode?: string;
  durationMs?: number;
  idempotencyKey?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export async function writeCrmAiAudit(entry: CrmAiAuditEntry): Promise<void> {
  try {
    await getAdminDb().collection(MARKETING_AI_AUDIT_LOGS).add({
      ...entry,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.warn("crm ai audit skipped", e instanceof Error ? e.message : e);
  }
}

export function createMemoryAiAudit() {
  const entries: CrmAiAuditEntry[] = [];
  return {
    entries,
    async write(entry: CrmAiAuditEntry) {
      entries.push(entry);
    },
  };
}
