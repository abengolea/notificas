import { adminAuth } from "@/lib/firebase-admin";
import { clientAllowsRedirect, getOauthClient } from "@/mcp/auth/clients";
import { createAuthorizationCode } from "@/mcp/auth/tokens";
import { isMcpUserAllowlisted, mcpResourceUrl } from "@/mcp/config";
import { resolveAuthorizedOrg } from "@/mcp/auth/orgs";
import { parseScopeString } from "@/mcp/scopes";
import { isValidCodeChallenge } from "@/mcp/auth/pkce";
import { oauthCorsResponse, oauthOptions, requireMcpOauth } from "@/mcp/auth/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const disabled = requireMcpOauth();
  if (disabled) return disabled;
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id") || "";
  const client = await getOauthClient(clientId);
  if (!client) return oauthCorsResponse({ error: "invalid_client" }, 400);
  return oauthCorsResponse({ client_name: client.clientName, client_id: client.id }, 200);
}

export function OPTIONS() {
  return oauthOptions();
}

export async function POST(request: Request) {
  const disabled = requireMcpOauth();
  if (disabled) return disabled;

  const authHeader = request.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return oauthCorsResponse({ error: "unauthorized", error_description: "Firebase ID token required." }, 401);
  }

  let decoded: { uid: string; email?: string };
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return oauthCorsResponse({ error: "unauthorized", error_description: "Invalid or expired session." }, 401);
  }

  if (!isMcpUserAllowlisted(decoded.uid, decoded.email || null)) {
    return oauthCorsResponse({ error: "access_denied", error_description: "MCP is not enabled for this user." }, 403);
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const clientId = String(body.client_id || "");
  const redirectUri = String(body.redirect_uri || "");
  const state = typeof body.state === "string" ? body.state : "";
  const codeChallenge = String(body.code_challenge || "");
  const resource = String(body.resource || mcpResourceUrl());
  const orgId = String(body.org_id || "");
  const deny = body.deny === true;

  const client = await getOauthClient(clientId);
  if (!client || !clientAllowsRedirect(client, redirectUri)) {
    return oauthCorsResponse({ error: "invalid_client" }, 400);
  }
  if (!isValidCodeChallenge(codeChallenge)) {
    return oauthCorsResponse({ error: "invalid_request", error_description: "PKCE S256 code_challenge required." }, 400);
  }
  if (resource !== mcpResourceUrl()) {
    return oauthCorsResponse({ error: "invalid_target", error_description: "Unknown resource." }, 400);
  }

  const redirect = new URL(redirectUri);
  if (deny) {
    redirect.searchParams.set("error", "access_denied");
    if (state) redirect.searchParams.set("state", state);
    return oauthCorsResponse({ redirect_to: redirect.toString() }, 200);
  }

  const org = await resolveAuthorizedOrg(decoded.uid, decoded.email || null, orgId);
  if (!org) {
    return oauthCorsResponse({ error: "access_denied", error_description: "You cannot authorize this company." }, 403);
  }

  const scopes = parseScopeString(typeof body.scope === "string" ? body.scope : "");
  const code = await createAuthorizationCode({
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod: "S256",
    resource,
    scopes,
    userId: decoded.uid,
    userEmail: decoded.email || null,
    orgId: org.id,
    orgName: org.nombre,
    senderUid: org.adminUserId,
    senderEmail: org.adminUserEmail,
    mcpClient: client.inferredClient,
  });

  redirect.searchParams.set("code", code);
  if (state) redirect.searchParams.set("state", state);
  return oauthCorsResponse({ redirect_to: redirect.toString() }, 200);
}

