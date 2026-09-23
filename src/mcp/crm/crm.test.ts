import { test } from "node:test";
import assert from "node:assert/strict";
import { crmMcpEnabledSafe, crmMcpResourceUrl, CRM_MCP_SERVER_NAME } from "./config";
import {
  crmMcpHasRead,
  parseCrmScopeString,
  parseStoredCrmScopes,
  CRM_MCP_SCOPES,
  CrmInvalidScopeError,
} from "./scopes";
import { listCrmMcpTools, listAllCrmMcpTools, crmMcpWriteToolCount, assertCrmMcpToolAllowed } from "./registry";
import { McpToolError } from "../errors";
import { mcpResourceUrl } from "../config";
import { CRM_FORBIDDEN_TOOL_NAMES } from "../../lib/marketing/tools/types";
import { CRM_MCP_PHASE_B_TOOL_SCOPES, crmMcpCanCallTool, isCrmMcpForbiddenTool } from "./policy";

const PHASE_A_SCOPES = [...CRM_MCP_SCOPES];

function namesFor(scopes: readonly string[]): string[] {
  return listCrmMcpTools(scopes).map((t) => t.name);
}

test("CRM MCP is disabled by default and isolated from product resource", () => {
  assert.equal(crmMcpEnabledSafe(), process.env.CRM_MCP === "true" || process.env.CRM_MCP === "1");
  assert.equal(CRM_MCP_SERVER_NAME, "notificas-mcp-crm");
  assert.notEqual(crmMcpResourceUrl(), mcpResourceUrl());
  assert.ok(crmMcpResourceUrl().endsWith("/mcp/crm"));
  assert.equal(mcpResourceUrl().endsWith("/mcp"), true);
  assert.equal(mcpResourceUrl().endsWith("/mcp/crm"), false);
});

test("CRM MCP scopes: empty defaults to crm:read; unknown is invalid_scope", () => {
  assert.deepEqual(
    [...CRM_MCP_SCOPES],
    ["crm:read", "crm:write", "campaigns:read", "campaigns:write", "linkedin:read", "linkedin:write"],
  );
  assert.deepEqual(parseCrmScopeString(""), ["crm:read"]);
  assert.deepEqual(parseCrmScopeString(null), ["crm:read"]);
  assert.deepEqual(parseCrmScopeString("   "), ["crm:read"]);
  assert.deepEqual(parseCrmScopeString("crm:read"), ["crm:read"]);
  assert.deepEqual(parseCrmScopeString("crm:write"), ["crm:write"]);
  assert.deepEqual(parseCrmScopeString("crm:read crm:write"), ["crm:read", "crm:write"]);
  assert.deepEqual(parseCrmScopeString("linkedin:read linkedin:write"), ["linkedin:read", "linkedin:write"]);
  assert.throws(() => parseCrmScopeString("invented:scope"), CrmInvalidScopeError);
  assert.throws(() => parseCrmScopeString("crm:read invented:scope"), CrmInvalidScopeError);
  assert.throws(() => parseCrmScopeString("campaigns:send"), CrmInvalidScopeError);
  assert.throws(() => parseCrmScopeString("notifications:send account:read"), CrmInvalidScopeError);
  try {
    parseCrmScopeString("crm:read foo");
    assert.fail("expected invalid_scope");
  } catch (e) {
    assert.equal(e instanceof CrmInvalidScopeError, true);
    if (e instanceof CrmInvalidScopeError) {
      assert.equal(e.error, "invalid_scope");
      assert.ok(e.errorDescription.includes("foo"));
    }
  }
  assert.equal(parseStoredCrmScopes(["crm:write"]).includes("crm:write"), true);
  assert.equal(parseStoredCrmScopes(["crm:write"]).includes("crm:read"), false);
  assert.equal(crmMcpHasRead(parseCrmScopeString("crm:read")), true);
  assert.equal(crmMcpHasRead(["account:read", "notifications:send"]), false);
});

test("crm:read token still sees additive reads and never writes, pause, resume or send", () => {
  const names = namesFor(["crm:read"]);
  for (const forbidden of CRM_FORBIDDEN_TOOL_NAMES) assert.equal(names.includes(forbidden), false);
  for (const phaseB of Object.keys(CRM_MCP_PHASE_B_TOOL_SCOPES)) assert.equal(names.includes(phaseB), false);
  assert.ok(names.includes("search_companies"));
  assert.ok(names.includes("search_campaigns"));
  assert.ok(names.includes("preview_campaign"));
  assert.ok(names.includes("list_taxonomy"));
  assert.ok(names.includes("search_opportunities"));
  assert.equal(crmMcpWriteToolCount(["crm:read"]), 0);
  assert.throws(() => assertCrmMcpToolAllowed("create_company", ["crm:read"]), McpToolError);
  assert.throws(() => assertCrmMcpToolAllowed("send_email", ["crm:read"]), McpToolError);
  assert.throws(() => assertCrmMcpToolAllowed("pause_campaign", ["crm:read"]), McpToolError);
  assert.throws(() => assertCrmMcpToolAllowed("resume_campaign", ["crm:read"]), McpToolError);
});

test("Fase A write scopes never publish pause, resume or send", () => {
  const names = namesFor(PHASE_A_SCOPES);
  assert.ok(names.includes("create_company"));
  assert.ok(names.includes("cancel_task"));
  assert.ok(names.includes("create_campaign_draft"));
  assert.ok(names.includes("update_campaign_draft"));
  assert.ok(names.includes("copy_campaign"));
  assert.ok(names.includes("archive_campaign"));
  assert.ok(names.includes("restore_campaign"));
  assert.equal(names.includes("pause_campaign"), false);
  assert.equal(names.includes("resume_campaign"), false);
  assert.equal(names.includes("send_campaign"), false);
  assert.equal(names.includes("retry_failed_sends"), false);
  assert.equal(names.includes("cancel_campaign"), false);
  assert.equal(names.includes("schedule_campaign"), false);
  const published: string[] = listAllCrmMcpTools().map((t) => t.name);
  for (const phaseB of Object.keys(CRM_MCP_PHASE_B_TOOL_SCOPES)) {
    assert.equal(published.includes(phaseB), false);
    assert.equal(isCrmMcpForbiddenTool(phaseB), true);
    assert.equal(crmMcpCanCallTool(phaseB, PHASE_A_SCOPES), false);
    assert.throws(() => assertCrmMcpToolAllowed(phaseB, PHASE_A_SCOPES), McpToolError);
  }
  const create = listAllCrmMcpTools().find((t) => t.name === "create_campaign_draft");
  assert.deepEqual(create?.securitySchemes, [{ type: "oauth2", scopes: ["campaigns:write"] }]);
  assert.deepEqual(create?._meta.securitySchemes, create?.securitySchemes);
  const campaignRead = listAllCrmMcpTools().find((t) => t.name === "search_campaigns");
  assert.deepEqual(campaignRead?.securitySchemes, [{ type: "oauth2", scopes: ["campaigns:read"] }]);
  assert.equal(crmMcpCanCallTool("search_campaigns", ["crm:read"]), true);
  assert.equal(crmMcpCanCallTool("search_campaigns", ["campaigns:read"]), true);
  assert.equal(create?.annotations.readOnlyHint, false);
});

test("tools published per scope combination", () => {
  const read = namesFor(["crm:read"]);
  const crmWrite = namesFor(["crm:read", "crm:write"]);
  const campWrite = namesFor(["crm:read", "campaigns:read", "campaigns:write"]);
  const all = namesFor(PHASE_A_SCOPES);

  assert.equal(read.includes("create_company"), false);
  assert.equal(read.includes("create_campaign_draft"), false);
  assert.ok(crmWrite.includes("create_company"));
  assert.equal(crmWrite.includes("create_campaign_draft"), false);
  assert.ok(campWrite.includes("create_campaign_draft"));
  assert.equal(campWrite.includes("create_company"), false);
  assert.ok(all.includes("create_company") && all.includes("create_campaign_draft"));
  assert.equal(all.includes("resume_campaign"), false);
  assert.equal(all.includes("pause_campaign"), false);
  assert.equal(all.includes("send_campaign"), false);
});

test("LinkedIn tools require dedicated read and write scopes", () => {
  const crmRead = namesFor(["crm:read"]);
  const linkedinRead = namesFor(["linkedin:read"]);
  const linkedinWrite = namesFor(["linkedin:write"]);
  const readNames = [
    "search_linkedin_campaigns",
    "get_linkedin_campaign",
    "preview_linkedin_campaign",
    "search_linkedin_pending_actions",
  ];
  const writeNames = [
    "create_linkedin_campaign_draft",
    "update_linkedin_campaign",
    "add_contact_to_linkedin_campaign",
    "remove_contact_from_linkedin_campaign",
    "update_linkedin_campaign_member",
    "record_linkedin_action",
  ];
  for (const name of readNames) {
    assert.equal(crmRead.includes(name), false);
    assert.equal(linkedinRead.includes(name), true);
    assert.equal(linkedinWrite.includes(name), false);
  }
  for (const name of writeNames) {
    assert.equal(crmRead.includes(name), false);
    assert.equal(linkedinRead.includes(name), false);
    assert.equal(linkedinWrite.includes(name), true);
  }
  for (const name of ["send_linkedin_message", "send_linkedin_campaign"]) {
    assert.equal(isCrmMcpForbiddenTool(name), true);
    assert.equal(crmMcpCanCallTool(name, CRM_MCP_SCOPES), false);
    assert.throws(() => assertCrmMcpToolAllowed(name, CRM_MCP_SCOPES), McpToolError);
  }
  const descriptors = listAllCrmMcpTools();
  assert.deepEqual(
    descriptors.find((tool) => tool.name === "search_linkedin_campaigns")?.securitySchemes,
    [{ type: "oauth2", scopes: ["linkedin:read"] }],
  );
  assert.deepEqual(
    descriptors.find((tool) => tool.name === "record_linkedin_action")?.securitySchemes,
    [{ type: "oauth2", scopes: ["linkedin:write"] }],
  );
});
