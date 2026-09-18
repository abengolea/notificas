import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getOrCreateMarketingList, loadMarketingListCatalog, resolveListLabel } from "../audience";
import { MARKETING_CAMPAIGNS } from "../collections";
import { serializeAdminDoc } from "../events";
import { namedRecipientSource } from "../lists";
import { isMarketingCountryCode, type MarketingCountryCode } from "../countries";
import { isMarketingStage } from "../stages";
import { emptyCampaignStats, marketingFromEmail, marketingFromName } from "../types";
import { clampMarketingLimit, decodeMarketingCursor, encodeMarketingCursor } from "../pagination";
import { MarketingValidationError } from "../errors";
import type { CampaignDetail, CampaignListCatalog, CampaignListSummary, CampaignSummary } from "./types";

function toCampaign(doc: Record<string, unknown>): CampaignSummary {
  const statsRaw = doc.stats && typeof doc.stats === "object" ? (doc.stats as Record<string, unknown>) : {};
  const stats: Record<string, number> = {};
  for (const [k, v] of Object.entries(statsRaw)) {
    if (typeof v === "number") stats[k] = v;
  }
  return {
    id: String(doc.id),
    name: String(doc.name || ""),
    country: String(doc.country || "all"),
    status: String(doc.status || "draft"),
    listId: doc.listId ? String(doc.listId) : null,
    listName: String(doc.listName || ""),
    subject: String(doc.subject || ""),
    contactCount: Number(doc.contactCount || 0),
    stats,
    createdAt: doc.createdAt ? String(doc.createdAt) : null,
    updatedAt: doc.updatedAt ? String(doc.updatedAt) : null,
  };
}

function pageRows<T extends { id: string }>(rows: T[], limit: number, cursor?: string) {
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

export function createLiveCampaignCatalog(): CampaignListCatalog {
  return {
    async searchCampaigns(input) {
      const db = getAdminDb();
      const snap = await db.collection(MARKETING_CAMPAIGNS).limit(200).get();
      let rows = snap.docs
        .map((d) => toCampaign(serializeAdminDoc(d.id, d.data())))
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      if (input.query) {
        const q = input.query.toLowerCase();
        rows = rows.filter((c) => c.name.toLowerCase().includes(q) || c.subject.toLowerCase().includes(q));
      }
      if (input.countryCode) {
        const code = input.countryCode.toUpperCase();
        rows = rows.filter((c) => c.country === code);
      }
      if (input.status) rows = rows.filter((c) => c.status === input.status);
      return pageRows(rows, input.limit, input.cursor);
    },
    async getCampaign(id) {
      const db = getAdminDb();
      const snap = await db.collection(MARKETING_CAMPAIGNS).doc(id).get();
      if (!snap.exists) return null;
      const data = serializeAdminDoc(snap.id, snap.data() || {});
      const base = toCampaign(data);
      const html = String(data.htmlBody || "");
      const text = String(data.textBody || "");
      const detail: CampaignDetail = {
        ...base,
        includeStages: Array.isArray(data.includeStages) ? data.includeStages.map(String) : [],
        htmlPreview: html.slice(0, 1_500),
        textPreview: text.slice(0, 1_500),
        audience: {
          total: Number(data.contactCount || 0),
          eligible: Number(data.contactCount || 0),
          skipped: 0,
        },
      };
      return detail;
    },
    async searchLists(input) {
      const catalog = await loadMarketingListCatalog();
      let rows: CampaignListSummary[] = catalog.map((l) => ({
        id: l.id,
        name: l.name,
        country: String(l.country),
        contactCount: l.contactCount,
        source: l.source,
        virtual: l.virtual,
      }));
      if (input.query) {
        const q = input.query.toLowerCase();
        rows = rows.filter((l) => l.name.toLowerCase().includes(q));
      }
      return pageRows(rows, input.limit, input.cursor);
    },
    async getList(id) {
      const catalog = await loadMarketingListCatalog();
      const hit = catalog.find((l) => l.id === id);
      if (!hit) return null;
      return {
        id: hit.id,
        name: hit.name,
        country: String(hit.country),
        contactCount: hit.contactCount,
        source: hit.source,
        virtual: hit.virtual,
        sampleSize: Math.min(hit.contactCount, 20),
      };
    },
    async createList(input) {
      const raw = (input.country || "all").toUpperCase();
      const country: MarketingCountryCode | "all" = isMarketingCountryCode(raw) ? raw : "all";
      const created = await getOrCreateMarketingList({
        name: input.name,
        country,
        source: "manual",
      });
      return {
        id: created.id,
        name: created.name,
        country: String(created.country),
        contactCount: 0,
        source: "manual",
      };
    },
    async createCampaignDraft(input) {
      const list = await resolveListLabel(input.listId);
      if (namedRecipientSource({ listId: list.listId }).kind !== "list") {
        throw new MarketingValidationError(
          "Elegí una lista nominada de destinatarios. No se crea un draft contra todo el CRM ni listas virtuales de país.",
        );
      }
      const includeStages = (input.includeStages || ["new"]).filter(isMarketingStage);
      const db = getAdminDb();
      const ref = db.collection(MARKETING_CAMPAIGNS).doc();
      await ref.set({
        name: input.name.trim(),
        country: input.country || list.country,
        listId: list.listId,
        listName: list.listName,
        subject: input.subject.trim(),
        htmlBody: input.htmlBody,
        textBody: input.textBody || "",
        fromEmail: marketingFromEmail(),
        fromName: marketingFromName(),
        status: "draft",
        includeStages: includeStages.length ? includeStages : ["new"],
        contactCount: 0,
        stats: emptyCampaignStats(),
        audienceKind: "list",
        industryId: list.industryId,
        useCaseId: list.useCaseId,
        useCaseIds: list.useCaseIds,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        startedAt: null,
        completedAt: null,
      });
      const snap = await ref.get();
      return toCampaign(serializeAdminDoc(snap.id, snap.data() || {}));
    },
    async countCampaigns() {
      const db = getAdminDb();
      try {
        const agg = await db.collection(MARKETING_CAMPAIGNS).count().get();
        return agg.data().count;
      } catch {
        const snap = await db.collection(MARKETING_CAMPAIGNS).limit(200).get();
        return snap.size;
      }
    },
    async countLists() {
      const catalog = await loadMarketingListCatalog();
      return catalog.filter((l) => !l.virtual).length;
    },
  };
}

export { clampMarketingLimit };
