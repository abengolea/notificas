import { getAdminDb } from "@/lib/firebase-admin";
import { getOrgIfMember } from "@/lib/org-server";
import { mcpResourceUrl } from "@/mcp/config";
import { McpToolError } from "@/mcp/errors";
import { lookupAccessToken, type AccessTokenRecord } from "@/mcp/auth/tokens";
import { inferMcpClientFromUserAgent } from "@/mcp/auth/client-name";
import { bearerFromAuthorization, isApiKeyOnMcp } from "@/mcp/auth/bearer";
import type { McpScope } from "@/mcp/scopes";
import { hasMcpScope } from "@/mcp/scopes";
import type { PublicApiAuthContext } from "@/lib/public-api/types";

export type McpAuthContext = {
  requestId: string;
  userId: string;
  userEmail: string | null;
  orgId: string;
  orgName: string;
  orgPlan: string;
  senderUid: string;
  senderEmail: string;
  scopes: McpScope[];
  clientId: string;
  mcpClient: string;
  resource: string;
};

export { bearerFromAuthorization } from "@/mcp/auth/bearer";

export function wwwAuthenticate(error: string, description: string): string {
  const meta = `${mcpResourceUrl().replace(/\/mcp$/, "")}/.well-known/oauth-protected-resource`;
  return `Bearer FAKESECRET_g3h4i5j6k7l8m9n0o1p2="${error}", error_description="${description.replace(/"/g, "")}", resource_metadata="${meta}"`;
}

export async function authenticateMcpRequest(request: Request, requestId: string): Promise<McpAuthContext> {
  const token = bearerFromAuthorization(request.headers.get("Authorization"));
  if (!token) {
    throw new McpToolError("UNAUTHORIZED", "Missing bearer access token.", 401);
  }
  if (isApiKeyOnMcp(token)) {
    throw new McpToolError("UNAUTHORIZED", "API keys cannot be used on the MCP endpoint. Use OAuth.", 401);
  }
  const rec = await lookupAccessToken(token);
  if (!rec) {
    throw new McpToolError("UNAUTHORIZED", "Invalid or expired access token.", 401);
  }
  if (rec.resource !== mcpResourceUrl()) {
    throw new McpToolError("UNAUTHORIZED", "Token was not issued for this resource.", 401);
  }
  return hydrateAuthContext(rec, request, requestId);
}

async function hydrateAuthContext(
  rec: AccessTokenRecord,
  request: Request,
  requestId: string
): Promise<McpAuthContext> {
  const org = await getOrgIfMember(rec.userId, rec.orgId, rec.userEmail);
  if (!org) {
    throw new McpToolError("FORBIDDEN", "The authorized organization is no longer accessible.", 403);
  }
  const uaClient = inferMcpClientFromUserAgent(request.headers.get("user-agent"));
  const orgSnap = await getAdminDb().collection("organizations").doc(rec.orgId).get();
  const plan = String(orgSnap.data()?.plan || org.data.plan || "starter");
  const senderUid = String(org.data.adminUserId || rec.senderUid);
  const senderEmail = String(org.data.adminUserEmail || rec.senderEmail || "");
  return {
    requestId,
    userId: rec.userId,
    userEmail: rec.userEmail,
    orgId: rec.orgId,
    orgName: String(org.data.nombre || rec.orgName || ""),
    orgPlan: plan,
    senderUid,
    senderEmail,
    scopes: rec.scopes,
    clientId: rec.clientId,
    mcpClient: rec.mcpClient !== "unknown" ? rec.mcpClient : uaClient || "unknown",
    resource: rec.resource,
  };
}

export function requireScope(ctx: McpAuthContext, scope: McpScope): void {
  if (!hasMcpScope(ctx.scopes, scope)) {
    throw new McpToolError("INSUFFICIENT_SCOPE", `This authorization does not include ${scope}.`, 403);
  }
}

export function toPublicApiContext(ctx: McpAuthContext): PublicApiAuthContext {
  return {
    requestId: ctx.requestId,
    apiKeyId: `mcp:${ctx.clientId}`,
    apiKeyPrefix: "mcp",
    orgId: ctx.orgId,
    orgName: ctx.orgName,
    orgCuit: null,
    senderUid: ctx.senderUid,
    senderEmail: ctx.senderEmail,
    environment: "live",
    testMode: false,
    scopes: [],
    origin: "mcp",
    mcpClient: ctx.mcpClient,
  };
}
