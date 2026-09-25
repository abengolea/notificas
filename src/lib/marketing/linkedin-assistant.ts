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
import { LINKEDIN_CAMPAIGN_STATUS_LABEL, LINKEDIN_MEMBER_STATUS_LABEL } from "./linkedin-ui";
import { normalizeLinkedInUrl, normalizeMarketingCountryCode } from "./normalizers";
import { nowIso } from "./persistence/timestamps";
import type {
  MarketingActivityRepository,
  MarketingContactRecord,
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
    "replied",
    "interested",
    "not_interested",
  ]),
  at: z.string().datetime().optional(),
  nextActionAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(8000).optional(),
});

const contactPatchSchema = z.object({
  name: z.string().max(200).optional(),
  title: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  notes: z.string().max(8000).optional(),
  linkedinNotes: z.string().max(8000).optional(),
  linkedinUrl: z.string().max(500).optional(),
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

export type LinkedInAssistantContactView = {
  id: string;
  name: string | null;
  title: string | null;
  companyName: string | null;
  email: string | null;
  linkedinUrl: string | null;
  linkedinStatus: string | null;
  linkedinLastContactAt: string | null;
  linkedinNextActionAt: string | null;
};

export type LinkedInAssistantMembershipView = {
  memberId: string;
  campaignId: string;
  campaignName: string;
  campaignStatus: MarketingLinkedInCampaign["status"];
  campaignStatusLabel: string;
  status: MarketingLinkedInMemberStatus;
  statusLabel: string;
  nextActionAt: string | null;
  connectionMessage: string | null;
  message: string | null;
  followUpMessage: string | null;
  updatedAt: string | null;
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

function contactView(contact: MarketingContactRecord): LinkedInAssistantContactView {
  return {
    id: contact.id,
    name: contact.name || null,
    title: contact.title || null,
    companyName: contact.company || null,
    email: contact.email || null,
    linkedinUrl: contact.linkedinUrl || null,
    linkedinStatus: contact.linkedinStatus || null,
    linkedinLastContactAt: contact.linkedinLastContactAt || null,
    linkedinNextActionAt: contact.linkedinNextActionAt || null,
  };
}

function contactName(member: MarketingLinkedInCampaignMember, contact?: { name?: string } | null): string {
  if (contact?.name?.trim()) return contact.name.trim();
  if (member.firstName?.trim()) return member.firstName.trim();
  return "Contacto";
}

function isCampaignEligible(campaign: MarketingLinkedInCampaign): boolean {
  return campaign.status !== "archived" && !campaign.archivedAt;
}

/** Campañas que la extensión puede operar: draft y active. */
export function isLinkedInCampaignOperable(campaign: MarketingLinkedInCampaign): boolean {
  if (!isCampaignEligible(campaign)) return false;
  return campaign.status === "draft" || campaign.status === "active";
}

function campaignWorkPriority(status: MarketingLinkedInCampaign["status"]): number {
  if (status === "active") return 0;
  if (status === "draft") return 1;
  return 9;
}

function sortMemberships(items: LinkedInAssistantMembershipView[]): LinkedInAssistantMembershipView[] {
  return [...items].sort((a, b) => {
    const priority = campaignWorkPriority(a.campaignStatus) - campaignWorkPriority(b.campaignStatus);
    if (priority !== 0) return priority;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });
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
      if (!isLinkedInCampaignOperable(campaign)) return new Map<string, MarketingLinkedInCampaign>();
      return new Map([[campaign.id, campaign]]);
    }
    const page = await deps.linkedIn.searchCampaigns(ctx, {
      archived: "exclude",
      limit: 200,
      countryCode,
    });
    const map = new Map<string, MarketingLinkedInCampaign>();
    for (const campaign of page.items) {
      if (isLinkedInCampaignOperable(campaign)) {
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
        if (!isLinkedInCampaignOperable(campaign)) continue;
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

    async listCampaignMembers(ctx: MarketingServiceContext, campaignId: string) {
      const campaign = await deps.linkedIn.getCampaign(ctx, campaignId);
      if (!isCampaignEligible(campaign)) {
        throw new MarketingNotFoundError("Campaña LinkedIn", campaignId);
      }
      const members = await deps.members.listAllForCampaign(ctx.workspaceId, campaignId);
      const items = [];
      for (const member of members) {
        const contact = await deps.contacts.getById(member.contactId);
        items.push({
          memberId: member.id,
          campaignId: campaign.id,
          contactId: member.contactId,
          status: member.status,
          statusLabel: LINKEDIN_MEMBER_STATUS_LABEL[member.status],
          nextActionAt: member.nextActionAt ?? null,
          lastActionAt: member.updatedAt ?? null,
          contact: {
            name: contactName(member, contact),
            title: member.jobTitle || contact?.title || null,
            companyName: member.companyName || contact?.company || null,
            linkedinUrl: member.linkedinUrl,
          },
          messages: {
            connection: member.connectionMessage ?? campaign.connectionMessage ?? null,
            message: member.message ?? campaign.message ?? null,
            followUp: member.followUpMessage ?? campaign.followUpMessage ?? null,
          },
        });
      }
      return { campaign: { id: campaign.id, name: campaign.name, status: campaign.status }, members: items };
    },

    async lookupByLinkedInUrl(ctx: MarketingServiceContext, rawUrl: string) {
      const linkedinUrl = normalizeLinkedInUrl(rawUrl);
      if (!linkedinUrl) throw new MarketingValidationError("URL de LinkedIn inválida");
      const contact = await deps.contacts.getByLinkedInUrl(ctx.workspaceId, linkedinUrl);
      if (!contact || contact.deletedAt) {
        return { contact: null, memberships: [], linkedinUrl };
      }

      const outreach = await deps.linkedIn.listOutreach(ctx, { contactId: contact.id, limit: 200 });
      const memberships: LinkedInAssistantMembershipView[] = [];
      for (const member of outreach.items) {
        const campaign = await deps.linkedIn.getCampaign(ctx, member.campaignId);
        if (!isLinkedInCampaignOperable(campaign)) continue;
        memberships.push({
          memberId: member.id,
          campaignId: campaign.id,
          campaignName: campaign.name,
          campaignStatus: campaign.status,
          campaignStatusLabel: LINKEDIN_CAMPAIGN_STATUS_LABEL[campaign.status],
          status: member.status,
          statusLabel: member.status === "connection_ready"
            ? "Listo para conexión"
            : LINKEDIN_MEMBER_STATUS_LABEL[member.status],
          nextActionAt: member.nextActionAt ?? null,
          connectionMessage: member.connectionMessage ?? campaign.connectionMessage ?? null,
          message: member.message ?? campaign.message ?? null,
          followUpMessage: member.followUpMessage ?? campaign.followUpMessage ?? null,
          updatedAt: member.updatedAt ?? campaign.updatedAt ?? null,
        });
      }

      return {
        contact: contactView(contact),
        memberships: sortMemberships(memberships),
        linkedinUrl,
      };
    },

    async getContact(ctx: MarketingServiceContext, contactId: string) {
      const contact = await deps.contacts.getById(contactId);
      if (!contact || contact.workspaceId !== ctx.workspaceId || contact.deletedAt) {
        throw new MarketingNotFoundError("Contacto", contactId);
      }
      return contactView(contact);
    },

    async updateAllowedContact(
      ctx: MarketingServiceContext,
      contactId: string,
      input: z.input<typeof contactPatchSchema>,
    ) {
      const parsed = contactPatchSchema.safeParse(input);
      if (!parsed.success) {
        throw new MarketingValidationError("Datos de contacto inválidos", parsed.error.flatten());
      }
      const current = await deps.contacts.getById(contactId);
      if (!current || current.workspaceId !== ctx.workspaceId || current.deletedAt) {
        throw new MarketingNotFoundError("Contacto", contactId);
      }
      const patch: Partial<MarketingContactRecord> = {
        ...updateStamps(ctx),
      };
      if (parsed.data.name !== undefined) patch.name = parsed.data.name.trim();
      if (parsed.data.title !== undefined) patch.title = parsed.data.title.trim();
      if (parsed.data.company !== undefined) patch.company = parsed.data.company.trim();
      if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes.trim();
      if (parsed.data.linkedinNotes !== undefined) patch.linkedinNotes = parsed.data.linkedinNotes.trim();
      if (parsed.data.linkedinUrl !== undefined) {
        const linkedinUrl = normalizeLinkedInUrl(parsed.data.linkedinUrl);
        if (!linkedinUrl) throw new MarketingValidationError("URL de LinkedIn inválida");
        const duplicate = await deps.contacts.getByLinkedInUrl(ctx.workspaceId, linkedinUrl);
        if (duplicate && duplicate.id !== contactId) {
          throw new MarketingValidationError("linkedinUrl ya pertenece a otro contacto");
        }
        patch.linkedinUrl = linkedinUrl;
      }
      await deps.contacts.update(contactId, patch);
      const updated = await deps.contacts.getById(contactId);
      if (!updated) throw new MarketingNotFoundError("Contacto", contactId);
      return contactView(updated);
    },

    async searchContacts(ctx: MarketingServiceContext, query: string) {
      const q = query.trim();
      if (!q) return { contacts: [] };
      const normalizedUrl = normalizeLinkedInUrl(q);
      if (normalizedUrl) {
        const found = await deps.contacts.getByLinkedInUrl(ctx.workspaceId, normalizedUrl);
        return { contacts: found && !found.deletedAt ? [contactView(found)] : [] };
      }
      const page = await deps.contacts.search(ctx.workspaceId, { query: q, limit: 20 });
      return {
        contacts: page.items.filter((contact) => !contact.deletedAt).map(contactView),
      };
    },
  };
}

export type LinkedInAssistantService = ReturnType<typeof createLinkedInAssistantService>;
