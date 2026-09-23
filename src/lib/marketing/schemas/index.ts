import { z } from "zod";
import { isMarketingCommercialStageId } from "../domain/commercial-stages";
import { isMarketingStage, MARKETING_STAGES } from "../stages";

export const marketingInstantSchema = z.string().min(1).max(40);

const optionalInstant = marketingInstantSchema.optional().nullable();

export const marketingWorkspaceIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/, "workspaceId inválido");

export const marketingEntityIdSchema = z.string().min(1).max(128);

export const marketingEngagementStageSchema = z.enum(MARKETING_STAGES);

export const marketingCommercialStageIdSchema = z
  .string()
  .min(1)
  .max(80)
  .refine((id) => isMarketingCommercialStageId(id), { message: "commercialStageId desconocido" });

export const marketingEntityBaseSchema = z.object({
  id: marketingEntityIdSchema,
  workspaceId: marketingWorkspaceIdSchema,
  createdAt: marketingInstantSchema,
  updatedAt: marketingInstantSchema,
  createdBy: z.string().min(1).max(128).optional(),
  updatedBy: z.string().min(1).max(128).optional(),
});

export const marketingSoftDeleteSchema = z.object({
  deletedAt: optionalInstant,
  deletedBy: z.string().min(1).max(128).nullable().optional(),
});

export const marketingMessageSnapshotSchema = z.object({
  subject: z.string().max(300).optional(),
  html: z.string().max(80_000).optional(),
  text: z.string().max(40_000).optional(),
  version: z.number().int().positive().optional(),
});

export const marketingCompanySizeSchema = z.enum(["micro", "small", "medium", "large", "enterprise"]);
export const marketingPrioritySchema = z.enum(["low", "normal", "high"]);
export const marketingCompanyStatusSchema = z.enum(["active", "inactive"]);
export const marketingListKindSchema = z.enum(["static", "dynamic"]);
export const marketingSourceTypeSchema = z.enum([
  "ai_research",
  "web",
  "linkedin",
  "event",
  "referral",
  "csv",
  "manual",
  "website",
  "association",
  "other",
]);
export const marketingActivityTypeSchema = z.enum([
  "contact_created",
  "company_created",
  "note_added",
  "email_sent",
  "email_delivered",
  "email_opened",
  "email_clicked",
  "email_replied",
  "call",
  "meeting",
  "demo",
  "status_changed",
  "follow_up_created",
  "follow_up_completed",
  "linkedin_connection_sent",
  "linkedin_connected",
  "linkedin_message_sent",
  "linkedin_follow_up_sent",
  "linkedin_replied",
  "linkedin_interested",
  "linkedin_not_interested",
  "system_event",
  "ai_event",
]);
export const marketingLinkedInCampaignStatusSchema = z.enum([
  "draft",
  "active",
  "paused",
  "completed",
  "archived",
]);
export const marketingLinkedInMessageTypeSchema = z.enum([
  "connection_request",
  "direct_message",
  "multistep",
]);
export const marketingLinkedInMemberStatusSchema = z.enum([
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
]);
export const marketingTaskTypeSchema = z.enum([
  "call",
  "email",
  "research",
  "meeting",
  "demo",
  "follow_up",
  "proposal",
  "data_completion",
  "other",
]);
export const marketingActorTypeSchema = z.enum(["user", "system", "ai"]);
export const marketingOpportunityStatusSchema = z.enum(["open", "won", "lost", "paused"]);
export const marketingTaskStatusSchema = z.enum(["open", "completed", "cancelled"]);
export const marketingDuplicateMatchTypeSchema = z.enum(["exact", "probable", "possible"]);
export const marketingDuplicateStatusSchema = z.enum(["pending", "merged", "dismissed"]);
export const marketingDuplicateEntityTypeSchema = z.enum(["company", "contact"]);

export const marketingCompanySchema = marketingEntityBaseSchema
  .merge(marketingSoftDeleteSchema)
  .extend({
    name: z.string().min(1).max(200),
    normalizedName: z.string().min(1).max(200),
    legalName: z.string().max(240).optional(),
    website: z.string().max(500).optional(),
    normalizedDomain: z.string().max(253).optional(),
    countryCode: z.string().length(2).optional(),
    state: z.string().max(80).optional(),
    city: z.string().max(80).optional(),
    industryIds: z.array(marketingEntityIdSchema).default([]),
    subIndustryIds: z.array(marketingEntityIdSchema).optional(),
    useCaseIds: z.array(marketingEntityIdSchema).default([]),
    organizationTypeId: marketingEntityIdSchema.optional(),
    size: marketingCompanySizeSchema.optional(),
    employees: z.number().int().nonnegative().optional(),
    generalEmail: z.string().max(254).optional(),
    phone: z.string().max(32).optional(),
    linkedin: z.string().max(500).optional(),
    sourceIds: z.array(marketingEntityIdSchema).default([]),
    tagIds: z.array(marketingEntityIdSchema).default([]),
    commercialStageId: z.string().max(80).optional(),
    priority: marketingPrioritySchema.optional(),
    ownerId: z.string().max(128).optional(),
    firstContactAt: optionalInstant,
    lastContactAt: optionalInstant,
    nextFollowUpAt: optionalInstant,
    notes: z.string().max(8000).optional(),
    status: marketingCompanyStatusSchema,
  });

export const marketingCatalogKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{1,78}$/, "key de catálogo inválido");

export const marketingCountrySchema = marketingEntityBaseSchema.extend({
  key: z.string().length(2),
  code: z.string().length(2),
  name: z.string().min(1).max(80),
  defaultLanguage: z.string().min(2).max(8).optional(),
  active: z.boolean(),
});

export const marketingIndustrySchema = marketingEntityBaseSchema.extend({
  key: marketingCatalogKeySchema,
  name: z.string().min(1).max(120),
  normalizedName: z.string().min(1).max(120),
  parentIndustryId: marketingEntityIdSchema.optional(),
  active: z.boolean(),
});

export const marketingUseCaseSchema = marketingEntityBaseSchema.extend({
  key: marketingCatalogKeySchema,
  name: z.string().min(1).max(160),
  description: z.string().max(4000).optional(),
  industryIds: z.array(z.string().min(1).max(128)).default([]),
  countryCodes: z.array(z.string().length(2)).default([]),
  appliesToAllCountries: z.boolean(),
  tagIds: z.array(marketingEntityIdSchema).optional(),
  active: z.boolean(),
});

export const marketingSourceSchema = marketingEntityBaseSchema.extend({
  type: marketingSourceTypeSchema,
  name: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  url: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const marketingTagSchema = marketingEntityBaseSchema.extend({
  key: marketingCatalogKeySchema,
  name: z.string().min(1).max(60),
  normalizedName: z.string().min(1).max(60),
  active: z.boolean(),
});

export const marketingListMembershipSchema = z.object({
  id: marketingEntityIdSchema,
  workspaceId: marketingWorkspaceIdSchema,
  listId: marketingEntityIdSchema,
  contactId: marketingEntityIdSchema,
  addedAt: marketingInstantSchema,
  addedBy: z.string().max(128).optional(),
  source: z.string().max(80).optional(),
});

export const marketingMessageTemplateSchema = marketingEntityBaseSchema
  .merge(marketingSoftDeleteSchema)
  .extend({
    name: z.string().min(1).max(160),
    channel: z.literal("email"),
    countryCodes: z.array(z.string().length(2)).default([]),
    industryIds: z.array(marketingEntityIdSchema).default([]),
    useCaseIds: z.array(marketingEntityIdSchema).default([]),
    language: z.string().min(2).max(8),
    currentVersion: z.number().int().positive(),
    active: z.boolean(),
  });

export const marketingMessageTemplateVersionSchema = z.object({
  id: marketingEntityIdSchema,
  workspaceId: marketingWorkspaceIdSchema,
  templateId: marketingEntityIdSchema,
  version: z.number().int().positive(),
  subject: z.string().max(300).optional(),
  html: z.string().max(80_000).optional(),
  text: z.string().max(40_000).optional(),
  createdAt: marketingInstantSchema,
  createdBy: z.string().max(128).optional(),
});

export const marketingActivitySchema = z.object({
  id: marketingEntityIdSchema,
  workspaceId: marketingWorkspaceIdSchema,
  type: marketingActivityTypeSchema,
  companyId: marketingEntityIdSchema.optional(),
  contactId: marketingEntityIdSchema.optional(),
  opportunityId: marketingEntityIdSchema.optional(),
  campaignId: marketingEntityIdSchema.optional(),
  actorType: marketingActorTypeSchema,
  actorId: z.string().max(128).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(8000).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: marketingInstantSchema,
});

export const marketingOpportunitySchema = marketingEntityBaseSchema
  .merge(marketingSoftDeleteSchema)
  .extend({
    name: z.string().min(1).max(200),
    companyId: marketingEntityIdSchema,
    contactIds: z.array(marketingEntityIdSchema).default([]),
    countryCode: z.string().length(2).optional(),
    industryId: marketingEntityIdSchema.optional(),
    useCaseId: marketingEntityIdSchema.optional(),
    commercialStageId: z.string().min(1).max(80),
    ownerId: z.string().max(128).optional(),
    estimatedValue: z.number().nonnegative().optional(),
    currency: z.string().length(3).optional(),
    nextStep: z.string().max(400).optional(),
    nextActionAt: optionalInstant,
    notes: z.string().max(8000).optional(),
    status: marketingOpportunityStatusSchema,
  });

export const marketingTaskSchema = z.object({
  id: marketingEntityIdSchema,
  workspaceId: marketingWorkspaceIdSchema,
  type: marketingTaskTypeSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  companyId: marketingEntityIdSchema.optional(),
  contactId: marketingEntityIdSchema.optional(),
  opportunityId: marketingEntityIdSchema.optional(),
  assignedTo: z.string().max(128).optional(),
  dueAt: optionalInstant,
  priority: marketingPrioritySchema,
  status: marketingTaskStatusSchema,
  source: z.enum(["manual", "system", "ai"]).optional(),
  createdAt: marketingInstantSchema,
  updatedAt: marketingInstantSchema,
  createdBy: z.string().max(128).optional(),
  completedAt: optionalInstant,
  completedBy: z.string().max(128).optional(),
});

export const marketingCommercialStageSchema = z.object({
  id: z.string().min(1).max(80),
  workspaceId: marketingWorkspaceIdSchema,
  name: z.string().min(1).max(80),
  order: z.number().int(),
  active: z.boolean(),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
});

export const marketingDuplicateCandidateSchema = z.object({
  id: marketingEntityIdSchema,
  workspaceId: marketingWorkspaceIdSchema,
  entityType: marketingDuplicateEntityTypeSchema,
  sourceId: marketingEntityIdSchema,
  candidateId: marketingEntityIdSchema,
  matchType: marketingDuplicateMatchTypeSchema,
  reasons: z.array(z.string().max(200)).default([]),
  status: marketingDuplicateStatusSchema,
  createdAt: marketingInstantSchema,
  reviewedAt: optionalInstant,
  reviewedBy: z.string().max(128).optional(),
});

/**
 * Documento de contacto v1 + campos v2 opcionales.
 * Un contacto antiguo (sin workspaceId/companyId/commercialStageId) es válido.
 */
export const marketingContactDocumentSchema = z
  .object({
    email: z.string().max(254).optional().default(""),
    emailKey: z.string().max(254).optional(),
    normalizedEmail: z.string().max(254).optional(),
    name: z.string().max(200).optional().default(""),
    company: z.string().max(200).optional().default(""),
    title: z.string().max(200).optional().default(""),
    country: z.string().min(2).max(2),
    countryCode: z.string().length(2).optional(),
    notes: z.string().max(8000).optional().default(""),
    stage: marketingEngagementStageSchema,
    stageManual: z.boolean().optional().default(false),
    tags: z.array(z.string().max(40)).optional().default([]),
    source: z.enum(["csv", "manual"]).optional(),
    listIds: z.array(z.string()).optional().default([]),
    lastCampaignId: z.string().nullable().optional(),
    lastSendId: z.string().nullable().optional(),
    lastSentAt: z.string().nullable().optional(),
    lastOpenedAt: z.string().nullable().optional(),
    lastClickedAt: z.string().nullable().optional(),
    lastRepliedAt: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
    workspaceId: marketingWorkspaceIdSchema.optional(),
    companyId: marketingEntityIdSchema.optional(),
    useCaseIds: z.array(marketingEntityIdSchema).optional(),
    tagIds: z.array(marketingEntityIdSchema).optional(),
    sourceIds: z.array(marketingEntityIdSchema).optional(),
    commercialStageId: z.string().max(80).optional(),
    ownerId: z.string().max(128).optional(),
    firstContactAt: optionalInstant,
    lastContactAt: optionalInstant,
    nextFollowUpAt: optionalInstant,
    doNotContact: z.boolean().optional(),
    unsubscribed: z.boolean().optional(),
    bounced: z.boolean().optional(),
    deletedAt: optionalInstant,
    deletedBy: z.string().max(128).nullable().optional(),
    createdBy: z.string().max(128).optional(),
    updatedBy: z.string().max(128).optional(),
    linkedinUrl: z.string().max(500).optional(),
    linkedinStatus: z.enum([
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
    ]).optional(),
    linkedinLastContactAt: optionalInstant,
    linkedinNextActionAt: optionalInstant,
    linkedinNotes: z.string().max(8000).optional(),
    prospectingSource: z.enum(["clay", "linkedin", "web", "manual", "association", "other"]).optional(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    if (value.commercialStageId && isMarketingStage(value.commercialStageId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "commercialStageId no debe reutilizar el engagement stage de email",
        path: ["commercialStageId"],
      });
    }
  });

export const marketingCampaignV2FieldsSchema = z.object({
  workspaceId: marketingWorkspaceIdSchema.optional(),
  channel: z.literal("email").optional(),
  templateId: marketingEntityIdSchema.optional(),
  templateVersion: z.number().int().positive().optional(),
  templateSnapshot: marketingMessageSnapshotSchema.optional(),
  industryIds: z.array(marketingEntityIdSchema).optional(),
  useCaseIds: z.array(marketingEntityIdSchema).optional(),
  createdBy: z.string().max(128).optional(),
  updatedBy: z.string().max(128).optional(),
});

export const marketingSendV2FieldsSchema = z.object({
  workspaceId: marketingWorkspaceIdSchema.optional(),
  companyId: marketingEntityIdSchema.optional(),
  provider: z.string().max(40).optional(),
  messageSnapshot: marketingMessageSnapshotSchema.optional(),
});

export type MarketingCompanyInput = z.infer<typeof marketingCompanySchema>;
export type MarketingContactDocument = z.infer<typeof marketingContactDocumentSchema>;
export type MarketingOpportunityInput = z.infer<typeof marketingOpportunitySchema>;
export type MarketingTaskInput = z.infer<typeof marketingTaskSchema>;
export type MarketingActivityInput = z.infer<typeof marketingActivitySchema>;
export type MarketingMessageTemplateInput = z.infer<typeof marketingMessageTemplateSchema>;
export type MarketingMessageTemplateVersionInput = z.infer<typeof marketingMessageTemplateVersionSchema>;
