export const CRM_MCP_SCOPES = ["crm:read", "crm:write", "campaigns:read", "campaigns:write"] as const;
export type CrmMcpScope = (typeof CRM_MCP_SCOPES)[number];

const SCOPE_SET = new Set<string>(CRM_MCP_SCOPES);

export function isCrmMcpScope(value: string): value is CrmMcpScope {
  return SCOPE_SET.has(value);
}

export class CrmInvalidScopeError extends Error {
  readonly error = "invalid_scope" as const;
  readonly errorDescription: string;
  readonly unknownScopes: string[];

  constructor(unknownScopes: string[]) {
    const unique = [...new Set(unknownScopes.filter(Boolean))];
    const desc = `Unsupported CRM MCP scope: ${unique.join(", ")}. Supported: ${CRM_MCP_SCOPES.join(" ")}.`;
    super(desc);
    this.name = "CrmInvalidScopeError";
    this.errorDescription = desc;
    this.unknownScopes = unique;
  }
}

function splitScopeParts(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Parse a space/comma-separated OAuth scope string.
 * Omitted/empty → crm:read. Any unknown token → invalid_scope (never silent fallback).
 */
export function parseCrmScopeString(raw: string | null | undefined): CrmMcpScope[] {
  if (raw == null || !String(raw).trim()) return ["crm:read"];
  const parts = splitScopeParts(String(raw));
  if (parts.length === 0) return ["crm:read"];
  const unknown = parts.filter((part) => !isCrmMcpScope(part));
  if (unknown.length) throw new CrmInvalidScopeError(unknown);
  const out: CrmMcpScope[] = [];
  for (const part of parts) {
    if (isCrmMcpScope(part) && !out.includes(part)) out.push(part);
  }
  return out;
}

/** Issued tokens already passed consent; empty → crm:read. Unknown leftovers are dropped, not rewritten to write. */
export function parseStoredCrmScopes(scopes: readonly string[] | undefined): CrmMcpScope[] {
  if (!Array.isArray(scopes) || scopes.length === 0) return ["crm:read"];
  const out: CrmMcpScope[] = [];
  for (const part of scopes) {
    if (isCrmMcpScope(part) && !out.includes(part)) out.push(part);
  }
  return out.length ? out : ["crm:read"];
}

export function crmMcpHasRead(scopes: readonly string[] | undefined): boolean {
  if (!Array.isArray(scopes) || scopes.length === 0) return false;
  return scopes.includes("crm:read");
}

export function crmMcpHasAnyScope(scopes: readonly string[] | undefined, needed: readonly CrmMcpScope[]): boolean {
  if (!Array.isArray(scopes) || scopes.length === 0) return false;
  return needed.some((scope) => scopes.includes(scope));
}

export function crmMcpHasKnownScope(scopes: readonly string[] | undefined): boolean {
  return crmMcpHasAnyScope(scopes, CRM_MCP_SCOPES);
}

export function crmScopeDescriptions(): Record<CrmMcpScope, string> {
  return {
    "crm:read": "Read the internal Notificas commercial CRM. Never writes, sends or deletes.",
    "crm:write":
      "Create and update CRM companies, contacts, tasks, notes, opportunities and recipient lists. Does not send email, delete or merge.",
    "campaigns:read": "Read commercial CRM email campaigns and preview a draft audience. Does not send.",
    "campaigns:write":
      "Create and edit commercial campaign DRAFTS, copy, archive or restore. Never sends, pauses, resumes or schedules email.",
  };
}
