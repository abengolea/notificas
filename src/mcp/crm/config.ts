import { crmMcpEnabled } from "@/lib/marketing/flags";
import { getMarketingWorkspaceId } from "@/lib/marketing/workspace";
import { mcpBaseUrl, MCP_PROTOCOL_VERSION, MCP_PROTOCOL_VERSIONS } from "@/mcp/config";

export const CRM_MCP_SERVER_NAME = "notificas-mcp-crm";
export const CRM_MCP_SERVER_VERSION = "1.0.0";
export const CRM_MCP_PROTOCOL_VERSION = MCP_PROTOCOL_VERSION;
export const CRM_MCP_PROTOCOL_VERSIONS = MCP_PROTOCOL_VERSIONS;

export function crmMcpResourceUrl(): string {
  return `${mcpBaseUrl()}/mcp/crm`;
}

export function crmMcpEnabledSafe(): boolean {
  return crmMcpEnabled();
}

export function crmMcpWorkspaceId(): string {
  return getMarketingWorkspaceId();
}

export function crmMcpToken(): string | null {
  const token = (process.env.CRM_MCP_TOKEN || "").trim();
  return token || null;
}

export function crmMcpClientId(): string | null {
  const id = (process.env.CRM_MCP_CLIENT_ID || "").trim();
  return id || null;
}

export function crmMcpClientSecret(): string | null {
  const secret = (process.env.CRM_MCP_CLIENT_SECRET || process.env.CRM_MCP_TOKEN || "").trim();
  return secret || null;
}

export function crmMcpAllowedUsers(): string[] {
  return (process.env.CRM_MCP_ALLOWED_USERS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isCrmMcpUserAllowed(idOrEmail: string): boolean {
  const allow = crmMcpAllowedUsers();
  if (allow.length === 0) return true;
  return allow.includes(idOrEmail.trim().toLowerCase());
}
