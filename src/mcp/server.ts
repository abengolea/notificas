import { newRequestId } from "@/lib/public-api/ids";
import {
  MCP_PROTOCOL_VERSION,
  MCP_PROTOCOL_VERSIONS,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  isMcpUserAllowlisted,
  mcpEnabled,
} from "@/mcp/config";
import {
  JSONRPC,
  isJsonRpcRequest,
  jsonRpcError,
  jsonRpcResult,
  type JsonRpcId,
  type JsonRpcRequest,
} from "@/mcp/protocol";
import { authenticateMcpRequest, type McpAuthContext, wwwAuthenticate } from "@/mcp/auth/context";
import { writeMcpAudit } from "@/mcp/audit";
import { consumeMcpRateLimit, kindToBucket } from "@/mcp/rate-limit";
import { callTool, getToolOrThrow, listToolsForScopes } from "@/mcp/tools/registry";
import { McpToolError, toolErrorPayload } from "@/mcp/errors";
import { MCP_CORS } from "@/mcp/auth/metadata";

function protocolVersion(requested: unknown): string {
  if (typeof requested === "string" && (MCP_PROTOCOL_VERSIONS as readonly string[]).includes(requested)) {
    return requested;
  }
  return MCP_PROTOCOL_VERSION;
}

function requestIdOf(request: Request): string {
  const incoming = request.headers.get("X-Request-Id")?.trim();
  if (incoming && /^[a-zA-Z0-9_.:-]{8,80}$/.test(incoming)) return incoming;
  return newRequestId();
}

export function mcpCorsHeaders(): Record<string, string> {
  return {
    ...MCP_CORS,
    "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
  };
}

export function jsonResponse(body: unknown, status: number, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...mcpCorsHeaders(),
      ...(extra || {}),
    },
  });
}

export function mcpDisabledResponse(): Response {
  return jsonResponse({ error: { code: "MCP_DISABLED", message: "Notificas MCP is not enabled." } }, 503);
}

async function handleOne(
  rpc: JsonRpcRequest,
  ctx: McpAuthContext
): Promise<{ body: unknown; notificationId?: string; campaignId?: string; tool?: string; errorCode?: string }> {
  const id = (rpc.id ?? null) as JsonRpcId;
  const method = rpc.method;

  if (method === "initialize") {
    const params = (rpc.params && typeof rpc.params === "object" ? rpc.params : {}) as { protocolVersion?: string };
    return {
      body: jsonRpcResult(id, {
        protocolVersion: protocolVersion(params.protocolVersion),
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
        instructions:
          "Notificas MCP exposes certified WhatsApp and email notifications for the authenticated company. Never send bulk campaigns. Use prepare_* before send_*. Tenant, credits and evidence are enforced by the Notificas backend, not by the model.",
      }),
    };
  }

  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    return { body: null };
  }

  if (method === "ping") {
    return { body: jsonRpcResult(id, {}) };
  }

  if (method === "tools/list") {
    return {
      body: jsonRpcResult(id, { tools: listToolsForScopes(ctx.scopes) }),
    };
  }

  if (method === "tools/call") {
    const params = (rpc.params && typeof rpc.params === "object" ? rpc.params : {}) as {
      name?: string;
      arguments?: unknown;
    };
    if (!params.name) {
      return { body: jsonRpcError(id, JSONRPC.INVALID_PARAMS, "Missing tool name.") };
    }
    try {
      const toolMeta = getToolOrThrow(params.name);
      await consumeMcpRateLimit({
        userId: ctx.userId,
        orgId: ctx.orgId,
        bucket: kindToBucket(toolMeta.kind),
      });
      const { tool, result } = await callTool(ctx, params.name, params.arguments);
      const rec = result && typeof result === "object" ? (result as Record<string, unknown>) : {};
      return {
        body: jsonRpcResult(id, {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
          isError: false,
        }),
        tool: tool.name,
        notificationId: typeof rec.id === "string" ? rec.id : typeof rec.notificationId === "string" ? rec.notificationId : undefined,
        campaignId: typeof rec.campaignId === "string" ? rec.campaignId : undefined,
      };
    } catch (e) {
      const err = e instanceof McpToolError ? e : new McpToolError("INTERNAL_ERROR", "An internal error occurred.", 500);
      if (!(e instanceof McpToolError) || err.code === "INTERNAL_ERROR") {
        console.error("mcp tool", ctx.requestId, e instanceof Error ? e.message : e);
      }
      return {
        body: jsonRpcResult(id, {
          content: [{ type: "text", text: JSON.stringify(toolErrorPayload(err, ctx.requestId)) }],
          structuredContent: toolErrorPayload(err, ctx.requestId),
          isError: true,
        }),
        tool: params.name,
        errorCode: err.code,
      };
    }
  }

  return { body: jsonRpcError(id, JSONRPC.METHOD_NOT_FOUND, `Method not found: ${method}`) };
}

export async function handleMcpHttp(request: Request): Promise<Response> {
  if (!mcpEnabled()) return mcpDisabledResponse();

  const requestId = requestIdOf(request);
  const started = Date.now();

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: mcpCorsHeaders() });
  }

  if (request.method === "DELETE") {
    return new Response(null, { status: 204, headers: mcpCorsHeaders() });
  }

  if (request.method === "GET") {
    return jsonResponse({ error: { code: "METHOD_NOT_ALLOWED", message: "Use POST for Streamable HTTP." } }, 405, {
      Allow: "POST, DELETE, OPTIONS",
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } }, 405);
  }

  let ctx: McpAuthContext;
  try {
    ctx = await authenticateMcpRequest(request, requestId);
  } catch (e) {
    const err = e instanceof McpToolError ? e : new McpToolError("UNAUTHORIZED", "Unauthorized.", 401);
    void writeMcpAudit({
      requestId,
      method: "POST",
      result: "denied",
      durationMs: Date.now() - started,
      errorCode: err.code,
    });
    return jsonResponse(toolErrorPayload(err, requestId), err.httpStatus, {
      "WWW-Authenticate": wwwAuthenticate("invalid_token", err.message),
      "X-Request-Id": requestId,
    });
  }

  if (!isMcpUserAllowlisted(ctx.userId, ctx.userEmail)) {
    const err = new McpToolError("FORBIDDEN", "MCP is not enabled for this user.", 403);
    void writeMcpAudit({
      requestId,
      userId: ctx.userId,
      orgId: ctx.orgId,
      result: "denied",
      client: ctx.mcpClient,
      durationMs: Date.now() - started,
      errorCode: err.code,
    });
    return jsonResponse(toolErrorPayload(err, requestId), 403, { "X-Request-Id": requestId });
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return jsonResponse(jsonRpcError(null, JSONRPC.PARSE_ERROR, "Parse error"), 400, { "X-Request-Id": requestId });
  }

  const messages = Array.isArray(parsed) ? parsed : [parsed];
  const outputs: unknown[] = [];
  let lastTool: string | undefined;
  let lastNotificationId: string | undefined;
  let lastCampaignId: string | undefined;
  let lastError: string | undefined;

  for (const item of messages) {
    if (!isJsonRpcRequest(item)) {
      outputs.push(jsonRpcError(null, JSONRPC.INVALID_REQUEST, "Invalid Request"));
      continue;
    }
    const isNotification = item.id === undefined && item.method.startsWith("notifications/");
    const handled = await handleOne(item, ctx);
    lastTool = handled.tool || lastTool;
    lastNotificationId = handled.notificationId || lastNotificationId;
    lastCampaignId = handled.campaignId || lastCampaignId;
    lastError = handled.errorCode || lastError;
    if (isNotification || handled.body == null) continue;
    outputs.push(handled.body);
  }

  void writeMcpAudit({
    requestId,
    userId: ctx.userId,
    orgId: ctx.orgId,
    tool: lastTool,
    method: "POST",
    result: lastError ? "error" : "ok",
    notificationId: lastNotificationId,
    campaignId: lastCampaignId,
    client: ctx.mcpClient,
    durationMs: Date.now() - started,
    errorCode: lastError,
  });

  const payload = Array.isArray(parsed) ? outputs : outputs[0] ?? { jsonrpc: "2.0", result: {} };
  return jsonResponse(payload, 200, { "X-Request-Id": requestId });
}
