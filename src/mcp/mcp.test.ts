import { test } from "node:test";
import assert from "node:assert/strict";
import { canAffordCredits, creditsRequiredForNotification, normalizeEnviosDisponibles } from "../lib/envios";
import { errorBody, PublicApiError, unauthorized } from "../lib/public-api/errors";
import { assertTenant } from "../lib/public-api/tenant";
import { missingTemplateVariables } from "../lib/public-api/templates";
import { createNotificationSchema, isValidEmail, isValidIdempotencyKey } from "../lib/public-api/validation";
import { toWhatsAppPhone } from "../lib/parse-campaign-csv";
import { requestFingerprint } from "../lib/public-api/idempotency-hash";
import { retryAfterSeconds, windowStartMs } from "../lib/public-api/rate-limit-config";
import {
  isMcpUserAllowlisted,
  mcpAllowAllUsers,
  mcpEnabled,
  MCP_SERVER_NAME,
} from "./config";
import { hasMcpScope, parseScopeString, MCP_SCOPES } from "./scopes";
import { McpToolError, mcpErrorFromPublic, toolErrorPayload } from "./errors";
import { isJsonRpcRequest, jsonRpcError, JSONRPC, annotationsFor } from "./protocol";
import { codeChallengeS256, newCodeVerifier, verifyPkceS256, isValidCodeChallenge } from "./auth/pkce";
import { bearerFromAuthorization, isApiKeyOnMcp, isExpiredToken } from "./auth/bearer";
import { inferMcpClientFromName, inferMcpClientFromUserAgent } from "./auth/client-name";
import { isAllowedRedirectUri } from "./auth/clients";
import { isForbiddenMcpTool, FORBIDDEN_MCP_TOOLS, IMPLEMENTED_MCP_TOOLS } from "./tools/policy";
import {
  parseOrThrow,
  prepareWhatsappSchema,
  sendWhatsappSchema,
  sendEmailSchema,
  createCampaignDraftSchema,
  requireEmail,
  requirePhone,
} from "./tools/schemas";

test("feature flag: MCP off by default", () => {
  assert.equal(mcpEnabled(), process.env.MCP_ENABLED === "true");
  assert.equal(MCP_SERVER_NAME, "notificas-mcp");
});

test("allowlist: empty list denies unless MCP_ALLOW_ALL", () => {
  const prevAllow = process.env.MCP_ALLOWED_USERS;
  const prevAll = process.env.MCP_ALLOW_ALL;
  process.env.MCP_ALLOWED_USERS = "";
  process.env.MCP_ALLOW_ALL = "";
  assert.equal(isMcpUserAllowlisted("uid-1", "a@b.com"), false);
  process.env.MCP_ALLOW_ALL = "true";
  assert.equal(isMcpUserAllowlisted("uid-1", "a@b.com"), true);
  process.env.MCP_ALLOW_ALL = "";
  process.env.MCP_ALLOWED_USERS = "uid-1,a@b.com";
  assert.equal(isMcpUserAllowlisted("uid-1", "other@x.com"), true);
  assert.equal(isMcpUserAllowlisted("other", "a@b.com"), true);
  assert.equal(isMcpUserAllowlisted("zzz", "no@x.com"), false);
  process.env.MCP_ALLOWED_USERS = prevAllow;
  process.env.MCP_ALLOW_ALL = prevAll;
  void mcpAllowAllUsers;
});

test("auth: missing, invalid shape, expired, API key rejected on MCP", () => {
  assert.equal(bearerFromAuthorization(null), null);
  assert.equal(bearerFromAuthorization("Basic abc"), null);
  assert.equal(bearerFromAuthorization("Bearer ntf_atk_ok"), "ntf_atk_ok");
  assert.equal(isApiKeyOnMcp("ntf_live_abc"), true);
  assert.equal(isApiKeyOnMcp("ntf_test_abc"), true);
  assert.equal(isApiKeyOnMcp("ntf_atk_abc"), false);
  assert.equal(isExpiredToken(Date.now() - 1000), true);
  assert.equal(isExpiredToken(Date.now() + 60_000), false);
});

test("scopes: send is not granted by read/prepare", () => {
  const granted = parseScopeString("account:read notifications:read notifications:prepare");
  assert.equal(hasMcpScope(granted, "notifications:send"), false);
  assert.equal(hasMcpScope(granted, "account:read"), true);
  assert.equal(hasMcpScope([], "account:read"), false);
  assert.equal(MCP_SCOPES.includes("notifications:send"), true);
});

test("tenant isolation hides foreign resources as 404", () => {
  assert.throws(
    () => assertTenant("org_a", "org_b"),
    (e: unknown) => e instanceof PublicApiError && e.httpStatus === 404
  );
});

test("credits: real unit is 1 per notification; insufficient vs sufficient", () => {
  assert.equal(creditsRequiredForNotification("whatsapp"), 1);
  assert.equal(creditsRequiredForNotification("email"), 1);
  assert.equal(canAffordCredits(5, 1), true);
  assert.equal(canAffordCredits(0, 1), false);
  assert.equal(canAffordCredits(-3, 1), false);
  assert.equal(normalizeEnviosDisponibles(-8), 0);
  assert.equal(canAffordCredits(10, 10), true);
  assert.equal(canAffordCredits(9, 10), false);
});

test("whatsapp: invalid phone, extra companyId rejected, missing template variable", () => {
  assert.equal(toWhatsAppPhone("123"), undefined);
  assert.throws(() => requirePhone("123"), (e: unknown) => e instanceof McpToolError && e.code === "INVALID_RECIPIENT");
  const sneaky = createNotificationSchema.safeParse({
    channel: "whatsapp",
    recipient: { phone: "+5493364123456" },
    orgId: "other-company",
    companyId: "other-company",
  });
  assert.equal(sneaky.success, false);
  const missing = missingTemplateVariables(["nombre", "monto", "url_lectura"], { nombre: "Ana" });
  assert.deepEqual(missing, ["monto"]);
  const wa = prepareWhatsappSchema.safeParse({ recipientPhone: "ab" });
  assert.equal(wa.success, false);
});

test("email: invalid address rejected; send schema requires idempotency", () => {
  assert.equal(isValidEmail("not-an-email"), false);
  assert.throws(() => requireEmail("not-an-email"), (e: unknown) => e instanceof McpToolError && e.code === "INVALID_RECIPIENT");
  const send = sendEmailSchema.safeParse({
    recipientEmail: "ana@empresa.com",
    subject: "Aviso",
    body: "Hola",
  });
  assert.equal(send.success, false);
  const ok = sendEmailSchema.safeParse({
    recipientEmail: "ana@empresa.com",
    subject: "Aviso",
    body: "Hola",
    idempotencyKey: "send-1",
  });
  assert.equal(ok.success, true);
});

test("idempotency: same body fingerprints match; different body does not", () => {
  const a = requestFingerprint({ channel: "whatsapp", phone: "+549111" });
  const b = requestFingerprint({ channel: "whatsapp", phone: "+549111" });
  const c = requestFingerprint({ channel: "email", phone: "+549111" });
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(isValidIdempotencyKey("retry-1"), true);
  const send = sendWhatsappSchema.safeParse({
    recipientPhone: "+5491112345678",
    idempotencyKey: "retry-1",
  });
  assert.equal(send.success, true);
});

test("campaigns: draft allowed; send_campaign and bulk tools are impossible", () => {
  for (const name of FORBIDDEN_MCP_TOOLS) {
    assert.equal(isForbiddenMcpTool(name), true);
    assert.equal((IMPLEMENTED_MCP_TOOLS as readonly string[]).includes(name), false);
  }
  assert.equal(isForbiddenMcpTool("send_whatsapp"), false);
  const draft = createCampaignDraftSchema.safeParse({
    channel: "whatsapp",
    recipients: [{ phone: "+5491112345678", name: "Ana" }],
  });
  assert.equal(draft.success, true);
  const tooMany = createCampaignDraftSchema.safeParse({
    channel: "whatsapp",
    recipients: Array.from({ length: 201 }, (_, i) => ({ phone: `+549111234${String(i).padStart(4, "0")}` })),
  });
  assert.equal(tooMany.success, false);
});

test("rate limiting windows produce retry-after", () => {
  const now = 1_700_000_060_000;
  const start = windowStartMs(now, 60);
  assert.equal(start % 60_000, 0);
  const retry = retryAfterSeconds(now, 60);
  assert.ok(retry >= 1 && retry <= 60);
});

test("PKCE S256 verifies; invalid verifier fails", () => {
  const verifier = newCodeVerifier();
  const challenge = codeChallengeS256(verifier);
  assert.equal(isValidCodeChallenge(challenge), true);
  assert.equal(verifyPkceS256(verifier, challenge), true);
  assert.equal(verifyPkceS256("short", challenge), false);
  assert.equal(verifyPkceS256(newCodeVerifier(), challenge), false);
});

test("OAuth redirect URIs: https and localhost only", () => {
  assert.equal(isAllowedRedirectUri("https://claude.ai/api/mcp/auth/callback"), true);
  assert.equal(isAllowedRedirectUri("http://localhost:3000/cb"), true);
  assert.equal(isAllowedRedirectUri("http://evil.example/cb"), false);
  assert.equal(isAllowedRedirectUri("javascript:alert(1)"), false);
});

test("errors: no stack traces; public API maps to MCP codes", () => {
  const err = unauthorized("invalid_token", "Invalid or expired access token.");
  const mapped = mcpErrorFromPublic(err);
  assert.equal(mapped.code, "UNAUTHORIZED");
  const body = toolErrorPayload(mapped, "req_test");
  assert.equal("stack" in (body.error as object), false);
  assert.equal((body.error as { code: string }).code, "UNAUTHORIZED");
  const apiBody = errorBody(err, "req_test");
  assert.equal("stack" in apiBody.error, false);
});

test("protocol: initialize-shaped JSON-RPC and write annotations have side effects", () => {
  assert.equal(isJsonRpcRequest({ jsonrpc: "2.0", method: "initialize", id: 1 }), true);
  assert.equal(isJsonRpcRequest({ method: "initialize" }), false);
  const err = jsonRpcError(1, JSONRPC.METHOD_NOT_FOUND, "nope");
  assert.equal(err.error.code, JSONRPC.METHOD_NOT_FOUND);
  const write = annotationsFor("write");
  assert.equal(write.readOnlyHint, false);
  assert.equal(write.openWorldHint, true);
  const read = annotationsFor("read");
  assert.equal(read.readOnlyHint, true);
});

test("client inference is metadata only", () => {
  assert.equal(inferMcpClientFromName("ChatGPT"), "chatgpt");
  assert.equal(inferMcpClientFromName("Claude Desktop"), "claude");
  assert.equal(inferMcpClientFromUserAgent("Claude-User"), "claude");
});

test("parseOrThrow surfaces VALIDATION_ERROR without leaking internals", () => {
  assert.throws(
    () => parseOrThrow(sendWhatsappSchema, { recipientPhone: "+5491112345678" }),
    (e: unknown) => e instanceof McpToolError && e.code === "VALIDATION_ERROR" && !String(e.message).includes("at ")
  );
});
