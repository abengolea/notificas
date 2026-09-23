import { test } from "node:test";
import assert from "node:assert/strict";
import { marketingContext } from "../context";
import { executeCrmTool } from "./execute";
import { createMemoryCrmToolRuntime } from "./runtime";
import { mcpCrmToolDefinitions, crmWriteTools } from "./registry";
import { CRM_FORBIDDEN_TOOL_NAMES, CRM_READ_TOOL_NAMES, CRM_WRITE_TOOL_NAMES } from "./types";
import { listCrmMcpTools } from "../../../mcp/crm/registry";
import { CRM_READ_HANDLERS } from "./read";
import { CRM_WRITE_HANDLERS } from "./write";

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

test("every declared CRM tool has a handler and MCP never lists send", () => {
  for (const name of CRM_READ_TOOL_NAMES) {
    assert.equal(name in CRM_READ_HANDLERS, true, name);
  }
  for (const name of CRM_WRITE_TOOL_NAMES) {
    assert.equal(name in CRM_WRITE_HANDLERS, true, name);
  }
  const listed: string[] = mcpCrmToolDefinitions().map((t) => t.name);
  assert.equal(listed.includes("send_campaign"), false);
  assert.equal(listed.includes("retry_failed_sends"), false);
});

test("MCP CRM registry with crm:read stays additive-read and has no send/write tools", () => {
  const names: string[] = listCrmMcpTools(["crm:read"]).map((t) => t.name);
  for (const write of CRM_WRITE_TOOL_NAMES) {
    assert.equal(names.includes(write), false);
  }
  for (const forbidden of CRM_FORBIDDEN_TOOL_NAMES) {
    assert.equal(names.includes(forbidden), false);
  }
  assert.ok(names.includes("search_companies"));
  assert.ok(names.includes("get_crm_stats"));
  assert.ok(names.includes("preview_campaign"));
  assert.ok(names.includes("list_taxonomy"));
  assert.ok(names.includes("search_linkedin_campaigns"));
  assert.ok(names.includes("get_linkedin_pending_actions"));
  assert.ok(names.includes("search_linkedin_outreach"));
  assert.equal(
    listCrmMcpTools(["crm:read"]).every((t) => t.annotations.readOnlyHint === true),
    true,
  );
  assert.ok(mcpCrmToolDefinitions().length > names.length);
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

test("create_company uses industryIds; industryId is rejected", async () => {
  const { runtime, ctx } = setup();
  const okIds = await executeCrmTool({
    runtime,
    ctx,
    name: "create_company",
    args: { name: "Metrogas", countryCode: "AR", industryIds: ["gas"] },
    mode: "readwrite",
  });
  assert.equal(okIds.ok, true);
  const bad = await executeCrmTool({
    runtime,
    ctx,
    name: "create_company",
    args: { name: "Wrong field", countryCode: "AR", industryId: "gas" },
    mode: "readwrite",
  });
  assert.equal(bad.ok, false);
  if (bad.ok) return;
  assert.equal(bad.error.code, "validation_error");
});

test("list_taxonomy returns canonical industry keys", async () => {
  const { runtime, ctx } = setup();
  const res = await executeCrmTool({ runtime, ctx, name: "list_taxonomy", args: {}, mode: "read" });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  const data = res.data as { industries: Array<{ key: string }>; commercialStages: Array<{ id: string }> };
  assert.ok(data.industries.some((i) => i.key === "mercado_capitales"));
  assert.ok(data.commercialStages.some((s) => s.id === "nuevo"));
});

test("cancel_task marks a task cancelled", async () => {
  const { runtime, ctx } = setup();
  const created = await executeCrmTool({
    runtime,
    ctx,
    name: "create_task",
    args: { title: "Llamar mañana" },
    mode: "readwrite",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const taskId = (created.data as { task: { id: string } }).task.id;
  const cancelled = await executeCrmTool({
    runtime,
    ctx,
    name: "cancel_task",
    args: { taskId },
    mode: "readwrite",
  });
  assert.equal(cancelled.ok, true);
  if (!cancelled.ok) return;
  assert.equal((cancelled.data as { task: { status: string } }).task.status, "cancelled");
});

test("create_campaign_draft never sends and rejects send in the same call", async () => {
  const { runtime, ctx } = setup();
  const list = await executeCrmTool({
    runtime,
    ctx,
    name: "create_list",
    args: { name: "ALyC AR", countryCode: "AR" },
    mode: "readwrite",
  });
  assert.equal(list.ok, true);
  if (!list.ok) return;
  const listId = (list.data as { list: { id: string } }).list.id;
  const draft = await executeCrmTool({
    runtime,
    ctx,
    name: "create_campaign_draft",
    args: { name: "Aviso comitentes", listId, subject: "Aviso", htmlBody: "<p>Hola comitentes</p>" },
    mode: "readwrite",
  });
  assert.equal(draft.ok, true);
  if (!draft.ok) return;
  const campaign = (draft.data as { campaign: { id: string; status: string }; sent: boolean }).campaign;
  assert.equal(campaign.status, "draft");
  assert.equal((draft.data as { sent: boolean }).sent, false);

  const withSend = await executeCrmTool({
    runtime,
    ctx,
    name: "create_campaign_draft",
    args: { name: "No enviar", listId, subject: "X", htmlBody: "<p>Hola</p>", send: true },
    mode: "readwrite",
  });
  assert.equal(withSend.ok, false);

  const preview = await executeCrmTool({
    runtime,
    ctx,
    name: "preview_campaign",
    args: { campaignId: campaign.id },
    mode: "read",
  });
  assert.equal(preview.ok, true);
  if (!preview.ok) return;
  assert.equal((preview.data as { sent: boolean }).sent, false);

  const again = await executeCrmTool({
    runtime,
    ctx,
    name: "get_campaign",
    args: { campaignId: campaign.id },
    mode: "read",
  });
  assert.equal(again.ok, true);
  if (!again.ok) return;
  assert.equal((again.data as { status: string }).status, "draft");
  const send = await executeCrmTool({
    runtime,
    ctx,
    name: "send_campaign",
    args: { campaignId: campaign.id },
    mode: "readwrite",
  });
  assert.equal(send.ok, false);
  if (!send.ok) assert.equal(send.error.code, "forbidden_tool");
});

test("update_campaign_draft only works on drafts; copy stays draft", async () => {
  const { runtime, ctx } = setup();
  await executeCrmTool({
    runtime,
    ctx,
    name: "create_list",
    args: { name: "Lista draft", countryCode: "AR" },
    mode: "readwrite",
  });
  const lists = await executeCrmTool({ runtime, ctx, name: "search_lists", args: {}, mode: "read" });
  assert.equal(lists.ok, true);
  if (!lists.ok) return;
  const listId = (lists.data as { items: Array<{ id: string }> }).items[0].id;
  const draft = await executeCrmTool({
    runtime,
    ctx,
    name: "create_campaign_draft",
    args: { name: "Original", listId, subject: "Asunto 1", htmlBody: "<p>Uno</p>" },
    mode: "readwrite",
  });
  assert.equal(draft.ok, true);
  if (!draft.ok) return;
  const campaignId = (draft.data as { campaign: { id: string } }).campaign.id;
  const updated = await executeCrmTool({
    runtime,
    ctx,
    name: "update_campaign_draft",
    args: { campaignId, changes: { subject: "Asunto 2" } },
    mode: "readwrite",
  });
  assert.equal(updated.ok, true);
  if (!updated.ok) return;
  assert.equal((updated.data as { campaign: { subject: string } }).campaign.subject, "Asunto 2");

  const copied = await executeCrmTool({
    runtime,
    ctx,
    name: "copy_campaign",
    args: { campaignId },
    mode: "readwrite",
  });
  assert.equal(copied.ok, true);
  if (!copied.ok) return;
  assert.equal((copied.data as { campaign: { status: string }; sent: boolean }).campaign.status, "draft");
  assert.equal((copied.data as { sent: boolean }).sent, false);

  await runtime.catalog.pauseCampaign(campaignId).catch(() => undefined);
  // Force non-draft in memory catalog
  const sending = await runtime.catalog.getCampaign(campaignId);
  if (sending) sending.status = "sending";
  const bad = await executeCrmTool({
    runtime,
    ctx,
    name: "update_campaign_draft",
    args: { campaignId, changes: { subject: "No" } },
    mode: "readwrite",
  });
  assert.equal(bad.ok, false);
  if (bad.ok) return;
  assert.equal(bad.error.code, "conflict");
});

test("pause_campaign cannot start a draft; send tools stay forbidden", async () => {
  const { runtime, ctx } = setup();
  await executeCrmTool({
    runtime,
    ctx,
    name: "create_list",
    args: { name: "Lista pause", countryCode: "UY" },
    mode: "readwrite",
  });
  const lists = await executeCrmTool({ runtime, ctx, name: "search_lists", args: {}, mode: "read" });
  assert.equal(lists.ok, true);
  if (!lists.ok) return;
  const listId = (lists.data as { items: Array<{ id: string }> }).items[0].id;
  const draft = await executeCrmTool({
    runtime,
    ctx,
    name: "create_campaign_draft",
    args: { name: "Draft pause", listId, subject: "Hola", htmlBody: "<p>Hola</p>" },
    mode: "readwrite",
  });
  assert.equal(draft.ok, true);
  if (!draft.ok) return;
  const campaignId = (draft.data as { campaign: { id: string } }).campaign.id;
  const paused = await executeCrmTool({
    runtime,
    ctx,
    name: "pause_campaign",
    args: { campaignId },
    mode: "readwrite",
  });
  assert.equal(paused.ok, false);

  for (const name of ["send_campaign", "retry_failed_sends", "cancel_campaign", "schedule_campaign"]) {
    const res = await executeCrmTool({ runtime, ctx, name, args: { campaignId }, mode: "readwrite" });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, "forbidden_tool");
  }
});

test("opportunities search and get", async () => {
  const { runtime, ctx } = setup();
  const company = await executeCrmTool({
    runtime,
    ctx,
    name: "create_company",
    args: { name: "Sancor Seguros", countryCode: "AR" },
    mode: "readwrite",
  });
  assert.equal(company.ok, true);
  if (!company.ok) return;
  const companyId = (company.data as { company: { id: string } }).company.id;
  const created = await executeCrmTool({
    runtime,
    ctx,
    name: "create_opportunity",
    args: { name: "Piloto mora", companyId, commercialStageId: "interesado" },
    mode: "readwrite",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const opportunityId = (created.data as { opportunity: { id: string } }).opportunity.id;
  const listed = await executeCrmTool({
    runtime,
    ctx,
    name: "search_opportunities",
    args: { companyId },
    mode: "read",
  });
  assert.equal(listed.ok, true);
  if (!listed.ok) return;
  assert.equal((listed.data as { items: unknown[] }).items.length, 1);
  const got = await executeCrmTool({
    runtime,
    ctx,
    name: "get_opportunity",
    args: { opportunityId },
    mode: "read",
  });
  assert.equal(got.ok, true);
});

test("LinkedIn CRM tools run manual campaign, member, action, and pending flows", async () => {
  const { runtime, ctx } = setup();
  const contactResult = await executeCrmTool({
    runtime,
    ctx,
    name: "create_contact",
    args: {
      name: "LinkedIn Only",
      linkedinUrl: "https://sv.linkedin.com/in/crm-tool-only",
      linkedinStatus: "not_contacted",
      linkedinNextActionAt: "2026-09-23T10:00:00.000Z",
      prospectingSource: "linkedin",
      countryCode: "AR",
    },
    mode: "readwrite",
  });
  assert.equal(contactResult.ok, true);
  if (!contactResult.ok) return;
  const contact = (contactResult.data as {
    contact: { id: string; email: string; linkedinUrl: string; prospectingSource: string };
  }).contact;
  assert.equal(contact.email, "");
  assert.equal(contact.linkedinUrl, "https://linkedin.com/in/crm-tool-only");
  assert.equal(contact.prospectingSource, "linkedin");

  const draftResult = await executeCrmTool({
    runtime,
    ctx: { ...ctx, idempotencyKey: "linkedin-draft-1" },
    name: "create_linkedin_campaign_draft",
    args: {
      name: "Manual outreach",
      countryCode: "AR",
      industryIds: ["insurance"],
      useCaseIds: ["collections"],
      connectionMessage: "Connection template",
      directMessage: "Direct template",
      followUpMessage: "Follow-up template",
    },
    mode: "readwrite",
  });
  assert.equal(draftResult.ok, true);
  if (!draftResult.ok) return;
  const campaign = (draftResult.data as {
    campaign: { id: string; status: string; directMessage: string; automated: boolean };
  }).campaign;
  assert.equal(campaign.status, "draft");
  assert.equal(campaign.directMessage, "Direct template");
  assert.equal(campaign.automated, false);

  const addResult = await executeCrmTool({
    runtime,
    ctx,
    name: "add_contact_to_linkedin_campaign",
    args: {
      campaignId: campaign.id,
      contactId: contact.id,
      member: {
        connectionMessage: "Personal connection",
        directMessage: "Personal direct",
        followUpMessage: "Personal follow-up",
        status: "invitation_prepared",
        invitationMessage: "Personal connection",
        nextActionAt: "2026-09-23T11:00:00.000Z",
      },
    },
    mode: "readwrite",
  });
  assert.equal(addResult.ok, true);
  if (!addResult.ok) return;
  const member = (addResult.data as {
    member: { id: string; directMessage: string; status: string; statusAlias: string; nextActionAt: string };
  }).member;
  assert.equal(member.directMessage, "Personal direct");
  assert.equal(member.status, "connection_ready");
  assert.equal(member.statusAlias, "invitation_prepared");

  const actionResult = await executeCrmTool({
    runtime,
    ctx: { ...ctx, idempotencyKey: "linkedin-action-1" },
    name: "record_linkedin_action",
    args: {
      campaignId: campaign.id,
      memberId: member.id,
      action: "connection_sent",
      occurredAt: "2026-09-23T12:00:00.000Z",
      notes: "Recorded after manual action",
      nextActionAt: "2026-09-24T10:00:00.000Z",
    },
    mode: "readwrite",
  });
  assert.equal(actionResult.ok, true);
  if (!actionResult.ok) return;
  assert.equal((actionResult.data as { member: { connectionSentAt: string } }).member.connectionSentAt, "2026-09-23T12:00:00.000Z");

  const pending = await executeCrmTool({
    runtime,
    ctx,
    name: "search_linkedin_pending_actions",
    args: { dueBefore: "2026-09-25T00:00:00.000Z", limit: 10 },
    mode: "read",
  });
  assert.equal(pending.ok, true);
  if (!pending.ok) return;
  assert.deepEqual((pending.data as { items: Array<{ id: string }> }).items.map((item) => item.id), [member.id]);

  const pendingAlias = await executeCrmTool({
    runtime,
    ctx,
    name: "get_linkedin_pending_actions",
    args: { dueBefore: "2026-09-25T00:00:00.000Z", limit: 10 },
    mode: "read",
  });
  assert.equal(pendingAlias.ok, true);
  if (!pendingAlias.ok) return;
  assert.equal(pendingAlias.tool, "get_linkedin_pending_actions");
  assert.deepEqual((pendingAlias.data as { items: Array<{ id: string }> }).items.map((item) => item.id), [member.id]);

  const outreachAlias = await executeCrmTool({
    runtime,
    ctx: { ...ctx, idempotencyKey: "linkedin-outreach-alias-1" },
    name: "update_linkedin_outreach_status",
    args: {
      campaignId: campaign.id,
      memberId: member.id,
      action: "connected",
      occurredAt: "2026-09-23T13:00:00.000Z",
    },
    mode: "readwrite",
  });
  assert.equal(outreachAlias.ok, true);
  if (!outreachAlias.ok) return;
  assert.equal(outreachAlias.tool, "update_linkedin_outreach_status");
  assert.equal((outreachAlias.data as { member: { status: string } }).member.status, "connected");

  const outreach = await executeCrmTool({
    runtime,
    ctx,
    name: "search_linkedin_outreach",
    args: { campaignId: campaign.id, status: "connected", limit: 10 },
    mode: "read",
  });
  assert.equal(outreach.ok, true);
  if (!outreach.ok) return;
  assert.equal((outreach.data as { items: Array<{ id: string }> }).items[0]?.id, member.id);

  for (const [name, args] of [
    ["search_linkedin_campaigns", { countryCode: "AR" }],
    ["get_linkedin_campaign", { campaignId: campaign.id }],
    ["preview_linkedin_campaign", { campaignId: campaign.id }],
  ] as const) {
    const result = await executeCrmTool({ runtime, ctx, name, args, mode: "read" });
    assert.equal(result.ok, true, name);
  }

  const updatedContact = await executeCrmTool({
    runtime,
    ctx,
    name: "update_contact",
    args: {
      contactId: contact.id,
      changes: {
        email: "linkedin-only@example.com",
        linkedinNotes: "Qualified manually",
        linkedinStatus: "connected",
      },
    },
    mode: "readwrite",
  });
  assert.equal(updatedContact.ok, true);
  if (!updatedContact.ok) return;
  assert.equal((updatedContact.data as { contact: { email: string } }).contact.email, "linkedin-only@example.com");

  const archived = await executeCrmTool({
    runtime,
    ctx: { ...ctx, idempotencyKey: "linkedin-archive-1" },
    name: "update_linkedin_campaign_draft",
    args: {
      campaignId: campaign.id,
      changes: { status: "archived", countryCode: null },
    },
    mode: "readwrite",
  });
  assert.equal(archived.ok, true);
  if (!archived.ok) return;
  assert.equal(archived.tool, "update_linkedin_campaign_draft");
  assert.equal(archived.ok, true);
  if (!archived.ok) return;
  const archivedCampaign = (archived.data as {
    campaign: { status: string; archivedAt: string; countryCode: string | null };
  }).campaign;
  assert.equal(archivedCampaign.status, "archived");
  assert.ok(archivedCampaign.archivedAt);
  assert.equal(archivedCampaign.countryCode, null);
});

test("LinkedIn send tools are absent and forbidden", async () => {
  const { runtime, ctx } = setup();
  const listed = mcpCrmToolDefinitions().map((tool) => tool.name);
  for (const name of ["send_linkedin_message", "send_linkedin_campaign"]) {
    assert.equal(listed.includes(name as never), false);
    const result = await executeCrmTool({ runtime, ctx, name, args: {}, mode: "readwrite" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "forbidden_tool");
  }
});

