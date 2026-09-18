import { canonicalIndustryKey, canonicalUseCaseKey, parseCatalogKeyList } from "./taxonomy/seed";
import { isMarketingCountryCode } from "./countries";
import { isMarketingStage, STAGE_LABEL } from "./stages";

export const CAMPAIGN_STATUSES = ["draft", "sending", "paused", "sent", "cancelled"] as const;
export type CampaignAdminStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABEL: Record<CampaignAdminStatus, string> = {
  draft: "Borrador",
  sending: "Enviando",
  paused: "Pausada",
  sent: "Enviada",
  cancelled: "Cancelada",
};

export const CAMPAIGN_OUTCOMES = [
  "unsent",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "replied",
  "bounced",
  "failed",
  "unsubscribed",
] as const;
export type CampaignOutcome = (typeof CAMPAIGN_OUTCOMES)[number];

export const CAMPAIGN_OUTCOME_LABEL: Record<CampaignOutcome, string> = {
  unsent: "Sin envíos",
  sent: "Con envíos",
  delivered: "Recibidos",
  opened: "Abiertos",
  clicked: "Con clics",
  replied: "Con respuestas",
  bounced: "Con rebotes",
  failed: "Con errores",
  unsubscribed: "Bajas",
};

export const AUDIENCE_KINDS = ["crm", "list"] as const;
export const AUDIENCE_KIND_LABEL: Record<(typeof AUDIENCE_KINDS)[number], string> = {
  crm: "Empresas del CRM",
  list: "CSV / lista",
};

export const CAMPAIGN_ARCHIVED_FILTERS = ["hide", "only", "all"] as const;
export type CampaignArchivedFilter = (typeof CAMPAIGN_ARCHIVED_FILTERS)[number];

export const CAMPAIGN_ARCHIVED_LABEL: Record<CampaignArchivedFilter, string> = {
  hide: "Activas",
  only: "Archivadas",
  all: "Activas y archivadas",
};

export type CampaignAdminFilters = {
  q?: string;
  country?: string;
  industryId?: string;
  useCaseId?: string;
  useCaseIds?: string[];
  status?: string;
  outcome?: string;
  audienceKind?: string;
  listId?: string;
  stage?: string;
  archived?: string;
};

export type CampaignFilterable = {
  name?: unknown;
  subject?: unknown;
  listName?: unknown;
  listId?: unknown;
  country?: unknown;
  industryId?: unknown;
  industryIds?: unknown;
  useCaseId?: unknown;
  useCaseIds?: unknown;
  includeStages?: unknown;
  status?: unknown;
  archivedAt?: unknown;
  audienceKind?: unknown;
  stats?: {
    queued?: number;
    sent?: number;
    delivered?: number;
    opened?: number;
    clicked?: number;
    replied?: number;
    bounced?: number;
    failed?: number;
    unsubscribed?: number;
  } | null;
};

function asText(value: unknown): string {
  return String(value || "").trim();
}

function campaignIndustry(camp: CampaignFilterable): string {
  const singular = asText(camp.industryId);
  if (singular) return canonicalIndustryKey(singular);
  const list = Array.isArray(camp.industryIds) ? camp.industryIds.map(String) : [];
  return list[0] ? canonicalIndustryKey(list[0]) : "";
}

function campaignUseCases(camp: CampaignFilterable): string[] {
  const list = Array.isArray(camp.useCaseIds) ? camp.useCaseIds.map(String) : [];
  const singular = asText(camp.useCaseId);
  return [...new Set([singular, ...list].filter(Boolean).map(canonicalUseCaseKey))];
}

function stat(camp: CampaignFilterable, key: NonNullable<keyof NonNullable<CampaignFilterable["stats"]>>): number {
  const value = camp.stats?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function isCampaignAdminStatus(value: string): value is CampaignAdminStatus {
  return (CAMPAIGN_STATUSES as readonly string[]).includes(value);
}

export function isCampaignOutcome(value: string): value is CampaignOutcome {
  return (CAMPAIGN_OUTCOMES as readonly string[]).includes(value);
}

export type ContactEngagementFilterable = {
  stage?: unknown;
  lastSentAt?: unknown;
  lastOpenedAt?: unknown;
  lastClickedAt?: unknown;
  lastRepliedAt?: unknown;
  lastUnsubscribedAt?: unknown;
};

export type SendOutcomeFilterable = {
  status?: unknown;
  sentAt?: unknown;
  deliveredAt?: unknown;
  openedAt?: unknown;
  clickedAt?: unknown;
  repliedAt?: unknown;
  lastError?: unknown;
};

function hasTimestamp(value: unknown): boolean {
  return Boolean(asText(value));
}

export function contactMatchesOutcome(contact: ContactEngagementFilterable, outcome?: string): boolean {
  const key = asText(outcome);
  if (!key || key === "all" || !isCampaignOutcome(key)) return true;
  const stage = asText(contact.stage);
  if (key === "unsent") {
    return !hasTimestamp(contact.lastSentAt) && stage !== "queued" && stage !== "sent" && stage !== "opened" && stage !== "clicked" && stage !== "replied";
  }
  if (key === "sent") {
    return hasTimestamp(contact.lastSentAt) || stage === "queued" || stage === "sent" || stage === "opened" || stage === "clicked" || stage === "replied";
  }
  if (key === "delivered") {
    return hasTimestamp(contact.lastSentAt) && stage !== "bounced" && stage !== "failed";
  }
  if (key === "opened") return hasTimestamp(contact.lastOpenedAt) || stage === "opened" || stage === "clicked" || stage === "replied";
  if (key === "clicked") return hasTimestamp(contact.lastClickedAt) || stage === "clicked" || stage === "replied";
  if (key === "replied") return hasTimestamp(contact.lastRepliedAt) || stage === "replied";
  if (key === "bounced") return stage === "bounced";
  if (key === "failed") return stage === "bounced";
  if (key === "unsubscribed") return stage === "unsubscribed" || hasTimestamp(contact.lastUnsubscribedAt);
  return true;
}

export function sendMatchesOutcome(send: SendOutcomeFilterable, outcome?: string): boolean {
  const key = asText(outcome);
  if (!key || key === "all" || !isCampaignOutcome(key)) return true;
  const status = asText(send.status);
  if (key === "unsent") return !hasTimestamp(send.sentAt) && status !== "sent" && status !== "delivered";
  if (key === "sent") return hasTimestamp(send.sentAt) || status === "sent" || status === "delivered";
  if (key === "delivered") return hasTimestamp(send.deliveredAt);
  if (key === "opened") return hasTimestamp(send.openedAt);
  if (key === "clicked") return hasTimestamp(send.clickedAt);
  if (key === "replied") return hasTimestamp(send.repliedAt);
  if (key === "bounced") return status === "bounced";
  if (key === "failed") return status === "failed" || Boolean(asText(send.lastError));
  if (key === "unsubscribed") return status === "unsubscribed";
  return true;
}

export function campaignMatchesAdminFilters(camp: CampaignFilterable, filters: CampaignAdminFilters): boolean {
  const q = asText(filters.q).toLowerCase();
  if (q) {
    const blob = `${asText(camp.name)} ${asText(camp.subject)} ${asText(camp.listName)}`.toLowerCase();
    if (!blob.includes(q)) return false;
  }
  const country = asText(filters.country).toUpperCase();
  if (country && country !== "ALL" && isMarketingCountryCode(country)) {
    if (asText(camp.country).toUpperCase() !== country) return false;
  }
  const industryId = asText(filters.industryId);
  if (industryId && industryId !== "all") {
    if (campaignIndustry(camp) !== canonicalIndustryKey(industryId)) return false;
  }
  const useCaseIds = parseCatalogKeyList(filters.useCaseIds?.length ? filters.useCaseIds : filters.useCaseId).map(canonicalUseCaseKey);
  if (useCaseIds.length) {
    const have = campaignUseCases(camp);
    if (!useCaseIds.some((key) => have.includes(key))) return false;
  }
  const status = asText(filters.status);
  if (status && status !== "all" && isCampaignAdminStatus(status)) {
    if (asText(camp.status) !== status) return false;
  }
  const audienceKind = asText(filters.audienceKind);
  if (audienceKind && audienceKind !== "all") {
    if (asText(camp.audienceKind || "list") !== audienceKind) return false;
  }
  const listId = asText(filters.listId);
  if (listId && listId !== "all") {
    if (asText(camp.listId) !== listId) return false;
  }
  const stage = asText(filters.stage);
  if (stage && stage !== "all" && isMarketingStage(stage)) {
    const included = Array.isArray(camp.includeStages)
      ? camp.includeStages.map(String).filter(Boolean)
      : [];
    if (included.length === 0) {
      if (stage !== "new") return false;
    } else if (!included.includes(stage)) {
      return false;
    }
  }
  const archivedFilter = asText(filters.archived) || "hide";
  const archived = Boolean(camp.archivedAt);
  if (archivedFilter === "hide" && archived) return false;
  if (archivedFilter === "only" && !archived) return false;
  const outcome = asText(filters.outcome);
  if (outcome && outcome !== "all" && isCampaignOutcome(outcome)) {
    if (outcome === "unsent") {
      if (asText(camp.status) === "sent" || stat(camp, "sent") > 0) return false;
    } else if (stat(camp, outcome === "sent" ? "sent" : outcome) <= 0) {
      return false;
    }
  }
  return true;
}

export function parseAdminFilterValue(value: string | null | undefined): string {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed === "all") return "";
  return trimmed;
}

export { STAGE_LABEL, isMarketingStage };
