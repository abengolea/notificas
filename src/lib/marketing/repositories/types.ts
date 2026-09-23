import type { MarketingContact } from "../types";
import type {
  MarketingActivity,
  MarketingCompany,
  MarketingCountry,
  MarketingIndustry,
  MarketingListMembership,
  MarketingLinkedInCampaign,
  MarketingLinkedInCampaignMember,
  MarketingMessageTemplate,
  MarketingMessageTemplateVersion,
  MarketingOpportunity,
  MarketingSource,
  MarketingTag,
  MarketingTask,
  MarketingUseCase,
} from "../domain/types";
import type { MarketingPage } from "../pagination";

export type { MarketingPage } from "../pagination";

export type CompanySearchFilters = {
  query?: string;
  countryCode?: string;
  industryId?: string;
  useCaseId?: string;
  status?: string;
  commercialStageId?: string;
  limit?: number;
  cursor?: string;
};

export type ContactSearchFilters = {
  query?: string;
  countryCode?: string;
  companyId?: string;
  commercialStageId?: string;
  stage?: string;
  limit?: number;
  cursor?: string;
};

export type TaskListFilters = {
  status?: MarketingTask["status"];
  assignedTo?: string;
  dueBefore?: string;
  dueAfter?: string;
  companyId?: string;
  contactId?: string;
  opportunityId?: string;
  limit?: number;
  cursor?: string;
};

export type OpportunitySearchFilters = {
  companyId?: string;
  countryCode?: string;
  commercialStageId?: string;
  status?: MarketingOpportunity["status"];
  limit?: number;
  cursor?: string;
};

export type ActivityListFilters = {
  limit?: number;
  cursor?: string;
};

export type LinkedInCampaignSearchFilters = {
  query?: string;
  status?: MarketingLinkedInCampaign["status"];
  countryCode?: string;
  archived?: "exclude" | "include" | "only";
  limit?: number;
  cursor?: string;
};

export type LinkedInMemberListFilters = {
  campaignId?: string;
  status?: MarketingLinkedInCampaignMember["status"];
  dueBefore?: string;
  limit?: number;
  cursor?: string;
};

/** Contacto de dominio: workspace hidratado en lectura (v1 sin campo → workspace default). */
export type MarketingContactRecord = MarketingContact & { workspaceId: string };

export interface MarketingCompanyRepository {
  create(doc: MarketingCompany): Promise<void>;
  getById(workspaceId: string, id: string): Promise<MarketingCompany | null>;
  update(workspaceId: string, id: string, patch: Partial<MarketingCompany>): Promise<void>;
  findByNormalizedDomain(workspaceId: string, domain: string): Promise<MarketingCompany[]>;
  findByNormalizedName(workspaceId: string, name: string, countryCode?: string): Promise<MarketingCompany[]>;
  search(workspaceId: string, filters: CompanySearchFilters): Promise<MarketingPage<MarketingCompany>>;
}

export interface MarketingContactRepository {
  getById(id: string): Promise<MarketingContactRecord | null>;
  getByEmail(email: string): Promise<MarketingContactRecord | null>;
  getByLinkedInUrl(workspaceId: string, linkedinUrl: string): Promise<MarketingContactRecord | null>;
  create(doc: MarketingContactRecord): Promise<void>;
  update(id: string, patch: Partial<MarketingContactRecord>): Promise<void>;
  search(workspaceId: string, filters: ContactSearchFilters): Promise<MarketingPage<MarketingContactRecord>>;
}

export interface MarketingIndustryRepository {
  create(doc: MarketingIndustry): Promise<void>;
  getById(workspaceId: string, id: string): Promise<MarketingIndustry | null>;
  update(workspaceId: string, id: string, patch: Partial<MarketingIndustry>): Promise<void>;
  findByNormalizedName(workspaceId: string, name: string): Promise<MarketingIndustry | null>;
  findByKey(workspaceId: string, key: string): Promise<MarketingIndustry | null>;
  list(workspaceId: string, cursor?: string, limit?: number): Promise<MarketingPage<MarketingIndustry>>;
}

export interface MarketingUseCaseRepository {
  create(doc: MarketingUseCase): Promise<void>;
  getById(workspaceId: string, id: string): Promise<MarketingUseCase | null>;
  update(workspaceId: string, id: string, patch: Partial<MarketingUseCase>): Promise<void>;
  findByKey(workspaceId: string, key: string): Promise<MarketingUseCase | null>;
  list(workspaceId: string, cursor?: string, limit?: number): Promise<MarketingPage<MarketingUseCase>>;
}

export interface MarketingTagRepository {
  create(doc: MarketingTag): Promise<void>;
  getById(workspaceId: string, id: string): Promise<MarketingTag | null>;
  update(workspaceId: string, id: string, patch: Partial<MarketingTag>): Promise<void>;
  findByNormalizedName(workspaceId: string, name: string): Promise<MarketingTag | null>;
  findByKey(workspaceId: string, key: string): Promise<MarketingTag | null>;
  list(workspaceId: string, cursor?: string, limit?: number): Promise<MarketingPage<MarketingTag>>;
}

export interface MarketingCountryRepository {
  create(doc: MarketingCountry): Promise<void>;
  getById(workspaceId: string, id: string): Promise<MarketingCountry | null>;
  update(workspaceId: string, id: string, patch: Partial<MarketingCountry>): Promise<void>;
  findByKey(workspaceId: string, key: string): Promise<MarketingCountry | null>;
  list(workspaceId: string, cursor?: string, limit?: number): Promise<MarketingPage<MarketingCountry>>;
}

export interface MarketingSourceRepository {
  create(doc: MarketingSource): Promise<void>;
  getById(workspaceId: string, id: string): Promise<MarketingSource | null>;
  list(workspaceId: string, cursor?: string, limit?: number): Promise<MarketingPage<MarketingSource>>;
}

export interface MarketingMembershipRepository {
  add(doc: MarketingListMembership): Promise<void>;
  remove(workspaceId: string, id: string): Promise<void>;
  getById(workspaceId: string, id: string): Promise<MarketingListMembership | null>;
  listContactsForList(
    workspaceId: string,
    listId: string,
    cursor?: string,
    limit?: number,
  ): Promise<MarketingPage<MarketingListMembership>>;
  listListsForContact(
    workspaceId: string,
    contactId: string,
    cursor?: string,
    limit?: number,
  ): Promise<MarketingPage<MarketingListMembership>>;
}

export interface MarketingTemplateRepository {
  create(doc: MarketingMessageTemplate): Promise<void>;
  getById(workspaceId: string, id: string): Promise<MarketingMessageTemplate | null>;
  updateMetadata(workspaceId: string, id: string, patch: Partial<MarketingMessageTemplate>): Promise<void>;
  appendVersion(
    workspaceId: string,
    templateId: string,
    body: Omit<MarketingMessageTemplateVersion, "id" | "version" | "templateId" | "workspaceId">,
  ): Promise<{ template: MarketingMessageTemplate; version: MarketingMessageTemplateVersion }>;
  getVersion(
    workspaceId: string,
    templateId: string,
    version: number,
  ): Promise<MarketingMessageTemplateVersion | null>;
  listVersions(workspaceId: string, templateId: string): Promise<MarketingMessageTemplateVersion[]>;
  list(workspaceId: string, cursor?: string, limit?: number): Promise<MarketingPage<MarketingMessageTemplate>>;
}

export interface MarketingActivityRepository {
  create(doc: MarketingActivity): Promise<void>;
  listByCompany(
    workspaceId: string,
    companyId: string,
    filters?: ActivityListFilters,
  ): Promise<MarketingPage<MarketingActivity>>;
  listByContact(
    workspaceId: string,
    contactId: string,
    filters?: ActivityListFilters,
  ): Promise<MarketingPage<MarketingActivity>>;
  listByOpportunity(
    workspaceId: string,
    opportunityId: string,
    filters?: ActivityListFilters,
  ): Promise<MarketingPage<MarketingActivity>>;
}

export interface MarketingLinkedInCampaignRepository {
  create(doc: MarketingLinkedInCampaign): Promise<void>;
  getById(workspaceId: string, id: string): Promise<MarketingLinkedInCampaign | null>;
  update(workspaceId: string, id: string, patch: Partial<MarketingLinkedInCampaign>): Promise<void>;
  adjustMemberCount(
    workspaceId: string,
    id: string,
    delta: number,
    updatedAt: string,
  ): Promise<number | null>;
  search(
    workspaceId: string,
    filters: LinkedInCampaignSearchFilters,
  ): Promise<MarketingPage<MarketingLinkedInCampaign>>;
}

export interface MarketingLinkedInCampaignMemberRepository {
  create(doc: MarketingLinkedInCampaignMember): Promise<boolean>;
  getById(workspaceId: string, id: string): Promise<MarketingLinkedInCampaignMember | null>;
  update(workspaceId: string, id: string, patch: Partial<MarketingLinkedInCampaignMember>): Promise<void>;
  remove(workspaceId: string, id: string): Promise<boolean>;
  listAllForCampaign(
    workspaceId: string,
    campaignId: string,
  ): Promise<MarketingLinkedInCampaignMember[]>;
  list(
    workspaceId: string,
    filters: LinkedInMemberListFilters,
  ): Promise<MarketingPage<MarketingLinkedInCampaignMember>>;
}

export interface MarketingTaskRepository {
  create(doc: MarketingTask): Promise<void>;
  getById(workspaceId: string, id: string): Promise<MarketingTask | null>;
  update(workspaceId: string, id: string, patch: Partial<MarketingTask>): Promise<void>;
  list(workspaceId: string, filters: TaskListFilters): Promise<MarketingPage<MarketingTask>>;
}

export interface MarketingOpportunityRepository {
  create(doc: MarketingOpportunity): Promise<void>;
  getById(workspaceId: string, id: string): Promise<MarketingOpportunity | null>;
  update(workspaceId: string, id: string, patch: Partial<MarketingOpportunity>): Promise<void>;
  search(workspaceId: string, filters: OpportunitySearchFilters): Promise<MarketingPage<MarketingOpportunity>>;
}

export type MarketingRepositories = {
  companies: MarketingCompanyRepository;
  contacts: MarketingContactRepository;
  countries: MarketingCountryRepository;
  industries: MarketingIndustryRepository;
  useCases: MarketingUseCaseRepository;
  tags: MarketingTagRepository;
  sources: MarketingSourceRepository;
  memberships: MarketingMembershipRepository;
  templates: MarketingTemplateRepository;
  activities: MarketingActivityRepository;
  tasks: MarketingTaskRepository;
  opportunities: MarketingOpportunityRepository;
  linkedInCampaigns: MarketingLinkedInCampaignRepository;
  linkedInCampaignMembers: MarketingLinkedInCampaignMemberRepository;
};
