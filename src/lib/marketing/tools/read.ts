import { z } from "zod";
import { MarketingNotFoundError } from "../errors";
import type { CrmToolContext, CrmToolRuntime, CrmToolSuccess } from "./types";
import {
  getCampaignSchema,
  getCompanyActivitySchema,
  getCompanySchema,
  getContactActivitySchema,
  getContactSchema,
  getCrmStatsSchema,
  getListSchema,
  getOpportunitySchema,
  getPendingTasksSchema,
  getTemplateSchema,
  listTaxonomySchema,
  previewCampaignSchema,
  previewLinkedinCampaignSchema,
  searchCampaignsSchema,
  searchCompaniesSchema,
  searchContactsSchema,
  searchLinkedinCampaignsSchema,
  searchLinkedinOutreachSchema,
  searchLinkedinPendingActionsSchema,
  searchListsSchema,
  searchOpportunitiesSchema,
  searchTemplatesSchema,
  getLinkedinCampaignSchema,
} from "./schemas";
import { TAXONOMY_INDUSTRIES, TAXONOMY_USE_CASES } from "../taxonomy/seed";
import { DETAIL_LIMIT, pageLimit, summarizeCompany } from "./helpers";
import { sanitizeCrmPayload } from "./sanitize";
import {
  canonicalizeLinkedInMemberStatus,
  linkedInOutreachView,
} from "../linkedin-outreach";

function ok(
  tool: CrmToolSuccess["tool"],
  data: unknown,
  extra?: Partial<CrmToolSuccess>,
): CrmToolSuccess {
  return { ok: true, tool, write: false, data: sanitizeCrmPayload(data), ...extra };
}

export async function searchCompanies(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof searchCompaniesSchema>,
): Promise<CrmToolSuccess> {
  const limit = pageLimit(input.limit);
  const page = await runtime.services.companies.searchCompanies(ctx, {
    query: input.query,
    countryCode: input.countryCode,
    industryId: input.industryId,
    useCaseId: input.useCaseId,
    commercialStageId: input.commercialStageId,
    limit,
    cursor: input.cursor,
  });
  return ok("search_companies", {
    items: page.items.filter((c) => !c.deletedAt).map(summarizeCompany),
    nextCursor: page.nextCursor,
  });
}

export async function getCompany(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof getCompanySchema>,
): Promise<CrmToolSuccess> {
  const company = await runtime.services.companies.getCompany(ctx, input.companyId);
  const [contacts, opportunities, tasks, activities] = await Promise.all([
    runtime.services.contacts.searchContacts(ctx, { companyId: company.id, limit: DETAIL_LIMIT }),
    runtime.services.opportunities.searchOpportunities(ctx, { companyId: company.id, limit: DETAIL_LIMIT }),
    runtime.services.tasks.listTasks(ctx, { companyId: company.id, status: "open", limit: DETAIL_LIMIT }),
    runtime.services.activities.listCompanyActivities(ctx, company.id, { limit: 5 }),
  ]);
  const useCases = [];
  for (const key of (company.useCaseIds || []).slice(0, 12)) {
    const row = await runtime.services.useCases.getByKey(ctx, key).catch(() => null);
    if (row) useCases.push({ id: row.id, key: row.key, name: row.name });
    else useCases.push({ key });
  }
  return ok(
    "get_company",
    {
      company: sanitizeCrmPayload({
        id: company.id,
        name: company.name,
        legalName: company.legalName,
        website: company.website,
        countryCode: company.countryCode,
        city: company.city,
        state: company.state,
        industryIds: company.industryIds,
        useCaseIds: company.useCaseIds,
        commercialStageId: company.commercialStageId,
        status: company.status,
        notes: company.notes,
        lastContactAt: company.lastContactAt,
        nextFollowUpAt: company.nextFollowUpAt,
        phone: company.phone,
      }),
      contacts: contacts.items.slice(0, DETAIL_LIMIT).map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        title: c.title,
        stage: c.stage,
        commercialStageId: c.commercialStageId || null,
      })),
      useCases,
      opportunities: opportunities.items.slice(0, DETAIL_LIMIT).map((o) => ({
        id: o.id,
        name: o.name,
        commercialStageId: o.commercialStageId,
        status: o.status,
        nextActionAt: o.nextActionAt || null,
      })),
      pendingTasks: tasks.items.slice(0, DETAIL_LIMIT).map((t) => ({
        id: t.id,
        title: t.title,
        dueAt: t.dueAt || null,
        status: t.status,
      })),
      lastActivity: activities.items.slice(0, 5).map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        createdAt: a.createdAt,
      })),
    },
    { entityType: "company", entityIds: [company.id], summary: `Empresa ${company.name}` },
  );
}

export async function searchContacts(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof searchContactsSchema>,
): Promise<CrmToolSuccess> {
  const limit = pageLimit(input.limit);
  const page = await runtime.services.contacts.searchContacts(ctx, {
    query: input.query,
    companyId: input.companyId,
    countryCode: input.countryCode,
    commercialStageId: input.commercialStageId,
    limit,
    cursor: input.cursor,
  });
  let items = page.items;
  if (input.hasEmail === true) items = items.filter((c) => Boolean(c.email));
  if (input.hasEmail === false) items = items.filter((c) => !c.email);
  if (input.hasLinkedin === true) items = items.filter((c) => Boolean(c.linkedinUrl));
  if (input.hasLinkedin === false) items = items.filter((c) => !c.linkedinUrl);
  return ok("search_contacts", {
    items: items.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      company: c.company,
      companyId: c.companyId || null,
      country: c.country,
      stage: c.stage,
      commercialStageId: c.commercialStageId || null,
      lastRepliedAt: c.lastRepliedAt,
      lastSentAt: c.lastSentAt,
      linkedinUrl: c.linkedinUrl || null,
      linkedinStatus: c.linkedinStatus || null,
      linkedinLastContactAt: c.linkedinLastContactAt || null,
      linkedinNextActionAt: c.linkedinNextActionAt || null,
      linkedinNotes: c.linkedinNotes || null,
      prospectingSource: c.prospectingSource || null,
    })),
    nextCursor: page.nextCursor,
  });
}

export async function getContact(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof getContactSchema>,
): Promise<CrmToolSuccess> {
  const contact = await runtime.services.contacts.getContact(ctx, input.contactId);
  const company = contact.companyId
    ? await runtime.services.companies.getCompany(ctx, contact.companyId).catch(() => null)
    : null;
  const [activities, tasks] = await Promise.all([
    runtime.services.activities.listContactActivities(ctx, contact.id, { limit: DETAIL_LIMIT }),
    runtime.services.tasks.listTasks(ctx, { contactId: contact.id, limit: DETAIL_LIMIT }),
  ]);
  return ok(
    "get_contact",
    {
      contact: {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        title: contact.title,
        company: contact.company,
        companyId: contact.companyId || null,
        country: contact.country,
        stage: contact.stage,
        commercialStageId: contact.commercialStageId || null,
        notes: contact.notes,
        lastSentAt: contact.lastSentAt,
        lastRepliedAt: contact.lastRepliedAt,
        linkedinUrl: contact.linkedinUrl || null,
        linkedinStatus: contact.linkedinStatus || null,
        linkedinLastContactAt: contact.linkedinLastContactAt || null,
        linkedinNextActionAt: contact.linkedinNextActionAt || null,
        linkedinNotes: contact.linkedinNotes || null,
        prospectingSource: contact.prospectingSource || null,
      },
      company: company ? summarizeCompany(company) : null,
      recentActivity: activities.items.map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        createdAt: a.createdAt,
      })),
      tasks: tasks.items.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueAt: t.dueAt || null,
      })),
    },
    { entityType: "contact", entityIds: [contact.id], summary: `Contacto ${contact.name || contact.email}` },
  );
}

export async function searchCampaigns(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof searchCampaignsSchema>,
): Promise<CrmToolSuccess> {
  void ctx;
  const page = await runtime.catalog.searchCampaigns({
    query: input.query,
    countryCode: input.countryCode,
    status: input.status,
    limit: pageLimit(input.limit),
    cursor: input.cursor,
  });
  return ok("search_campaigns", page);
}

export async function getCampaign(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof getCampaignSchema>,
): Promise<CrmToolSuccess> {
  void ctx;
  const campaign = await runtime.catalog.getCampaign(input.campaignId);
  if (!campaign) throw new MarketingNotFoundError("Campaña", input.campaignId);
  return ok("get_campaign", campaign, {
    entityType: "campaign",
    entityIds: [campaign.id],
    summary: `Campaña ${campaign.name} (${campaign.status})`,
  });
}

export async function searchLists(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof searchListsSchema>,
): Promise<CrmToolSuccess> {
  void ctx;
  const page = await runtime.catalog.searchLists({
    query: input.query,
    limit: pageLimit(input.limit),
    cursor: input.cursor,
  });
  return ok("search_lists", page);
}

export async function getList(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof getListSchema>,
): Promise<CrmToolSuccess> {
  void ctx;
  const list = await runtime.catalog.getList(input.listId);
  if (!list) throw new MarketingNotFoundError("Lista", input.listId);
  return ok("get_list", list, { entityType: "list", entityIds: [list.id], summary: `Lista ${list.name}` });
}

export async function searchTemplates(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof searchTemplatesSchema>,
): Promise<CrmToolSuccess> {
  const page = await runtime.services.templates.listTemplates(ctx, input.cursor, pageLimit(input.limit));
  let items = page.items;
  if (input.query) {
    const q = input.query.toLowerCase();
    items = items.filter((t) => t.name.toLowerCase().includes(q));
  }
  if (input.countryCode) {
    const code = input.countryCode.toUpperCase();
    items = items.filter((t) => t.countryCodes.length === 0 || t.countryCodes.includes(code));
  }
  return ok("search_templates", {
    items: items.map((t) => ({
      id: t.id,
      name: t.name,
      language: t.language,
      countryCodes: t.countryCodes,
      industryIds: t.industryIds,
      useCaseIds: t.useCaseIds,
      currentVersion: t.currentVersion,
      active: t.active,
    })),
    nextCursor: page.nextCursor,
  });
}

export async function getTemplate(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof getTemplateSchema>,
): Promise<CrmToolSuccess> {
  const template = await runtime.services.templates.getTemplate(ctx, input.templateId);
  const version = template.currentVersion
    ? await runtime.services.templates.getTemplateVersion(ctx, template.id, template.currentVersion).catch(() => null)
    : null;
  return ok(
    "get_template",
    {
      template: {
        id: template.id,
        name: template.name,
        language: template.language,
        countryCodes: template.countryCodes,
        industryIds: template.industryIds,
        useCaseIds: template.useCaseIds,
        currentVersion: template.currentVersion,
        active: template.active,
      },
      currentVersion: version
        ? {
            version: version.version,
            subject: version.subject,
            textPreview: (version.text || "").slice(0, 1_500),
            htmlPreview: (version.html || "").slice(0, 1_500),
          }
        : null,
    },
    { entityType: "template", entityIds: [template.id], summary: `Template ${template.name}` },
  );
}

export async function getCompanyActivity(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof getCompanyActivitySchema>,
): Promise<CrmToolSuccess> {
  await runtime.services.companies.getCompany(ctx, input.companyId);
  const page = await runtime.services.activities.listCompanyActivities(ctx, input.companyId, {
    limit: pageLimit(input.limit, 10, 50),
    cursor: input.cursor,
  });
  return ok("get_company_activity", {
    items: page.items.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      description: a.description,
      createdAt: a.createdAt,
      actorType: a.actorType,
    })),
    nextCursor: page.nextCursor,
  });
}

export async function getContactActivity(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof getContactActivitySchema>,
): Promise<CrmToolSuccess> {
  await runtime.services.contacts.getContact(ctx, input.contactId);
  const page = await runtime.services.activities.listContactActivities(ctx, input.contactId, {
    limit: pageLimit(input.limit, 10, 50),
    cursor: input.cursor,
  });
  return ok("get_contact_activity", {
    items: page.items.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      description: a.description,
      createdAt: a.createdAt,
      actorType: a.actorType,
    })),
    nextCursor: page.nextCursor,
  });
}

export async function getPendingTasks(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof getPendingTasksSchema>,
): Promise<CrmToolSuccess> {
  const page = await runtime.services.tasks.listTasks(ctx, {
    status: input.status || "open",
    dueBefore: input.dueBefore,
    dueAfter: input.dueAfter,
    companyId: input.companyId,
    contactId: input.contactId,
    limit: pageLimit(input.limit),
    cursor: input.cursor,
  });
  return ok("get_pending_tasks", {
    items: page.items.map((t) => ({
      id: t.id,
      title: t.title,
      type: t.type,
      status: t.status,
      dueAt: t.dueAt || null,
      companyId: t.companyId || null,
      contactId: t.contactId || null,
      priority: t.priority,
    })),
    nextCursor: page.nextCursor,
  });
}

export async function getCrmStats(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof getCrmStatsSchema>,
): Promise<CrmToolSuccess> {
  void input;
  const [companies, contacts, countries, pendingTasks, newContacts, responses, campaigns] = await Promise.all([
    runtime.stats.countCompanies(ctx.workspaceId),
    runtime.stats.countContacts(ctx.workspaceId),
    runtime.stats.countCountries(ctx.workspaceId),
    runtime.stats.countPendingTasks(ctx.workspaceId),
    runtime.stats.countNewContacts(ctx.workspaceId),
    runtime.stats.countRepliedContacts(ctx.workspaceId),
    runtime.catalog.countCampaigns(),
  ]);
  const seedCountries = runtime.services.countries.listCountries().length;
  return ok("get_crm_stats", {
    workspaceId: ctx.workspaceId,
    companies: companies.count,
    contacts: contacts.count,
    countries: countries.count || seedCountries,
    campaigns,
    pendingTasks: pendingTasks.count,
    newContacts: newContacts.count,
    responses: responses.count,
    truncated: Boolean(
      companies.truncated || contacts.truncated || pendingTasks.truncated || newContacts.truncated || responses.truncated,
    ),
    asOf: new Date().toISOString(),
  });
}

export async function listTaxonomy(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof listTaxonomySchema>,
): Promise<CrmToolSuccess> {
  void input;
  const countries = runtime.services.countries.listCountries().map((c) => ({
    code: c.code,
    name: c.name,
  }));
  const commercialStages = runtime.services.commercialStages.listCommercialStages(ctx).map((s) => ({
    id: s.id,
    name: s.name,
    order: s.order,
  }));
  return ok("list_taxonomy", {
    countries,
    industries: TAXONOMY_INDUSTRIES.filter((r) => r.active).map((r) => ({
      key: r.key,
      name: r.name,
      keywords: (r.keywords || []).slice(0, 8),
    })),
    useCases: TAXONOMY_USE_CASES.filter((r) => r.active).map((r) => ({
      key: r.key,
      name: r.name,
      industryKeys: r.industryKeys,
    })),
    commercialStages,
  });
}

export async function searchOpportunities(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof searchOpportunitiesSchema>,
): Promise<CrmToolSuccess> {
  const page = await runtime.services.opportunities.searchOpportunities(ctx, {
    companyId: input.companyId,
    countryCode: input.countryCode,
    commercialStageId: input.commercialStageId,
    status: input.status,
    limit: pageLimit(input.limit),
    cursor: input.cursor,
  });
  let items = page.items.filter((o) => !o.deletedAt);
  if (input.query) {
    const q = input.query.toLowerCase();
    items = items.filter((o) => o.name.toLowerCase().includes(q));
  }
  return ok("search_opportunities", {
    items: items.map((o) => ({
      id: o.id,
      name: o.name,
      companyId: o.companyId,
      countryCode: o.countryCode || null,
      commercialStageId: o.commercialStageId,
      status: o.status,
      nextActionAt: o.nextActionAt || null,
      estimatedValue: o.estimatedValue ?? null,
    })),
    nextCursor: page.nextCursor,
  });
}

export async function getOpportunity(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof getOpportunitySchema>,
): Promise<CrmToolSuccess> {
  const opportunity = await runtime.services.opportunities.getOpportunity(ctx, input.opportunityId);
  return ok(
    "get_opportunity",
    {
      opportunity: {
        id: opportunity.id,
        name: opportunity.name,
        companyId: opportunity.companyId,
        contactIds: opportunity.contactIds || [],
        countryCode: opportunity.countryCode || null,
        industryId: opportunity.industryId || null,
        useCaseId: opportunity.useCaseId || null,
        commercialStageId: opportunity.commercialStageId,
        status: opportunity.status,
        nextStep: opportunity.nextStep || null,
        nextActionAt: opportunity.nextActionAt || null,
        notes: opportunity.notes || null,
        estimatedValue: opportunity.estimatedValue ?? null,
        currency: opportunity.currency || null,
      },
    },
    { entityType: "opportunity", entityIds: [opportunity.id], summary: `Oportunidad ${opportunity.name}` },
  );
}

export async function previewCampaign(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof previewCampaignSchema>,
): Promise<CrmToolSuccess> {
  void ctx;
  const preview = await runtime.catalog.previewCampaign(input.campaignId);
  if (!preview) throw new MarketingNotFoundError("Campaña", input.campaignId);
  return ok("preview_campaign", preview, {
    entityType: "campaign",
    entityIds: [preview.campaignId],
    summary: `Preview de ${preview.name} (no enviado)`,
  });
}

function linkedinCampaignView<T extends { message?: string }>(campaign: T) {
  const { message, ...rest } = campaign;
  return { ...rest, directMessage: message || null };
}

function linkedinMemberView<T extends { message?: string; status?: string }>(member: T) {
  return linkedInOutreachView(member);
}

export async function searchLinkedinCampaigns(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof searchLinkedinCampaignsSchema>,
): Promise<CrmToolSuccess> {
  const page = await runtime.services.linkedInCampaigns.searchCampaigns(ctx, {
    query: input.query,
    status: input.status,
    countryCode: input.countryCode,
    archived: input.archived,
    limit: pageLimit(input.limit),
    cursor: input.cursor,
  });
  const items = input.industryId
    ? page.items.filter((campaign) => (campaign.industryIds || []).includes(input.industryId!))
    : page.items;
  return ok("search_linkedin_campaigns", {
    items: items.map(linkedinCampaignView),
    nextCursor: page.nextCursor,
  });
}

export async function getLinkedinCampaign(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof getLinkedinCampaignSchema>,
): Promise<CrmToolSuccess> {
  const preview = await runtime.services.linkedInCampaigns.previewCampaign(ctx, input.campaignId);
  return ok("get_linkedin_campaign", {
    campaign: linkedinCampaignView(preview.campaign),
    summary: preview.summary,
    members: preview.members.slice(0, 20).map(linkedinMemberView),
    truncated: preview.members.length > 20,
    automated: false,
  }, {
    entityType: "linkedin_campaign",
    entityIds: [preview.campaign.id],
    summary: `Campaña LinkedIn ${preview.campaign.name} (${preview.campaign.status}); ${preview.summary.total} prospectos; organización manual`,
  });
}

export async function previewLinkedinCampaign(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof previewLinkedinCampaignSchema>,
): Promise<CrmToolSuccess> {
  const preview = await runtime.services.linkedInCampaigns.previewCampaign(ctx, input.campaignId);
  return ok("preview_linkedin_campaign", {
    campaign: linkedinCampaignView(preview.campaign),
    members: preview.members.slice(0, 100).map(linkedinMemberView),
    summary: preview.summary,
    truncated: preview.members.length > 100,
    automated: false,
  }, {
    entityType: "linkedin_campaign",
    entityIds: [preview.campaign.id],
    summary: `Preview manual de ${preview.campaign.name}; no se envió ni automatizó nada`,
  });
}

export async function searchLinkedinPendingActions(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof searchLinkedinPendingActionsSchema>,
): Promise<CrmToolSuccess> {
  const limit = pageLimit(input.limit);
  const page = await runtime.services.linkedInCampaigns.pendingActions(ctx, input.dueBefore, limit);
  return ok("search_linkedin_pending_actions", {
    items: page.items.slice(0, limit).map(linkedinMemberView),
    nextCursor: page.nextCursor,
  });
}

export async function searchLinkedinOutreach(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof searchLinkedinOutreachSchema>,
): Promise<CrmToolSuccess> {
  const status = canonicalizeLinkedInMemberStatus(input.status);
  const limit = pageLimit(input.limit);
  const page = await runtime.services.linkedInCampaigns.listOutreach(ctx, {
    campaignId: input.campaignId,
    status,
    dueBefore: input.dueBefore,
    limit: 100,
    cursor: input.cursor,
  });
  let items = page.items.map(linkedinMemberView);
  if (input.companyId) items = items.filter((item) => item.companyId === input.companyId);
  if (input.contactId) items = items.filter((item) => item.contactId === input.contactId);
  if (input.dueAfter) {
    items = items.filter((item) => Boolean(item.nextActionAt && String(item.nextActionAt) >= input.dueAfter!));
  }
  return ok("search_linkedin_outreach", {
    items: items.slice(0, limit),
    nextCursor: page.nextCursor,
    automated: false,
  });
}

export async function getLinkedinPendingActions(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof searchLinkedinPendingActionsSchema>,
): Promise<CrmToolSuccess> {
  const result = await searchLinkedinPendingActions(runtime, ctx, input);
  return { ...result, tool: "get_linkedin_pending_actions" };
}

export const CRM_READ_HANDLERS = {
  search_companies: { schema: searchCompaniesSchema, run: searchCompanies },
  get_company: { schema: getCompanySchema, run: getCompany },
  search_contacts: { schema: searchContactsSchema, run: searchContacts },
  get_contact: { schema: getContactSchema, run: getContact },
  search_campaigns: { schema: searchCampaignsSchema, run: searchCampaigns },
  get_campaign: { schema: getCampaignSchema, run: getCampaign },
  search_lists: { schema: searchListsSchema, run: searchLists },
  get_list: { schema: getListSchema, run: getList },
  search_templates: { schema: searchTemplatesSchema, run: searchTemplates },
  get_template: { schema: getTemplateSchema, run: getTemplate },
  get_company_activity: { schema: getCompanyActivitySchema, run: getCompanyActivity },
  get_contact_activity: { schema: getContactActivitySchema, run: getContactActivity },
  get_pending_tasks: { schema: getPendingTasksSchema, run: getPendingTasks },
  get_crm_stats: { schema: getCrmStatsSchema, run: getCrmStats },
  list_taxonomy: { schema: listTaxonomySchema, run: listTaxonomy },
  search_opportunities: { schema: searchOpportunitiesSchema, run: searchOpportunities },
  get_opportunity: { schema: getOpportunitySchema, run: getOpportunity },
  preview_campaign: { schema: previewCampaignSchema, run: previewCampaign },
  search_linkedin_campaigns: { schema: searchLinkedinCampaignsSchema, run: searchLinkedinCampaigns },
  get_linkedin_campaign: { schema: getLinkedinCampaignSchema, run: getLinkedinCampaign },
  preview_linkedin_campaign: { schema: previewLinkedinCampaignSchema, run: previewLinkedinCampaign },
  search_linkedin_pending_actions: {
    schema: searchLinkedinPendingActionsSchema,
    run: searchLinkedinPendingActions,
  },
  get_linkedin_pending_actions: {
    schema: searchLinkedinPendingActionsSchema,
    run: getLinkedinPendingActions,
  },
  search_linkedin_outreach: {
    schema: searchLinkedinOutreachSchema,
    run: searchLinkedinOutreach,
  },
} as const;
