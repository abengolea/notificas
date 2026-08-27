import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/public-api/types";

/** Auditoría sin secretos: nunca persistir Authorization, API keys, webhook secrets ni bodies crudos. */
export async function writeApiAudit(entry: {
  requestId: string;
  apiKeyId?: string;
  orgId?: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  notificationId?: string;
  batchId?: string;
  errorCode?: string;
}): Promise<void> {
  try {
    await getAdminDb().collection(COLLECTIONS.apiAudit).add({
      ...entry,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.warn("public-api audit skipped", e instanceof Error ? e.message : e);
  }
}
