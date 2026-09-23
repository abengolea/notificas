import type { MarketingRepositories } from "../repositories/types";
import { createActivityService } from "./activity";
import { createCommercialStageService } from "./commercial-stage";
import { createCompanyService } from "./company";
import { createContactService } from "./contact";
import { createCountryService } from "./country";
import { createIndustryService } from "./industry";
import { createMembershipService } from "./membership";
import { createLinkedInCampaignService } from "./linkedin-campaign";
import { createOpportunityService } from "./opportunity";
import { createSourceService } from "./source";
import { createTagService } from "./tag";
import { createTaskService } from "./task";
import { createTemplateService } from "./template";
import { createUseCaseService } from "./use-case";

export function createMarketingServices(repos: MarketingRepositories) {
  return {
    companies: createCompanyService(repos.companies, repos.industries, repos.useCases),
    contacts: createContactService(repos.contacts, repos.companies),
    countries: createCountryService(repos.countries),
    industries: createIndustryService(repos.industries),
    useCases: createUseCaseService(repos.useCases, repos.industries),
    tags: createTagService(repos.tags),
    sources: createSourceService(repos.sources),
    memberships: createMembershipService(repos.memberships),
    linkedInCampaigns: createLinkedInCampaignService({
      campaigns: repos.linkedInCampaigns,
      members: repos.linkedInCampaignMembers,
      contacts: repos.contacts,
      companies: repos.companies,
      activities: repos.activities,
    }),
    templates: createTemplateService(repos.templates),
    activities: createActivityService(repos.activities),
    tasks: createTaskService(repos.tasks),
    opportunities: createOpportunityService({
      opportunities: repos.opportunities,
      companies: repos.companies,
      contacts: repos.contacts,
      industries: repos.industries,
      useCases: repos.useCases,
    }),
    commercialStages: createCommercialStageService(),
  };
}

export type MarketingServices = ReturnType<typeof createMarketingServices>;

export {
  createActivityService,
  createCommercialStageService,
  createCompanyService,
  createContactService,
  createCountryService,
  createIndustryService,
  createMembershipService,
  createLinkedInCampaignService,
  createOpportunityService,
  createSourceService,
  createTagService,
  createTaskService,
  createTemplateService,
  createUseCaseService,
};
