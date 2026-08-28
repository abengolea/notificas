import { NextResponse } from "next/server";
import { OAUTH_CORS } from "@/mcp/auth/metadata";
import { mcpEnabled } from "@/mcp/config";

export function oauthCorsResponse(body: unknown, status: number, extra?: Record<string, string>): NextResponse {
  const res = NextResponse.json(body, { status });
  for (const [k, v] of Object.entries(OAUTH_CORS)) res.headers.set(k, v);
  if (extra) for (const [k, v] of Object.entries(extra)) res.headers.set(k, v);
  return res;
}

export function oauthOptions(): NextResponse {
  return new NextResponse(null, { status: 204, headers: OAUTH_CORS });
}

export function oauthDisabled(): NextResponse {
  return oauthCorsResponse({ error: "temporarily_unavailable", error_description: "MCP is not enabled." }, 503);
}

export function requireMcpOauth(): NextResponse | null {
  if (!mcpEnabled()) return oauthDisabled();
  return null;
}

export async function readFormOrJson(request: Request): Promise<Record<string, string>> {
  const ctype = request.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(json)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  }
  const text = await request.text();
  const params = new URLSearchParams(text);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}
