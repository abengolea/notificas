import { z } from "zod";
import type { MarketingServiceContext } from "../context";
import { newMarketingEntityId } from "../domain/ids";
import type { MarketingActivity } from "../domain/types";
import { MarketingValidationError } from "../errors";
import { marketingActivityTypeSchema, marketingActorTypeSchema } from "../schemas";
import type { ActivityListFilters, MarketingActivityRepository } from "../repositories/types";
import { nowIso } from "../persistence/timestamps";

const createSchema = z.object({
  type: marketingActivityTypeSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(8000).optional(),
  companyId: z.string().optional(),
  contactId: z.string().optional(),
  opportunityId: z.string().optional(),
  campaignId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  actorType: marketingActorTypeSchema.optional(),
  actorId: z.string().max(128).optional(),
});

export function createActivityService(activities: MarketingActivityRepository) {
  return {
    async createActivity(ctx: MarketingServiceContext, input: z.input<typeof createSchema>) {
      const parsed = createSchema.safeParse(input);
      if (!parsed.success) throw new MarketingValidationError("Actividad inválida", parsed.error.flatten());
      const doc: MarketingActivity = {
        id: newMarketingEntityId(),
        workspaceId: ctx.workspaceId,
        type: parsed.data.type,
        title: parsed.data.title.trim(),
        description: parsed.data.description,
        companyId: parsed.data.companyId,
        contactId: parsed.data.contactId,
        opportunityId: parsed.data.opportunityId,
        campaignId: parsed.data.campaignId,
        metadata: parsed.data.metadata,
        actorType: parsed.data.actorType || ctx.actorType,
        actorId: parsed.data.actorId || ctx.actorId,
        createdAt: nowIso(),
      };
      await activities.create(doc);
      return doc;
    },
    async listCompanyActivities(ctx: MarketingServiceContext, companyId: string, filters?: ActivityListFilters) {
      return activities.listByCompany(ctx.workspaceId, companyId, filters);
    },
    async listContactActivities(ctx: MarketingServiceContext, contactId: string, filters?: ActivityListFilters) {
      return activities.listByContact(ctx.workspaceId, contactId, filters);
    },
    async listOpportunityActivities(ctx: MarketingServiceContext, opportunityId: string, filters?: ActivityListFilters) {
      return activities.listByOpportunity(ctx.workspaceId, opportunityId, filters);
    },
  };
}

export type ActivityService = ReturnType<typeof createActivityService>;
