import { marketingCatalogId } from "../domain/ids";
import { DEFAULT_MARKETING_WORKSPACE_ID } from "../workspace";
import {
  clampMarketingLimit,
  decodeMarketingCursor,
  encodeMarketingCursor,
  type MarketingPage,
} from "../pagination";
import type {
  ActivityListFilters,
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

function sortKey(iso: string | null | undefined, id: string): string {
  return `${iso || ""}\t${id}`;
}

function paginate<T extends { id: string }>(
  rows: T[],
  timestampOf: (row: T) => string | null | undefined,
  cursor: string | undefined,
  limit: number,
): MarketingPage<T> {
  const sorted = [...rows].sort((a, b) => {
    const ka = sortKey(timestampOf(b), b.id);
    const kb = sortKey(timestampOf(a), a.id);
    return ka.localeCompare(kb) || b.id.localeCompare(a.id);
  });
  const decoded = decodeMarketingCursor(cursor);
  let start = 0;
  if (decoded) {
    const idx = sorted.findIndex((row) => row.id === decoded.id && timestampOf(row) === decoded.t);
    start = idx >= 0 ? idx + 1 : 0;
  }
  const slice = sorted.slice(start, start + limit + 1);
  const extra = slice.length > limit;
  const items = extra ? slice.slice(0, limit) : slice;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor:
      extra && last
        ? encodeMarketingCursor({ t: timestampOf(last) || "", id: last.id })
        : undefined,
  };
}

function isActiveCompany(doc: MarketingCompany): boolean {
  return !doc.deletedAt;
}

function hydrateContact(doc: MarketingContactRecord): MarketingContactRecord {
  return {
    ...doc,
    workspaceId: doc.workspaceId || DEFAULT_MARKETING_WORKSPACE_ID,
  };
}

function assertWorkspace<T extends { workspaceId: string }>(doc: T | null, workspaceId: string): T | null {
  if (!doc) return null;
  if (doc.workspaceId !== workspaceId) return null;
  return doc;
}

export function createMemoryMarketingRepositories(): MarketingRepositories {
  const companies = new Map<string, MarketingCompany>();
  const contacts = new Map<string, MarketingContactRecord>();
  const countries = new Map<string, MarketingCountry>();
  const industries = new Map<string, MarketingIndustry>();
  const useCases = new Map<string, MarketingUseCase>();
  const tags = new Map<string, MarketingTag>();
  const sources = new Map<string, MarketingSource>();
  const memberships = new Map<string, MarketingListMembership>();
  const templates = new Map<string, MarketingMessageTemplate>();
  const versions = new Map<string, MarketingMessageTemplateVersion>();
  const activities = new Map<string, MarketingActivity>();
  const tasks = new Map<string, MarketingTask>();
  const opportunities = new Map<string, MarketingOpportunity>();
  const linkedInCampaigns = new Map<string, MarketingLinkedInCampaign>();
  const linkedInCampaignMembers = new Map<string, MarketingLinkedInCampaignMember>();

  const companyRepo: MarketingCompanyRepository = {
    async create(doc) {
      companies.set(doc.id, { ...doc, deletedAt: doc.deletedAt ?? null });
    },
    async getById(workspaceId, id) {
      return assertWorkspace(companies.get(id) || null, workspaceId);
    },
    async update(workspaceId, id, patch) {
      const current = await this.getById(workspaceId, id);
      if (!current) return;
      companies.set(id, { ...current, ...patch, id, workspaceId });
    },
    async findByNormalizedDomain(workspaceId, domain) {
      return [...companies.values()].filter(
        (c) =>
          c.workspaceId === workspaceId &&
          isActiveCompany(c) &&
          c.normalizedDomain === domain,
      );
    },
    async findByNormalizedName(workspaceId, name, countryCode) {
      return [...companies.values()].filter(
        (c) =>
          c.workspaceId === workspaceId &&
          isActiveCompany(c) &&
          c.normalizedName === name &&
          (!countryCode || c.countryCode === countryCode),
      );
    },
    async search(workspaceId, filters: CompanySearchFilters) {
      let rows = [...companies.values()].filter((c) => c.workspaceId === workspaceId && isActiveCompany(c));
      if (filters.countryCode) rows = rows.filter((c) => c.countryCode === filters.countryCode);
      if (filters.status) rows = rows.filter((c) => c.status === filters.status);
      if (filters.commercialStageId) rows = rows.filter((c) => c.commercialStageId === filters.commercialStageId);
      if (filters.industryId) rows = rows.filter((c) => c.industryIds.includes(filters.industryId!));
      if (filters.useCaseId) rows = rows.filter((c) => c.useCaseIds.includes(filters.useCaseId!));
      if (filters.query?.trim()) {
        const q = filters.query.trim().toLowerCase();
        rows = rows.filter(
          (c) =>
            c.normalizedName === q ||
            c.normalizedDomain === q ||
            c.name.toLowerCase() === q,
        );
      }
      return paginate(rows, (c) => c.updatedAt, filters.cursor, clampMarketingLimit(filters.limit));
    },
  };

  const contactRepo: MarketingContactRepository = {
    async getById(id) {
      const doc = contacts.get(id);
      return doc ? hydrateContact(doc) : null;
    },
    async getByEmail(email) {
      const key = email.trim().toLowerCase();
      const doc = [...contacts.values()].find((c) => c.emailKey === key || c.email === key);
      return doc ? hydrateContact(doc) : null;
    },
    async getByLinkedInUrl(workspaceId, linkedinUrl) {
      const doc = [...contacts.values()].find(
        (c) => hydrateContact(c).workspaceId === workspaceId && c.linkedinUrl === linkedinUrl && !c.deletedAt,
      );
      return doc ? hydrateContact(doc) : null;
    },
    async create(doc) {
      contacts.set(doc.id, { ...doc });
    },
    async update(id, patch) {
      const current = contacts.get(id);
      if (!current) return;
      contacts.set(id, { ...current, ...patch, id });
    },
    async search(workspaceId, filters: ContactSearchFilters) {
      let rows = [...contacts.values()].map(hydrateContact).filter((c) => {
        if (c.deletedAt) return false;
        return c.workspaceId === workspaceId;
      });
      if (filters.companyId) rows = rows.filter((c) => c.companyId === filters.companyId);
      if (filters.countryCode) rows = rows.filter((c) => (c.countryCode || c.country) === filters.countryCode);
      if (filters.commercialStageId) rows = rows.filter((c) => c.commercialStageId === filters.commercialStageId);
      if (filters.stage) rows = rows.filter((c) => c.stage === filters.stage);
      if (filters.query?.trim()) {
        const q = filters.query.trim().toLowerCase();
        rows = rows.filter(
          (c) =>
            c.email === q ||
            c.emailKey === q ||
            (c.name || "").toLowerCase().includes(q),
        );
      }
      return paginate(rows, (c) => c.updatedAt, filters.cursor, clampMarketingLimit(filters.limit));
    },
  };

  const industryRepo: MarketingIndustryRepository = {
    async create(doc) {
      industries.set(doc.id, doc);
    },
    async getById(workspaceId, id) {
      return assertWorkspace(industries.get(id) || null, workspaceId);
    },
    async update(workspaceId, id, patch) {
      const current = await this.getById(workspaceId, id);
      if (!current) return;
      industries.set(id, { ...current, ...patch, id, workspaceId });
    },
    async findByNormalizedName(workspaceId, name) {
      return (
        [...industries.values()].find(
          (d) => d.workspaceId === workspaceId && d.normalizedName === name,
        ) || null
      );
    },
    async findByKey(workspaceId, key) {
      const id = marketingCatalogId(workspaceId, "industry", key);
      const byId = assertWorkspace(industries.get(id) || null, workspaceId);
      if (byId) return byId;
      return [...industries.values()].find((d) => d.workspaceId === workspaceId && d.key === key) || null;
    },
    async list(workspaceId, cursor, limit) {
      const rows = [...industries.values()].filter((d) => d.workspaceId === workspaceId);
      return paginate(rows, (d) => d.updatedAt, cursor, clampMarketingLimit(limit));
    },
  };

  const useCaseRepo: MarketingUseCaseRepository = {
    async create(doc) {
      useCases.set(doc.id, doc);
    },
    async getById(workspaceId, id) {
      return assertWorkspace(useCases.get(id) || null, workspaceId);
    },
    async update(workspaceId, id, patch) {
      const current = await this.getById(workspaceId, id);
      if (!current) return;
      useCases.set(id, { ...current, ...patch, id, workspaceId });
    },
    async findByKey(workspaceId, key) {
      const id = marketingCatalogId(workspaceId, "use_case", key);
      const byId = assertWorkspace(useCases.get(id) || null, workspaceId);
      if (byId) return byId;
      return [...useCases.values()].find((d) => d.workspaceId === workspaceId && d.key === key) || null;
    },
    async list(workspaceId, cursor, limit) {
      const rows = [...useCases.values()].filter((d) => d.workspaceId === workspaceId);
      return paginate(rows, (d) => d.updatedAt, cursor, clampMarketingLimit(limit));
    },
  };

  const tagRepo: MarketingTagRepository = {
    async create(doc) {
      tags.set(doc.id, doc);
    },
    async getById(workspaceId, id) {
      return assertWorkspace(tags.get(id) || null, workspaceId);
    },
    async update(workspaceId, id, patch) {
      const current = await this.getById(workspaceId, id);
      if (!current) return;
      tags.set(id, { ...current, ...patch, id, workspaceId });
    },
    async findByNormalizedName(workspaceId, name) {
      return (
        [...tags.values()].find((d) => d.workspaceId === workspaceId && d.normalizedName === name) || null
      );
    },
    async findByKey(workspaceId, key) {
      const id = marketingCatalogId(workspaceId, "tag", key);
      const byId = assertWorkspace(tags.get(id) || null, workspaceId);
      if (byId) return byId;
      return [...tags.values()].find((d) => d.workspaceId === workspaceId && d.key === key) || null;
    },
    async list(workspaceId, cursor, limit) {
      const rows = [...tags.values()].filter((d) => d.workspaceId === workspaceId);
      return paginate(rows, (d) => d.updatedAt, cursor, clampMarketingLimit(limit));
    },
  };

  const countryRepo: MarketingCountryRepository = {
    async create(doc) {
      countries.set(doc.id, doc);
    },
    async getById(workspaceId, id) {
      return assertWorkspace(countries.get(id) || null, workspaceId);
    },
    async update(workspaceId, id, patch) {
      const current = await this.getById(workspaceId, id);
      if (!current) return;
      countries.set(id, { ...current, ...patch, id, workspaceId });
    },
    async findByKey(workspaceId, key) {
      const code = key.trim().toUpperCase();
      const id = marketingCatalogId(workspaceId, "country", code);
      const byId = assertWorkspace(countries.get(id) || null, workspaceId);
      if (byId) return byId;
      return [...countries.values()].find((d) => d.workspaceId === workspaceId && d.key === code) || null;
    },
    async list(workspaceId, cursor, limit) {
      const rows = [...countries.values()].filter((d) => d.workspaceId === workspaceId);
      return paginate(rows, (d) => d.updatedAt, cursor, clampMarketingLimit(limit));
    },
  };

  const sourceRepo: MarketingSourceRepository = {
    async create(doc) {
      sources.set(doc.id, doc);
    },
    async getById(workspaceId, id) {
      return assertWorkspace(sources.get(id) || null, workspaceId);
    },
    async list(workspaceId, cursor, limit) {
      const rows = [...sources.values()].filter((d) => d.workspaceId === workspaceId);
      return paginate(rows, (d) => d.createdAt, cursor, clampMarketingLimit(limit));
    },
  };

  const membershipRepo: MarketingMembershipRepository = {
    async add(doc) {
      memberships.set(doc.id, doc);
    },
    async remove(workspaceId, id) {
      const current = memberships.get(id);
      if (!current || current.workspaceId !== workspaceId) return;
      memberships.delete(id);
    },
    async getById(workspaceId, id) {
      return assertWorkspace(memberships.get(id) || null, workspaceId);
    },
    async listContactsForList(workspaceId, listId, cursor, limit) {
      const rows = [...memberships.values()].filter((d) => d.workspaceId === workspaceId && d.listId === listId);
      return paginate(rows, (d) => d.addedAt, cursor, clampMarketingLimit(limit));
    },
    async listListsForContact(workspaceId, contactId, cursor, limit) {
      const rows = [...memberships.values()].filter(
        (d) => d.workspaceId === workspaceId && d.contactId === contactId,
      );
      return paginate(rows, (d) => d.addedAt, cursor, clampMarketingLimit(limit));
    },
  };

  const templateRepo: MarketingTemplateRepository = {
    async create(doc) {
      templates.set(doc.id, doc);
    },
    async getById(workspaceId, id) {
      return assertWorkspace(templates.get(id) || null, workspaceId);
    },
    async updateMetadata(workspaceId, id, patch) {
      const current = await this.getById(workspaceId, id);
      if (!current) return;
      const forbidden = { html: undefined, text: undefined, subject: undefined };
      templates.set(id, { ...current, ...patch, ...forbidden, id, workspaceId });
    },
    async appendVersion(workspaceId, templateId, body) {
      const current = await this.getById(workspaceId, templateId);
      if (!current) throw new Error("template_not_found");
      const version = current.currentVersion + 1;
      const id = `${templateId}__v${version}`;
      if (versions.has(id)) throw new Error("version_conflict");
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
      versions.set(id, doc);
      const nextTemplate = { ...current, currentVersion: version, updatedAt: body.createdAt };
      templates.set(templateId, nextTemplate);
      return { template: nextTemplate, version: doc };
    },
    async getVersion(workspaceId, templateId, version) {
      const doc = versions.get(`${templateId}__v${version}`) || null;
      return assertWorkspace(doc, workspaceId);
    },
    async listVersions(workspaceId, templateId) {
      return [...versions.values()]
        .filter((d) => d.workspaceId === workspaceId && d.templateId === templateId)
        .sort((a, b) => a.version - b.version);
    },
    async list(workspaceId, cursor, limit) {
      const rows = [...templates.values()].filter((d) => d.workspaceId === workspaceId && !d.deletedAt);
      return paginate(rows, (d) => d.updatedAt, cursor, clampMarketingLimit(limit));
    },
  };

  const activityRepo: MarketingActivityRepository = {
    async create(doc) {
      activities.set(doc.id, doc);
    },
    async listByCompany(workspaceId, companyId, filters?: ActivityListFilters) {
      const rows = [...activities.values()].filter(
        (d) => d.workspaceId === workspaceId && d.companyId === companyId,
      );
      return paginate(rows, (d) => d.createdAt, filters?.cursor, clampMarketingLimit(filters?.limit));
    },
    async listByContact(workspaceId, contactId, filters?: ActivityListFilters) {
      const rows = [...activities.values()].filter(
        (d) => d.workspaceId === workspaceId && d.contactId === contactId,
      );
      return paginate(rows, (d) => d.createdAt, filters?.cursor, clampMarketingLimit(filters?.limit));
    },
    async listByOpportunity(workspaceId, opportunityId, filters?: ActivityListFilters) {
      const rows = [...activities.values()].filter(
        (d) => d.workspaceId === workspaceId && d.opportunityId === opportunityId,
      );
      return paginate(rows, (d) => d.createdAt, filters?.cursor, clampMarketingLimit(filters?.limit));
    },
  };

  const taskRepo: MarketingTaskRepository = {
    async create(doc) {
      tasks.set(doc.id, doc);
    },
    async getById(workspaceId, id) {
      return assertWorkspace(tasks.get(id) || null, workspaceId);
    },
    async update(workspaceId, id, patch) {
      const current = await this.getById(workspaceId, id);
      if (!current) return;
      tasks.set(id, { ...current, ...patch, id, workspaceId });
    },
    async list(workspaceId, filters: TaskListFilters) {
      let rows = [...tasks.values()].filter((d) => d.workspaceId === workspaceId);
      if (filters.status) rows = rows.filter((d) => d.status === filters.status);
      if (filters.assignedTo) rows = rows.filter((d) => d.assignedTo === filters.assignedTo);
      if (filters.companyId) rows = rows.filter((d) => d.companyId === filters.companyId);
      if (filters.contactId) rows = rows.filter((d) => d.contactId === filters.contactId);
      if (filters.opportunityId) rows = rows.filter((d) => d.opportunityId === filters.opportunityId);
      if (filters.dueAfter) rows = rows.filter((d) => d.dueAt && d.dueAt >= filters.dueAfter!);
      if (filters.dueBefore) rows = rows.filter((d) => d.dueAt && d.dueAt <= filters.dueBefore!);
      return paginate(rows, (d) => d.dueAt || d.updatedAt, filters.cursor, clampMarketingLimit(filters.limit));
    },
  };

  const opportunityRepo: MarketingOpportunityRepository = {
    async create(doc) {
      opportunities.set(doc.id, { ...doc, deletedAt: doc.deletedAt ?? null });
    },
    async getById(workspaceId, id) {
      return assertWorkspace(opportunities.get(id) || null, workspaceId);
    },
    async update(workspaceId, id, patch) {
      const current = await this.getById(workspaceId, id);
      if (!current) return;
      opportunities.set(id, { ...current, ...patch, id, workspaceId });
    },
    async search(workspaceId, filters: OpportunitySearchFilters) {
      let rows = [...opportunities.values()].filter((d) => d.workspaceId === workspaceId && !d.deletedAt);
      if (filters.companyId) rows = rows.filter((d) => d.companyId === filters.companyId);
      if (filters.countryCode) rows = rows.filter((d) => d.countryCode === filters.countryCode);
      if (filters.commercialStageId) rows = rows.filter((d) => d.commercialStageId === filters.commercialStageId);
      if (filters.status) rows = rows.filter((d) => d.status === filters.status);
      return paginate(rows, (d) => d.updatedAt, filters.cursor, clampMarketingLimit(filters.limit));
    },
  };

  const linkedInCampaignRepo: MarketingLinkedInCampaignRepository = {
    async create(doc) {
      linkedInCampaigns.set(doc.id, { ...doc });
    },
    async getById(workspaceId, id) {
      return assertWorkspace(linkedInCampaigns.get(id) || null, workspaceId);
    },
    async update(workspaceId, id, patch) {
      const current = await this.getById(workspaceId, id);
      if (!current) return;
      linkedInCampaigns.set(id, { ...current, ...patch, id, workspaceId });
    },
    async adjustMemberCount(workspaceId, id, delta, updatedAt) {
      const current = await this.getById(workspaceId, id);
      if (!current) return null;
      const memberCount = Math.max(0, current.memberCount + Math.trunc(delta));
      linkedInCampaigns.set(id, { ...current, memberCount, updatedAt, id, workspaceId });
      return memberCount;
    },
    async search(workspaceId, filters) {
      let rows = [...linkedInCampaigns.values()].filter((d) => d.workspaceId === workspaceId);
      const archived = filters.archived ?? (filters.status === "archived" ? "only" : "exclude");
      if (archived === "exclude") rows = rows.filter((d) => d.status !== "archived");
      if (archived === "only") rows = rows.filter((d) => d.status === "archived");
      if (filters.status) rows = rows.filter((d) => d.status === filters.status);
      if (filters.countryCode) rows = rows.filter((d) => d.countryCode === filters.countryCode);
      if (filters.query?.trim()) {
        const q = filters.query.trim().toLowerCase();
        rows = rows.filter((d) => d.name.toLowerCase().includes(q));
      }
      return paginate(rows, (d) => d.updatedAt, filters.cursor, clampMarketingLimit(filters.limit));
    },
  };

  const linkedInCampaignMemberRepo: MarketingLinkedInCampaignMemberRepository = {
    async create(doc) {
      if (linkedInCampaignMembers.has(doc.id)) return false;
      linkedInCampaignMembers.set(doc.id, { ...doc });
      return true;
    },
    async getById(workspaceId, id) {
      return assertWorkspace(linkedInCampaignMembers.get(id) || null, workspaceId);
    },
    async update(workspaceId, id, patch) {
      const current = await this.getById(workspaceId, id);
      if (!current) return;
      linkedInCampaignMembers.set(id, { ...current, ...patch, id, workspaceId });
    },
    async remove(workspaceId, id) {
      const current = await this.getById(workspaceId, id);
      if (!current) return false;
      linkedInCampaignMembers.delete(id);
      return true;
    },
    async listAllForCampaign(workspaceId, campaignId) {
      return [...linkedInCampaignMembers.values()]
        .filter((d) => d.workspaceId === workspaceId && d.campaignId === campaignId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));
    },
    async list(workspaceId, filters) {
      let rows = [...linkedInCampaignMembers.values()].filter((d) => d.workspaceId === workspaceId);
      if (filters.campaignId) rows = rows.filter((d) => d.campaignId === filters.campaignId);
      if (filters.status) rows = rows.filter((d) => d.status === filters.status);
      if (filters.dueBefore) {
        rows = rows.filter((d) => Boolean(d.nextActionAt && d.nextActionAt <= filters.dueBefore!));
      }
      return paginate(
        rows,
        (d) => d.nextActionAt || d.updatedAt,
        filters.cursor,
        clampMarketingLimit(filters.limit),
      );
    },
  };

  return {
    companies: companyRepo,
    contacts: contactRepo,
    countries: countryRepo,
    industries: industryRepo,
    useCases: useCaseRepo,
    tags: tagRepo,
    sources: sourceRepo,
    memberships: membershipRepo,
    templates: templateRepo,
    activities: activityRepo,
    tasks: taskRepo,
    opportunities: opportunityRepo,
    linkedInCampaigns: linkedInCampaignRepo,
    linkedInCampaignMembers: linkedInCampaignMemberRepo,
  };
}
