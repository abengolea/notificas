import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OauthClientMetadataError,
  isAllowedRedirectUri,
  isChatgptRedirectUri,
  parseDcrRegistration,
  registrationResponse,
  summarizeDcrBody,
} from "./clients";
import { authorizationServerMetadata, crmAuthorizationServerMetadata } from "./metadata";
import { crmProtectedResourceMetadata } from "../crm/metadata";
import { GET as getAuthorizationServer } from "../../app/.well-known/oauth-authorization-server/route";
import { GET as getAuthorizationServerMcp } from "../../app/.well-known/oauth-authorization-server/mcp/route";
import { GET as getAuthorizationServerMcpCrm } from "../../app/.well-known/oauth-authorization-server/mcp/crm/route";

const REQUIRED_AS_FIELDS = [
  "issuer",
  "authorization_endpoint",
  "token_endpoint",
  "registration_endpoint",
  "response_types_supported",
  "grant_types_supported",
  "code_challenge_methods_supported",
  "token_endpoint_auth_methods_supported",
  "scopes_supported",
] as const;

const CHATGPT_DCR_REGISTRATION_ENDPOINT = "https://notificas.com.ar/oauth/register";
const CHATGPT_CRM_ISSUER = "https://notificas.com.ar";

async function readAsJson(res: Response): Promise<Record<string, unknown>> {
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("location"), null);
  const contentType = res.headers.get("content-type") || "";
  assert.equal(contentType.includes("application/json"), true);
  assert.equal(contentType.includes("text/html"), false);
  const body = (await res.json()) as Record<string, unknown>;
  for (const field of REQUIRED_AS_FIELDS) {
    assert.notEqual(body[field], undefined, `missing ${field}`);
  }
  assert.equal(body.issuer, CHATGPT_CRM_ISSUER);
  assert.equal(body.registration_endpoint, CHATGPT_DCR_REGISTRATION_ENDPOINT);
  assert.deepEqual(body.code_challenge_methods_supported, ["S256"]);
  assert.deepEqual(body.token_endpoint_auth_methods_supported, ["none"]);
  return body;
}

const chatgptPayload = {
  client_name: "ChatGPT",
  redirect_uris: ["https://chatgpt.com/connector_platform_oauth_redirect"],
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  token_endpoint_auth_method: "none",
  scope: "crm:read",
  software_id: "chatgpt-connector",
};

test("DCR accepts ChatGPT connector metadata and ignores unknown fields", () => {
  const parsed = parseDcrRegistration(chatgptPayload);
  assert.equal(parsed.clientName, "ChatGPT");
  assert.deepEqual(parsed.redirectUris, ["https://chatgpt.com/connector_platform_oauth_redirect"]);
  assert.deepEqual(parsed.grantTypes, ["authorization_code", "refresh_token"]);
  assert.deepEqual(parsed.responseTypes, ["code"]);
  assert.equal(parsed.tokenEndpointAuthMethod, "none");
  assert.equal(parsed.clientUri, undefined);
});

test("DCR accepts ChatGPT callback-id redirect and a single string redirect_uris", () => {
  const parsed = parseDcrRegistration({
    client_name: "ChatGPT",
    redirect_uris: "https://chatgpt.com/connector/oauth/abc_12",
  });
  assert.equal(parsed.redirectUris[0], "https://chatgpt.com/connector/oauth/abc_12");
  assert.equal(isChatgptRedirectUri(new URL(parsed.redirectUris[0])), true);
});

test("DCR does not put empty optional fields on the registration response", () => {
  const parsed = parseDcrRegistration(chatgptPayload);
  const body = registrationResponse({
    id: "mcp_test",
    clientName: parsed.clientName,
    redirectUris: parsed.redirectUris,
    grantTypes: parsed.grantTypes,
    responseTypes: parsed.responseTypes,
    tokenEndpointAuthMethod: parsed.tokenEndpointAuthMethod,
    inferredClient: "chatgpt",
    createdAtMs: 1_700_000_000_000,
  });
  assert.equal("client_uri" in body, false);
  assert.equal(body.token_endpoint_auth_method, "none");
  assert.ok(!Object.values(body).some((value) => value === null || value === ""));
});

test("DCR rejects insecure redirects with a specific description", () => {
  assert.throws(
    () => parseDcrRegistration({ redirect_uris: ["http://evil.example/cb"] }),
    (e: unknown) => e instanceof OauthClientMetadataError && e.errorDescription.includes("redirect_uris"),
  );
  assert.equal(isAllowedRedirectUri("javascript:alert(1)"), false);
});

test("DCR safe log does not include secrets", () => {
  const summary = summarizeDcrBody({
    client_name: "ChatGPT",
    client_secret: "super-secret",
    redirect_uris: ["https://chatgpt.com/connector_platform_oauth_redirect"],
    token_endpoint_auth_method: "none",
  });
  assert.equal(JSON.stringify(summary).includes("super-secret"), false);
  assert.deepEqual(summary.redirect_hosts, ["chatgpt.com"]);
});

test("OAuth metadata advertises PKCE S256, DCR and none auth", () => {
  const meta = authorizationServerMetadata();
  assert.equal(meta.authorization_endpoint.endsWith("/oauth/authorize"), true);
  assert.equal(meta.token_endpoint.endsWith("/oauth/token"), true);
  assert.equal(meta.registration_endpoint.endsWith("/oauth/register"), true);
  assert.deepEqual(meta.code_challenge_methods_supported, ["S256"]);
  assert.deepEqual(meta.token_endpoint_auth_methods_supported, ["none"]);
  assert.ok(meta.grant_types_supported.includes("authorization_code"));
  assert.ok(meta.grant_types_supported.includes("refresh_token"));
});

function restoreEnv(name: string, previous: string | undefined) {
  if (previous === undefined) delete process.env[name];
  else process.env[name] = previous;
}

test("CRM protected resource is /mcp/crm", () => {
  const prevBase = process.env.MCP_BASE_URL;
  const prevApp = process.env.NEXT_PUBLIC_APP_URL;
  process.env.MCP_BASE_URL = CHATGPT_CRM_ISSUER;
  process.env.NEXT_PUBLIC_APP_URL = CHATGPT_CRM_ISSUER;
  try {
    const meta = crmProtectedResourceMetadata();
    assert.equal(meta.resource, "https://notificas.com.ar/mcp/crm");
    assert.deepEqual(meta.authorization_servers, [CHATGPT_CRM_ISSUER]);
    assert.deepEqual(
      meta.scopes_supported,
      [
        "crm:read",
        "crm:write",
        "campaigns:read",
        "campaigns:write",
        "linkedin:read",
        "linkedin:write",
        "notifications:read",
        "notifications:prepare",
        "certificates:read",
      ],
    );
    assert.equal(meta.scopes_supported.includes("notifications:send"), false);
    assert.match(meta.scope_descriptions["linkedin:read"], /manual organization/i);
    assert.match(meta.scope_descriptions["linkedin:write"], /never automates/i);
    assert.match(meta.scope_descriptions["linkedin:write"], /removing a contact's campaign membership/i);
    assert.match(meta.scope_descriptions["linkedin:write"], /cannot delete a contact or campaign/i);
  } finally {
    restoreEnv("MCP_BASE_URL", prevBase);
    restoreEnv("NEXT_PUBLIC_APP_URL", prevApp);
  }
});

test("path-aware OAuth AS discovery for /mcp/crm stays published with DCR", async () => {
  const prevCrm = process.env.CRM_MCP;
  const prevMcp = process.env.MCP_ENABLED;
  const prevBase = process.env.MCP_BASE_URL;
  const prevApp = process.env.NEXT_PUBLIC_APP_URL;
  process.env.CRM_MCP = "true";
  process.env.MCP_ENABLED = "true";
  process.env.MCP_BASE_URL = CHATGPT_CRM_ISSUER;
  process.env.NEXT_PUBLIC_APP_URL = CHATGPT_CRM_ISSUER;
  try {
    const root = await readAsJson(getAuthorizationServer());
    const product = await readAsJson(getAuthorizationServerMcp());
    const crm = await readAsJson(getAuthorizationServerMcpCrm());
    assert.deepEqual(product, root);
    assert.deepEqual(crm.scopes_supported, crmAuthorizationServerMetadata().scopes_supported);
    assert.equal((crm.scopes_supported as string[]).includes("notifications:read"), true);
    assert.equal((crm.scopes_supported as string[]).includes("notifications:prepare"), true);
    assert.equal((crm.scopes_supported as string[]).includes("certificates:read"), true);
    assert.equal((crm.scopes_supported as string[]).includes("notifications:send"), false);
    assert.equal((crm.scopes_supported as string[]).includes("account:read"), false);
    assert.equal(crm.authorization_endpoint, "https://notificas.com.ar/oauth/authorize");
    assert.equal(crm.token_endpoint, "https://notificas.com.ar/oauth/token");
    assert.equal(crm.registration_endpoint, CHATGPT_DCR_REGISTRATION_ENDPOINT);
  } finally {
    restoreEnv("CRM_MCP", prevCrm);
    restoreEnv("MCP_ENABLED", prevMcp);
    restoreEnv("MCP_BASE_URL", prevBase);
    restoreEnv("NEXT_PUBLIC_APP_URL", prevApp);
  }
});

test("regression: /.well-known/oauth-authorization-server/mcp/crm route file cannot disappear", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const routeFile = join(
    here,
    "../../app/.well-known/oauth-authorization-server/mcp/crm/route.ts",
  );
  assert.equal(existsSync(routeFile), true);
  assert.equal(typeof getAuthorizationServerMcpCrm, "function");
});
