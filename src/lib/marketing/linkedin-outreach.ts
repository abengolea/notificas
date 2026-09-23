import type { MarketingLinkedInAction, MarketingLinkedInMemberStatus } from "./domain/types";

/** ChatGPT / extension aliases → stored member status. The CRM model is not duplicated. */
const STATUS_ALIASES: Record<string, MarketingLinkedInMemberStatus> = {
  pending: "not_contacted",
  invitation_prepared: "connection_ready",
  invitation_sent: "connection_sent",
  message_prepared: "message_ready",
  skipped: "do_not_contact",
};

const ACTION_ALIASES: Record<string, MarketingLinkedInAction> = {
  invitation_sent: "connection_sent",
  follow_up_sent: "followup_sent",
};

const ACTION_FOR_STATUS: Partial<Record<MarketingLinkedInMemberStatus, MarketingLinkedInAction>> = {
  connection_sent: "connection_sent",
  connected: "connected",
  message_sent: "message_sent",
  follow_up_sent: "followup_sent",
  replied: "replied",
  interested: "interested",
  not_interested: "not_interested",
};

export const LINKEDIN_OUTREACH_STATUS_INPUTS = [
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
] as const;

export const LINKEDIN_OUTREACH_ACTION_INPUTS = [
  "connection_sent",
  "connected",
  "message_sent",
  "followup_sent",
  "follow_up_sent",
  "replied",
  "interested",
  "not_interested",
  "invitation_sent",
] as const;

export function canonicalizeLinkedInMemberStatus(
  value: string | undefined,
): MarketingLinkedInMemberStatus | undefined {
  if (!value) return undefined;
  if (STATUS_ALIASES[value]) return STATUS_ALIASES[value];
  return value as MarketingLinkedInMemberStatus;
}

export function canonicalizeLinkedInAction(value: string | undefined): MarketingLinkedInAction | undefined {
  if (!value) return undefined;
  if (ACTION_ALIASES[value]) return ACTION_ALIASES[value];
  return value as MarketingLinkedInAction;
}

export function linkedInActionForStatus(
  status: MarketingLinkedInMemberStatus,
): MarketingLinkedInAction | undefined {
  return ACTION_FOR_STATUS[status];
}

export function linkedInOutreachView<T extends { status?: string; message?: string }>(row: T) {
  const { message, status, ...rest } = row;
  const canonical = canonicalizeLinkedInMemberStatus(status) || status;
  return {
    ...rest,
    status: canonical,
    statusAlias:
      canonical === "not_contacted"
        ? "pending"
        : canonical === "connection_ready"
          ? "invitation_prepared"
          : canonical === "connection_sent"
            ? "invitation_sent"
            : canonical === "message_ready"
              ? "message_prepared"
              : canonical,
    invitationMessage: (row as { connectionMessage?: string }).connectionMessage || null,
    directMessage: message || null,
    automated: false,
  };
}
