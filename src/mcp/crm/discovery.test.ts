import { test } from "node:test";
import assert from "node:assert/strict";
import type { AccessTokenRecord } from "../auth/tokens";
import { handleCrmMcpHttp } from "./server";
import {
  clearCrmMcpTestAccessTokens,
  crmProtectedResourceMetadataUrl,
  setCrmMcpTestAccessToken,
} from "./auth";
import {
  crmMcpExecuteCallCount,
  listAllCrmMcpTools,
  resetCrmMcpExecuteCallCount,
  setCrmMcpToolRuntimeForTests,
} from "./registry";
import { advertisedScopeForTool } from "./policy";
import { crmMcpWorkspaceId } from "./config";
import { createMemoryCrmToolRuntime } from "../../lib/marketing/tools/runtime";
import type { CrmMcpScope } from "./scopes";

const PHASE_B = [
  "send_campaign",
  "retry_failed_sends",
  "cancel_campaign",
  "pause_campaign",
  "resume_campaign",
  "schedule_campaign",
  "send_linkedin_message",
  "send_linkedin_campaign",
];

function restoreEnv(name: string, previous: string | undefined) {
  if (previous === undefined) delete process.env[name];
  else process.env[name] = previous;
}

async function crmRpc(
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; json: Record<string, unknown>; wwwAuthenticate: string | null; contentType: string }> {
  const res = await handleCrmMcpHttp(
    new Request("https://notificas.com.ar/mcp/crm", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
  const text = await res.text();
  return {
    status: res.status,
    json: JSON.parse(text) as Record<string, unknown>,
    wwwAuthenticate: res.headers.get("www-authenticate"),
    contentType: res.headers.get("content-type") || "",
  };
}

function fakeToken(scopes: CrmMcpScope[], resource = "https://notificas.com.ar/mcp/crm"): AccessTokenRecord {
  return {
    userId: "user-1",
    userEmail: "tester@notificas.com.ar",
    orgId: "notificas-internal",
    orgName: "Notificas",
    senderUid: "user-1",
    senderEmail: "tester@notificas.com.ar",
    clientId: "mcp_test",
    scopes,
    resource,
    mcpClient: "chatgpt",
    expiresAtMs: Date.now() + 60_000,
    revoked: false,
  };
}

function challengeList(json: Record<string, unknown>): string[] {
  const result = json.result as Record<string, unknown> | undefined;
  const meta = result?._meta as Record<string, unknown> | undefined;
  const list = meta?.["mcp/www_authenticate"];
  return Array.isArray(list) ? list.map(String) : [];
}

test("ChatGPT discovery is public; tools/call stays OAuth-gated", async () => {
  const prevCrm = process.env.CRM_MCP;
  const prevAllow = process.env.CRM_MCP_ALLOWED_USERS;
  const prevBase = process.env.MCP_BASE_URL;
  const prevApp = process.env.NEXT_PUBLIC_APP_URL;
  process.env.CRM_MCP = "true";
  process.env.CRM_MCP_ALLOWED_USERS = "";
  process.env.MCP_BASE_URL = "https://notificas.com.ar";
  process.env.NEXT_PUBLIC_APP_URL = "https://notificas.com.ar";
  const { runtime, repos } = createMemoryCrmToolRuntime();
  setCrmMcpToolRuntimeForTests(runtime);
  resetCrmMcpExecuteCallCount();
  clearCrmMcpTestAccessTokens();

  try {
    const init = await crmRpc({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "ChatGPT", version: "1" } },
    });
    assert.equal(init.status, 200);
    assert.equal(init.contentType.includes("application/json"), true);
    assert.equal(init.json.jsonrpc, "2.0");
    const initResult = init.json.result as Record<string, unknown>;
    assert.equal((initResult.serverInfo as { name: string }).name, "notificas-mcp-crm");
    assert.equal(crmMcpExecuteCallCount(), 0);

    const notified = await handleCrmMcpHttp(
      new Request("https://notificas.com.ar/mcp/crm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      }),
    );
    assert.equal(notified.status, 202);
    assert.equal(crmMcpExecuteCallCount(), 0);

    const listed = await crmRpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    assert.equal(listed.status, 200);
    const tools = (listed.json.result as { tools: Array<Record<string, unknown>> }).tools;
    assert.equal(tools.length, 52);
    assert.equal(listAllCrmMcpTools().length, 52);
    for (const banned of PHASE_B) assert.equal(tools.some((t) => t.name === banned), false);

    const byName = Object.fromEntries(tools.map((t) => [String(t.name), t]));
    assert.deepEqual(byName.search_companies.securitySchemes, [{ type: "oauth2", scopes: ["crm:read"] }]);
    assert.deepEqual(byName.create_company.securitySchemes, [{ type: "oauth2", scopes: ["crm:write"] }]);
    assert.deepEqual(byName.search_campaigns.securitySchemes, [{ type: "oauth2", scopes: ["campaigns:read"] }]);
    assert.deepEqual(byName.create_campaign_draft.securitySchemes, [{ type: "oauth2", scopes: ["campaigns:write"] }]);
    assert.deepEqual(byName.search_linkedin_campaigns.securitySchemes, [{ type: "oauth2", scopes: ["crm:read"] }]);
    assert.deepEqual(byName.search_linkedin_outreach.securitySchemes, [{ type: "oauth2", scopes: ["crm:read"] }]);
    assert.deepEqual(byName.get_linkedin_pending_actions.securitySchemes, [{ type: "oauth2", scopes: ["crm:read"] }]);
    assert.deepEqual(byName.create_linkedin_campaign_draft.securitySchemes, [{ type: "oauth2", scopes: ["crm:write"] }]);
    assert.deepEqual(byName.update_linkedin_campaign_draft.securitySchemes, [{ type: "oauth2", scopes: ["crm:write"] }]);
    assert.deepEqual(byName.update_linkedin_outreach_status.securitySchemes, [{ type: "oauth2", scopes: ["crm:write"] }]);
    for (const tool of tools) {
      assert.deepEqual(tool.securitySchemes, (tool._meta as { securitySchemes: unknown }).securitySchemes);
      const schemes = tool.securitySchemes as Array<{ type: string; scopes: string[] }>;
      assert.equal(schemes[0]?.type, "oauth2");
      assert.equal(schemes[0]?.scopes.length, 1);
      assert.equal(schemes[0]?.scopes[0], advertisedScopeForTool(String(tool.name)));
    }
    assert.equal(crmMcpExecuteCallCount(), 0);

    const unauthSearch = await crmRpc({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "search_companies", arguments: { query: "Acme" } },
    });
    assert.equal(unauthSearch.status, 200);
    const searchResult = unauthSearch.json.result as Record<string, unknown>;
    assert.equal(searchResult.isError, true);
    const searchChallenge = challengeList(unauthSearch.json);
    assert.equal(searchChallenge.length, 1);
    assert.match(searchChallenge[0], /resource_metadata="https:\/\/notificas.com.ar\/.well-known\/oauth-protected-resource\/mcp\/crm"/);
    assert.match(searchChallenge[0], /error="invalid_token"/);
    assert.match(searchChallenge[0], /error_description="Authentication required"/);
    assert.equal(crmMcpExecuteCallCount(), 0);

    const unauthCreate = await crmRpc({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "create_company", arguments: { name: "Acme", countryCode: "AR" } },
    });
    assert.equal(unauthCreate.status, 200);
    assert.equal((unauthCreate.json.result as { isError: boolean }).isError, true);
    assert.match(challengeList(unauthCreate.json)[0], /error="invalid_token"/);
    assert.equal(crmMcpExecuteCallCount(), 0);
    assert.equal((await repos.companies.search(crmMcpWorkspaceId(), {})).items.length, 0);

    setCrmMcpTestAccessToken("ntf_atk_read", fakeToken(["crm:read"]));
    const readSearch = await crmRpc(
      { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "search_companies", arguments: { query: "Acme" } } },
      { authorization: "Bearer ntf_atk_read" },
    );
    assert.equal(readSearch.status, 200);
    assert.equal((readSearch.json.result as { isError?: boolean }).isError, false);
    assert.ok((readSearch.json.result as { structuredContent: unknown }).structuredContent);
    assert.equal(crmMcpExecuteCallCount(), 1);

    const readCreate = await crmRpc(
      {
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: { name: "create_company", arguments: { name: "ShouldNotExist", countryCode: "AR" } },
      },
      { authorization: "Bearer ntf_atk_read" },
    );
    assert.equal(readCreate.status, 200);
    const denied = readCreate.json.result as Record<string, unknown>;
    assert.equal(denied.isError, true);
    const deniedChallenge = challengeList(readCreate.json);
    assert.match(deniedChallenge[0], /error="insufficient_scope"/);
    assert.match(deniedChallenge[0], /scope="crm:write"/);
    assert.equal(crmMcpExecuteCallCount(), 1);
    assert.equal((await repos.companies.search(crmMcpWorkspaceId(), {})).items.length, 0);

    setCrmMcpTestAccessToken("ntf_atk_write", fakeToken(["crm:write"]));
    const writeCreate = await crmRpc(
      {
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: { name: "create_company", arguments: { name: "Acme", countryCode: "AR" } },
      },
      { authorization: "Bearer ntf_atk_write" },
    );
    assert.equal(writeCreate.status, 200);
    assert.equal((writeCreate.json.result as { isError?: boolean }).isError, false);
    assert.equal(crmMcpExecuteCallCount(), 2);
    assert.equal((await repos.companies.search(crmMcpWorkspaceId(), {})).items.length, 1);

    setCrmMcpTestAccessToken("ntf_atk_product", fakeToken(["crm:read"], "https://notificas.com.ar/mcp"));
    const wrongResource = await crmRpc(
      { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "search_companies", arguments: {} } },
      { authorization: "Bearer ntf_atk_product" },
    );
    assert.equal(wrongResource.status, 200);
    assert.equal((wrongResource.json.result as { isError: boolean }).isError, true);
    assert.match(challengeList(wrongResource.json)[0], /error="invalid_token"/);
    assert.equal(crmMcpExecuteCallCount(), 2);

    assert.ok(crmProtectedResourceMetadataUrl().endsWith("/.well-known/oauth-protected-resource/mcp/crm"));

    setCrmMcpTestAccessToken(
      "ntf_atk_linkedin",
      fakeToken(["crm:write", "linkedin:read", "linkedin:write"]),
    );
    const linkedinHeaders = { authorization: "Bearer ntf_atk_linkedin" };
    const createdContact = await crmRpc(
      {
        jsonrpc: "2.0",
        id: 9,
        method: "tools/call",
        params: {
          name: "create_contact",
          arguments: {
            name: "MCP LinkedIn",
            linkedinUrl: "https://linkedin.com/in/mcp-linkedin-flow",
            countryCode: "AR",
            prospectingSource: "linkedin",
          },
        },
      },
      linkedinHeaders,
    );
    assert.equal((createdContact.json.result as { isError?: boolean }).isError, false);
    const contactId = ((createdContact.json.result as { structuredContent: { contact: { id: string } } })
      .structuredContent.contact.id);

    const createdCampaign = await crmRpc(
      {
        jsonrpc: "2.0",
        id: 10,
        method: "tools/call",
        params: {
          name: "create_linkedin_campaign_draft",
          arguments: {
            name: "MCP manual LinkedIn",
            directMessage: "Manual template",
            connectionMessage: "Manual connection",
            followUpMessage: "Manual follow-up",
          },
        },
      },
      linkedinHeaders,
    );
    assert.equal((createdCampaign.json.result as { isError?: boolean }).isError, false);
    const campaignId = ((createdCampaign.json.result as {
      structuredContent: { campaign: { id: string; status: string } };
    }).structuredContent.campaign.id);

    const addedMember = await crmRpc(
      {
        jsonrpc: "2.0",
        id: 11,
        method: "tools/call",
        params: {
          name: "add_contact_to_linkedin_campaign",
          arguments: {
            campaignId,
            contactId,
            member: { status: "connection_ready", nextActionAt: "2026-09-23T10:00:00.000Z" },
          },
        },
      },
      linkedinHeaders,
    );
    assert.equal((addedMember.json.result as { isError?: boolean }).isError, false);
    const memberId = ((addedMember.json.result as { structuredContent: { member: { id: string } } })
      .structuredContent.member.id);

    const recordedAction = await crmRpc(
      {
        jsonrpc: "2.0",
        id: 12,
        method: "tools/call",
        params: {
          name: "record_linkedin_action",
          arguments: {
            campaignId,
            memberId,
            action: "connection_sent",
            occurredAt: "2026-09-23T12:00:00.000Z",
            nextActionAt: "2026-09-24T10:00:00.000Z",
          },
        },
      },
      linkedinHeaders,
    );
    assert.equal((recordedAction.json.result as { isError?: boolean }).isError, false);

    const pendingActions = await crmRpc(
      {
        jsonrpc: "2.0",
        id: 13,
        method: "tools/call",
        params: {
          name: "search_linkedin_pending_actions",
          arguments: { dueBefore: "2026-09-25T00:00:00.000Z", limit: 10 },
        },
      },
      linkedinHeaders,
    );
    assert.deepEqual(
      (pendingActions.json.result as { structuredContent: { items: Array<{ id: string }> } })
        .structuredContent.items.map((item) => item.id),
      [memberId],
    );
  } finally {
    setCrmMcpToolRuntimeForTests(undefined);
    clearCrmMcpTestAccessTokens();
    resetCrmMcpExecuteCallCount();
    restoreEnv("CRM_MCP", prevCrm);
    restoreEnv("CRM_MCP_ALLOWED_USERS", prevAllow);
    restoreEnv("MCP_BASE_URL", prevBase);
    restoreEnv("NEXT_PUBLIC_APP_URL", prevApp);
  }
});
