import { z } from "zod";

export const toolLimitSchema = z.number().int().optional();
export const toolCursorSchema = z.string().max(400).optional();
export const idSchema = z.string().min(1).max(128);

const optStr = (max: number) => z.string().max(max).optional();

export const searchCompaniesSchema = z.object({
  query: optStr(200),
  countryCode: optStr(8),
  industryId: optStr(80),
  useCaseId: optStr(80),
  commercialStageId: optStr(80),
  limit: toolLimitSchema,
  cursor: toolCursorSchema,
});

export const getCompanySchema = z.object({
  companyId: idSchema,
});

export const searchContactsSchema = z.object({
  query: optStr(200),
  companyId: optStr(128),
  countryCode: optStr(8),
  commercialStageId: optStr(80),
  hasEmail: z.boolean().optional(),
  limit: toolLimitSchema,
  cursor: toolCursorSchema,
});

export const getContactSchema = z.object({
  contactId: idSchema,
});

export const searchCampaignsSchema = z.object({
  query: optStr(200),
  countryCode: optStr(8),
  status: optStr(40),
  limit: toolLimitSchema,
  cursor: toolCursorSchema,
});

export const getCampaignSchema = z.object({
  campaignId: idSchema,
});

export const searchListsSchema = z.object({
  query: optStr(200),
  limit: toolLimitSchema,
  cursor: toolCursorSchema,
});

export const getListSchema = z.object({
  listId: idSchema,
});

export const searchTemplatesSchema = z.object({
  query: optStr(200),
  countryCode: optStr(8),
  limit: toolLimitSchema,
  cursor: toolCursorSchema,
});

export const getTemplateSchema = z.object({
  templateId: idSchema,
});

export const getCompanyActivitySchema = z.object({
  companyId: idSchema,
  limit: toolLimitSchema,
  cursor: toolCursorSchema,
});

export const getContactActivitySchema = z.object({
  contactId: idSchema,
  limit: toolLimitSchema,
  cursor: toolCursorSchema,
});

export const getPendingTasksSchema = z.object({
  dueBefore: optStr(40),
  dueAfter: optStr(40),
  companyId: optStr(128),
  contactId: optStr(128),
  status: z.enum(["open", "completed", "cancelled"]).optional(),
  limit: toolLimitSchema,
  cursor: toolCursorSchema,
});

export const getCrmStatsSchema = z.object({});

export const createCompanySchema = z.object({
  name: z.string().min(1).max(200),
  countryCode: optStr(8),
  website: optStr(500),
  industryIds: z.array(z.string().max(80)).max(20).optional(),
  useCaseIds: z.array(z.string().max(80)).max(20).optional(),
  notes: optStr(4000),
});

export const updateCompanySchema = z.object({
  companyId: idSchema,
  changes: z
    .object({
      name: z.string().min(1).max(200).optional(),
      countryCode: optStr(8),
      website: optStr(500),
      industryIds: z.array(z.string().max(80)).max(20).optional(),
      useCaseIds: z.array(z.string().max(80)).max(20).optional(),
      notes: optStr(4000),
      commercialStageId: optStr(80),
      priority: z.enum(["low", "normal", "high"]).optional(),
      phone: optStr(32),
      legalName: optStr(240),
      city: optStr(80),
      state: optStr(80),
      status: z.enum(["active", "inactive"]).optional(),
      tagIds: z.array(z.string().max(80)).max(20).optional(),
    })
    .strict(),
});

export const createContactSchema = z.object({
  email: z.string().min(3).max(254),
  name: optStr(200),
  companyId: optStr(128),
  companyName: optStr(200),
  title: optStr(200),
  countryCode: optStr(8),
  notes: optStr(4000),
});

export const updateContactSchema = z.object({
  contactId: idSchema,
  changes: z
    .object({
      name: optStr(200),
      title: optStr(200),
      company: optStr(200),
      companyId: optStr(128),
      countryCode: optStr(8),
      notes: optStr(4000),
      commercialStageId: optStr(80),
      tags: z.array(z.string().max(40)).max(20).optional(),
    })
    .strict(),
});

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: optStr(4000),
  type: z.enum(["call", "email", "research", "meeting", "demo", "follow_up", "proposal", "data_completion", "other"]).optional(),
  companyId: optStr(128),
  companyName: optStr(200),
  contactId: optStr(128),
  dueAt: optStr(40),
  dueInDays: z.number().int().min(0).max(365).optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
});

export const completeTaskSchema = z.object({
  taskId: idSchema,
});

export const createListSchema = z.object({
  name: z.string().min(2).max(160),
  countryCode: optStr(8),
});

export const addContactToListSchema = z.object({
  listId: idSchema,
  contactId: idSchema,
});

export const createNoteSchema = z.object({
  text: z.string().min(1).max(4000),
  companyId: optStr(128),
  contactId: optStr(128),
});

export const createOpportunitySchema = z.object({
  name: z.string().min(1).max(200),
  companyId: optStr(128),
  companyName: optStr(200),
  commercialStageId: z.string().min(1).max(80),
  countryCode: optStr(8),
  contactIds: z.array(z.string().max(128)).max(20).optional(),
  industryId: optStr(80),
  useCaseId: optStr(80),
  nextStep: optStr(400),
  nextActionAt: optStr(40),
  notes: optStr(4000),
  estimatedValue: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
});

export const updateOpportunitySchema = z.object({
  opportunityId: idSchema,
  changes: z
    .object({
      name: z.string().min(1).max(200).optional(),
      commercialStageId: optStr(80),
      nextStep: optStr(400),
      nextActionAt: optStr(40),
      notes: optStr(4000),
      estimatedValue: z.number().nonnegative().optional(),
      currency: z.string().length(3).optional(),
      contactIds: z.array(z.string().max(128)).max(20).optional(),
      countryCode: optStr(8),
      industryId: optStr(80),
      useCaseId: optStr(80),
    })
    .strict(),
});

export const createCampaignDraftSchema = z.object({
  name: z.string().min(2).max(160),
  listId: optStr(80),
  listName: optStr(160),
  countryCode: optStr(8),
  subject: z.string().min(2).max(200),
  htmlBody: optStr(20_000),
  textBody: optStr(8_000),
  includeStages: z.array(z.string().max(40)).max(12).optional(),
});
