import { FieldPath } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_COMPANIES, MARKETING_CONTACTS } from "../collections";
import { fromFirestoreDocument } from "../persistence/documents";
import { DEFAULT_MARKETING_WORKSPACE_ID } from "../workspace";
import type { MarketingContactRecord } from "../repositories/types";
import { CRM_COMPANIES_MIGRATION_BATCH_SIZE } from "./constants";

export type MarketingMigrationScanBatch = {
  items: MarketingContactRecord[];
  nextCursor: string | null;
};

/**
 * Lectura paginada exclusiva del job de migración.
 * No forma parte de `contactService.searchContacts`.
 */
export interface MarketingMigrationContactScanner {
  scanBatch(cursor: string | null, limit: number): Promise<MarketingMigrationScanBatch>;
}

function hydrateContact(data: Record<string, unknown>): MarketingContactRecord {
  const workspaceId = String(data.workspaceId || DEFAULT_MARKETING_WORKSPACE_ID);
  return { ...(data as unknown as MarketingContactRecord), workspaceId };
}

export function createStaticContactScanner(
  contacts: MarketingContactRecord[],
): MarketingMigrationContactScanner {
  const sorted = [...contacts].sort((a, b) => a.id.localeCompare(b.id));
  return {
    async scanBatch(cursor, limit) {
      const size = Math.max(1, limit || CRM_COMPANIES_MIGRATION_BATCH_SIZE);
      let start = 0;
      if (cursor) {
        const idx = sorted.findIndex((c) => c.id === cursor);
        start = idx >= 0 ? idx + 1 : 0;
      }
      const items = sorted.slice(start, start + size);
      const last = items[items.length - 1];
      const exhausted = start + items.length >= sorted.length;
      return { items, nextCursor: exhausted || !last ? null : last.id };
    },
  };
}

/** Probe sin índice compuesto. Si la colección v2 está vacía, el preview no consulta companies. */
export async function firestoreMarketingCompaniesExist(): Promise<boolean> {
  const snap = await getAdminDb().collection(MARKETING_COMPANIES).limit(1).get();
  return !snap.empty;
}

export function createFirestoreContactScanner(): MarketingMigrationContactScanner {
  return {
    async scanBatch(cursor, limit) {
      const size = Math.max(1, limit || CRM_COMPANIES_MIGRATION_BATCH_SIZE);
      let query = getAdminDb()
        .collection(MARKETING_CONTACTS)
        .orderBy(FieldPath.documentId())
        .limit(size);
      if (cursor) query = query.startAfter(cursor);
      const snap = await query.get();
      const items = snap.docs.map((doc) =>
        hydrateContact(fromFirestoreDocument(doc.id, doc.data())),
      );
      const last = snap.docs[snap.docs.length - 1];
      return {
        items,
        nextCursor: !last || snap.size < size ? null : last.id,
      };
    },
  };
}
