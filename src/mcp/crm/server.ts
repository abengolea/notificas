import { newRequestId } from "@/lib/public-api/ids";
import { JSONRPC, isJsonRpcRequest, jsonRpcError, jsonRpcResult, type JsonRpcId, type JsonRpcRequest } from "@/mcp/protocol";
import { jsonResponse, mcpCorsHeaders } from "@/mcp/server";
import { McpToolError, toolErrorPayload } from "@/mcp/errors";
import { consumeMcpRateLimit } from "@/mcp/rate-limit";
import {
  CRM_MCP_PROTOCOL_VERSION,
  CRM_MCP_PROTOCOL_VERSIONS,
  CRM_MCP_SERVER_NAME,
  CRM_MCP_SERVER_VERSION,
  crmMcpEnabledSafe,
  crmMcpWorkspaceId,
} from "./config";
import { authenticateCrmMcpRequest, crmWwwAuthenticate, type CrmMcpAuthContext } from "./auth";
import { writeCrmMcpAudit } from "./audit";
import { callCrmMcpTool, listCrmMcpTools } from "./registry";

function protocolVersion(requested: unknown): string {
  if (typeof requested === "string" && (CRM_MCP_PROTOCOL_VERSIONS as readonly string[]).includes(requested)) {
    return requested;
  }
  return CRM_MCP_PROTOCOL_VERSION;
}

function requestIdOf(request: Request): string {
  const incoming = request.headers.get("X-Request-Id")?.trim();
  if (incoming && /^[a-zA-Z0-9_.:-]{8,80}$/.test(incoming)) return incoming;
  return newRequestId();
}

export function crmMcpDisabledResponse(): Response {
  return jsonResponse({ error: { code: "MCP_DISABLED", message: "Notificas CRM MCP is not enabled." } }, 503);
}

async function handleOne(
  rpc: JsonRpcRequest,
  ctx: CrmMcpAuthContext,
): Promise<{ body: unknown; tool?: string; errorCode?: string }> {
  const id = (rpc.id ?? null) as JsonRpcId;
  const method = rpc.method;

  if (method === "initialize") {
    const params = (rpc.params && typeof rpc.params === "object" ? rpc.params : {}) as { protocolVersion?: string };
    return {
      body: jsonRpcResult(id, {
        protocolVersion: protocolVersion(params.protocolVersion),
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: CRM_MCP_SERVER_NAME, version: CRM_MCP_SERVER_VERSION },
        instructions:
          "Notificas CRM MCP is read-only access to the internal commercial CRM. Never invent companies, contacts or campaign results. Use search_* then get_*. Workspace is fixed by the server. You cannot send email, create records or delete anything here.",
      }),
      tool: "initialize",
    };
  }

  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    return { body: null };
  }

  if (method === "ping") {
    return { body: jsonRpcResult(id, {}) };
  }

  if (method === "tools/list") {
    return { body: jsonRpcResult(id, { tools: listCrmMcpTools() }), tool: "tools/list" };
  }

  if (method === "tools/call") {
    const params = (rpc.params && typeof rpc.params === "object" ? rpc.params : {}) as {
      name?: string;
      arguments?: unknown;
    };
    if (!params.name) {
      return { body: jsonRpcError(id, JSONRPC.INVALID_PARAMS, "Missing tool name."), tool: undefined };
    }
    try {
      await consumeMcpRateLimit({
        userId: ctx.actor,
        orgId: `crmws:${ctx.workspaceId}`,
        bucket: "read",
      });
      const result = await callCrmMcpTool(ctx, params.name, params.arguments);
      return {
        body: jsonRpcResult(id, {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
          isError: false,
        }),
        tool: params.name,
      };
    } catch (e) {
      const err = e instanceof McpToolError ? e : new McpToolError("INTERNAL_ERROR", "An internal error occurred.", 500);
      if (!(e instanceof McpToolError) || err.code === "INTERNAL_ERROR") {
        console.error("crm mcp tool", ctx.requestId, e instanceof Error ? e.message : e);
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

export async function handleCrmMcpHttp(request: Request): Promise<Response> {
  if (!crmMcpEnabledSafe()) return crmMcpDisabledResponse();

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

  let ctx: CrmMcpAuthContext;
  try {
    ctx = await authenticateCrmMcpRequest(request, requestId);
  } catch (e) {
    const err = e instanceof McpToolError ? e : new McpToolError("UNAUTHORIZED", "Unauthorized.", 401);
    void writeCrmMcpAudit({
      requestId,
      workspaceId: crmMcpWorkspaceId(),
      result: "denied",
      durationMs: Date.now() - started,
      errorCode: err.code,
    });
    return jsonResponse(toolErrorPayload(err, requestId), err.httpStatus, {
      "WWW-Authenticate": crmWwwAuthenticate("invalid_token", err.message),
      "X-Request-Id": requestId,
    });
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return jsonResponse(jsonRpcError(null, JSONRPC.PARSE_ERROR, "Invalid JSON."), 400, { "X-Request-Id": requestId });
  }

  if (Array.isArray(parsed)) {
    return jsonResponse(jsonRpcError(null, JSONRPC.INVALID_REQUEST, "Batch JSON-RPC is not supported."), 400, {
      "X-Request-Id": requestId,
    });
  }
  if (!isJsonRpcRequest(parsed)) {
    return jsonResponse(jsonRpcError(null, JSONRPC.INVALID_REQUEST, "Invalid JSON-RPC request."), 400, {
      "X-Request-Id": requestId,
    });
  }

  const handled = await handleOne(parsed, ctx);
  const body = handled.body;
  const isError = Boolean(handled.errorCode) || (body && typeof body === "object" && "error" in (body as object));
  void writeCrmMcpAudit({
    requestId,
    actor: ctx.actor,
    tool: handled.tool,
    workspaceId: ctx.workspaceId,
    result: isError ? "error" : "ok",
    durationMs: Date.now() - started,
    errorCode: handled.errorCode,
    client: ctx.client,
  });

  if (handled.body == null) {
    return new Response(null, { status: 202, headers: { ...mcpCorsHeaders(), "X-Request-Id": requestId } });
  }
  return jsonResponse(handled.body, 200, { "X-Request-Id": requestId });
}

export function crmMcpHealthPayload() {
  return {
    ok: true,
    service: CRM_MCP_SERVER_NAME,
    version: CRM_MCP_SERVER_VERSION,
    enabled: crmMcpEnabledSafe(),
    readOnly: true,
  };
}
