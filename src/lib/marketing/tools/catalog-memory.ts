import { clampMarketingLimit, encodeMarketingCursor, decodeMarketingCursor } from "../pagination";
import type { CampaignListCatalog, CampaignListSummary, CampaignDetail } from "./types";

function page<T extends { id: string }>(
  rows: T[],
  limit: number,
  cursor?: string,
): { items: T[]; nextCursor?: string } {
  const decoded = decodeMarketingCursor(cursor);
  let start = 0;
  if (decoded) {
    const idx = rows.findIndex((row) => row.id === decoded.id);
    start = idx >= 0 ? idx + 1 : 0;
  }
  const slice = rows.slice(start, start + limit + 1);
  const extra = slice.length > limit;
  const items = extra ? slice.slice(0, limit) : slice;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: extra && last ? encodeMarketingCursor({ t: "", id: last.id }) : undefined,
  };
}

export function createMemoryCampaignCatalog(seed?: {
  lists?: CampaignListSummary[];
  campaigns?: CampaignDetail[];
}): CampaignListCatalog {
  const lists = [...(seed?.lists || [])];
  const campaigns = [...(seed?.campaigns || [])];

  return {
    async searchCampaigns(input) {
      let rows = campaigns.filter((c) => !c.id.startsWith("__"));
      if (input.query) {
        const q = input.query.toLowerCase();
        rows = rows.filter((c) => c.name.toLowerCase().includes(q) || c.subject.toLowerCase().includes(q));
      }
      if (input.countryCode) {
        const code = input.countryCode.toUpperCase();
        rows = rows.filter((c) => c.country === code || c.country === "all");
      }
      if (input.status) rows = rows.filter((c) => c.status === input.status);
      return page(rows, input.limit, input.cursor);
    },
    async getCampaign(id) {
      return campaigns.find((c) => c.id === id) || null;
    },
    async searchLists(input) {
      let rows = lists;
      if (input.query) {
        const q = input.query.toLowerCase();
        rows = rows.filter((l) => l.name.toLowerCase().includes(q));
      }
      return page(rows, input.limit, input.cursor);
    },
    async getList(id) {
      return lists.find((l) => l.id === id) || null;
    },
    async createList(input) {
      const existing = lists.find((l) => l.name.toLowerCase() === input.name.trim().toLowerCase());
      if (existing) return existing;
      const row: CampaignListSummary = {
        id: `list_${lists.length + 1}`,
        name: input.name.trim(),
        country: (input.country || "all").toUpperCase(),
        contactCount: 0,
        source: "manual",
      };
      lists.push(row);
      return row;
    },
    async createCampaignDraft(input) {
      const list = lists.find((l) => l.id === input.listId);
      const row: CampaignDetail = {
        id: `camp_${campaigns.length + 1}`,
        name: input.name.trim(),
        country: input.country || list?.country || "all",
        status: "draft",
        listId: input.listId,
        listName: list?.name || "",
        subject: input.subject,
        contactCount: list?.contactCount || 0,
        stats: { queued: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, bounced: 0, failed: 0, unsubscribed: 0 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        includeStages: input.includeStages || ["new"],
        htmlPreview: input.htmlBody.slice(0, 500),
        textPreview: (input.textBody || "").slice(0, 500),
      };
      campaigns.push(row);
      return row;
    },
    async countCampaigns() {
      return campaigns.length;
    },
    async countLists() {
      return lists.filter((l) => !l.virtual).length;
    },
  };
}

export { clampMarketingLimit };
