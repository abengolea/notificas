import { clampMarketingLimit, encodeMarketingCursor, decodeMarketingCursor } from "../pagination";
import {
  assertDraftForContentEdit,
  copyCampaignName,
  isCampaignArchived,
  pauseCampaignStatus,
  resumeCampaignStatus,
} from "../campaign-ops";
import { MarketingNotFoundError, MarketingValidationError } from "../errors";
import { emptyCampaignStats } from "../types";
import type {
  CampaignDetail,
  CampaignDraftChanges,
  CampaignListCatalog,
  CampaignListSummary,
  CampaignPreview,
  CampaignSummary,
} from "./types";

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

function requireCampaign(campaigns: CampaignDetail[], id: string): CampaignDetail {
  const row = campaigns.find((c) => c.id === id);
  if (!row) throw new MarketingNotFoundError("Campaña", id);
  return row;
}

function toSummary(row: CampaignDetail): CampaignSummary {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    status: row.status,
    listId: row.listId,
    listName: row.listName,
    subject: row.subject,
    contactCount: row.contactCount,
    archivedAt: row.archivedAt ?? null,
    stats: row.stats,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function previewOf(row: CampaignDetail): CampaignPreview {
  return {
    campaignId: row.id,
    name: row.name,
    status: row.status,
    subject: row.subject,
    htmlPreview: (row.htmlPreview || row.htmlBody || "").slice(0, 1_500),
    textPreview: (row.textPreview || "").slice(0, 1_500),
    sent: false,
    audience: {
      total: row.audience?.total ?? row.contactCount,
      eligible: row.audience?.eligible ?? row.contactCount,
      skipped: row.audience?.skipped ?? 0,
      sample: [],
    },
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
    async previewCampaign(id) {
      const row = campaigns.find((c) => c.id === id);
      return row ? previewOf(row) : null;
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
      let listId = input.listId;
      if (!listId && input.industryId && input.country) {
        const created = await this.createList({
          name: `CRM ${input.industryId} ${input.country}`,
          country: input.country,
        });
        listId = created.id;
      }
      if (!listId) throw new MarketingValidationError("Indicá listId o un segmento CRM para el draft.");
      const list = lists.find((l) => l.id === listId);
      const now = new Date().toISOString();
      const row: CampaignDetail = {
        id: `camp_${campaigns.length + 1}`,
        name: input.name.trim(),
        country: input.country || list?.country || "all",
        status: "draft",
        listId,
        listName: list?.name || "",
        subject: input.subject,
        contactCount: list?.contactCount || 0,
        archivedAt: null,
        stats: emptyCampaignStats(),
        createdAt: now,
        updatedAt: now,
        includeStages: input.includeStages || ["new"],
        htmlBody: input.htmlBody,
        htmlPreview: input.htmlBody.slice(0, 500),
        textPreview: (input.textBody || "").slice(0, 500),
        industryId: input.industryId || null,
        useCaseIds: input.useCaseIds || (input.useCaseId ? [input.useCaseId] : []),
        audience: { total: list?.contactCount || 0, eligible: list?.contactCount || 0, skipped: 0 },
      };
      campaigns.push(row);
      return toSummary(row);
    },
    async updateCampaignDraft(id, changes: CampaignDraftChanges) {
      const row = requireCampaign(campaigns, id);
      assertDraftForContentEdit(row.status);
      if (changes.name) row.name = changes.name.trim();
      if (changes.subject) row.subject = changes.subject.trim();
      if (changes.htmlBody) {
        row.htmlBody = changes.htmlBody;
        row.htmlPreview = changes.htmlBody.slice(0, 500);
      }
      if (changes.textBody !== undefined) row.textPreview = changes.textBody.slice(0, 500);
      if (changes.includeStages) row.includeStages = changes.includeStages;
      if (changes.listId) {
        const list = lists.find((l) => l.id === changes.listId);
        row.listId = changes.listId;
        row.listName = list?.name || row.listName;
      }
      row.updatedAt = new Date().toISOString();
      return toSummary(row);
    },
    async copyCampaign(id) {
      const source = requireCampaign(campaigns, id);
      const now = new Date().toISOString();
      const row: CampaignDetail = {
        ...source,
        id: `camp_${campaigns.length + 1}`,
        name: copyCampaignName(source.name),
        status: "draft",
        archivedAt: null,
        stats: emptyCampaignStats(),
        createdAt: now,
        updatedAt: now,
      };
      campaigns.push(row);
      return toSummary(row);
    },
    async archiveCampaign(id) {
      const row = requireCampaign(campaigns, id);
      row.archivedAt = new Date().toISOString();
      if (row.status === "sending") row.status = "paused";
      row.updatedAt = new Date().toISOString();
      return toSummary(row);
    },
    async restoreCampaign(id) {
      const row = requireCampaign(campaigns, id);
      row.archivedAt = null;
      row.updatedAt = new Date().toISOString();
      return toSummary(row);
    },
    async pauseCampaign(id) {
      const row = requireCampaign(campaigns, id);
      row.status = pauseCampaignStatus(row.status);
      row.updatedAt = new Date().toISOString();
      return toSummary(row);
    },
    async resumeCampaign(id) {
      const row = requireCampaign(campaigns, id);
      row.status = resumeCampaignStatus(row.status, isCampaignArchived(row));
      row.updatedAt = new Date().toISOString();
      return toSummary(row);
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
