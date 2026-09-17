const TRUE = new Set(["1", "true", "yes", "on"]);

export const CRM_FLAG_NAMES = [
  "crm_v2",
  "crm_ai",
  "crm_mcp",
  "crm_dynamic_lists",
  "crm_bulk_actions",
  "crm_opportunities",
  "crm_tasks",
] as const;

export type CrmFlagName = (typeof CRM_FLAG_NAMES)[number];

/** Env vars server-side. Ninguna es NEXT_PUBLIC: el CRM visible no cambia. */
export const CRM_FLAG_ENV: Record<CrmFlagName, string> = {
  crm_v2: "CRM_V2",
  crm_ai: "CRM_AI",
  crm_mcp: "CRM_MCP",
  crm_dynamic_lists: "CRM_DYNAMIC_LISTS",
  crm_bulk_actions: "CRM_BULK_ACTIONS",
  crm_opportunities: "CRM_OPPORTUNITIES",
  crm_tasks: "CRM_TASKS",
};

function envFlag(name: string): boolean {
  return TRUE.has((process.env[name] || "").trim().toLowerCase());
}

export function isCrmFlagEnabled(flag: CrmFlagName): boolean {
  return envFlag(CRM_FLAG_ENV[flag]);
}

export function crmV2Enabled(): boolean {
  return isCrmFlagEnabled("crm_v2");
}

export function crmAiEnabled(): boolean {
  return isCrmFlagEnabled("crm_ai");
}

export function crmMcpEnabled(): boolean {
  return isCrmFlagEnabled("crm_mcp");
}

export function crmDynamicListsEnabled(): boolean {
  return isCrmFlagEnabled("crm_dynamic_lists");
}

export function crmBulkActionsEnabled(): boolean {
  return isCrmFlagEnabled("crm_bulk_actions");
}

export function crmOpportunitiesEnabled(): boolean {
  return isCrmFlagEnabled("crm_opportunities");
}

export function crmTasksEnabled(): boolean {
  return isCrmFlagEnabled("crm_tasks");
}

export function crmFlags(): Record<CrmFlagName, boolean> {
  return {
    crm_v2: crmV2Enabled(),
    crm_ai: crmAiEnabled(),
    crm_mcp: crmMcpEnabled(),
    crm_dynamic_lists: crmDynamicListsEnabled(),
    crm_bulk_actions: crmBulkActionsEnabled(),
    crm_opportunities: crmOpportunitiesEnabled(),
    crm_tasks: crmTasksEnabled(),
  };
}
