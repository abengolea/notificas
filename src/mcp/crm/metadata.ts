import { CRM_MCP_SCOPES, crmScopeDescriptions } from "./scopes";
import { CRM_MCP_PROTOCOL_VERSION, crmMcpResourceUrl } from "./config";
import { mcpIssuer } from "@/mcp/config";

export function crmProtectedResourceMetadata() {
  const resource = crmMcpResourceUrl();
  const issuer = mcpIssuer();
  return {
    resource,
    authorization_servers: [issuer],
    bearer_methods_supported: ["header"],
    scopes_supported: [...CRM_MCP_SCOPES],
    scope_descriptions: crmScopeDescriptions(),
    resource_name: "Notificas CRM MCP",
    resource_documentation: `${issuer}/docs/crm/MCP_CRM.md`,
    mcp_protocol_version: CRM_MCP_PROTOCOL_VERSION,
    token_endpoint: `${resource}/oauth/token`,
  };
}
