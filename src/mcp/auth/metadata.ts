import { ALL_MCP_SCOPES, scopeDescriptions } from "@/mcp/scopes";
import { mcpIssuer, mcpResourceUrl, MCP_PROTOCOL_VERSION } from "@/mcp/config";

export function protectedResourceMetadata() {
  const resource = mcpResourceUrl();
  const issuer = mcpIssuer();
  return {
    resource,
    authorization_servers: [issuer],
    bearer_methods_supported: ["header"],
    scopes_supported: ALL_MCP_SCOPES,
    resource_name: "Notificas MCP",
    resource_documentation: `${issuer}/docs/MCP.md`,
    mcp_protocol_version: MCP_PROTOCOL_VERSION,
  };
}

export function authorizationServerMetadata() {
  const issuer = mcpIssuer();
  const scopes = ALL_MCP_SCOPES;
  const desc = scopeDescriptions();
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    scopes_supported: scopes,
    scope_descriptions: desc,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    response_modes_supported: ["query"],
  };
}

export const OAUTH_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

export const MCP_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, Idempotency-Key, X-Request-Id",
  "Access-Control-Expose-Headers": "MCP-Protocol-Version, Mcp-Session-Id, X-Request-Id, WWW-Authenticate",
  "Access-Control-Max-Age": "86400",
};
