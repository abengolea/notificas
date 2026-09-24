import { NextResponse } from "next/server";
import { crmAuthorizationServerMetadata, OAUTH_CORS } from "@/mcp/auth/metadata";
import { mcpEnabled } from "@/mcp/config";
import { crmMcpEnabledSafe } from "@/mcp/crm/config";
import { oauthOptions } from "@/mcp/auth/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return oauthOptions();
}

export function GET() {
  if (!mcpEnabled() && !crmMcpEnabledSafe()) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: OAUTH_CORS });
  }
  return NextResponse.json(crmAuthorizationServerMetadata(), { headers: OAUTH_CORS });
}
