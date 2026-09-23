import { marketingCatalogId } from "../domain/ids";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  MARKETING_ACTIVITIES,
  MARKETING_COMPANIES,
  MARKETING_CONTACTS,
  MARKETING_COUNTRY_COLLECTION,
  MARKETING_INDUSTRIES,
  MARKETING_LINKEDIN_CAMPAIGN_MEMBERS,
  MARKETING_LINKEDIN_CAMPAIGNS,
  MARKETING_LIST_MEMBERSHIPS,
  MARKETING_MESSAGE_TEMPLATE_VERSIONS,
  MARKETING_MESSAGE_TEMPLATES,
  MARKETING_OPPORTUNITIES,
  MARKETING_SOURCES,
  MARKETING_TAGS,
  MARKETING_TASKS,
  MARKETING_USE_CASES,
} from "../collections";
import { contactIdForEmail } from "../csv";
import { DEFAULT_MARKETING_WORKSPACE_ID } from "../workspace";
import { fromFirestoreDocument, toFirestoreDocument } from "../persistence/documents";
import { toFirestoreTimestamp } from "../persistence/timestamps";
import {
  clampMarketingLimit,
  decodeMarketingCursor,
  encodeMarketingCursor,
  type MarketingPage,
} from "../pagination";
import { normalizeMarketingEmail } from "../normalizers";
import type {
  CompanySearchFilters,
  ContactSearchFilters,
  MarketingActivityRepository,
  MarketingCompanyRepository,
  MarketingContactRecord,
  MarketingContactRepository,
  MarketingCountryRepository,
  MarketingIndustryRepository,
  MarketingLinkedInCampaignMemberRepository,
  MarketingLinkedInCampaignRepository,
  MarketingMembershipRepository,
  MarketingOpportunityRepository,
  MarketingRepositories,
  MarketingSourceRepository,
  MarketingTagRepository,
  MarketingTaskRepository,
  MarketingTemplateRepository,
  MarketingUseCaseRepository,
  OpportunitySearchFilters,
  TaskListFilters,
} from "./types";
import type {
  MarketingActivity,
  MarketingCompany,
  MarketingCountry,
  MarketingIndustry,
  MarketingListMembership,
  MarketingMessageTemplate,
  MarketingMessageTemplateVersion,
  MarketingLinkedInCampaign,
  MarketingLinkedInCampaignMember,
  MarketingOpportunity,
  MarketingSource,
  MarketingTag,
  MarketingTask,
  MarketingUseCase,
} from "../domain/types";

function col(name: string) {
  return getAdminDb().collection(name);
}

function asPage<T extends { id: string }>(
  rows: T[],
  limit: number,
  ts: (row: T) => string | null | undefined,
): MarketingPage<T> {
  const extra = rows.length > limit;
  const items = extra ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: extra && last ? encodeMarketingCursor({ t: ts(last) || "", id: last.id }) : undefined,
  };
}

async function getTyped<T>(collection: string, id: string): Promise<T | null> {
  const snap = await col(collection).doc(id).get();
  if (!snap.exists) return null;
  return fromFirestoreDocument(snap.id, snap.data()) as T;
}

async function createTyped(collection: string, id: string, doc: Record<string, unknown>): Promise<void> {
  await col(collection).doc(id).set(toFirestoreDocument(doc));
}

async function updateTyped(
  collection: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await col(collection).doc(id).update(toFirestoreDocument(patch));
}

function applyCursor(
  query: FirebaseFirestore.Query,
  cursor: string | undefined,
  orderField: string,
): FirebaseFirestore.Query {
  const ordered = query.orderBy(orderField, "desc");
  const decoded = decodeMarketingCursor(cursor);
  if (!decoded) return ordered;
  const ts = toFirestoreTimestamp(decoded.t);
  return ordered.startAfter(ts ?? decoded.t);
}

function hydrateContact(data: Record<string, unknown>): MarketingContactRecord {
  const workspaceId = String(data.workspaceId || DEFAULT_MARKETING_WORKSPACE_ID);
  return { ...(data as unknown as MarketingContactRecord), workspaceId };
}

export function createFirestoreMarketingRepositories(): MarketingRepositories {
  const companies: MarketingCompanyRepository = {
    async create(doc) {
      await createTyped(MARKETING_COMPANIES, doc.id, { ...doc, deletedAt: doc.deletedAt ?? null });
    },
    async getById(workspaceId, id) {
      const row = await getTyped<MarketingCompany>(MARKETING_COMPANIES, id);
      return row && row.workspaceId === workspaceId ? row : null;
    },
    async update(workspaceId, id, patch) {
      const current = await this.getById(workspaceId, id);
      if (!current) return;
      await updateTyped(MARKETING_COMPANIES, id, { ...patch });
    },
    async findByNormalizedDomain(workspaceId, domain) {
      const snap = await col(MARKETING_COMPANIES)
        .where("workspaceId", "==", workspaceId)
        .where("normalizedDomain", "==", domain)
        .limit(10)
        .get();
      return snap.docs
        .map((d) => fromFirestoreDocument(d.id, d.data()) as MarketingCompany)
        .filter((c) => !c.deletedAt);
    },
    async findByNormalizedName(workspaceId, name, countryCode) {
      let q: FirebaseFirestore.Query = col(MARKETING_COMPANIES)
        .where("workspaceId", "==", workspaceId)
        .where("normalizedName", "==", name);
      if (countryCode) q = q.where("countryCode", "==", countryCode);
      const snap = await q.limit(10).get();
      return snap.docs
        .map((d) => fromFirestoreDocument(d.id, d.data()) as MarketingCompany)
        .filter((c) => !c.deletedAt);
    },
    async search(workspaceId, filters: CompanySearchFilters) {
      const limit = clampMarketingLimit(filters.limit);
      let q: FirebaseFirestore.Query = col(MARKETING_COMPANIES)
        .where("workspaceId", "==", workspaceId)
        .where("deletedAt", "==", null);
      if (filters.countryCode) q = q.where("countryCode", "==", filters.countryCode);
      else if (filters.status) q = q.where("status", "==", filters.status);
      else if (filters.commercialStageId) q = q.where("commercialStageId", "==", filters.commercialStageId);
      else if (filters.industryId) q = q.where("industryIds", "array-contains", filters.industryId);
      else if (filters.useCaseId) q = q.where("useCaseIds", "array-contains", filters.useCaseId);
      q = applyCursor(q, filters.cursor, "updatedAt").limit(limit + 1);
      const snap = await q.get();
      const rows = snap.docs.map((d) => fromFirestoreDocument(d.id, d.data()) as MarketingCompany);
      return asPage(rows, limit, (r) => r.updatedAt);
    },
  };

  const contacts: MarketingContactRepository = {
    async getById(id) {
      const row = await getTyped<MarketingContactRecord>(MARKETING_CONTACTS, id);
      return row ? hydrateContact(row) : null;
    },
    async getByEmail(email) {
      return this.getById(contactIdForEmail(normalizeMarketingEmail(email)));
    },
    async getByLinkedInUrl(workspaceId, linkedinUrl) {
      const snap = await col(MARKETING_CONTACTS)
        .where("workspaceId", "==", workspaceId)
        .where("linkedinUrl", "==", linkedinUrl)
        .limit(1)
        .get();
      if (snap.empty) return null;
      return hydrateContact(fromFirestoreDocument(snap.docs[0].id, snap.docs[0].data()));
    },
    async create(doc) {
      await createTyped(MARKETING_CONTACTS, doc.id, { ...doc });
    },
    async update(id, patch) {
      await updateTyped(MARKETING_CONTACTS, id, { ...patch });
    },
    async search(workspaceId, filters: ContactSearchFilters) {
      const limit = clampMarketingLimit(filters.limit);
      let q: FirebaseFirestore.Query = col(MARKETING_CONTACTS);
      if (filters.companyId) {
        q = q.where("workspaceId", "==", workspaceId).where("companyId", "==", filters.companyId);
      } else if (filters.countryCode) {
        q = q.where("country", "==", filters.countryCode);
      } else {
        q = q.where("workspaceId", "==", workspaceId);
      }
      q = applyCursor(q, filters.cursor, "updatedAt").limit(limit + 1);
      const snap = await q.get();
      const rows = snap.docs
        .map((d) => hydrateContact(fromFirestoreDocument(d.id, d.data())))
        .filter((c) => {
          if (c.deletedAt) return false;
          if ((c.workspaceId || DEFAULT_MARKETING_WORKSPACE_ID) !== workspaceId) return false;
          if (filters.stage && c.stage !== filters.stage) return false;
          if (filters.commercialStageId && c.commercialStageId !== filters.commercialStageId) return false;
          return true;
        });
      return asPage(rows, limit, (r) => r.updatedAt || undefined);
    },
  };

  function catalogRepo<T extends { id: string; workspaceId: string; updatedAt: string }>(
    collection: string,
  ): {
    create: (doc: T) => Promise<void>;
    getById: (workspaceId: string, id: string) => Promise<T | null>;
    update: (workspaceId: string, id: string, patch: Partial<T>) => Promise<void>;
    list: (workspaceId: string, cursor?: string, limit?: number) => Promise<MarketingPage<T>>;
  } {
    return {
      async create(doc) {
        await createTyped(collection, doc.id, { ...doc });
      },
      async getById(workspaceId, id) {
        const row = await getTyped<T>(collection, id);
        return row && row.workspaceId === workspaceId ? row : null;
      },
      async update(workspaceId, id, patch) {
        const current = await this.getById(workspaceId, id);
        if (!current) return;
        await updateTyped(collection, id, { ...patch });
      },
      async list(workspaceId, cursor, limit) {
        const size = clampMarketingLimit(limit);
        const q = applyCursor(
          col(collection).where("workspaceId", "==", workspaceId),
          cursor,
          "updatedAt",
        ).limit(size + 1);
        const snap = await q.get();
        const rows = snap.docs.map((d) => fromFirestoreDocument(d.id, d.data()) as T);
        return asPage(rows, size, (r) => r.updatedAt);
      },
    };
  }

  const industryBase = catalogRepo<MarketingIndustry>(MARKETING_INDUSTRIES);
  const industries: MarketingIndustryRepository = {
    ...industryBase,
    async findByNormalizedName(workspaceId, name) {
      const snap = await col(MARKETING_INDUSTRIES)
        .where("workspaceId", "==", workspaceId)
        .where("normalizedName", "==", name)
        .limit(1)
        .get();
      if (snap.empty) return null;
      return fromFirestoreDocument(snap.docs[0].id, snap.docs[0].data()) as MarketingIndustry;
    },
    async findByKey(workspaceId, key) {
      return industryBase.getById(workspaceId, marketingCatalogId(workspaceId, "industry", key));
    },
  };

  const useCaseBase = catalogRepo<MarketingUseCase>(MARKETING_USE_CASES);
  const useCases: MarketingUseCaseRepository = {
    ...useCaseBase,
    async findByKey(workspaceId, key) {
      return useCaseBase.getById(workspaceId, marketingCatalogId(workspaceId, "use_case", key));
    },
  };

  const tagBase = catalogRepo<MarketingTag>(MARKETING_TAGS);
  const tags: MarketingTagRepository = {
    ...tagBase,
    async findByNormalizedName(workspaceId, name) {
      const snap = await col(MARKETING_TAGS)
        .where("workspaceId", "==", workspaceId)
        .where("normalizedName", "==", name)
        .limit(1)
        .get();
      if (snap.empty) return null;
      return fromFirestoreDocument(snap.docs[0].id, snap.docs[0].data()) as MarketingTag;
    },
    async findByKey(workspaceId, key) {
      return tagBase.getById(workspaceId, marketingCatalogId(workspaceId, "tag", key));
    },
  };

  const countryBase = catalogRepo<MarketingCountry>(MARKETING_COUNTRY_COLLECTION);
  const countries: MarketingCountryRepository = {
    ...countryBase,
    async findByKey(workspaceId, key) {
      const code = key.trim().toUpperCase();
      return countryBase.getById(workspaceId, marketingCatalogId(workspaceId, "country", code));
    },
  };

  const sources: MarketingSourceRepository = {
    async create(doc) {
      await createTyped(MARKETING_SOURCES, doc.id, { ...doc });
    },
    async getById(workspaceId, id) {
      const row = await getTyped<MarketingSource>(MARKETING_SOURCES, id);
      return row && row.workspaceId === workspaceId ? row : null;
    },
    async list(workspaceId, cursor, limit) {
      const size = clampMarketingLimit(limit);
      const q = applyCursor(col(MARKETING_SOURCES).where("workspaceId", "==", workspaceId), cursor, "createdAt").limit(
        size + 1,
      );
      const snap = await q.get();
      const rows = snap.docs.map((d) => fromFirestoreDocument(d.id, d.data()) as MarketingSource);
      return asPage(rows, size, (r) => r.createdAt);
    },
  };

  const memberships: MarketingMembershipRepository = {
    async add(doc) {
      await createTyped(MARKETING_LIST_MEMBERSHIPS, doc.id, { ...doc });
    },
    async remove(workspaceId, id) {
      const current = await this.getById(workspaceId, id);
      if (!current) return;
      await col(MARKETING_LIST_MEMBERSHIPS).doc(id).delete();
    },
    async getById(workspaceId, id) {
      const row = await getTyped<MarketingListMembership>(MARKETING_LIST_MEMBERSHIPS, id);
      return row && row.workspaceId === workspaceId ? row : null;
    },
    async listContactsForList(workspaceId, listId, cursor, limit) {
      const size = clampMarketingLimit(limit);
      const q = applyCursor(
        col(MARKETING_LIST_MEMBERSHIPS).where("workspaceId", "==", workspaceId).where("listId", "==", listId),
        cursor,
        "addedAt",
      ).limit(size + 1);
      const snap = await q.get();
      const rows = snap.docs.map((d) => fromFirestoreDocument(d.id, d.data()) as MarketingListMembership);
      return asPage(rows, size, (r) => r.addedAt);
    },
    async listListsForContact(workspaceId, contactId, cursor, limit) {
      const size = clampMarketingLimit(limit);
      const q = applyCursor(
        col(MARKETING_LIST_MEMBERSHIPS).where("workspaceId", "==", workspaceId).where("contactId", "==", contactId),
        cursor,
        "addedAt",
      ).limit(size + 1);
      const snap = await q.get();
      const rows = snap.docs.map((d) => fromFirestoreDocument(d.id, d.data()) as MarketingListMembership);
      return asPage(rows, size, (r) => r.addedAt);
    },
  };

  const templates: MarketingTemplateRepository = {
    async create(doc) {
      await createTyped(MARKETING_MESSAGE_TEMPLATES, doc.id, { ...doc, deletedAt: doc.deletedAt ?? null });
    },
    async getById(workspaceId, id) {
      const row = await getTyped<MarketingMessageTemplate>(MARKETING_MESSAGE_TEMPLATES, id);
      return row && row.workspaceId === workspaceId ? row : null;
    },
    async updateMetadata(workspaceId, id, patch) {
      const current = await this.getById(workspaceId, id);
      if (!current) return;
      await updateTyped(MARKETING_MESSAGE_TEMPLATES, id, { ...patch });
    },
    async appendVersion(workspaceId, templateId, body) {
      const db = getAdminDb();
      const templateRef = col(MARKETING_MESSAGE_TEMPLATES).doc(templateId);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(templateRef);
        if (!snap.exists) throw new Error("template_not_found");
        const current = fromFirestoreDocument(snap.id, snap.data()) as MarketingMessageTemplate;
        if (current.workspaceId !== workspaceId) throw new Error("template_not_found");
        const version = current.currentVersion + 1;
        const id = `${templateId}__v${version}`;
        const versionRef = col(MARKETING_MESSAGE_TEMPLATE_VERSIONS).doc(id);
        const existing = await tx.get(versionRef);
        if (existing.exists) throw new Error("version_conflict");
        const doc: MarketingMessageTemplateVersion = {
          id,
          workspaceId,
          templateId,
          version,
          subject: body.subject,
          html: body.html,
          text: body.text,
          createdAt: body.createdAt,
          createdBy: body.createdBy,
        };
        tx.set(versionRef, toFirestoreDocument({ ...doc }));
        const nextTemplate: MarketingMessageTemplate = {
          ...current,
          currentVersion: version,
          updatedAt: body.createdAt,
        };
        tx.update(templateRef, toFirestoreDocument({ currentVersion: version, updatedAt: body.createdAt }));
        return { template: nextTemplate, version: doc };
      });
    },
    async getVersion(workspaceId, templateId, version) {
      const id = `${templateId}__v${version}`;
      const row = await getTyped<MarketingMessageTemplateVersion>(MARKETING_MESSAGE_TEMPLATE_VERSIONS, id);
      return row && row.workspaceId === workspaceId ? row : null;
    },
    async listVersions(workspaceId, templateId) {
      const snap = await col(MARKETING_MESSAGE_TEMPLATE_VERSIONS)
        .where("workspaceId", "==", workspaceId)
        .where("templateId", "==", templateId)
        .orderBy("version", "asc")
        .get();
      return snap.docs.map((d) => fromFirestoreDocument(d.id, d.data()) as MarketingMessageTemplateVersion);
    },
    async list(workspaceId, cursor, limit) {
      const size = clampMarketingLimit(limit);
      const q = applyCursor(
        col(MARKETING_MESSAGE_TEMPLATES).where("workspaceId", "==", workspaceId),
        cursor,
        "updatedAt",
      ).limit(size + 1);
      const snap = await q.get();
      const rows = snap.docs
        .map((d) => fromFirestoreDocument(d.id, d.data()) as MarketingMessageTemplate)
        .filter((row) => !row.deletedAt);
      return asPage(rows, size, (r) => r.updatedAt);
    },
  };

  const activities: MarketingActivityRepository = {
    async create(doc) {
      await createTyped(MARKETING_ACTIVITIES, doc.id, { ...doc });
    },
    async listByCompany(workspaceId, companyId, filters) {
      const size = clampMarketingLimit(filters?.limit);
      const q = applyCursor(
        col(MARKETING_ACTIVITIES).where("workspaceId", "==", workspaceId).where("companyId", "==", companyId),
        filters?.cursor,
        "createdAt",
      ).limit(size + 1);
      const snap = await q.get();
      const rows = snap.docs.map((d) => fromFirestoreDocument(d.id, d.data()) as MarketingActivity);
      return asPage(rows, size, (r) => r.createdAt);
    },
    async listByContact(workspaceId, contactId, filters) {
      const size = clampMarketingLimit(filters?.limit);
      const q = applyCursor(
        col(MARKETING_ACTIVITIES).where("workspaceId", "==", workspaceId).where("contactId", "==", contactId),
        filters?.cursor,
        "createdAt",
      ).limit(size + 1);
      const snap = await q.get();
      const rows = snap.docs.map((d) => fromFirestoreDocument(d.id, d.data()) as MarketingActivity);
      return asPage(rows, size, (r) => r.createdAt);
    },
    async listByOpportunity(workspaceId, opportunityId, filters) {
      const size = clampMarketingLimit(filters?.limit);
      const q = applyCursor(
        col(MARKETING_ACTIVITIES).where("workspaceId", "==", workspaceId).where("opportunityId", "==", opportunityId),
        filters?.cursor,
        "createdAt",
      ).limit(size + 1);
      const snap = await q.get();
      const rows = snap.docs.map((d) => fromFirestoreDocument(d.id, d.data()) as MarketingActivity);
      return asPage(rows, size, (r) => r.createdAt);
    },
  };

  const tasks: MarketingTaskRepository = {
    async create(doc) {
      await createTyped(MARKETING_TASKS, doc.id, { ...doc });
    },
    async getById(workspaceId, id) {
      const row = await getTyped<MarketingTask>(MARKETING_TASKS, id);
      return row && row.workspaceId === workspaceId ? row : null;
    },
    async update(workspaceId, id, patch) {
      const current = await this.getById(workspaceId, id);
      if (!current) return;
      await updateTyped(MARKETING_TASKS, id, { ...patch });
    },
    async list(workspaceId, filters: TaskListFilters) {
      const size = clampMarketingLimit(filters.limit);
      let q: FirebaseFirestore.Query = col(MARKETING_TASKS).where("workspaceId", "==", workspaceId);
      if (filters.assignedTo) q = q.where("assignedTo", "==", filters.assignedTo);
      else if (filters.companyId) q = q.where("companyId", "==", filters.companyId);
      else if (filters.contactId) q = q.where("contactId", "==", filters.contactId);
      else if (filters.opportunityId) q = q.where("opportunityId", "==", filters.opportunityId);
      if (filters.status) q = q.where("status", "==", filters.status);
      const orderField = filters.dueAfter || filters.dueBefore ? "dueAt" : "updatedAt";
      if (filters.dueAfter) q = q.where("dueAt", ">=", toFirestoreTimestamp(filters.dueAfter));
      if (filters.dueBefore) q = q.where("dueAt", "<=", toFirestoreTimestamp(filters.dueBefore));
      q = applyCursor(q, filters.cursor, orderField).limit(size + 1);
      const snap = await q.get();
      const rows = snap.docs.map((d) => fromFirestoreDocument(d.id, d.data()) as MarketingTask);
      return asPage(rows, size, (r) => (orderField === "dueAt" ? r.dueAt : r.updatedAt));
    },
  };

  const opportunities: MarketingOpportunityRepository = {
    async create(doc) {
      await createTyped(MARKETING_OPPORTUNITIES, doc.id, { ...doc, deletedAt: doc.deletedAt ?? null });
    },
    async getById(workspaceId, id) {
      const row = await getTyped<MarketingOpportunity>(MARKETING_OPPORTUNITIES, id);
      return row && row.workspaceId === workspaceId ? row : null;
    },
    async update(workspaceId, id, patch) {
      const current = await this.getById(workspaceId, id);
      if (!current) return;
      await updateTyped(MARKETING_OPPORTUNITIES, id, { ...patch });
    },
    async search(workspaceId, filters: OpportunitySearchFilters) {
      const size = clampMarketingLimit(filters.limit);
      let q: FirebaseFirestore.Query = col(MARKETING_OPPORTUNITIES)
        .where("workspaceId", "==", workspaceId)
        .where("deletedAt", "==", null);
      if (filters.companyId) q = q.where("companyId", "==", filters.companyId);
      else if (filters.countryCode) q = q.where("countryCode", "==", filters.countryCode);
      else if (filters.commercialStageId) q = q.where("commercialStageId", "==", filters.commercialStageId);
      else if (filters.status) q = q.where("status", "==", filters.status);
      q = applyCursor(q, filters.cursor, "updatedAt").limit(size + 1);
      const snap = await q.get();
      const rows = snap.docs.map((d) => fromFirestoreDocument(d.id, d.data()) as MarketingOpportunity);
      return asPage(rows, size, (r) => r.updatedAt);
    },
  };

  const linkedInCampaigns: MarketingLinkedInCampaignRepository = {
    async create(doc) {
      await createTyped(MARKETING_LINKEDIN_CAMPAIGNS, doc.id, { ...doc });
    },
    async getById(workspaceId, id) {
      const row = await getTyped<MarketingLinkedInCampaign>(MARKETING_LINKEDIN_CAMPAIGNS, id);
      return row && row.workspaceId === workspaceId ? row : null;
    },
    async update(workspaceId, id, patch) {
      const current = await this.getById(workspaceId, id);
      if (!current) return;
      await updateTyped(MARKETING_LINKEDIN_CAMPAIGNS, id, { ...patch });
    },
    async adjustMemberCount(workspaceId, id, delta, updatedAt) {
      const ref = col(MARKETING_LINKEDIN_CAMPAIGNS).doc(id);
      return getAdminDb().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists || String(snap.data()?.workspaceId || "") !== workspaceId) return null;
        const current = Math.max(0, Number(snap.data()?.memberCount || 0));
        const memberCount = Math.max(0, current + Math.trunc(delta));
        tx.update(ref, {
          memberCount,
          updatedAt: toFirestoreTimestamp(updatedAt),
        });
        return memberCount;
      });
    },
    async search(workspaceId, filters) {
      const size = clampMarketingLimit(filters.limit);
      const archived = filters.archived ?? (filters.status === "archived" ? "only" : "exclude");
      if (
        (archived === "exclude" && filters.status === "archived") ||
        (archived === "only" && filters.status && filters.status !== "archived")
      ) {
        return { items: [] };
      }
      let q: FirebaseFirestore.Query = col(MARKETING_LINKEDIN_CAMPAIGNS)
        .where("workspaceId", "==", workspaceId);
      if (archived === "exclude") q = q.where("archivedAt", "==", null);
      if (archived === "only" && !filters.status) q = q.where("status", "==", "archived");
      if (filters.status) q = q.where("status", "==", filters.status);
      if (filters.countryCode) q = q.where("countryCode", "==", filters.countryCode);
      q = applyCursor(q, filters.cursor, "updatedAt").limit(size + 1);
      const snap = await q.get();
      let rows = snap.docs.map(
        (d) => fromFirestoreDocument(d.id, d.data()) as MarketingLinkedInCampaign,
      );
      if (filters.query?.trim()) {
        const query = filters.query.trim().toLowerCase();
        rows = rows.filter((row) => row.name.toLowerCase().includes(query));
      }
      return asPage(rows, size, (row) => row.updatedAt);
    },
  };

  const linkedInCampaignMembers: MarketingLinkedInCampaignMemberRepository = {
    async create(doc) {
      const ref = col(MARKETING_LINKEDIN_CAMPAIGN_MEMBERS).doc(doc.id);
      return getAdminDb().runTransaction(async (tx) => {
        const current = await tx.get(ref);
        if (current.exists) return false;
        tx.create(ref, toFirestoreDocument({ ...doc }));
        return true;
      });
    },
    async getById(workspaceId, id) {
      const row = await getTyped<MarketingLinkedInCampaignMember>(
        MARKETING_LINKEDIN_CAMPAIGN_MEMBERS,
        id,
      );
      return row && row.workspaceId === workspaceId ? row : null;
    },
    async update(workspaceId, id, patch) {
      const current = await this.getById(workspaceId, id);
      if (!current) return;
      await updateTyped(MARKETING_LINKEDIN_CAMPAIGN_MEMBERS, id, { ...patch });
    },
    async remove(workspaceId, id) {
      const ref = col(MARKETING_LINKEDIN_CAMPAIGN_MEMBERS).doc(id);
      return getAdminDb().runTransaction(async (tx) => {
        const current = await tx.get(ref);
        if (!current.exists || String(current.data()?.workspaceId || "") !== workspaceId) return false;
        tx.delete(ref);
        return true;
      });
    },
    async listAllForCampaign(workspaceId, campaignId) {
      const snap = await col(MARKETING_LINKEDIN_CAMPAIGN_MEMBERS)
        .where("workspaceId", "==", workspaceId)
        .where("campaignId", "==", campaignId)
        .orderBy("updatedAt", "desc")
        .get();
      return snap.docs.map(
        (d) => fromFirestoreDocument(d.id, d.data()) as MarketingLinkedInCampaignMember,
      );
    },
    async list(workspaceId, filters) {
      const size = clampMarketingLimit(filters.limit);
      let q: FirebaseFirestore.Query = col(MARKETING_LINKEDIN_CAMPAIGN_MEMBERS)
        .where("workspaceId", "==", workspaceId);
      if (filters.campaignId) q = q.where("campaignId", "==", filters.campaignId);
      if (filters.status) q = q.where("status", "==", filters.status);
      if (filters.dueBefore) {
        if (!filters.status) {
          q = q.where("status", "in", [
            "not_contacted",
            "connection_ready",
            "connection_sent",
            "connected",
            "message_ready",
            "message_sent",
            "follow_up_due",
            "follow_up_sent",
          ]);
        }
        q = q
          .where("nextActionAt", "<=", toFirestoreTimestamp(filters.dueBefore))
          .orderBy("nextActionAt", "asc")
          .limit(size + 1);
      } else {
        q = applyCursor(q, filters.cursor, "updatedAt").limit(size + 1);
      }
      const snap = await q.get();
      const rows = snap.docs.map(
        (d) => fromFirestoreDocument(d.id, d.data()) as MarketingLinkedInCampaignMember,
      );
      return asPage(rows, size, (row) => row.nextActionAt || row.updatedAt);
    },
  };

  return {
    companies,
    contacts,
    countries,
    industries,
    useCases,
    tags,
    sources,
    memberships,
    templates,
    activities,
    tasks,
    opportunities,
    linkedInCampaigns,
    linkedInCampaignMembers,
  };
}
