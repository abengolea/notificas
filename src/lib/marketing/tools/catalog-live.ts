import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { audienceForCampaign, getOrCreateMarketingList, loadMarketingListCatalog, resolveListLabel } from "../audience";
import { materializeCrmCampaignList } from "../campaign-segment";
import {
  assertDraftForContentEdit,
  copyMarketingCampaign,
  isCampaignArchived,
  pauseCampaignStatus,
  patchMarketingCampaign,
  requireMarketingCampaign,
  resumeCampaignStatus,
} from "../campaign-ops";
import { persistCampaignEmail } from "../campaign-email";
import { MARKETING_CAMPAIGNS } from "../collections";
import { serializeAdminDoc } from "../events";
import { namedRecipientSource } from "../lists";
import { isMarketingCountryCode, type MarketingCountryCode } from "../countries";
import { isMarketingStage } from "../stages";
import { emptyCampaignStats, marketingFromEmail, marketingFromName } from "../types";
import { clampMarketingLimit, decodeMarketingCursor, encodeMarketingCursor } from "../pagination";
import { MarketingNotFoundError, MarketingValidationError } from "../errors";
import type {
  CampaignDetail,
  CampaignDraftChanges,
  CampaignDraftInput,
  CampaignListCatalog,
  CampaignListSummary,
  CampaignPreview,
  CampaignSummary,
} from "./types";

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
    archivedAt: doc.archivedAt ? String(doc.archivedAt) : null,
    stats,
    createdAt: doc.createdAt ? String(doc.createdAt) : null,
    updatedAt: doc.updatedAt ? String(doc.updatedAt) : null,
  };
}

function toDetail(data: Record<string, unknown>): CampaignDetail {
  const html = String(data.htmlBody || "");
  const text = String(data.textBody || "");
  const useCaseIds = Array.isArray(data.useCaseIds)
    ? data.useCaseIds.map(String).filter(Boolean)
    : data.useCaseId
      ? [String(data.useCaseId)]
      : [];
  return {
    ...toCampaign(data),
    includeStages: Array.isArray(data.includeStages) ? data.includeStages.map(String) : [],
    htmlPreview: html.slice(0, 1_500),
    textPreview: text.slice(0, 1_500),
    htmlBody: html,
    industryId: data.industryId ? String(data.industryId) : null,
    useCaseIds,
    audience: {
      total: Number(data.contactCount || 0),
      eligible: Number(data.contactCount || 0),
      skipped: 0,
    },
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

async function summaryAfter(id: string): Promise<CampaignSummary> {
  const db = getAdminDb();
  const snap = await db.collection(MARKETING_CAMPAIGNS).doc(id).get();
  if (!snap.exists) throw new MarketingNotFoundError("Campaña", id);
  return toCampaign(serializeAdminDoc(snap.id, snap.data() || {}));
}

async function previewFromDoc(data: Record<string, unknown>): Promise<CampaignPreview> {
  const html = String(data.htmlBody || "");
  const text = String(data.textBody || "");
  const status = String(data.status || "draft");
  const live =
    status === "draft"
      ? await audienceForCampaign(data)
      : {
          total: Number(data.contactCount || 0),
          eligible: Number(data.contactCount || 0),
          skipped: 0,
          contacts: [],
        };
  return {
    campaignId: String(data.id),
    name: String(data.name || ""),
    status,
    subject: String(data.subject || ""),
    htmlPreview: html.slice(0, 1_500),
    textPreview: text.slice(0, 1_500),
    sent: false,
    audience: {
      total: live.total,
      eligible: live.eligible,
      skipped: live.skipped,
      sample: live.contacts.slice(0, 8).map((c) => ({ name: c.name, email: c.email })),
    },
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
      return toDetail(serializeAdminDoc(snap.id, snap.data() || {}));
    },
    async previewCampaign(id) {
      const db = getAdminDb();
      const snap = await db.collection(MARKETING_CAMPAIGNS).doc(id).get();
      if (!snap.exists) return null;
      return previewFromDoc(serializeAdminDoc(snap.id, snap.data() || {}));
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
      const includeStages = (input.includeStages || ["new"]).filter(isMarketingStage);
      const useCaseIds = input.useCaseIds?.length ? input.useCaseIds : input.useCaseId ? [input.useCaseId] : [];
      const crmSegment = Boolean(input.industryId && (useCaseIds.length || input.useCaseId) && input.country);
      const materialized =
        !input.listId && crmSegment
          ? await materializeCrmCampaignList({
              segment: {
                countryCode: input.country || "",
                industryId: input.industryId || "",
                useCaseIds,
              },
              includeStages,
            })
          : null;
      const listId = materialized?.listId || input.listId;
      if (!listId) {
        throw new MarketingValidationError(
          "Indicá listId o un segmento CRM (country + industryId + useCaseIds) para el draft.",
        );
      }
      const list = await resolveListLabel(listId);
      if (namedRecipientSource({ listId: list.listId }).kind !== "list") {
        throw new MarketingValidationError(
          "Elegí una lista nominada de destinatarios. No se crea un draft contra todo el CRM ni listas virtuales de país.",
        );
      }
      const snapshot = persistCampaignEmail({
        htmlBody: input.htmlBody,
        name: input.name,
        subject: input.subject,
        title: input.subject,
        campaignName: input.name,
      });
      const db = getAdminDb();
      const ref = db.collection(MARKETING_CAMPAIGNS).doc();
      await ref.set({
        name: input.name.trim(),
        country: input.country || list.country,
        listId: list.listId,
        listName: list.listName,
        subject: input.subject.trim(),
        htmlBody: snapshot.htmlBody,
        textBody: snapshot.textBody || input.textBody || "",
        emailContent: snapshot.emailContent,
        templateId: snapshot.templateId,
        templateVersion: snapshot.templateVersion,
        htmlSnapshotAt: FieldValue.serverTimestamp(),
        fromEmail: marketingFromEmail(),
        fromName: marketingFromName(),
        status: "draft",
        includeStages: includeStages.length ? includeStages : ["new"],
        contactCount: materialized?.eligible || 0,
        stats: emptyCampaignStats(),
        audienceKind: materialized ? "crm" : "list",
        industryId: materialized ? input.industryId || null : list.industryId,
        useCaseId: materialized ? useCaseIds[0] || null : list.useCaseId,
        useCaseIds: materialized ? useCaseIds : list.useCaseIds,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        startedAt: null,
        completedAt: null,
      });
      const snap = await ref.get();
      return toCampaign(serializeAdminDoc(snap.id, snap.data() || {}));
    },
    async updateCampaignDraft(id, changes: CampaignDraftChanges) {
      const { data } = await requireMarketingCampaign(id);
      assertDraftForContentEdit(String(data.status || "draft"));
      const patch: Record<string, unknown> = {};
      if (changes.name) patch.name = changes.name.trim();
      if (changes.subject) patch.subject = changes.subject.trim();
      if (changes.htmlBody) {
        const snapshot = persistCampaignEmail({
          htmlBody: changes.htmlBody,
          name: String(data.name || ""),
          subject: String(changes.subject || data.subject || ""),
          title: String(changes.subject || data.subject || ""),
          campaignName: String(changes.name || data.name || ""),
        });
        patch.htmlBody = snapshot.htmlBody;
        patch.textBody = snapshot.textBody;
        patch.emailContent = snapshot.emailContent;
        patch.templateId = snapshot.templateId;
        patch.templateVersion = snapshot.templateVersion;
        patch.htmlSnapshotAt = FieldValue.serverTimestamp();
      }
      if (changes.textBody !== undefined && !changes.htmlBody) patch.textBody = changes.textBody;
      if (changes.includeStages) {
        const stages = changes.includeStages.filter(isMarketingStage);
        patch.includeStages = stages.length ? stages : ["new"];
      }
      if (changes.listId) {
        const list = await resolveListLabel(changes.listId);
        if (namedRecipientSource({ listId: list.listId }).kind !== "list") {
          throw new MarketingValidationError("Cargá una lista nominada (CSV o lista CRM materializada).");
        }
        patch.listId = list.listId;
        patch.listName = list.listName;
        patch.country = list.country;
        if (list.industryId) patch.industryId = list.industryId;
        if (list.useCaseId) patch.useCaseId = list.useCaseId;
        if (list.useCaseIds?.length) patch.useCaseIds = list.useCaseIds;
      }
      if (Object.keys(patch).length === 0) {
        throw new MarketingValidationError("No hay cambios para aplicar al borrador.");
      }
      await patchMarketingCampaign(id, patch);
      return summaryAfter(id);
    },
    async copyCampaign(id) {
      const copied = await copyMarketingCampaign(id);
      return toCampaign(copied.campaign);
    },
    async archiveCampaign(id) {
      const { data } = await requireMarketingCampaign(id);
      const patch: Record<string, unknown> = { archivedAt: FieldValue.serverTimestamp() };
      if (String(data.status || "") === "sending") patch.status = "paused";
      await patchMarketingCampaign(id, patch);
      return summaryAfter(id);
    },
    async restoreCampaign(id) {
      await patchMarketingCampaign(id, { archivedAt: null });
      return summaryAfter(id);
    },
    async pauseCampaign(id) {
      const { data } = await requireMarketingCampaign(id);
      await patchMarketingCampaign(id, { status: pauseCampaignStatus(String(data.status || "")) });
      return summaryAfter(id);
    },
    async resumeCampaign(id) {
      const { data } = await requireMarketingCampaign(id);
      await patchMarketingCampaign(id, {
        status: resumeCampaignStatus(String(data.status || ""), isCampaignArchived(data)),
      });
      return summaryAfter(id);
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
