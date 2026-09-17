import { annotationsFor } from "@/mcp/protocol";
import { McpToolError } from "@/mcp/errors";
import { crmReadTools } from "@/lib/marketing/tools/registry";
import { CRM_FORBIDDEN_TOOL_NAMES, CRM_WRITE_TOOL_NAMES } from "@/lib/marketing/tools/types";
import { executeCrmTool } from "@/lib/marketing/tools/execute";
import { getLiveCrmToolRuntime } from "@/lib/marketing/tools/runtime";
import { marketingContext } from "@/lib/marketing/context";
import type { CrmMcpAuthContext } from "./auth";
import { crmMcpHasRead } from "./scopes";

export function listCrmMcpTools() {
  return crmReadTools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: annotationsFor("read"),
  }));
}

export function assertCrmMcpToolAllowed(name: string): void {
  if ((CRM_FORBIDDEN_TOOL_NAMES as readonly string[]).includes(name) || name.startsWith("send_")) {
    throw new McpToolError(
      "FEATURE_NOT_AVAILABLE",
      "CRM MCP is read-only. Sending, deleting and writes are not available from ChatGPT.",
      403,
    );
  }
  if ((CRM_WRITE_TOOL_NAMES as readonly string[]).includes(name)) {
    throw new McpToolError(
      "FEATURE_NOT_AVAILABLE",
      "CRM MCP is read-only. Use the internal Notificas assistant for safe writes.",
      403,
    );
  }
}

export async function callCrmMcpTool(ctx: CrmMcpAuthContext, name: string, args: unknown): Promise<unknown> {
  if (!crmMcpHasRead(ctx.scopes)) {
    throw new McpToolError("INSUFFICIENT_SCOPE", "This authorization does not include crm:read.", 403);
  }
  assertCrmMcpToolAllowed(name);
  const result = await executeCrmTool({
    runtime: getLiveCrmToolRuntime(),
    ctx: marketingContext(ctx.workspaceId, { actorType: "system", actorId: ctx.actor }),
    name,
    args,
    mode: "read",
  });
  if (!result.ok) {
    const code = result.error.code === "entity_not_found" ? "VALIDATION_ERROR" : "VALIDATION_ERROR";
    throw new McpToolError(code, result.error.message, result.error.code === "entity_not_found" ? 404 : 400);
  }
  return result.data;
}

export function crmMcpWriteToolCount(): number {
  return listCrmMcpTools().filter((t) => !t.annotations.readOnlyHint).length;
}
