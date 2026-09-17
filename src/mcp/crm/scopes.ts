export const CRM_MCP_SCOPES = ["crm:read"] as const;
export type CrmMcpScope = (typeof CRM_MCP_SCOPES)[number];

export function isCrmMcpScope(value: string): value is CrmMcpScope {
  return (CRM_MCP_SCOPES as readonly string[]).includes(value);
}

export function parseCrmScopeString(raw: string | null | undefined): CrmMcpScope[] {
  if (!raw || !raw.trim()) return ["crm:read"];
  const out: CrmMcpScope[] = [];
  for (const part of raw.split(/[\s,]+/)) {
    if (isCrmMcpScope(part) && !out.includes(part)) out.push(part);
  }
  return out.length ? out : ["crm:read"];
}

export function crmMcpHasRead(scopes: readonly string[] | undefined): boolean {
  if (!Array.isArray(scopes) || scopes.length === 0) return false;
  return scopes.includes("crm:read") || scopes.includes("*");
}

export function crmScopeDescriptions(): Record<CrmMcpScope, string> {
  return {
    "crm:read": "Read the internal Notificas commercial CRM. Never writes, sends or deletes.",
  };
}
