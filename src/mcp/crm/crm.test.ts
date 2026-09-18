import { test } from "node:test";
import assert from "node:assert/strict";
import { crmMcpEnabledSafe, crmMcpResourceUrl, CRM_MCP_SERVER_NAME } from "./config";
import { crmMcpHasRead, parseCrmScopeString, CRM_MCP_SCOPES } from "./scopes";
import { listCrmMcpTools, crmMcpWriteToolCount, assertCrmMcpToolAllowed } from "./registry";
import { McpToolError } from "../errors";
import { mcpResourceUrl } from "../config";
import { CRM_WRITE_TOOL_NAMES } from "../../lib/marketing/tools/types";

test("CRM MCP is disabled by default and isolated from product resource", () => {
  assert.equal(crmMcpEnabledSafe(), process.env.CRM_MCP === "true" || process.env.CRM_MCP === "1");
  assert.equal(CRM_MCP_SERVER_NAME, "notificas-mcp-crm");
  assert.notEqual(crmMcpResourceUrl(), mcpResourceUrl());
  assert.ok(crmMcpResourceUrl().endsWith("/mcp/crm"));
  assert.equal(mcpResourceUrl().endsWith("/mcp"), true);
  assert.equal(mcpResourceUrl().endsWith("/mcp/crm"), false);
});

test("CRM MCP scopes are crm:read only", () => {
  assert.deepEqual([...CRM_MCP_SCOPES], ["crm:read"]);
  assert.equal(crmMcpHasRead(parseCrmScopeString("crm:read")), true);
  assert.equal(crmMcpHasRead(["account:read", "notifications:send"]), false);
  assert.equal(parseCrmScopeString("notifications:send account:read").includes("crm:read"), true);
});

test("CRM MCP tool list never includes writes", () => {
  const tools = listCrmMcpTools();
  const names: string[] = tools.map((t) => t.name);
  for (const write of CRM_WRITE_TOOL_NAMES) assert.equal(names.includes(write), false);
  assert.equal(names.includes("send_campaign"), false);
  assert.equal(crmMcpWriteToolCount(), 0);
  for (const tool of tools) {
    assert.deepEqual(tool.securitySchemes, [{ type: "oauth2", scopes: ["crm:read"] }]);
  }
  assert.throws(() => assertCrmMcpToolAllowed("create_company"), McpToolError);
  assert.throws(() => assertCrmMcpToolAllowed("send_email"), McpToolError);
});
