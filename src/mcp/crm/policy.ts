import { CRM_FORBIDDEN_TOOL_NAMES } from "@/lib/marketing/tools/types";
import { CRM_READ_TOOL_DEFINITIONS, CRM_WRITE_TOOL_DEFINITIONS } from "@/lib/marketing/tools/definitions";
import type { CrmMcpScope } from "./scopes";
import { crmMcpHasAnyScope } from "./scopes";

/** Any of these scopes is enough to call the tool. */
export const CRM_MCP_TOOL_SCOPES: Record<string, readonly CrmMcpScope[]> = {
  search_companies: ["crm:read"],
  get_company: ["crm:read"],
  search_contacts: ["crm:read"],
  get_contact: ["crm:read"],
  search_lists: ["crm:read"],
  get_list: ["crm:read"],
  search_templates: ["crm:read"],
  get_template: ["crm:read"],
  get_company_activity: ["crm:read"],
  get_contact_activity: ["crm:read"],
  get_pending_tasks: ["crm:read"],
  get_crm_stats: ["crm:read"],
  list_taxonomy: ["crm:read"],
  search_opportunities: ["crm:read"],
  get_opportunity: ["crm:read"],
  search_campaigns: ["crm:read", "campaigns:read"],
  get_campaign: ["crm:read", "campaigns:read"],
  preview_campaign: ["crm:read", "campaigns:read"],
  create_company: ["crm:write"],
  update_company: ["crm:write"],
  create_contact: ["crm:write"],
  update_contact: ["crm:write"],
  create_task: ["crm:write"],
  complete_task: ["crm:write"],
  cancel_task: ["crm:write"],
  create_note: ["crm:write"],
  create_opportunity: ["crm:write"],
  update_opportunity: ["crm:write"],
  create_list: ["crm:write"],
  add_contact_to_list: ["crm:write"],
  create_campaign_draft: ["campaigns:write"],
  update_campaign_draft: ["campaigns:write"],
  copy_campaign: ["campaigns:write"],
  archive_campaign: ["campaigns:write"],
  restore_campaign: ["campaigns:write"],
};

/** Prepared for Fase B. Not published. When enabled they must require campaigns:send. */
export const CRM_MCP_PHASE_B_TOOL_SCOPES = {
  pause_campaign: ["campaigns:send"],
  resume_campaign: ["campaigns:send"],
  send_campaign: ["campaigns:send"],
  retry_failed_sends: ["campaigns:send"],
  cancel_campaign: ["campaigns:send"],
} as const;

const PHASE_B_NAMES = new Set<string>(Object.keys(CRM_MCP_PHASE_B_TOOL_SCOPES));

const WRITE_NAMES = new Set<string>(CRM_WRITE_TOOL_DEFINITIONS.map((t) => t.name));

export function crmMcpToolScopes(name: string): readonly CrmMcpScope[] | null {
  return CRM_MCP_TOOL_SCOPES[name] || null;
}

export function crmMcpToolIsWrite(name: string): boolean {
  return WRITE_NAMES.has(name);
}

export function isCrmMcpForbiddenTool(name: string): boolean {
  return (
    (CRM_FORBIDDEN_TOOL_NAMES as readonly string[]).includes(name) ||
    name.startsWith("send_") ||
    PHASE_B_NAMES.has(name)
  );
}

export function crmMcpCanCallTool(name: string, scopes: readonly string[] | undefined): boolean {
  if (isCrmMcpForbiddenTool(name)) return false;
  const needed = crmMcpToolScopes(name);
  if (!needed) return false;
  return crmMcpHasAnyScope(scopes, needed);
}

export function advertisedScopeForTool(name: string): CrmMcpScope {
  const needed = crmMcpToolScopes(name);
  return (needed?.[0] || "crm:read") as CrmMcpScope;
}

export function mcpExposedCrmToolDefinitions() {
  return [...CRM_READ_TOOL_DEFINITIONS, ...CRM_WRITE_TOOL_DEFINITIONS].filter(
    (t) => Boolean(CRM_MCP_TOOL_SCOPES[t.name]) && !isCrmMcpForbiddenTool(t.name),
  );
}
