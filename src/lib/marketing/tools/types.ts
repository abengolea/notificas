import type { MarketingServiceContext } from "../context";
import type { MarketingDuplicateWarning } from "../errors";
import type { MarketingServices } from "../services";

export const CRM_READ_TOOL_NAMES = [
  "search_companies",
  "get_company",
  "search_contacts",
  "get_contact",
  "search_campaigns",
  "get_campaign",
  "search_lists",
  "get_list",
  "search_templates",
  "get_template",
  "get_company_activity",
  "get_contact_activity",
  "get_pending_tasks",
  "get_crm_stats",
  "list_taxonomy",
  "search_opportunities",
  "get_opportunity",
  "preview_campaign",
  "search_linkedin_campaigns",
  "get_linkedin_campaign",
  "preview_linkedin_campaign",
  "search_linkedin_pending_actions",
  "get_linkedin_pending_actions",
] as const;

export const CRM_WRITE_TOOL_NAMES = [
  "create_company",
  "update_company",
  "create_contact",
  "update_contact",
  "create_task",
  "complete_task",
  "cancel_task",
  "create_list",
  "add_contact_to_list",
  "create_note",
  "create_opportunity",
  "update_opportunity",
  "create_campaign_draft",
  "update_campaign_draft",
  "copy_campaign",
  "archive_campaign",
  "restore_campaign",
  "pause_campaign",
  "resume_campaign",
  "create_linkedin_campaign_draft",
  "update_linkedin_campaign",
  "update_linkedin_campaign_draft",
  "add_contact_to_linkedin_campaign",
  "remove_contact_from_linkedin_campaign",
  "update_linkedin_campaign_member",
  "record_linkedin_action",
  "update_linkedin_outreach_status",
] as const;

export const CRM_FORBIDDEN_TOOL_NAMES = [
  "send_campaign",
  "send_email",
  "retry_failed_sends",
  "cancel_campaign",
  "schedule_campaign",
  "delete_company",
  "delete_contact",
  "bulk_delete",
  "bulk_write",
  "execute_crm_query",
  "merge_companies",
  "import_contacts_csv",
  "send_linkedin_message",
  "send_linkedin_campaign",
] as const;

export type CrmReadToolName = (typeof CRM_READ_TOOL_NAMES)[number];
export type CrmWriteToolName = (typeof CRM_WRITE_TOOL_NAMES)[number];
export type CrmToolName = CrmReadToolName | CrmWriteToolName;

export type CrmToolAccess = "read" | "write";

export type CrmToolContext = MarketingServiceContext & {
  /** Usuario interno que pidió la acción. Distinto del ejecutor técnico `actorId` AI. */
  userId?: string;
  conversationId?: string;
  requestId?: string;
};

export type CrmToolErrorBody = {
  code: string;
  message: string;
};

export type CrmToolSuccess = {
  ok: true;
  tool: CrmToolName;
  data: unknown;
  summary?: string;
  entityType?: string;
  entityIds?: string[];
  write: boolean;
  duplicateWarnings?: MarketingDuplicateWarning[];
  needsClarification?: boolean;
};

export type CrmToolFailure = {
  ok: false;
  tool?: string;
  error: CrmToolErrorBody;
  write: boolean;
};

export type CrmToolResult = CrmToolSuccess | CrmToolFailure;

export type CrmJsonSchema = Record<string, unknown>;

export type CrmToolDefinition = {
  name: CrmToolName;
  description: string;
  access: CrmToolAccess;
  inputSchema: CrmJsonSchema;
};

export type CampaignListSummary = {
  id: string;
  name: string;
  country: string;
  contactCount: number;
  source: string;
  virtual?: boolean;
};

export type CampaignSummary = {
  id: string;
  name: string;
  country: string;
  status: string;
  listId: string | null;
  listName: string;
  subject: string;
  contactCount: number;
  archivedAt?: string | null;
  stats?: Record<string, number>;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CampaignDetail = CampaignSummary & {
  includeStages?: string[];
  htmlPreview?: string;
  textPreview?: string;
  htmlBody?: string;
  archivedAt?: string | null;
  industryId?: string | null;
  useCaseIds?: string[];
  audience?: { total: number; eligible: number; skipped: number };
};

export type CampaignPreview = {
  campaignId: string;
  name: string;
  status: string;
  subject: string;
  htmlPreview: string;
  textPreview: string;
  sent: false;
  audience: {
    total: number;
    eligible: number;
    skipped: number;
    sample: Array<{ name: string; email: string }>;
  };
};

export type CampaignDraftInput = {
  name: string;
  listId?: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  country?: string;
  includeStages?: string[];
  industryId?: string;
  useCaseId?: string;
  useCaseIds?: string[];
};

export type CampaignDraftChanges = {
  name?: string;
  subject?: string;
  htmlBody?: string;
  textBody?: string;
  listId?: string;
  includeStages?: string[];
};

export type CampaignListCatalog = {
  searchCampaigns(input: {
    query?: string;
    countryCode?: string;
    status?: string;
    limit: number;
    cursor?: string;
  }): Promise<{ items: CampaignSummary[]; nextCursor?: string }>;
  getCampaign(id: string): Promise<CampaignDetail | null>;
  previewCampaign(id: string): Promise<CampaignPreview | null>;
  searchLists(input: {
    query?: string;
    limit: number;
    cursor?: string;
  }): Promise<{ items: CampaignListSummary[]; nextCursor?: string }>;
  getList(id: string): Promise<(CampaignListSummary & { sampleSize?: number }) | null>;
  createList(input: { name: string; country?: string }): Promise<CampaignListSummary>;
  createCampaignDraft(input: CampaignDraftInput): Promise<CampaignSummary>;
  updateCampaignDraft(id: string, changes: CampaignDraftChanges): Promise<CampaignSummary>;
  copyCampaign(id: string): Promise<CampaignSummary>;
  archiveCampaign(id: string): Promise<CampaignSummary>;
  restoreCampaign(id: string): Promise<CampaignSummary>;
  pauseCampaign(id: string): Promise<CampaignSummary>;
  resumeCampaign(id: string): Promise<CampaignSummary>;
  countCampaigns(): Promise<number>;
  countLists(): Promise<number>;
};

export type CrmCount = {
  count: number;
  truncated?: boolean;
};

export type CrmStatsPort = {
  countCompanies(workspaceId: string): Promise<CrmCount>;
  countContacts(workspaceId: string): Promise<CrmCount>;
  countPendingTasks(workspaceId: string): Promise<CrmCount>;
  countNewContacts(workspaceId: string): Promise<CrmCount>;
  countRepliedContacts(workspaceId: string): Promise<CrmCount>;
  countCountries(workspaceId: string): Promise<CrmCount>;
};

export type IdempotencyStore = {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
};

export type CrmToolRuntime = {
  services: MarketingServices;
  catalog: CampaignListCatalog;
  stats: CrmStatsPort;
  idempotency: IdempotencyStore;
};
