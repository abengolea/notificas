import { peekAvailableCredits } from "@/lib/public-api/notifications";
import type { McpAuthContext } from "@/mcp/auth/context";
import { ALL_MCP_SCOPES, type McpScope } from "@/mcp/scopes";

export async function getAccount(ctx: McpAuthContext) {
  return {
    company: {
      id: ctx.orgId,
      name: ctx.orgName,
      plan: ctx.orgPlan,
    },
    user: {
      id: ctx.userId,
      email: ctx.userEmail,
    },
    permissions: ctx.scopes.filter((s): s is McpScope => (ALL_MCP_SCOPES as readonly string[]).includes(s)),
    source: "mcp",
  };
}

export async function getBalance(ctx: McpAuthContext) {
  const credits = await peekAvailableCredits(ctx.senderUid);
  return {
    credits_available: credits,
    plan: ctx.orgPlan,
    unit: "envios",
  };
}
