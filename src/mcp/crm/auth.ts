import { createHmac, timingSafeEqual } from "crypto";
import { bearerFromAuthorization, isApiKeyOnMcp } from "@/mcp/auth/bearer";
import { lookupAccessToken } from "@/mcp/auth/tokens";
import { inferMcpClientFromUserAgent } from "@/mcp/auth/client-name";
import { McpToolError } from "@/mcp/errors";
import { mcpResourceUrl } from "@/mcp/config";
import {
  crmMcpClientId,
  crmMcpClientSecret,
  crmMcpResourceUrl,
  crmMcpToken,
  crmMcpWorkspaceId,
  isCrmMcpUserAllowed,
} from "./config";
import { crmMcpHasKnownScope, parseStoredCrmScopes, type CrmMcpScope } from "./scopes";

export type CrmMcpAuthContext = {
  requestId: string;
  actor: string;
  workspaceId: string;
  scopes: CrmMcpScope[];
  client: string;
  resource: string;
  idempotencyKey?: string;
};

function tokenEquals(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    const dummy = Buffer.alloc(b.length);
    timingSafeEqual(dummy, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function crmWwwAuthenticate(error: string, description: string): string {
  const meta = `${crmMcpResourceUrl().replace(/\/mcp\/crm$/, "")}/.well-known/oauth-protected-resource/mcp/crm`;
  return `Bearer realm="notificas-crm-mcp", error="${error}", error_description="${description.replace(/"/g, "")}", resource_metadata="${meta}"`;
}

export async function authenticateCrmMcpRequest(request: Request, requestId: string): Promise<CrmMcpAuthContext> {
  const token = bearerFromAuthorization(request.headers.get("Authorization"));
  if (!token) {
    throw new McpToolError("UNAUTHORIZED", "Missing bearer access token for the CRM MCP.", 401);
  }
  if (isApiKeyOnMcp(token)) {
    throw new McpToolError(
      "UNAUTHORIZED",
      "Certified-product API keys cannot access the internal CRM MCP.",
      401,
    );
  }

  const workspaceId = crmMcpWorkspaceId();
  const client = inferMcpClientFromUserAgent(request.headers.get("user-agent")) || "chatgpt";
  const staticToken = crmMcpToken();
  if (staticToken && tokenEquals(token, staticToken)) {
    return {
      requestId,
      actor: "crm-mcp",
      workspaceId,
      scopes: ["crm:read"],
      client,
      resource: crmMcpResourceUrl(),
    };
  }

  const rec = await lookupAccessToken(token);
  if (!rec) {
    throw new McpToolError("UNAUTHORIZED", "Invalid or expired CRM MCP token.", 401);
  }
  if (rec.resource === mcpResourceUrl()) {
    throw new McpToolError(
      "UNAUTHORIZED",
      "This token belongs to the certified Notificas product MCP, not the internal CRM MCP.",
      401,
    );
  }
  if (rec.resource !== crmMcpResourceUrl()) {
    throw new McpToolError("UNAUTHORIZED", "Token was not issued for the CRM MCP resource.", 401);
  }
  if (!crmMcpHasKnownScope(rec.scopes as string[])) {
    throw new McpToolError("INSUFFICIENT_SCOPE", "This authorization does not include a CRM MCP scope.", 403);
  }
  const actor = rec.userEmail || rec.userId;
  if (!isCrmMcpUserAllowed(actor) && !isCrmMcpUserAllowed(rec.userId)) {
    throw new McpToolError("FORBIDDEN", "CRM MCP is not enabled for this actor.", 403);
  }
  return {
    requestId,
    actor,
    workspaceId,
    scopes: parseStoredCrmScopes(rec.scopes as string[]),
    client: rec.mcpClient || client,
    resource: rec.resource,
  };
}

export function issueCrmClientCredentials(opts: {
  clientId: string;
  clientSecret: string;
}): { access_token: string; token_type: "Bearer"; expires_in: number; scope: string; resource: string } {
  const expectedId = crmMcpClientId();
  const expectedSecret = crmMcpClientSecret();
  const staticToken = crmMcpToken();
  if (!expectedSecret || !staticToken) {
    throw new McpToolError("UNAUTHORIZED", "CRM MCP client credentials are not configured.", 401);
  }
  if (expectedId && opts.clientId !== expectedId) {
    throw new McpToolError("UNAUTHORIZED", "Invalid CRM MCP client.", 401);
  }
  if (!tokenEquals(opts.clientSecret, expectedSecret)) {
    throw new McpToolError("UNAUTHORIZED", "Invalid CRM MCP client secret.", 401);
  }
  return {
    access_token: staticToken,
    token_type: "Bearer",
    expires_in: 3600,
    scope: "crm:read",
    resource: crmMcpResourceUrl(),
  };
}

/** Firma opcional para tokens derivados. No se usa si hay CRM_MCP_TOKEN estático. */
export function signCrmMcpToken(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
