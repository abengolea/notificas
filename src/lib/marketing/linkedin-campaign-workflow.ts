import type {
  MarketingLinkedInAction,
  MarketingLinkedInCampaign,
  MarketingLinkedInCampaignMember,
  MarketingLinkedInMemberStatus,
} from "./domain/types";

export type LinkedInWorkBucket = "todo" | "pending" | "waiting" | "closed";

export type LinkedInPrepareActionKind = "connection" | "message" | "followup";

export type LinkedInOutreachFieldKey = "connectionMessage" | "message" | "followUpMessage";

export const LINKEDIN_OUTREACH_FIELD_LABEL: Record<LinkedInOutreachFieldKey, string> = {
  connectionMessage: "Solicitud de conexión",
  message: "Mensaje principal",
  followUpMessage: "Seguimiento",
};

const OUTREACH_FIELD_BY_KIND: Record<LinkedInPrepareActionKind, LinkedInOutreachFieldKey> = {
  connection: "connectionMessage",
  message: "message",
  followup: "followUpMessage",
};

export function linkedInPrimaryOutreachField(
  status: MarketingLinkedInMemberStatus,
): LinkedInOutreachFieldKey {
  const kind = linkedInActionKindForStatus(status);
  if (kind) return OUTREACH_FIELD_BY_KIND[kind];
  return "message";
}

const TODO_STATUSES = new Set<MarketingLinkedInMemberStatus>([
  "connection_ready",
  "message_ready",
  "follow_up_due",
  "connected",
]);

const WAITING_STATUSES = new Set<MarketingLinkedInMemberStatus>([
  "connection_sent",
  "message_sent",
  "follow_up_sent",
]);

const CLOSED_STATUSES = new Set<MarketingLinkedInMemberStatus>([
  "replied",
  "interested",
  "not_interested",
  "do_not_contact",
]);

const TODO_PRIORITY: Partial<Record<MarketingLinkedInMemberStatus, number>> = {
  follow_up_due: 1,
  message_ready: 2,
  connection_ready: 3,
  connected: 4,
};

export function linkedInWorkBucket(status: MarketingLinkedInMemberStatus): LinkedInWorkBucket {
  if (TODO_STATUSES.has(status)) return "todo";
  if (status === "not_contacted") return "pending";
  if (WAITING_STATUSES.has(status)) return "waiting";
  if (CLOSED_STATUSES.has(status)) return "closed";
  return "waiting";
}

export function linkedInActionKindForStatus(
  status: MarketingLinkedInMemberStatus,
): LinkedInPrepareActionKind | null {
  if (status === "connection_ready") return "connection";
  if (status === "message_ready" || status === "connected") return "message";
  if (status === "follow_up_due") return "followup";
  return null;
}

export function linkedInResolveOutreachMessage(
  member: MarketingLinkedInCampaignMember,
  campaign: MarketingLinkedInCampaign,
  kind: LinkedInPrepareActionKind,
): string | null {
  if (kind === "connection") {
    return member.connectionMessage ?? campaign.connectionMessage ?? null;
  }
  if (kind === "message") {
    return member.message ?? campaign.message ?? null;
  }
  return member.followUpMessage ?? campaign.followUpMessage ?? null;
}

export function linkedInCompleteActionForMember(
  status: MarketingLinkedInMemberStatus,
): MarketingLinkedInAction | null {
  if (status === "connection_ready") return "connection_sent";
  if (status === "message_ready" || status === "connected") return "message_sent";
  if (status === "follow_up_due") return "followup_sent";
  return null;
}

export function sortLinkedInCampaignMembersForWork(
  members: MarketingLinkedInCampaignMember[],
): MarketingLinkedInCampaignMember[] {
  const bucketOrder: Record<LinkedInWorkBucket, number> = {
    todo: 0,
    pending: 1,
    waiting: 2,
    closed: 3,
  };
  return [...members].sort((a, b) => {
    const bucketDiff = bucketOrder[linkedInWorkBucket(a.status)] - bucketOrder[linkedInWorkBucket(b.status)];
    if (bucketDiff !== 0) return bucketDiff;
    const prioA = TODO_PRIORITY[a.status] ?? 50;
    const prioB = TODO_PRIORITY[b.status] ?? 50;
    if (linkedInWorkBucket(a.status) === "todo" && prioA !== prioB) return prioA - prioB;
    return (a.updatedAt || "").localeCompare(b.updatedAt || "");
  });
}

export function buildLinkedInPreparePayload(
  member: MarketingLinkedInCampaignMember,
  campaign: MarketingLinkedInCampaign,
) {
  const kind = linkedInActionKindForStatus(member.status);
  if (!kind) return null;
  const name =
    member.firstName?.trim() ||
    member.jobTitle?.trim() ||
    "Contacto";
  const action = {
    memberId: member.id,
    campaignId: campaign.id,
    action: kind,
    message: linkedInResolveOutreachMessage(member, campaign, kind),
    contact: {
      name,
      firstName: member.firstName ?? null,
      title: member.jobTitle ?? null,
      companyName: member.companyName ?? null,
      linkedinUrl: member.linkedinUrl,
    },
  };
  return {
    memberId: member.id,
    campaignId: campaign.id,
    action,
  };
}
