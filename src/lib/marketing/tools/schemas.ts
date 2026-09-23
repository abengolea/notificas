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
  hasLinkedin: z.boolean().optional(),
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

export const listTaxonomySchema = z.object({});

export const searchOpportunitiesSchema = z.object({
  query: optStr(200),
  companyId: optStr(128),
  countryCode: optStr(8),
  commercialStageId: optStr(80),
  status: z.enum(["open", "won", "lost", "paused"]).optional(),
  limit: toolLimitSchema,
  cursor: toolCursorSchema,
});

export const getOpportunitySchema = z.object({
  opportunityId: idSchema,
});

export const previewCampaignSchema = z.object({
  campaignId: idSchema,
});

const idempotencyKeySchema = z.string().min(1).max(128).optional();

export const createCompanySchema = z
  .object({
    name: z.string().min(1).max(200),
    countryCode: optStr(8),
    website: optStr(500),
    industryIds: z.array(z.string().max(80)).max(20).optional(),
    useCaseIds: z.array(z.string().max(80)).max(20).optional(),
    notes: optStr(4000),
  })
  .strict();

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

const linkedinStatusSchema = z.enum([
  "not_contacted",
  "connection_ready",
  "connection_sent",
  "connected",
  "message_ready",
  "message_sent",
  "follow_up_due",
  "follow_up_sent",
  "replied",
  "interested",
  "not_interested",
  "do_not_contact",
  "not_found",
]);

const prospectingSourceSchema = z.enum(["clay", "linkedin", "web", "manual", "association", "other"]);

export const createContactSchema = z
  .object({
    email: optStr(254),
    linkedinUrl: optStr(500),
    linkedinStatus: linkedinStatusSchema.optional(),
    linkedinLastContactAt: z.string().datetime().nullable().optional(),
    linkedinNextActionAt: z.string().datetime().nullable().optional(),
    linkedinNotes: optStr(8000),
    prospectingSource: prospectingSourceSchema.optional(),
    name: optStr(200),
    companyId: optStr(128),
    companyName: optStr(200),
    title: optStr(200),
    countryCode: optStr(8),
    notes: optStr(4000),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.email?.trim() && !value.linkedinUrl?.trim()) {
      ctx.addIssue({ code: "custom", message: "email or linkedinUrl is required", path: ["email"] });
    }
  });

export const updateContactSchema = z.object({
  contactId: idSchema,
  changes: z
    .object({
      name: optStr(200),
      email: optStr(254),
      title: optStr(200),
      company: optStr(200),
      companyId: optStr(128),
      countryCode: optStr(8),
      notes: optStr(4000),
      commercialStageId: optStr(80),
      tags: z.array(z.string().max(40)).max(20).optional(),
      linkedinUrl: optStr(500),
      linkedinStatus: linkedinStatusSchema.optional(),
      linkedinLastContactAt: z.string().datetime().nullable().optional(),
      linkedinNextActionAt: z.string().datetime().nullable().optional(),
      linkedinNotes: optStr(8000),
      prospectingSource: prospectingSourceSchema.optional(),
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

export const cancelTaskSchema = z.object({
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

export const createCampaignDraftSchema = z
  .object({
    name: z.string().min(2).max(160),
    listId: optStr(80),
    listName: optStr(160),
    countryCode: optStr(8),
    industryId: optStr(80),
    useCaseId: optStr(80),
    useCaseIds: z.array(z.string().max(80)).max(20).optional(),
    subject: z.string().min(2).max(200),
    htmlBody: optStr(20_000),
    textBody: optStr(8_000),
    includeStages: z.array(z.string().max(40)).max(12).optional(),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const updateCampaignDraftSchema = z
  .object({
    campaignId: idSchema,
    changes: z
      .object({
        name: z.string().min(2).max(160).optional(),
        subject: z.string().min(2).max(200).optional(),
        htmlBody: z.string().min(8).max(20_000).optional(),
        textBody: optStr(8_000),
        listId: optStr(80),
        includeStages: z.array(z.string().max(40)).max(12).optional(),
      })
      .strict(),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const campaignIdSchema = z
  .object({
    campaignId: idSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

const linkedinCampaignStatusSchema = z.enum(["draft", "active", "paused", "completed", "archived"]);
const linkedinMessageTypeSchema = z.enum(["connection_request", "direct_message", "multistep"]);
const linkedinMemberStatusSchema = z.enum([
  "not_contacted",
  "connection_ready",
  "connection_sent",
  "connected",
  "message_ready",
  "message_sent",
  "follow_up_due",
  "follow_up_sent",
  "replied",
  "interested",
  "not_interested",
  "do_not_contact",
  "pending",
  "invitation_prepared",
  "invitation_sent",
  "message_prepared",
  "skipped",
]);
const linkedinActionSchema = z.enum([
  "connection_sent",
  "connected",
  "message_sent",
  "followup_sent",
  "follow_up_sent",
  "replied",
  "interested",
  "not_interested",
  "invitation_sent",
]);

export const searchLinkedinCampaignsSchema = z.object({
  query: optStr(200),
  status: linkedinCampaignStatusSchema.optional(),
  countryCode: optStr(8),
  industryId: optStr(128),
  archived: z.enum(["exclude", "include", "only"]).optional(),
  limit: toolLimitSchema,
  cursor: toolCursorSchema,
});

export const getLinkedinCampaignSchema = z.object({ campaignId: idSchema }).strict();
export const previewLinkedinCampaignSchema = z.object({ campaignId: idSchema }).strict();

export const createLinkedinCampaignDraftSchema = z
  .object({
    name: z.string().min(2).max(160),
    description: optStr(4000),
    countryCode: z.string().min(2).max(40).nullable().optional(),
    industryId: optStr(128),
    industryIds: z.array(z.string().min(1).max(128)).max(50).optional(),
    useCaseId: optStr(128),
    useCaseIds: z.array(z.string().min(1).max(128)).max(50).optional(),
    listId: optStr(128),
    commercialInitiativeId: optStr(128),
    messageType: linkedinMessageTypeSchema.optional(),
    connectionMessage: optStr(3000),
    directMessage: optStr(8000),
    followUpMessage: optStr(8000),
    notes: optStr(8000),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const updateLinkedinCampaignSchema = z
  .object({
    campaignId: idSchema,
    changes: z
      .object({
        name: z.string().min(2).max(160).optional(),
        description: optStr(4000),
        countryCode: z.string().min(2).max(40).nullable().optional(),
        industryIds: z.array(z.string().min(1).max(128)).max(50).optional(),
        useCaseIds: z.array(z.string().min(1).max(128)).max(50).optional(),
        listId: optStr(128),
        commercialInitiativeId: optStr(128),
        messageType: linkedinMessageTypeSchema.optional(),
        connectionMessage: optStr(3000),
        directMessage: optStr(8000),
        followUpMessage: optStr(8000),
        notes: optStr(8000),
        status: linkedinCampaignStatusSchema.optional(),
      })
      .strict(),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

const linkedinMemberChangesSchema = z
  .object({
    status: linkedinMemberStatusSchema.optional(),
    invitationMessage: optStr(3000),
    connectionMessage: optStr(3000),
    directMessage: optStr(8000),
    followUpMessage: optStr(8000),
    notes: optStr(8000),
    nextActionAt: z.string().datetime().nullable().optional(),
  })
  .strict();

export const addContactToLinkedinCampaignSchema = z
  .object({
    campaignId: idSchema,
    contactId: idSchema,
    member: linkedinMemberChangesSchema.optional(),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const removeContactFromLinkedinCampaignSchema = z
  .object({
    campaignId: idSchema,
    memberId: idSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const updateLinkedinCampaignMemberSchema = z
  .object({
    campaignId: idSchema,
    memberId: idSchema,
    changes: linkedinMemberChangesSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const recordLinkedinActionSchema = z
  .object({
    campaignId: idSchema,
    memberId: idSchema,
    action: linkedinActionSchema,
    occurredAt: z.string().datetime().optional(),
    notes: optStr(8000),
    nextActionAt: z.string().datetime().nullable().optional(),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const searchLinkedinPendingActionsSchema = z
  .object({
    dueBefore: z.string().datetime().optional(),
    limit: toolLimitSchema,
  })
  .strict();

export const searchLinkedinOutreachSchema = z
  .object({
    campaignId: optStr(128),
    companyId: optStr(128),
    contactId: optStr(128),
    status: linkedinMemberStatusSchema.optional(),
    dueBefore: z.string().datetime().optional(),
    dueAfter: z.string().datetime().optional(),
    limit: toolLimitSchema,
    cursor: toolCursorSchema,
  })
  .strict();

export const updateLinkedinOutreachStatusSchema = z
  .object({
    campaignId: idSchema,
    memberId: idSchema,
    status: linkedinMemberStatusSchema.optional(),
    action: linkedinActionSchema.optional(),
    lastActionAt: z.string().datetime().optional(),
    occurredAt: z.string().datetime().optional(),
    notes: optStr(8000),
    nextActionAt: z.string().datetime().nullable().optional(),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.status && !value.action) {
      ctx.addIssue({ code: "custom", message: "status or action is required", path: ["status"] });
    }
  });
