import { NextResponse } from "next/server";
import { OAUTH_CORS } from "@/mcp/auth/metadata";
import { crmMcpEnabledSafe } from "@/mcp/crm/config";
import { issueCrmClientCredentials } from "@/mcp/crm/auth";
import { McpToolError } from "@/mcp/errors";
import { mcpCorsHeaders } from "@/mcp/server";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...OAUTH_CORS, ...mcpCorsHeaders() } });
}

export async function POST(request: Request) {
  if (!crmMcpEnabledSafe()) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: OAUTH_CORS });
  }
  try {
    const contentType = request.headers.get("content-type") || "";
    let clientId = "";
    let clientSecret = "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      clientId = String(body.client_id || "");
      clientSecret = String(body.client_secret || "");
    } else {
      const text = await request.text();
      const params = new URLSearchParams(text);
      clientId = params.get("client_id") || "";
      clientSecret = params.get("client_secret") || "";
    }
    const tokens = issueCrmClientCredentials({ clientId, clientSecret });
    return NextResponse.json(tokens, { headers: OAUTH_CORS });
  } catch (e) {
    const err = e instanceof McpToolError ? e : new McpToolError("UNAUTHORIZED", "Unauthorized.", 401);
    return NextResponse.json({ error: err.code, error_description: err.message }, { status: err.httpStatus, headers: OAUTH_CORS });
  }
}
