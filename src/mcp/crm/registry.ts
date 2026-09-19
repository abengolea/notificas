import { annotationsFor } from "@/mcp/protocol";
import { McpToolError } from "@/mcp/errors";
import { executeCrmTool, isCrmWriteTool } from "@/lib/marketing/tools/execute";
import { getLiveCrmToolRuntime } from "@/lib/marketing/tools/runtime";
import { marketingContext } from "@/lib/marketing/context";
import type { CrmMcpAuthContext } from "./auth";
import {
  advertisedScopeForTool,
  crmMcpCanCallTool,
  crmMcpToolIsWrite,
  isCrmMcpForbiddenTool,
  mcpExposedCrmToolDefinitions,
} from "./policy";
import type { CrmMcpScope } from "./scopes";

export function listAllCrmMcpTools() {
  return mcpExposedCrmToolDefinitions().map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: annotationsFor(t.access === "read" ? "read" : "write"),
    securitySchemes: [{ type: "oauth2" as const, scopes: [advertisedScopeForTool(t.name)] }],
  }));
}

export function listCrmMcpTools(scopes: readonly string[] | CrmMcpScope[] = ["crm:read"]) {
  return listAllCrmMcpTools().filter((t) => crmMcpCanCallTool(t.name, scopes));
}

export function assertCrmMcpToolAllowed(name: string, scopes: readonly string[] = ["crm:read"]): void {
  if (isCrmMcpForbiddenTool(name)) {
    throw new McpToolError(
      "FEATURE_NOT_AVAILABLE",
      "Sending, pausing, resuming, scheduling, deleting, merging and bulk imports are not available from ChatGPT.",
      403,
    );
  }
  if (!crmMcpCanCallTool(name, scopes)) {
    const write = crmMcpToolIsWrite(name);
    throw new McpToolError(
      "INSUFFICIENT_SCOPE",
      write
        ? `This authorization cannot call ${name}. Reconnect ChatGPT and grant the matching write scope.`
        : `This authorization cannot call ${name}.`,
      403,
    );
  }
}

export async function callCrmMcpTool(ctx: CrmMcpAuthContext, name: string, args: unknown): Promise<unknown> {
  assertCrmMcpToolAllowed(name, ctx.scopes);
  const result = await executeCrmTool({
    runtime: getLiveCrmToolRuntime(),
    ctx: marketingContext(ctx.workspaceId, {
      actorType: "system",
      actorId: ctx.actor,
      idempotencyKey: ctx.idempotencyKey,
    }),
    name,
    args,
    mode: isCrmWriteTool(name) ? "readwrite" : "read",
  });
  if (!result.ok) {
    if (result.error.code === "forbidden_tool") {
      throw new McpToolError("FEATURE_NOT_AVAILABLE", result.error.message, 403);
    }
    const http =
      result.error.code === "entity_not_found" ? 404 : result.error.code === "conflict" ? 409 : 400;
    throw new McpToolError("VALIDATION_ERROR", result.error.message, http);
  }
  return result.data;
}

export function crmMcpWriteToolCount(scopes: readonly string[] = ["crm:read"]): number {
  return listCrmMcpTools(scopes).filter((t) => !t.annotations.readOnlyHint).length;
}
