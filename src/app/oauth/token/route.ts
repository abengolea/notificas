import { getOauthClient, clientAllowsRedirect } from "@/mcp/auth/clients";
import { consumeAuthorizationCode, issueTokens, refreshTokens } from "@/mcp/auth/tokens";
import { mcpResourceUrl } from "@/mcp/config";
import { oauthCorsResponse, oauthOptions, readFormOrJson, requireMcpOauth } from "@/mcp/auth/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return oauthOptions();
}

export async function POST(request: Request) {
  const disabled = requireMcpOauth();
  if (disabled) return disabled;
  const body = await readFormOrJson(request);
  const grant = body.grant_type;

  try {
    if (grant === "authorization_code") {
      const clientId = body.client_id || "";
      const redirectUri = body.redirect_uri || "";
      const code = body.code || "";
      const verifier = body.code_verifier || "";
      const resource = body.resource || mcpResourceUrl();
      const client = await getOauthClient(clientId);
      if (!client || !clientAllowsRedirect(client, redirectUri)) {
        return oauthCorsResponse({ error: "invalid_client" }, 401);
      }
      const rec = await consumeAuthorizationCode({
        code,
        clientId,
        redirectUri,
        codeVerifier: verifier,
        resource,
      });
      const tokens = await issueTokens(rec);
      return oauthCorsResponse(tokens, 200, { "Cache-Control": "no-store" });
    }

    if (grant === "refresh_token") {
      const tokens = await refreshTokens(body.refresh_token || "", body.resource || undefined);
      return oauthCorsResponse(tokens, 200, { "Cache-Control": "no-store" });
    }

    return oauthCorsResponse({ error: "unsupported_grant_type" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invalid_grant";
    if (msg === "invalid_target") {
      return oauthCorsResponse({ error: "invalid_target", error_description: "Token resource mismatch." }, 400);
    }
    return oauthCorsResponse({ error: "invalid_grant" }, 400);
  }
}
