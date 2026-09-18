/**
 * Instante en la capa de dominio / JSON.
 * Firestore persiste Timestamp; las APIs actuales serializan a ISO-8601 UTC.
 * Ver docs/crm/DATA_MODEL.md.
 */
export type MarketingInstant = string;

export type MarketingEntityBase = {
  id: string;
  workspaceId: string;
  createdAt: MarketingInstant;
  updatedAt: MarketingInstant;
  createdBy?: string;
  updatedBy?: string;
};

export type MarketingSoftDelete = {
  deletedAt?: MarketingInstant | null;
  deletedBy?: string | null;
};

export type MarketingCompanySize = "micro" | "small" | "medium" | "large" | "enterprise";
export type MarketingPriority = "low" | "normal" | "high";
export type MarketingCompanyStatus = "active" | "inactive";
export type MarketingListKind = "static" | "dynamic";
export type MarketingTaskStatus = "open" | "completed" | "cancelled";
export type MarketingOpportunityStatus = "open" | "won" | "lost" | "paused";
export type MarketingActorType = "user" | "system" | "ai";
export type MarketingDuplicateEntityType = "company" | "contact";
export type MarketingDuplicateMatchType = "exact" | "probable" | "possible";
export type MarketingDuplicateStatus = "pending" | "merged" | "dismissed";
export type MarketingTemplateChannel = "email";

export type MarketingSourceType =
  | "ai_research"
  | "web"
  | "linkedin"
  | "event"
  | "referral"
  | "csv"
  | "manual"
  | "website"
  | "association"
  | "other";

export type MarketingActivityType =
  | "contact_created"
  | "company_created"
  | "note_added"
  | "email_sent"
  | "email_delivered"
  | "email_opened"
  | "email_clicked"
  | "email_replied"
  | "call"
  | "meeting"
  | "demo"
  | "status_changed"
  | "follow_up_created"
  | "follow_up_completed"
  | "system_event"
  | "ai_event";

export type MarketingTaskType =
  | "call"
  | "email"
  | "research"
  | "meeting"
  | "demo"
  | "follow_up"
  | "proposal"
  | "data_completion"
  | "other";

export type MarketingTaskSource = "manual" | "system" | "ai";

export type MarketingMessageSnapshot = {
  subject?: string;
  html?: string;
  text?: string;
  version?: number;
};

export type MarketingCompany = MarketingEntityBase &
  MarketingSoftDelete & {
    name: string;
    normalizedName: string;
    legalName?: string;
    website?: string;
    normalizedDomain?: string;
    countryCode?: string;
    state?: string;
    city?: string;
    industryIds: string[];
    subIndustryIds?: string[];
    useCaseIds: string[];
    organizationTypeId?: string;
    size?: MarketingCompanySize;
    employees?: number;
    generalEmail?: string;
    phone?: string;
    linkedin?: string;
    sourceIds: string[];
    tagIds: string[];
    commercialStageId?: string;
    priority?: MarketingPriority;
    ownerId?: string;
    firstContactAt?: MarketingInstant;
    lastContactAt?: MarketingInstant;
    nextFollowUpAt?: MarketingInstant;
    notes?: string;
    status: MarketingCompanyStatus;
  };

export type MarketingCountry = MarketingEntityBase & {
  /** Identidad lógica = ISO-2. Coincide con `code`. */
  key: string;
  code: string;
  name: string;
  defaultLanguage?: string;
  active: boolean;
};

export type MarketingIndustry = MarketingEntityBase & {
  /** Identidad lógica estable (`utilities`). El `id` de documento es un hash determinista. */
  key: string;
  name: string;
  normalizedName: string;
  /** FK interna al documento padre (hash), no al key. */
  parentIndustryId?: string;
  active: boolean;
};

export type MarketingUseCase = MarketingEntityBase & {
  key: string;
  name: string;
  description?: string;
  /** Keys de industria (`seguros`, `gas`), no hashes de documento. */
  industryIds: string[];
  /**
   * ISO-2. `[]` significa global / no restringido.
   * El campo `appliesToAllCountries` materializa ese contrato para no ambiguar.
   */
  countryCodes: string[];
  appliesToAllCountries: boolean;
  tagIds?: string[];
  active: boolean;
};

export type MarketingSource = Omit<MarketingEntityBase, "updatedBy"> & {
  type: MarketingSourceType;
  name?: string;
  description?: string;
  url?: string;
  metadata?: Record<string, unknown>;
};

export type MarketingTag = MarketingEntityBase & {
  key: string;
  name: string;
  normalizedName: string;
  active: boolean;
};

export type MarketingListMembership = {
  id: string;
  workspaceId: string;
  listId: string;
  contactId: string;
  addedAt: MarketingInstant;
  addedBy?: string;
  source?: string;
};

export type MarketingMessageTemplate = MarketingEntityBase &
  MarketingSoftDelete & {
    name: string;
    channel: MarketingTemplateChannel;
    countryCodes: string[];
    industryIds: string[];
    useCaseIds: string[];
    language: string;
    currentVersion: number;
    active: boolean;
  };

export type MarketingMessageTemplateVersion = {
  id: string;
  workspaceId: string;
  templateId: string;
  version: number;
  subject?: string;
  html?: string;
  text?: string;
  createdAt: MarketingInstant;
  createdBy?: string;
};

export type MarketingActivity = {
  id: string;
  workspaceId: string;
  type: MarketingActivityType;
  companyId?: string;
  contactId?: string;
  opportunityId?: string;
  campaignId?: string;
  actorType: MarketingActorType;
  actorId?: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: MarketingInstant;
};

export type MarketingOpportunity = MarketingEntityBase &
  MarketingSoftDelete & {
    name: string;
    companyId: string;
    contactIds: string[];
    countryCode?: string;
    industryId?: string;
    useCaseId?: string;
    commercialStageId: string;
    ownerId?: string;
    estimatedValue?: number;
    currency?: string;
    nextStep?: string;
    nextActionAt?: MarketingInstant;
    notes?: string;
    status: MarketingOpportunityStatus;
  };

export type MarketingTask = {
  id: string;
  workspaceId: string;
  type: MarketingTaskType;
  title: string;
  description?: string;
  companyId?: string;
  contactId?: string;
  opportunityId?: string;
  assignedTo?: string;
  dueAt?: MarketingInstant;
  priority: MarketingPriority;
  status: MarketingTaskStatus;
  source?: MarketingTaskSource;
  createdAt: MarketingInstant;
  updatedAt: MarketingInstant;
  createdBy?: string;
  completedAt?: MarketingInstant;
  completedBy?: string;
};

export type MarketingCommercialStage = {
  id: string;
  workspaceId: string;
  name: string;
  order: number;
  active: boolean;
  isWon?: boolean;
  isLost?: boolean;
};

export type MarketingDuplicateCandidate = {
  id: string;
  workspaceId: string;
  entityType: MarketingDuplicateEntityType;
  sourceId: string;
  candidateId: string;
  matchType: MarketingDuplicateMatchType;
  reasons: string[];
  status: MarketingDuplicateStatus;
  createdAt: MarketingInstant;
  reviewedAt?: MarketingInstant;
  reviewedBy?: string;
};

export type MarketingSavedSearch = MarketingEntityBase & {
  name: string;
  entityType: "company" | "contact" | "opportunity" | "campaign";
  filters: Record<string, unknown>;
};

export type MarketingStats = {
  id: string;
  workspaceId: string;
  scope: string;
  countryCode?: string;
  industryId?: string;
  useCaseId?: string;
  counters: Record<string, number>;
  updatedAt: MarketingInstant;
};

/** Campos v2 opcionales sobre el contacto actual. `stage` sigue siendo solo engagement de email. */
export type MarketingContactV2Fields = {
  workspaceId?: string;
  companyId?: string;
  countryCode?: string;
  normalizedEmail?: string;
  useCaseIds?: string[];
  tagIds?: string[];
  sourceIds?: string[];
  commercialStageId?: string;
  ownerId?: string;
  firstContactAt?: MarketingInstant | null;
  lastContactAt?: MarketingInstant | null;
  nextFollowUpAt?: MarketingInstant | null;
  doNotContact?: boolean;
  unsubscribed?: boolean;
  bounced?: boolean;
  deletedAt?: MarketingInstant | null;
  deletedBy?: string | null;
  createdBy?: string;
  updatedBy?: string;
};

export type MarketingCampaignV2Fields = {
  workspaceId?: string;
  templateId?: string;
  templateVersion?: number;
  templateSnapshot?: MarketingMessageSnapshot;
  industryIds?: string[];
  useCaseIds?: string[];
  createdBy?: string;
  updatedBy?: string;
};

export type MarketingSendV2Fields = {
  workspaceId?: string;
  companyId?: string;
  provider?: string;
  messageSnapshot?: MarketingMessageSnapshot;
};

export type MarketingListV2Fields = {
  workspaceId?: string;
  type?: MarketingListKind;
  rules?: Record<string, unknown>;
};
