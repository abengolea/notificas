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
import {
  callCrmMcpTool,
  isCrmMcpTestRuntime,
  listAllCrmMcpTools,
} from "./registry";
import { advertisedScopeForTool, crmMcpToolIsWrite } from "./policy";

type CrmMcpHandled = {
  body: unknown;
  tool?: string;
  errorCode?: string;
  actor?: string;
  client?: string;
  wwwAuthenticate?: string;
};

const DISCOVERY_METHODS = new Set([
  "initialize",
  "notifications/initialized",
  "notifications/cancelled",
  "ping",
  "tools/list",
]);

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

function challengeForAuthError(err: McpToolError, toolName?: string): { error: string; description: string; scope?: string } {
  if (err.code === "INSUFFICIENT_SCOPE") {
    return {
      error: "insufficient_scope",
      description: err.message,
      scope: toolName ? advertisedScopeForTool(toolName) : undefined,
    };
  }
  return { error: "invalid_token", description: "Authentication required" };
}

function authChallengeToolResult(
  id: JsonRpcId,
  requestId: string,
  err: McpToolError,
  toolName?: string,
): { body: unknown; tool?: string; errorCode: string; wwwAuthenticate: string } {
  const { error, description, scope } = challengeForAuthError(err, toolName);
  const challenge = crmWwwAuthenticate(error, description, scope);
  const payload = toolErrorPayload(err, requestId);
  return {
    body: jsonRpcResult(id, {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
      isError: true,
      _meta: { "mcp/www_authenticate": [challenge] },
    }),
    tool: toolName,
    errorCode: err.code,
    wwwAuthenticate: challenge,
  };
}

function handleDiscovery(rpc: JsonRpcRequest): CrmMcpHandled {
  const id = (rpc.id ?? null) as JsonRpcId;
  const method = rpc.method;

  if (method === "initialize") {
    const params = (rpc.params && typeof rpc.params === "object" ? rpc.params : {}) as { protocolVersion?: string };
    return {
      body: jsonRpcResult(id, {
        protocolVersion: protocolVersion(params.protocolVersion),
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: CRM_MCP_SERVER_NAME, version: CRM_MCP_SERVER_VERSION },
        instructions:
          "Notificas CRM MCP is the internal commercial CRM (not the certified product). Use search_* then get_*. Workspace is fixed by the server. Writes require crm:write, campaigns:write or linkedin:write. LinkedIn CRM tools: search_linkedin_campaigns, get_linkedin_campaign, preview_linkedin_campaign, search_linkedin_pending_actions, get_linkedin_pending_actions, search_linkedin_outreach, create_linkedin_campaign_draft, update_linkedin_campaign, update_linkedin_campaign_draft, add_contact_to_linkedin_campaign, create_linkedin_outreach, update_linkedin_outreach_status, record_linkedin_action, archive_linkedin_campaign, restore_linkedin_campaign. They are records for manual organization only and never automate, send, connect, message or scrape LinkedIn. Sending, scheduling, deleting and bulk import are not available.",
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
    return { body: jsonRpcResult(id, { tools: listAllCrmMcpTools() }), tool: "tools/list" };
  }

  return { body: jsonRpcError(id, JSONRPC.METHOD_NOT_FOUND, `Method not found: ${method}`) };
}

async function handleToolsCall(
  rpc: JsonRpcRequest,
  request: Request,
  requestId: string,
): Promise<CrmMcpHandled> {
  const id = (rpc.id ?? null) as JsonRpcId;
  const params = (rpc.params && typeof rpc.params === "object" ? rpc.params : {}) as {
    name?: string;
    arguments?: unknown;
  };
  if (!params.name) {
    return { body: jsonRpcError(id, JSONRPC.INVALID_PARAMS, "Missing tool name.") };
  }

  let ctx: CrmMcpAuthContext;
  try {
    ctx = await authenticateCrmMcpRequest(request, requestId);
    const idem = request.headers.get("Idempotency-Key")?.trim();
    if (idem && idem.length <= 128) ctx.idempotencyKey = idem;
  } catch (e) {
    const err = e instanceof McpToolError ? e : new McpToolError("UNAUTHORIZED", "Unauthorized.", 401);
    return { ...authChallengeToolResult(id, requestId, err, params.name), actor: undefined, client: undefined };
  }

  try {
    if (!isCrmMcpTestRuntime()) {
      await consumeMcpRateLimit({
        userId: ctx.actor,
        orgId: `crmws:${ctx.workspaceId}`,
        bucket: crmMcpToolIsWrite(params.name) ? "write" : "read",
      });
    }
    const result = await callCrmMcpTool(ctx, params.name, params.arguments);
    return {
      body: jsonRpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
        isError: false,
      }),
      tool: params.name,
      actor: ctx.actor,
      client: ctx.client,
    };
  } catch (e) {
    const err = e instanceof McpToolError ? e : new McpToolError("INTERNAL_ERROR", "An internal error occurred.", 500);
    if (err.code === "UNAUTHORIZED" || err.code === "INSUFFICIENT_SCOPE" || err.code === "FORBIDDEN") {
      return { ...authChallengeToolResult(id, requestId, err, params.name), actor: ctx.actor, client: ctx.client };
    }
    if (err.code === "INTERNAL_ERROR") {
      console.error("crm mcp tool", requestId, e instanceof Error ? e.message : e);
    }
    return {
      body: jsonRpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(toolErrorPayload(err, requestId)) }],
        structuredContent: toolErrorPayload(err, requestId),
        isError: true,
      }),
      tool: params.name,
      errorCode: err.code,
      actor: ctx.actor,
      client: ctx.client,
    };
  }
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

  const isDiscovery = DISCOVERY_METHODS.has(parsed.method);
  const handled: CrmMcpHandled = isDiscovery
    ? handleDiscovery(parsed)
    : parsed.method === "tools/call"
      ? await handleToolsCall(parsed, request, requestId)
      : { body: jsonRpcError((parsed.id ?? null) as JsonRpcId, JSONRPC.METHOD_NOT_FOUND, `Method not found: ${parsed.method}`) };

  const body = handled.body;
  const isError = Boolean(handled.errorCode) || (body && typeof body === "object" && "error" in (body as object));
  if (!isDiscovery && !isCrmMcpTestRuntime()) {
    void writeCrmMcpAudit({
      requestId,
      actor: handled.actor,
      tool: handled.tool,
      workspaceId: crmMcpWorkspaceId(),
      result: isError ? "error" : "ok",
      durationMs: Date.now() - started,
      errorCode: handled.errorCode,
      client: handled.client,
    });
  }

  const extra: Record<string, string> = { "X-Request-Id": requestId };
  if (handled.wwwAuthenticate) {
    extra["WWW-Authenticate"] = handled.wwwAuthenticate;
  }

  if (handled.body == null) {
    return new Response(null, { status: 202, headers: { ...mcpCorsHeaders(), ...extra } });
  }
  return jsonResponse(handled.body, 200, extra);
}

export function crmMcpHealthPayload() {
  const tools = listAllCrmMcpTools();
  return {
    ok: true,
    service: CRM_MCP_SERVER_NAME,
    version: CRM_MCP_SERVER_VERSION,
    enabled: crmMcpEnabledSafe(),
    readOnly: false,
    sendForbidden: true,
    toolCount: tools.length,
    linkedinToolCount: tools.filter((tool) => /linkedin|outreach/i.test(tool.name)).length,
  };
}
