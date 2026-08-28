import { NextResponse } from "next/server";
import { authorizationServerMetadata, OAUTH_CORS } from "@/mcp/auth/metadata";
import { mcpEnabled } from "@/mcp/config";
import { oauthOptions } from "@/mcp/auth/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return oauthOptions();
}

export function GET() {
  if (!mcpEnabled()) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: OAUTH_CORS });
  }
  return NextResponse.json(authorizationServerMetadata(), { headers: OAUTH_CORS });
}
