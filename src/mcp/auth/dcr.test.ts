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
import { authorizationServerMetadata } from "./metadata";
import { crmProtectedResourceMetadata } from "../crm/metadata";

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

test("CRM protected resource is /mcp/crm", () => {
  const meta = crmProtectedResourceMetadata();
  assert.ok(String(meta.resource).endsWith("/mcp/crm"));
  assert.ok(Array.isArray(meta.authorization_servers) && meta.authorization_servers.length === 1);
  assert.deepEqual(meta.scopes_supported, ["crm:read"]);
});
