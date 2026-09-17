import { NextResponse } from "next/server";
import { OAUTH_CORS } from "@/mcp/auth/metadata";
import { crmMcpEnabledSafe } from "@/mcp/crm/config";
import { crmProtectedResourceMetadata } from "@/mcp/crm/metadata";
import { oauthOptions } from "@/mcp/auth/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return oauthOptions();
}

export function GET() {
  if (!crmMcpEnabledSafe()) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: OAUTH_CORS });
  }
  return NextResponse.json(crmProtectedResourceMetadata(), { headers: OAUTH_CORS });
}
