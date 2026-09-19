import { adminAuth } from "@/lib/firebase-admin";
import type { NextRequest } from "next/server";
import { getAdminSessionEmail } from "@/lib/assert-admin-session";
import { clientAllowsRedirect, getOauthClient } from "@/mcp/auth/clients";
import { createAuthorizationCode } from "@/mcp/auth/tokens";
import { isMcpUserAllowlisted, mcpResourceUrl } from "@/mcp/config";
import { resolveAuthorizedOrg } from "@/mcp/auth/orgs";
import { parseScopeString } from "@/mcp/scopes";
import { crmMcpEnabledSafe, crmMcpResourceUrl, crmMcpWorkspaceId, isCrmMcpUserAllowed } from "@/mcp/crm/config";
import { parseCrmScopeString, CrmInvalidScopeError } from "@/mcp/crm/scopes";
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

export async function POST(request: NextRequest) {
  const disabled = requireMcpOauth();
  if (disabled) return disabled;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const clientId = String(body.client_id || "");
  const redirectUri = String(body.redirect_uri || "");
  const state = typeof body.state === "string" ? body.state : "";
  const codeChallenge = String(body.code_challenge || "");
  const resource = String(body.resource || mcpResourceUrl());
  const orgId = String(body.org_id || "");
  const deny = body.deny === true;
  const isCrmResource = resource === crmMcpResourceUrl();

  let decoded: { uid: string; email?: string };
  if (isCrmResource) {
    const adminEmail = getAdminSessionEmail(request);
    if (!adminEmail) {
      return oauthCorsResponse(
        { error: "unauthorized", error_description: "Administrative session required." },
        401,
      );
    }
    decoded = { uid: `admin:${adminEmail}`, email: adminEmail };
  } else {
    const authHeader = request.headers.get("Authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) {
      return oauthCorsResponse(
        { error: "unauthorized", error_description: "Firebase ID token required." },
        401,
      );
    }
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch {
      return oauthCorsResponse(
        { error: "unauthorized", error_description: "Invalid or expired session." },
        401,
      );
    }
  }

  if (isCrmResource) {
    const actor = decoded.email || decoded.uid;
    if (!crmMcpEnabledSafe() || (!isCrmMcpUserAllowed(actor) && !isCrmMcpUserAllowed(decoded.uid))) {
      return oauthCorsResponse({ error: "access_denied", error_description: "CRM MCP is not enabled for this user." }, 403);
    }
  } else if (!isMcpUserAllowlisted(decoded.uid, decoded.email || null)) {
    return oauthCorsResponse({ error: "access_denied", error_description: "MCP is not enabled for this user." }, 403);
  }

  const client = await getOauthClient(clientId);
  if (!client || !clientAllowsRedirect(client, redirectUri)) {
    return oauthCorsResponse({ error: "invalid_client" }, 400);
  }
  if (!isValidCodeChallenge(codeChallenge)) {
    return oauthCorsResponse({ error: "invalid_request", error_description: "PKCE S256 code_challenge required." }, 400);
  }
  if (resource !== mcpResourceUrl() && !isCrmResource) {
    return oauthCorsResponse({ error: "invalid_target", error_description: "Unknown resource." }, 400);
  }

  const redirect = new URL(redirectUri);
  if (deny) {
    redirect.searchParams.set("error", "access_denied");
    if (state) redirect.searchParams.set("state", state);
    return oauthCorsResponse({ redirect_to: redirect.toString() }, 200);
  }

  const org = isCrmResource ? null : await resolveAuthorizedOrg(decoded.uid, decoded.email || null, orgId);
  if (!isCrmResource && !org) {
    return oauthCorsResponse({ error: "access_denied", error_description: "You cannot authorize this company." }, 403);
  }

  let scopes;
  try {
    scopes = isCrmResource
      ? parseCrmScopeString(typeof body.scope === "string" ? body.scope : "")
      : parseScopeString(typeof body.scope === "string" ? body.scope : "");
  } catch (e) {
    if (e instanceof CrmInvalidScopeError) {
      return oauthCorsResponse({ error: e.error, error_description: e.errorDescription }, 400);
    }
    throw e;
  }
  const workspaceId = crmMcpWorkspaceId();
  const code = await createAuthorizationCode({
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod: "S256",
    resource,
    scopes,
    userId: decoded.uid,
    userEmail: decoded.email || null,
    orgId: isCrmResource ? workspaceId : org!.id,
    orgName: isCrmResource ? "Notificas CRM" : org!.nombre,
    senderUid: isCrmResource ? decoded.uid : org!.adminUserId,
    senderEmail: isCrmResource ? decoded.email || "" : org!.adminUserEmail,
    mcpClient: client.inferredClient,
  });

  redirect.searchParams.set("code", code);
  if (state) redirect.searchParams.set("state", state);
  return oauthCorsResponse({ redirect_to: redirect.toString() }, 200);
}
