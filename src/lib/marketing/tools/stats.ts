import { getAdminDb } from "@/lib/firebase-admin";
import {
  MARKETING_COMPANIES,
  MARKETING_CONTACTS,
  MARKETING_COUNTRY_COLLECTION,
  MARKETING_TASKS,
} from "../collections";
import { createMemoryMarketingRepositories } from "../repositories/memory";
import type { MarketingRepositories } from "../repositories/types";
import type { CrmStatsPort } from "./types";

async function firestoreCount(
  collection: string,
  filters: Array<[string, FirebaseFirestore.WhereFilterOp, unknown]>,
): Promise<number | null> {
  try {
    let q: FirebaseFirestore.Query = getAdminDb().collection(collection);
    for (const [field, op, value] of filters) q = q.where(field, op, value);
    const agg = await q.count().get();
    return agg.data().count;
  } catch {
    return null;
  }
}

export function createLiveCrmStats(): CrmStatsPort {
  return {
    async countCompanies(workspaceId) {
      const count = await firestoreCount(MARKETING_COMPANIES, [
        ["workspaceId", "==", workspaceId],
        ["deletedAt", "==", null],
      ]);
      return { count: count ?? 0, truncated: count == null };
    },
    async countContacts(workspaceId) {
      const withWs = await firestoreCount(MARKETING_CONTACTS, [["workspaceId", "==", workspaceId]]);
      if (withWs != null) return { count: withWs };
      const all = await firestoreCount(MARKETING_CONTACTS, []);
      return { count: all ?? 0, truncated: all == null };
    },
    async countPendingTasks(workspaceId) {
      const count = await firestoreCount(MARKETING_TASKS, [
        ["workspaceId", "==", workspaceId],
        ["status", "==", "open"],
      ]);
      return { count: count ?? 0, truncated: count == null };
    },
    async countNewContacts(workspaceId) {
      void workspaceId;
      const count = await firestoreCount(MARKETING_CONTACTS, [["stage", "==", "new"]]);
      return { count: count ?? 0, truncated: count == null };
    },
    async countRepliedContacts(workspaceId) {
      void workspaceId;
      const count = await firestoreCount(MARKETING_CONTACTS, [["stage", "==", "replied"]]);
      return { count: count ?? 0, truncated: count == null };
    },
    async countCountries(workspaceId) {
      const count = await firestoreCount(MARKETING_COUNTRY_COLLECTION, [["workspaceId", "==", workspaceId]]);
      return { count: count ?? 0, truncated: count == null };
    },
  };
}

export function createMemoryCrmStats(repos: MarketingRepositories): CrmStatsPort {
  return {
    async countCompanies(workspaceId) {
      const page = await repos.companies.search(workspaceId, { limit: 100 });
      return { count: page.items.filter((c) => !c.deletedAt).length, truncated: Boolean(page.nextCursor) };
    },
    async countContacts(workspaceId) {
      const page = await repos.contacts.search(workspaceId, { limit: 100 });
      return { count: page.items.length, truncated: Boolean(page.nextCursor) };
    },
    async countPendingTasks(workspaceId) {
      const page = await repos.tasks.list(workspaceId, { status: "open", limit: 100 });
      return { count: page.items.length, truncated: Boolean(page.nextCursor) };
    },
    async countNewContacts(workspaceId) {
      const page = await repos.contacts.search(workspaceId, { stage: "new", limit: 100 });
      return { count: page.items.length, truncated: Boolean(page.nextCursor) };
    },
    async countRepliedContacts(workspaceId) {
      const page = await repos.contacts.search(workspaceId, { stage: "replied", limit: 100 });
      return { count: page.items.length, truncated: Boolean(page.nextCursor) };
    },
    async countCountries(workspaceId) {
      const page = await repos.countries.list(workspaceId, undefined, 100);
      return { count: page.items.length, truncated: Boolean(page.nextCursor) };
    },
  };
}

export function createEmptyMemoryStats(): CrmStatsPort {
  return createMemoryCrmStats(createMemoryMarketingRepositories());
}
