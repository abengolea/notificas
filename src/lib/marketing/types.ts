import type { MarketingCountryCode } from "./countries";
import type { MarketingStage } from "./stages";

export const MARKETING_FROM_EMAIL_DEFAULT = "adrianbengolea@notificas.com";
export const MARKETING_FROM_NAME_DEFAULT = "Adrian Bengolea";

export type MarketingCampaignStatus = "draft" | "sending" | "paused" | "sent" | "cancelled";

export type MarketingSendStatus =
  | "queued"
  | "sent"
  | "opened"
  | "clicked"
  | "replied"
  | "bounced"
  | "failed";

export type MarketingEventType =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "replied"
  | "bounced"
  | "failed"
  | "unsubscribed"
  | "complained";

export type MarketingContact = {
  id: string;
  email: string;
  emailKey: string;
  name: string;
  company: string;
  title: string;
  country: MarketingCountryCode;
  notes: string;
  stage: MarketingStage;
  stageManual: boolean;
  tags: string[];
  source: "csv" | "manual";
  lastCampaignId: string | null;
  lastSendId: string | null;
  lastSentAt: string | null;
  lastOpenedAt: string | null;
  lastClickedAt: string | null;
  lastRepliedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type MarketingCampaignStats = {
  queued: number;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  failed: number;
  unsubscribed: number;
};

export type MarketingCampaign = {
  id: string;
  name: string;
  country: MarketingCountryCode | "all";
  subject: string;
  htmlBody: string;
  textBody: string;
  fromEmail: string;
  fromName: string;
  status: MarketingCampaignStatus;
  includeStages: MarketingStage[];
  contactCount: number;
  stats: MarketingCampaignStats;
  createdAt: string | null;
  updatedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type MarketingSend = {
  id: string;
  campaignId: string;
  contactId: string;
  email: string;
  country: MarketingCountryCode;
  company: string;
  name: string;
  subject: string;
  status: MarketingSendStatus;
  resendEmailId: string | null;
  rfcMessageId: string | null;
  gmailThreadId: string | null;
  gmailMessageId: string | null;
  openCount: number;
  clickCount: number;
  replySnippet: string | null;
  lastError: string | null;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  repliedAt: string | null;
  bouncedAt: string | null;
  createdAt: string | null;
};

export type MarketingEvent = {
  id: string;
  sendId: string;
  campaignId: string;
  contactId: string;
  type: MarketingEventType;
  at: string;
  meta?: Record<string, unknown>;
};

export type CountryPipelineRow = {
  code: MarketingCountryCode | "all";
  name: string;
  total: number;
  stages: Record<MarketingStage, number>;
};

export function emptyCampaignStats(): MarketingCampaignStats {
  return {
    queued: 0,
    sent: 0,
    opened: 0,
    clicked: 0,
    replied: 0,
    bounced: 0,
    failed: 0,
    unsubscribed: 0,
  };
}

export function marketingFromEmail(): string {
  return (process.env.MARKETING_FROM_EMAIL || MARKETING_FROM_EMAIL_DEFAULT).trim().toLowerCase();
}

export function marketingFromName(): string {
  return (process.env.MARKETING_FROM_NAME || MARKETING_FROM_NAME_DEFAULT).trim();
}

export function marketingFromHeader(): string {
  return `${marketingFromName()} <${marketingFromEmail()}>`;
}
