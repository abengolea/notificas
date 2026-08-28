import { registerOauthClient, validateRedirectUris } from "@/mcp/auth/clients";
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
    validateRedirectUris(body.redirect_uris);
    const client = await registerOauthClient({
      clientName: typeof body.client_name === "string" ? body.client_name : undefined,
      redirectUris: body.redirect_uris,
      clientUri: typeof body.client_uri === "string" ? body.client_uri : undefined,
    });
    return oauthCorsResponse(
      {
        client_id: client.id,
        client_id_issued_at: Math.floor(client.createdAtMs / 1000),
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        grant_types: client.grantTypes,
        response_types: client.responseTypes,
        token_endpoint_auth_method: client.tokenEndpointAuthMethod,
        client_uri: client.clientUri,
      },
      201
    );
  } catch {
    return oauthCorsResponse({ error: "invalid_client_metadata", error_description: "Invalid client metadata." }, 400);
  }
}
