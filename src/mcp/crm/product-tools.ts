import { MCP_TOOLS, callTool } from "@/mcp/tools/registry";
import type { McpAuthContext } from "@/mcp/auth/context";
import { isMcpScope, type McpScope } from "@/mcp/scopes";
import { McpToolError } from "@/mcp/errors";
import { resolveOrgForCrmProductScopes } from "@/mcp/auth/orgs";
import type { CrmMcpAuthContext } from "./auth";

/** Certified-product tools allowed on /mcp/crm. send_* and colliding campaign names are excluded. */
export const CRM_MCP_PRODUCT_TOOL_NAMES = [
  "estimate_notification",
  "prepare_whatsapp",
  "prepare_email",
  "get_notification",
  "get_delivery_status",
  "get_certificate",
  "verify_notification",
] as const;

const PRODUCT_NAME_SET = new Set<string>(CRM_MCP_PRODUCT_TOOL_NAMES);

function mcpScopesGrantedOnCrm(scopes: readonly string[]): McpScope[] {
  const out: McpScope[] = [];
  for (const scope of scopes) {
    if (isMcpScope(scope)) out.push(scope);
  }
  return out;
}

export function isCrmMcpProductTool(name: string): boolean {
  return PRODUCT_NAME_SET.has(name);
}

export function crmMcpProductToolDefinitions() {
  return MCP_TOOLS.filter((t) => isCrmMcpProductTool(t.name)).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    access: t.kind === "write" ? "write" : "read",
  }));
}

export async function hydrateCrmProductAuthContext(ctx: CrmMcpAuthContext): Promise<McpAuthContext> {
  if (!ctx.orgId || ctx.orgId === ctx.workspaceId) {
    throw new McpToolError(
      "FORBIDDEN",
      "Notification and certificate tools require a company account. Reconnect ChatGPT and select the Notificas company.",
      403,
    );
  }
  const org = await resolveOrgForCrmProductScopes(ctx.userEmail, ctx.orgId);
  if (!org) {
    throw new McpToolError("FORBIDDEN", "The authorized organization is no longer accessible.", 403);
  }
  return {
    requestId: ctx.requestId,
    userId: ctx.userId,
    userEmail: ctx.userEmail,
    orgId: org.id,
    orgName: org.nombre,
    orgPlan: org.plan,
    senderUid: org.adminUserId,
    senderEmail: org.adminUserEmail,
    scopes: mcpScopesGrantedOnCrm(ctx.scopes),
    clientId: ctx.clientId,
    mcpClient: ctx.client,
    resource: ctx.resource,
  };
}

export async function callCrmProductTool(
  ctx: CrmMcpAuthContext,
  name: string,
  args: unknown,
): Promise<unknown> {
  if (!isCrmMcpProductTool(name) || name.startsWith("send_")) {
    throw new McpToolError("FEATURE_NOT_AVAILABLE", "Sending is not available from the CRM MCP.", 403);
  }
  const productCtx = await hydrateCrmProductAuthContext(ctx);
  const { result } = await callTool(productCtx, name, args);
  return result;
}
