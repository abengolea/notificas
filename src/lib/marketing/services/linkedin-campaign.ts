import { z } from "zod";
import type { MarketingServiceContext } from "../context";
import { marketingLinkedInCampaignMemberId, newMarketingEntityId } from "../domain/ids";
import type {
  MarketingActivityType,
  MarketingLinkedInAction,
  MarketingLinkedInCampaign,
  MarketingLinkedInCampaignMember,
  MarketingLinkedInMemberStatus,
} from "../domain/types";
import {
  MarketingConflictError,
  MarketingNotFoundError,
  MarketingValidationError,
} from "../errors";
import { nowIso } from "../persistence/timestamps";
import { normalizeMarketingCountryCode } from "../normalizers";
import type {
  LinkedInCampaignSearchFilters,
  MarketingActivityRepository,
  MarketingCompanyRepository,
  MarketingContactRepository,
  MarketingLinkedInCampaignMemberRepository,
  MarketingLinkedInCampaignRepository,
  LinkedInMemberListFilters,
} from "../repositories/types";
import {
  marketingLinkedInCampaignStatusSchema,
  marketingLinkedInMemberStatusSchema,
  marketingLinkedInMessageTypeSchema,
} from "../schemas";
import { createStamps, updateStamps } from "./scope";

const campaignStatusSchema = marketingLinkedInCampaignStatusSchema;
const memberStatusSchema = marketingLinkedInMemberStatusSchema;
const memberStatuses = marketingLinkedInMemberStatusSchema.options;
const actionSchema = z.enum([
  "connection_sent",
  "connected",
  "message_sent",
  "followup_sent",
  "replied",
  "interested",
  "not_interested",
]);

const campaignCreateSchema = z.object({
  name: z.string().min(2).max(160),
  description: z.string().max(4000).optional(),
  countryCode: z.string().min(2).max(40).nullable().optional(),
  industryIds: z.array(z.string().min(1).max(128)).max(50).optional(),
  useCaseIds: z.array(z.string().min(1).max(128)).max(50).optional(),
  listId: z.string().min(1).max(128).optional(),
  commercialInitiativeId: z.string().min(1).max(128).optional(),
  messageType: marketingLinkedInMessageTypeSchema.optional().default("multistep"),
  connectionMessage: z.string().max(3000).optional(),
  message: z.string().max(8000).optional(),
  followUpMessage: z.string().max(8000).optional(),
  notes: z.string().max(8000).optional(),
});

const campaignUpdateSchema = campaignCreateSchema.partial().extend({
  status: campaignStatusSchema.optional(),
});

const memberUpdateSchema = z.object({
  status: memberStatusSchema.optional(),
  connectionMessage: z.string().max(3000).optional(),
  message: z.string().max(8000).optional(),
  followUpMessage: z.string().max(8000).optional(),
  notes: z.string().max(8000).optional(),
  nextActionAt: z.string().datetime().nullable().optional(),
});

const actionInputSchema = z.object({
  action: actionSchema,
  at: z.string().datetime().optional(),
  nextActionAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(8000).optional(),
});

const actionState: Record<
  MarketingLinkedInAction,
  {
    status: MarketingLinkedInMemberStatus;
    timestamp: keyof MarketingLinkedInCampaignMember;
    activityType: MarketingActivityType;
  }
> = {
  connection_sent: {
    status: "connection_sent",
    timestamp: "connectionSentAt",
    activityType: "linkedin_connection_sent",
  },
  connected: {
    status: "connected",
    timestamp: "connectedAt",
    activityType: "linkedin_connected",
  },
  message_sent: {
    status: "message_sent",
    timestamp: "messageSentAt",
    activityType: "linkedin_message_sent",
  },
  followup_sent: {
    status: "follow_up_sent",
    timestamp: "followUpSentAt",
    activityType: "linkedin_follow_up_sent",
  },
  replied: {
    status: "replied",
    timestamp: "repliedAt",
    activityType: "linkedin_replied",
  },
  interested: {
    status: "interested",
    timestamp: "interestedAt",
    activityType: "linkedin_interested",
  },
  not_interested: {
    status: "not_interested",
    timestamp: "notInterestedAt",
    activityType: "linkedin_not_interested",
  },
};

export function createLinkedInCampaignService(deps: {
  campaigns: MarketingLinkedInCampaignRepository;
  members: MarketingLinkedInCampaignMemberRepository;
  contacts: MarketingContactRepository;
  companies: MarketingCompanyRepository;
  activities: MarketingActivityRepository;
}) {
  const requireCampaign = async (ctx: MarketingServiceContext, id: string) => {
    const campaign = await deps.campaigns.getById(ctx.workspaceId, id);
    if (!campaign) throw new MarketingNotFoundError("Campaña LinkedIn", id);
    return campaign;
  };

  const requireMember = async (ctx: MarketingServiceContext, id: string) => {
    const member = await deps.members.getById(ctx.workspaceId, id);
    if (!member) throw new MarketingNotFoundError("Miembro de campaña LinkedIn", id);
    return member;
  };

  return {
    async createCampaign(ctx: MarketingServiceContext, input: z.input<typeof campaignCreateSchema>) {
      const parsed = campaignCreateSchema.safeParse(input);
      if (!parsed.success) throw new MarketingValidationError("Campaña LinkedIn inválida", parsed.error.flatten());
      const countryCode = typeof parsed.data.countryCode === "string"
        ? normalizeMarketingCountryCode(parsed.data.countryCode)
        : parsed.data.countryCode;
      if (typeof parsed.data.countryCode === "string" && !countryCode) {
        throw new MarketingValidationError("countryCode inválido");
      }
      const stamps = createStamps(ctx);
      const campaign: MarketingLinkedInCampaign = {
        id: newMarketingEntityId(),
        workspaceId: ctx.workspaceId,
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim(),
        countryCode,
        industryIds: parsed.data.industryIds,
        useCaseIds: parsed.data.useCaseIds,
        listId: parsed.data.listId?.trim(),
        commercialInitiativeId: parsed.data.commercialInitiativeId?.trim(),
        messageType: parsed.data.messageType,
        connectionMessage: parsed.data.connectionMessage?.trim(),
        message: parsed.data.message?.trim(),
        followUpMessage: parsed.data.followUpMessage?.trim(),
        notes: parsed.data.notes?.trim(),
        status: "draft",
        memberCount: 0,
        activatedAt: null,
        completedAt: null,
        archivedAt: null,
        ...stamps,
      };
      await deps.campaigns.create(campaign);
      return campaign;
    },

    async getCampaign(ctx: MarketingServiceContext, id: string) {
      return requireCampaign(ctx, id);
    },

    async searchCampaigns(ctx: MarketingServiceContext, filters: LinkedInCampaignSearchFilters = {}) {
      const countryCode = filters.countryCode
        ? normalizeMarketingCountryCode(filters.countryCode)
        : undefined;
      if (filters.countryCode && !countryCode) throw new MarketingValidationError("countryCode inválido");
      return deps.campaigns.search(ctx.workspaceId, { ...filters, countryCode: countryCode || undefined });
    },

    async updateCampaign(
      ctx: MarketingServiceContext,
      id: string,
      input: z.input<typeof campaignUpdateSchema>,
    ) {
      const current = await requireCampaign(ctx, id);
      const parsed = campaignUpdateSchema.safeParse(input);
      if (!parsed.success) throw new MarketingValidationError("Campaña LinkedIn inválida", parsed.error.flatten());
      if (current.status === "archived" && parsed.data.status && parsed.data.status !== "archived") {
        throw new MarketingConflictError("La campaña archivada no puede cambiar de estado");
      }
      const patch: Partial<MarketingLinkedInCampaign> = { ...updateStamps(ctx) };
      if (parsed.data.name !== undefined) patch.name = parsed.data.name.trim();
      if (parsed.data.description !== undefined) patch.description = parsed.data.description.trim();
      if (parsed.data.countryCode !== undefined) {
        if (parsed.data.countryCode === null) {
          patch.countryCode = null;
        } else {
          const countryCode = normalizeMarketingCountryCode(parsed.data.countryCode);
          if (!countryCode) throw new MarketingValidationError("countryCode inválido");
          patch.countryCode = countryCode;
        }
      }
      if (parsed.data.industryIds !== undefined) patch.industryIds = parsed.data.industryIds;
      if (parsed.data.useCaseIds !== undefined) patch.useCaseIds = parsed.data.useCaseIds;
      if (parsed.data.listId !== undefined) patch.listId = parsed.data.listId.trim();
      if (parsed.data.commercialInitiativeId !== undefined) {
        patch.commercialInitiativeId = parsed.data.commercialInitiativeId.trim();
      }
      if (parsed.data.messageType !== undefined) patch.messageType = parsed.data.messageType;
      if (parsed.data.connectionMessage !== undefined) patch.connectionMessage = parsed.data.connectionMessage.trim();
      if (parsed.data.message !== undefined) patch.message = parsed.data.message.trim();
      if (parsed.data.followUpMessage !== undefined) patch.followUpMessage = parsed.data.followUpMessage.trim();
      if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes.trim();
      if (parsed.data.status !== undefined) {
        patch.status = parsed.data.status;
        patch.archivedAt =
          parsed.data.status === "archived"
            ? current.archivedAt || nowIso()
            : null;
        if (parsed.data.status === "active" && !current.activatedAt) patch.activatedAt = nowIso();
        if (parsed.data.status === "completed") patch.completedAt = nowIso();
      }
      await deps.campaigns.update(ctx.workspaceId, id, patch);
      return requireCampaign(ctx, id);
    },

    async archiveCampaign(ctx: MarketingServiceContext, id: string) {
      await requireCampaign(ctx, id);
      const at = nowIso();
      await deps.campaigns.update(ctx.workspaceId, id, {
        status: "archived",
        archivedAt: at,
        ...updateStamps(ctx),
      });
      return requireCampaign(ctx, id);
    },

    async restoreCampaign(ctx: MarketingServiceContext, id: string) {
      const current = await requireCampaign(ctx, id);
      if (current.status !== "archived") return current;
      await deps.campaigns.update(ctx.workspaceId, id, {
        status: "draft",
        archivedAt: null,
        ...updateStamps(ctx),
      });
      return requireCampaign(ctx, id);
    },

    async previewCampaign(ctx: MarketingServiceContext, id: string) {
      const campaign = await requireCampaign(ctx, id);
      const members = await deps.members.listAllForCampaign(ctx.workspaceId, id);
      const byStatus = Object.fromEntries(memberStatuses.map((status) => [status, 0])) as Record<
        MarketingLinkedInMemberStatus,
        number
      >;
      for (const member of members) byStatus[member.status] += 1;
      const milestoneCount = (
        timestamp: keyof MarketingLinkedInCampaignMember,
        currentStatus: MarketingLinkedInMemberStatus,
      ) => members.filter((member) => Boolean(member[timestamp]) || member.status === currentStatus).length;
      return {
        campaign,
        members: members.map((member) => ({
          ...member,
          connectionMessage: member.connectionMessage ?? campaign.connectionMessage,
          message: member.message ?? campaign.message,
          followUpMessage: member.followUpMessage ?? campaign.followUpMessage,
        })),
        summary: {
          total: members.length,
          pending:
            byStatus.not_contacted +
            byStatus.connection_ready +
            byStatus.message_ready +
            byStatus.follow_up_due,
          connectionSent: milestoneCount("connectionSentAt", "connection_sent"),
          connected: milestoneCount("connectedAt", "connected"),
          messageSent: milestoneCount("messageSentAt", "message_sent"),
          replied: milestoneCount("repliedAt", "replied"),
          interested: milestoneCount("interestedAt", "interested"),
          byStatus,
        },
      };
    },

    async listMembers(
      ctx: MarketingServiceContext,
      campaignId: string,
      filters: Omit<LinkedInMemberListFilters, "campaignId"> = {},
    ) {
      await requireCampaign(ctx, campaignId);
      return deps.members.list(ctx.workspaceId, { ...filters, campaignId });
    },

    async addMember(ctx: MarketingServiceContext, campaignId: string, contactId: string) {
      const campaign = await requireCampaign(ctx, campaignId);
      if (campaign.status === "archived") throw new MarketingConflictError("La campaña está archivada");
      const contact = await deps.contacts.getById(contactId);
      if (!contact || contact.workspaceId !== ctx.workspaceId || contact.deletedAt) {
        throw new MarketingNotFoundError("Contacto", contactId);
      }
      if (!contact.linkedinUrl) {
        throw new MarketingValidationError("El contacto no tiene linkedinUrl");
      }
      const id = marketingLinkedInCampaignMemberId(campaignId, contactId, ctx.workspaceId);
      const existing = await deps.members.getById(ctx.workspaceId, id);
      if (existing) return existing;
      const company = contact.companyId
        ? await deps.companies.getById(ctx.workspaceId, contact.companyId)
        : null;
      const stamps = createStamps(ctx);
      const member: MarketingLinkedInCampaignMember = {
        id,
        workspaceId: ctx.workspaceId,
        campaignId,
        contactId,
        companyId: contact.companyId,
        firstName: contact.name.trim().split(/\s+/)[0] || undefined,
        companyName: company?.name || contact.company || undefined,
        jobTitle: contact.title || undefined,
        linkedinUrl: contact.linkedinUrl,
        status: "not_contacted",
        responseType: null,
        nextActionAt: contact.linkedinNextActionAt ?? null,
        ...stamps,
      };
      const created = await deps.members.create(member);
      if (!created) return requireMember(ctx, id);
      await deps.campaigns.adjustMemberCount(ctx.workspaceId, campaignId, 1, stamps.updatedAt);
      return member;
    },

    async removeMember(ctx: MarketingServiceContext, campaignId: string, memberId: string) {
      await requireCampaign(ctx, campaignId);
      const member = await requireMember(ctx, memberId);
      if (member.campaignId !== campaignId) throw new MarketingNotFoundError("Miembro", memberId);
      const removed = await deps.members.remove(ctx.workspaceId, memberId);
      if (removed) {
        await deps.campaigns.adjustMemberCount(ctx.workspaceId, campaignId, -1, nowIso());
      }
    },

    async updateMember(
      ctx: MarketingServiceContext,
      campaignId: string,
      memberId: string,
      input: z.input<typeof memberUpdateSchema>,
    ) {
      await requireCampaign(ctx, campaignId);
      const member = await requireMember(ctx, memberId);
      if (member.campaignId !== campaignId) throw new MarketingNotFoundError("Miembro", memberId);
      const parsed = memberUpdateSchema.safeParse(input);
      if (!parsed.success) throw new MarketingValidationError("Miembro LinkedIn inválido", parsed.error.flatten());
      const patch: Partial<MarketingLinkedInCampaignMember> = {
        ...parsed.data,
        ...updateStamps(ctx),
      };
      if (parsed.data.connectionMessage !== undefined) {
        patch.connectionMessage = parsed.data.connectionMessage.trim();
      }
      if (parsed.data.message !== undefined) patch.message = parsed.data.message.trim();
      if (parsed.data.followUpMessage !== undefined) {
        patch.followUpMessage = parsed.data.followUpMessage.trim();
      }
      if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes.trim();
      await deps.members.update(ctx.workspaceId, memberId, patch);
      return requireMember(ctx, memberId);
    },

    async recordAction(
      ctx: MarketingServiceContext,
      campaignId: string,
      memberId: string,
      input: z.input<typeof actionInputSchema>,
    ) {
      const campaign = await requireCampaign(ctx, campaignId);
      const member = await requireMember(ctx, memberId);
      if (member.campaignId !== campaignId) throw new MarketingNotFoundError("Miembro", memberId);
      const parsed = actionInputSchema.safeParse(input);
      if (!parsed.success) throw new MarketingValidationError("Acción LinkedIn inválida", parsed.error.flatten());
      const action = parsed.data.action;
      const transition = actionState[action];
      const at = parsed.data.at || nowIso();
      const memberPatch: Partial<MarketingLinkedInCampaignMember> = {
        status: transition.status,
        nextActionAt: parsed.data.nextActionAt ?? null,
        notes: parsed.data.notes?.trim() ?? member.notes,
        [transition.timestamp]: at,
        ...updateStamps(ctx),
      };
      if (action === "replied" || action === "interested" || action === "not_interested") {
        memberPatch.responseType = action;
      }
      await deps.members.update(ctx.workspaceId, memberId, memberPatch);
      const contactPatch = {
        workspaceId: ctx.workspaceId,
        linkedinStatus: transition.status,
        linkedinLastContactAt: at,
        linkedinNextActionAt: parsed.data.nextActionAt ?? null,
        ...updateStamps(ctx),
      };
      await deps.contacts.update(member.contactId, parsed.data.notes === undefined
        ? contactPatch
        : { ...contactPatch, linkedinNotes: parsed.data.notes.trim() });
      await deps.activities.create({
        id: newMarketingEntityId(),
        workspaceId: ctx.workspaceId,
        type: transition.activityType,
        campaignId,
        contactId: member.contactId,
        companyId: member.companyId,
        actorType: ctx.actorType,
        actorId: ctx.actorId,
        title: `LinkedIn: ${action}`,
        description: parsed.data.notes?.trim(),
        metadata: {
          channel: "linkedin",
          action,
          memberId,
          campaignName: campaign.name,
        },
        createdAt: at,
      });
      return requireMember(ctx, memberId);
    },

    async listOutreach(ctx: MarketingServiceContext, filters: LinkedInMemberListFilters = {}) {
      return deps.members.list(ctx.workspaceId, filters);
    },

    async pendingActions(ctx: MarketingServiceContext, dueBefore = nowIso(), limit = 100) {
      const page = await deps.members.list(ctx.workspaceId, { dueBefore, limit });
      const terminal = new Set(["replied", "interested", "not_interested", "do_not_contact"]);
      return {
        ...page,
        items: page.items.filter((member) => !terminal.has(member.status)),
      };
    },
  };
}

export type LinkedInCampaignService = ReturnType<typeof createLinkedInCampaignService>;
