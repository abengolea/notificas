import { z } from "zod";
import type { MarketingServiceContext } from "./context";
import { newMarketingEntityId } from "./domain/ids";
import type {
  MarketingLinkedInAction,
  MarketingLinkedInCampaign,
  MarketingLinkedInCampaignMember,
  MarketingLinkedInMemberStatus,
} from "./domain/types";
import { MarketingNotFoundError, MarketingValidationError } from "./errors";
import { linkedInOutreachView } from "./linkedin-outreach";
import { LINKEDIN_MEMBER_STATUS_LABEL } from "./linkedin-ui";
import { normalizeMarketingCountryCode } from "./normalizers";
import { nowIso } from "./persistence/timestamps";
import type {
  MarketingActivityRepository,
  MarketingContactRepository,
  MarketingLinkedInCampaignMemberRepository,
  MarketingLinkedInCampaignRepository,
} from "./repositories/types";
import { updateStamps } from "./services/scope";
import type { LinkedInCampaignService } from "./services/linkedin-campaign";

export type LinkedInAssistantActionKind = "connection" | "message" | "followup";

export type LinkedInAssistantAuditEvent =
  | "opened_profile"
  | "prepared_connection"
  | "prepared_message"
  | "prepared_followup"
  | "skipped"
  | "postponed";

const TERMINAL_STATUSES = new Set<MarketingLinkedInMemberStatus>([
  "replied",
  "interested",
  "not_interested",
  "do_not_contact",
]);

const ACTIONABLE_STATUSES: MarketingLinkedInMemberStatus[] = [
  "follow_up_due",
  "message_ready",
  "connection_ready",
];

const STATUS_PRIORITY: Record<MarketingLinkedInMemberStatus, number> = {
  follow_up_due: 1,
  message_ready: 2,
  connection_ready: 3,
  not_contacted: 4,
  connection_sent: 5,
  connected: 6,
  message_sent: 7,
  follow_up_sent: 8,
  replied: 99,
  interested: 99,
  not_interested: 99,
  do_not_contact: 99,
};

const completeActionSchema = z.object({
  action: z.enum([
    "connection_sent",
    "connected",
    "message_sent",
    "followup_sent",
    "follow_up_sent",
    "invitation_sent",
  ]),
  at: z.string().datetime().optional(),
  nextActionAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(8000).optional(),
});

const auditEventSchema = z.object({
  event: z.enum([
    "opened_profile",
    "prepared_connection",
    "prepared_message",
    "prepared_followup",
    "skipped",
    "postponed",
  ]),
  notes: z.string().max(8000).optional(),
});

export type LinkedInAssistantFilters = {
  campaignId?: string;
  status?: MarketingLinkedInMemberStatus;
  countryCode?: string;
  dueBefore?: string;
  limit?: number;
  excludeMemberIds?: string[];
};

export type LinkedInAssistantActionView = {
  memberId: string;
  campaignId: string;
  contactId: string;
  companyId?: string | null;
  campaign: {
    id: string;
    name: string;
    countryCode?: string | null;
    status: string;
  };
  contact: {
    name: string;
    firstName?: string | null;
    title?: string | null;
    companyName?: string | null;
    linkedinUrl: string;
  };
  action: LinkedInAssistantActionKind;
  message: string | null;
  status: MarketingLinkedInMemberStatus;
  statusLabel: string;
  nextActionAt: string | null;
};

function actionKindForStatus(status: MarketingLinkedInMemberStatus): LinkedInAssistantActionKind | null {
  if (status === "connection_ready") return "connection";
  if (status === "message_ready" || status === "connected") return "message";
  if (status === "follow_up_due") return "followup";
  return null;
}

function resolveMessage(
  member: MarketingLinkedInCampaignMember,
  campaign: MarketingLinkedInCampaign,
  kind: LinkedInAssistantActionKind,
): string | null {
  if (kind === "connection") {
    return member.connectionMessage ?? campaign.connectionMessage ?? null;
  }
  if (kind === "message") {
    return member.message ?? campaign.message ?? null;
  }
  return member.followUpMessage ?? campaign.followUpMessage ?? null;
}

function contactName(member: MarketingLinkedInCampaignMember, contact?: { name?: string } | null): string {
  if (contact?.name?.trim()) return contact.name.trim();
  if (member.firstName?.trim()) return member.firstName.trim();
  return "Contacto";
}

function isCampaignEligible(campaign: MarketingLinkedInCampaign): boolean {
  return campaign.status !== "archived" && !campaign.archivedAt;
}

function sortActionableMembers(
  members: MarketingLinkedInCampaignMember[],
  now: string,
): MarketingLinkedInCampaignMember[] {
  return [...members].sort((a, b) => {
    const priorityDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (priorityDiff !== 0) return priorityDiff;

    const aDue = a.nextActionAt;
    const bDue = b.nextActionAt;
    const aOverdue = aDue && aDue <= now ? 0 : 1;
    const bOverdue = bDue && bDue <= now ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;

    if (aDue && bDue && aDue !== bDue) return aDue.localeCompare(bDue);
    if (aDue && !bDue) return -1;
    if (!aDue && bDue) return 1;
    return (a.updatedAt || "").localeCompare(b.updatedAt || "");
  });
}

export function connectionReviewDays(): number {
  const raw = Number(process.env.LINKEDIN_ASSISTANT_CONNECTION_REVIEW_DAYS || 4);
  return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 4;
}

export function defaultNextActionAfterConnectionSent(from = new Date()): string {
  const days = connectionReviewDays();
  return new Date(from.getTime() + days * 86_400_000).toISOString();
}

export function createLinkedInAssistantService(deps: {
  linkedIn: LinkedInCampaignService;
  campaigns: MarketingLinkedInCampaignRepository;
  members: MarketingLinkedInCampaignMemberRepository;
  contacts: MarketingContactRepository;
  activities: MarketingActivityRepository;
}) {
  const loadCampaignMap = async (
    ctx: MarketingServiceContext,
    campaignId?: string,
    countryCode?: string,
  ) => {
    if (campaignId) {
      const campaign = await deps.linkedIn.getCampaign(ctx, campaignId);
      if (!isCampaignEligible(campaign)) return new Map<string, MarketingLinkedInCampaign>();
      return new Map([[campaign.id, campaign]]);
    }
    const page = await deps.linkedIn.searchCampaigns(ctx, {
      archived: "exclude",
      limit: 200,
      countryCode,
    });
    const map = new Map<string, MarketingLinkedInCampaign>();
    for (const campaign of page.items) {
      if (isCampaignEligible(campaign) && campaign.status !== "draft") {
        map.set(campaign.id, campaign);
      }
    }
    return map;
  };

  const buildActionView = async (
    ctx: MarketingServiceContext,
    member: MarketingLinkedInCampaignMember,
    campaign: MarketingLinkedInCampaign,
  ): Promise<LinkedInAssistantActionView | null> => {
    const kind = actionKindForStatus(member.status);
    if (!kind) return null;
    const contact = await deps.contacts.getById(member.contactId);
    const name = contactName(member, contact);
    const firstName = member.firstName || name.split(/\s+/)[0] || null;
    return {
      memberId: member.id,
      campaignId: member.campaignId,
      contactId: member.contactId,
      companyId: member.companyId,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        countryCode: campaign.countryCode,
        status: campaign.status,
      },
      contact: {
        name,
        firstName,
        title: member.jobTitle || contact?.title || null,
        companyName: member.companyName || contact?.company || null,
        linkedinUrl: member.linkedinUrl,
      },
      action: kind,
      message: resolveMessage(member, campaign, kind),
      status: member.status,
      statusLabel: LINKEDIN_MEMBER_STATUS_LABEL[member.status],
      nextActionAt: member.nextActionAt ?? null,
    };
  };

  const listActionableMembers = async (
    ctx: MarketingServiceContext,
    filters: LinkedInAssistantFilters = {},
  ) => {
    const limit = Math.min(500, Math.max(1, filters.limit ?? 100));
    const now = filters.dueBefore || nowIso();
    const countryCode = filters.countryCode
      ? normalizeMarketingCountryCode(filters.countryCode) || undefined
      : undefined;
    if (filters.countryCode && !countryCode) {
      throw new MarketingValidationError("countryCode inválido");
    }

    const campaignMap = await loadCampaignMap(ctx, filters.campaignId, countryCode);
    if (campaignMap.size === 0) return [];

    const exclude = new Set(filters.excludeMemberIds || []);
    const statuses = filters.status
      ? [filters.status]
      : ACTIONABLE_STATUSES;

    const collected: MarketingLinkedInCampaignMember[] = [];
    for (const status of statuses) {
      if (TERMINAL_STATUSES.has(status)) continue;
      const page = await deps.linkedIn.listOutreach(ctx, {
        campaignId: filters.campaignId,
        status,
        dueBefore: status === "follow_up_due" ? now : undefined,
        limit: 200,
      });
      for (const member of page.items) {
        if (exclude.has(member.id)) continue;
        if (TERMINAL_STATUSES.has(member.status)) continue;
        const campaign = campaignMap.get(member.campaignId);
        if (!campaign) continue;
        if (countryCode && campaign.countryCode !== countryCode) continue;
        if (!actionKindForStatus(member.status)) continue;
        collected.push(member);
      }
    }

    const unique = new Map(collected.map((member) => [member.id, member]));
    return sortActionableMembers([...unique.values()], now).slice(0, limit);
  };

  return {
    async getNextAction(ctx: MarketingServiceContext, filters: LinkedInAssistantFilters = {}) {
      const members = await listActionableMembers(ctx, { ...filters, limit: filters.limit ?? 1 });
      if (!members.length) return null;
      const member = members[0];
      const campaign = await deps.linkedIn.getCampaign(ctx, member.campaignId);
      return buildActionView(ctx, member, campaign);
    },

    async listActions(ctx: MarketingServiceContext, filters: LinkedInAssistantFilters = {}) {
      const members = await listActionableMembers(ctx, filters);
      const views: LinkedInAssistantActionView[] = [];
      for (const member of members) {
        const campaign = await deps.linkedIn.getCampaign(ctx, member.campaignId);
        const view = await buildActionView(ctx, member, campaign);
        if (view) views.push(view);
      }
      return views;
    },

    async getAction(ctx: MarketingServiceContext, memberId: string) {
      const member = await deps.members.getById(ctx.workspaceId, memberId);
      if (!member) throw new MarketingNotFoundError("Miembro de campaña LinkedIn", memberId);
      const campaign = await deps.linkedIn.getCampaign(ctx, member.campaignId);
      if (!isCampaignEligible(campaign)) {
        throw new MarketingNotFoundError("Acción LinkedIn", memberId);
      }
      const view = await buildActionView(ctx, member, campaign);
      if (!view) throw new MarketingNotFoundError("Acción LinkedIn accionable", memberId);
      return view;
    },

    async completeAction(
      ctx: MarketingServiceContext,
      memberId: string,
      input: z.input<typeof completeActionSchema>,
    ) {
      const parsed = completeActionSchema.safeParse(input);
      if (!parsed.success) {
        throw new MarketingValidationError("Acción inválida", parsed.error.flatten());
      }
      const member = await deps.members.getById(ctx.workspaceId, memberId);
      if (!member) throw new MarketingNotFoundError("Miembro de campaña LinkedIn", memberId);

      let action = parsed.data.action.replace("follow_up_sent", "followup_sent").replace(
        "invitation_sent",
        "connection_sent",
      ) as MarketingLinkedInAction;

      let nextActionAt = parsed.data.nextActionAt;
      if (action === "connection_sent" && nextActionAt === undefined) {
        nextActionAt = defaultNextActionAfterConnectionSent(
          parsed.data.at ? new Date(parsed.data.at) : new Date(),
        );
      }

      const updated = await deps.linkedIn.recordAction(ctx, member.campaignId, memberId, {
        action,
        at: parsed.data.at,
        nextActionAt: nextActionAt ?? null,
        notes: parsed.data.notes,
      });

      const campaign = await deps.linkedIn.getCampaign(ctx, member.campaignId);
      const view = await buildActionView(ctx, updated, campaign);
      return {
        member: linkedInOutreachView(updated),
        action: view,
      };
    },

    async recordAuditEvent(
      ctx: MarketingServiceContext,
      memberId: string,
      input: z.input<typeof auditEventSchema>,
    ) {
      const parsed = auditEventSchema.safeParse(input);
      if (!parsed.success) {
        throw new MarketingValidationError("Evento inválido", parsed.error.flatten());
      }
      const member = await deps.members.getById(ctx.workspaceId, memberId);
      if (!member) throw new MarketingNotFoundError("Miembro de campaña LinkedIn", memberId);
      const campaign = await deps.linkedIn.getCampaign(ctx, member.campaignId);
      const at = nowIso();

      if (parsed.data.event === "postponed") {
        const postponeDays = Number(process.env.LINKEDIN_ASSISTANT_POSTPONE_DAYS || 1);
        const nextActionAt = new Date(Date.now() + postponeDays * 86_400_000).toISOString();
        await deps.members.update(ctx.workspaceId, memberId, {
          nextActionAt,
          ...updateStamps(ctx),
        });
      }

      await deps.activities.create({
        id: newMarketingEntityId(),
        workspaceId: ctx.workspaceId,
        type: "system_event",
        campaignId: member.campaignId,
        contactId: member.contactId,
        companyId: member.companyId,
        actorType: ctx.actorType,
        actorId: ctx.actorId,
        title: `LinkedIn Assistant: ${parsed.data.event}`,
        description: parsed.data.notes?.trim(),
        metadata: {
          channel: "linkedin",
          assistantEvent: parsed.data.event,
          memberId,
          campaignName: campaign.name,
        },
        createdAt: at,
      });

      return { ok: true, event: parsed.data.event, memberId };
    },

    async listCampaignSummaries(ctx: MarketingServiceContext, countryCode?: string) {
      const normalized = countryCode
        ? normalizeMarketingCountryCode(countryCode) || undefined
        : undefined;
      if (countryCode && !normalized) throw new MarketingValidationError("countryCode inválido");

      const page = await deps.linkedIn.searchCampaigns(ctx, {
        archived: "exclude",
        countryCode: normalized,
        limit: 200,
      });

      const summaries = [];
      for (const campaign of page.items) {
        if (!isCampaignEligible(campaign) || campaign.status === "draft") continue;
        const preview = await deps.linkedIn.previewCampaign(ctx, campaign.id);
        summaries.push({
          id: campaign.id,
          name: campaign.name,
          countryCode: campaign.countryCode,
          status: campaign.status,
          total: preview.summary.total,
          pending: preview.summary.pending,
          connectionSent: preview.summary.connectionSent,
          connected: preview.summary.connected,
          messageSent: preview.summary.messageSent,
          replied: preview.summary.replied,
        });
      }
      return summaries;
    },
  };
}

export type LinkedInAssistantService = ReturnType<typeof createLinkedInAssistantService>;
