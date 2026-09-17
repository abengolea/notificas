import { test } from "node:test";
import assert from "node:assert/strict";
import { marketingContext } from "../context";
import { executeCrmTool } from "./execute";
import { createMemoryCrmToolRuntime } from "./runtime";
import { mcpCrmToolDefinitions, crmWriteTools } from "./registry";
import { CRM_FORBIDDEN_TOOL_NAMES, CRM_WRITE_TOOL_NAMES } from "./types";
import { listCrmMcpTools } from "../../../mcp/crm/registry";

function setup(workspaceId = "notificas-internal") {
  const { runtime } = createMemoryCrmToolRuntime();
  const ctx = {
    ...marketingContext(workspaceId, { actorType: "user", actorId: "adrian" }),
    userId: "adrian",
  };
  const other = {
    ...marketingContext("otro-workspace", { actorType: "user", actorId: "otro" }),
    userId: "otro",
  };
  return { runtime, ctx, other };
}

test("MCP CRM registry is read-only and has no send/write tools", () => {
  const names: string[] = listCrmMcpTools().map((t) => t.name);
  for (const write of CRM_WRITE_TOOL_NAMES) {
    assert.equal(names.includes(write), false);
  }
  for (const forbidden of CRM_FORBIDDEN_TOOL_NAMES) {
    assert.equal(names.includes(forbidden), false);
  }
  assert.ok(names.includes("search_companies"));
  assert.ok(names.includes("get_crm_stats"));
  assert.equal(
    listCrmMcpTools().every((t) => t.annotations.readOnlyHint === true),
    true,
  );
  assert.equal(mcpCrmToolDefinitions().length, names.length);
  assert.ok(crmWriteTools.length > 0);
});

test("search companies and stats stay in the tool workspace", async () => {
  const { runtime, ctx, other } = setup();
  await executeCrmTool({
    runtime,
    ctx,
    name: "create_company",
    args: { name: "Naturgy", countryCode: "AR" },
    mode: "readwrite",
  });
  await executeCrmTool({
    runtime,
    ctx: other,
    name: "create_company",
    args: { name: "Empresa Ajena", countryCode: "CL" },
    mode: "readwrite",
  });

  const found = await executeCrmTool({
    runtime,
    ctx,
    name: "search_companies",
    args: { query: "Naturgy", workspaceId: "otro-workspace" },
    mode: "read",
  });
  assert.equal(found.ok, true);
  if (!found.ok) return;
  const items = (found.data as { items: Array<{ name: string }> }).items;
  assert.equal(items.length, 1);
  assert.equal(items[0].name, "Naturgy");

  const foreign = await executeCrmTool({
    runtime,
    ctx,
    name: "search_companies",
    args: { query: "Empresa Ajena" },
    mode: "read",
  });
  assert.equal(foreign.ok, true);
  if (!foreign.ok) return;
  assert.equal((foreign.data as { items: unknown[] }).items.length, 0);

  const stats = await executeCrmTool({ runtime, ctx, name: "get_crm_stats", args: {}, mode: "read" });
  assert.equal(stats.ok, true);
});

test("get_company bounds related lists and pagination respects max", async () => {
  const { runtime, ctx } = setup();
  const created = await executeCrmTool({
    runtime,
    ctx,
    name: "create_company",
    args: { name: "Sancor", countryCode: "AR" },
    mode: "readwrite",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const companyId = (created.data as { company: { id: string } }).company.id;
  const got = await executeCrmTool({
    runtime,
    ctx,
    name: "get_company",
    args: { companyId },
    mode: "read",
  });
  assert.equal(got.ok, true);
  if (!got.ok) return;
  const data = got.data as { contacts: unknown[]; pendingTasks: unknown[] };
  assert.ok(data.contacts.length <= 8);
  assert.ok(data.pendingTasks.length <= 8);

  const paged = await executeCrmTool({
    runtime,
    ctx,
    name: "search_companies",
    args: { countryCode: "AR", limit: 250 },
    mode: "read",
  });
  assert.equal(paged.ok, true);
});

test("read mode rejects write tools; send tools do not exist", async () => {
  const { runtime, ctx } = setup();
  const write = await executeCrmTool({
    runtime,
    ctx,
    name: "create_company",
    args: { name: "X" },
    mode: "read",
  });
  assert.equal(write.ok, false);
  if (write.ok) return;
  assert.equal(write.error.code, "read_only");

  const send = await executeCrmTool({
    runtime,
    ctx,
    name: "send_campaign",
    args: { campaignId: "x" },
    mode: "readwrite",
  });
  assert.equal(send.ok, false);
  if (send.ok) return;
  assert.equal(send.error.code, "forbidden_tool");
});

test("invalid tool args become validation_error", async () => {
  const { runtime, ctx } = setup();
  const res = await executeCrmTool({
    runtime,
    ctx,
    name: "get_company",
    args: {},
    mode: "read",
  });
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.error.code, "validation_error");
});

test("create_company surfaces duplicate warnings", async () => {
  const { runtime, ctx } = setup();
  await executeCrmTool({
    runtime,
    ctx,
    name: "create_company",
    args: { name: "Naturgy NOA", website: "https://naturgy.com.ar", countryCode: "AR" },
    mode: "readwrite",
  });
  const second = await executeCrmTool({
    runtime,
    ctx,
    name: "create_company",
    args: { name: "Otra", website: "naturgy.com.ar", countryCode: "CL" },
    mode: "readwrite",
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.ok((second.duplicateWarnings || []).length > 0);
  assert.ok(second.summary?.toLowerCase().includes("duplic"));
});

test("ambiguous company name does not create a contact", async () => {
  const { runtime, ctx } = setup();
  await executeCrmTool({
    runtime,
    ctx,
    name: "create_company",
    args: { name: "Acme", countryCode: "CL" },
    mode: "readwrite",
  });
  await executeCrmTool({
    runtime,
    ctx,
    name: "create_company",
    args: { name: "Acme", countryCode: "PE" },
    mode: "readwrite",
  });
  const contact = await executeCrmTool({
    runtime,
    ctx,
    name: "create_contact",
    args: { email: "juan@acme.test", name: "Juan", companyName: "Acme" },
    mode: "readwrite",
  });
  assert.equal(contact.ok, true);
  if (!contact.ok) return;
  assert.equal(contact.needsClarification, true);
  const listed = await executeCrmTool({
    runtime,
    ctx,
    name: "search_contacts",
    args: { query: "juan@acme.test" },
    mode: "read",
  });
  assert.equal(listed.ok, true);
  if (!listed.ok) return;
  assert.equal((listed.data as { items: unknown[] }).items.length, 0);
});

test("create retry with the same idempotency key does not duplicate companies", async () => {
  const { runtime, ctx } = setup();
  const first = await executeCrmTool({
    runtime,
    ctx: { ...ctx, conversationId: "conv-1", idempotencyKey: "call_same" },
    name: "create_company",
    args: { name: "Seguros XYZ", countryCode: "CL" },
    mode: "readwrite",
  });
  const second = await executeCrmTool({
    runtime,
    ctx: { ...ctx, conversationId: "conv-1", idempotencyKey: "call_same" },
    name: "create_company",
    args: { name: "Seguros XYZ", countryCode: "CL" },
    mode: "readwrite",
  });
  assert.equal(first.ok && second.ok, true);
  if (!first.ok || !second.ok) return;
  const id1 = (first.data as { company: { id: string } }).company.id;
  const id2 = (second.data as { company: { id: string } }).company.id;
  assert.equal(id1, id2);
  const listed = await executeCrmTool({
    runtime,
    ctx,
    name: "search_companies",
    args: { query: "Seguros XYZ" },
    mode: "read",
  });
  assert.equal(listed.ok, true);
  if (!listed.ok) return;
  assert.equal((listed.data as { items: unknown[] }).items.length, 1);
});

test("create_task for a unique company name", async () => {
  const { runtime, ctx } = setup();
  await executeCrmTool({
    runtime,
    ctx,
    name: "create_company",
    args: { name: "Naturgy", countryCode: "AR" },
    mode: "readwrite",
  });
  const task = await executeCrmTool({
    runtime,
    ctx,
    name: "create_task",
    args: { title: "Volver a contactar", companyName: "Naturgy", dueInDays: 7 },
    mode: "readwrite",
  });
  assert.equal(task.ok, true);
  if (!task.ok) return;
  assert.ok(task.summary?.includes("Tarea creada"));
});
