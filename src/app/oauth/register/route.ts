import { NextResponse } from "next/server";
import {
  OauthClientMetadataError,
  parseDcrRegistration,
  registerOauthClient,
  registrationResponse,
  summarizeDcrBody,
} from "@/mcp/auth/clients";
import { oauthCorsResponse, oauthOptions, requireMcpOauth } from "@/mcp/auth/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return oauthOptions();
}

export async function POST(request: Request) {
  const disabled = requireMcpOauth();
  if (disabled) return disabled;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    console.info("[oauth/register] dcr", summarizeDcrBody(body));
    const parsed = parseDcrRegistration(body);
    const client = await registerOauthClient({
      clientName: parsed.clientName,
      redirectUris: parsed.redirectUris,
      clientUri: parsed.clientUri,
      grantTypes: parsed.grantTypes,
      responseTypes: parsed.responseTypes,
    });
    return oauthCorsResponse(registrationResponse(client), 201);
  } catch (e) {
    if (e instanceof OauthClientMetadataError) {
      console.warn("[oauth/register] invalid_client_metadata", e.errorDescription);
      return oauthCorsResponse({ error: e.error, error_description: e.errorDescription }, 400);
    }
    console.error("[oauth/register] failed", e instanceof Error ? e.message : "unknown");
    return oauthCorsResponse({ error: "invalid_client_metadata", error_description: "Invalid client metadata." }, 400);
  }
}

export function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
