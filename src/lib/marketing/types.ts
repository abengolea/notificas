import type { MarketingCountryCode } from "./countries";
import type {
  MarketingCampaignV2Fields,
  MarketingContactV2Fields,
  MarketingListV2Fields,
  MarketingSendV2Fields,
} from "./domain/types";
import type { MarketingStage } from "./stages";

export const MARKETING_FROM_EMAIL_DEFAULT = "contacto@notificas.com.ar";
export const MARKETING_CONTACT_EMAIL_DEFAULT = "contacto@notificas.com";
export const MARKETING_FROM_NAME_DEFAULT = "Notificas";
export const MARKETING_REPLY_TO_DEFAULT = "adrianbengolea@notificas.com";
export const MARKETING_GMAIL_EMAIL_DEFAULT = "adrianbengolea@notificas.com";

export type MarketingCampaignStatus = "draft" | "sending" | "paused" | "sent" | "cancelled";

export type MarketingSendStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "replied"
  | "bounced"
  | "failed"
  | "unsubscribed";

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
  /** Ciclo de engagement de email. Nunca pipeline comercial. */
  stage: MarketingStage;
  stageManual: boolean;
  tags: string[];
  source: "csv" | "manual";
  listIds: string[];
  lastCampaignId: string | null;
  lastSendId: string | null;
  lastSentAt: string | null;
  lastOpenedAt: string | null;
  lastClickedAt: string | null;
  lastRepliedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
} & MarketingContactV2Fields;

export type MarketingCampaignStats = {
  queued: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  failed: number;
  unsubscribed: number;
};

export type MarketingList = {
  id: string;
  name: string;
  country: MarketingCountryCode | "all";
  contactCount: number;
  source: "csv" | "manual";
  virtual?: boolean;
} & MarketingListV2Fields;

export type MarketingCampaign = {
  id: string;
  name: string;
  country: MarketingCountryCode | "all";
  listId: string | null;
  listName: string;
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
  archivedAt: string | null;
  copiedFromId?: string | null;
} & MarketingCampaignV2Fields;

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
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  repliedAt: string | null;
  bouncedAt: string | null;
  createdAt: string | null;
} & MarketingSendV2Fields;

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
    delivered: 0,
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

export function marketingContactEmail(): string {
  return (process.env.MARKETING_CONTACT_EMAIL || MARKETING_CONTACT_EMAIL_DEFAULT).trim().toLowerCase();
}

export function marketingFromName(): string {
  return (process.env.MARKETING_FROM_NAME || MARKETING_FROM_NAME_DEFAULT).trim();
}

export function marketingReplyTo(): string {
  return (process.env.MARKETING_REPLY_TO || MARKETING_REPLY_TO_DEFAULT).trim().toLowerCase();
}

export function marketingGmailEmail(): string {
  return (process.env.MARKETING_GMAIL_EMAIL || MARKETING_GMAIL_EMAIL_DEFAULT).trim().toLowerCase();
}

export function marketingFromHeader(): string {
  return `${marketingFromName()} <${marketingFromEmail()}>`;
}
