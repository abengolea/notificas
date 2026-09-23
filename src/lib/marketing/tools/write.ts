import { z } from "zod";
import { MarketingValidationError } from "../errors";
import { COUNTRY_LIST_PREFIX } from "../lists";
import type { CrmToolContext, CrmToolRuntime, CrmToolSuccess } from "./types";
import { crmIdempotencyKey } from "./idempotency";
import { clarificationResult, resolveCompanyByName } from "./helpers";
import { sanitizeCrmPayload } from "./sanitize";
import {
  addContactToListSchema,
  addContactToLinkedinCampaignSchema,
  campaignIdSchema,
  cancelTaskSchema,
  completeTaskSchema,
  createCampaignDraftSchema,
  createCompanySchema,
  createContactSchema,
  createListSchema,
  createLinkedinCampaignDraftSchema,
  createNoteSchema,
  createOpportunitySchema,
  createTaskSchema,
  updateCampaignDraftSchema,
  updateCompanySchema,
  updateContactSchema,
  updateOpportunitySchema,
  removeContactFromLinkedinCampaignSchema,
  updateLinkedinCampaignSchema,
  updateLinkedinCampaignMemberSchema,
  recordLinkedinActionSchema,
} from "./schemas";

function ok(
  tool: CrmToolSuccess["tool"],
  data: unknown,
  extra?: Partial<CrmToolSuccess>,
): CrmToolSuccess {
  return { ok: true, tool, write: true, data: sanitizeCrmPayload(data), ...extra };
}

async function remember(
  runtime: CrmToolRuntime,
  key: string,
  compute: () => Promise<CrmToolSuccess>,
): Promise<CrmToolSuccess> {
  const cached = await runtime.idempotency.get<CrmToolSuccess>(key);
  if (cached && cached.ok) return cached;
  const result = await compute();
  if (result.ok && !result.needsClarification) {
    await runtime.idempotency.set(key, result);
  }
  return result;
}

async function companyFromNameOrId(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  tool: CrmToolSuccess["tool"],
  companyId?: string,
  companyName?: string,
): Promise<{ id: string; name?: string } | CrmToolSuccess> {
  if (companyId) {
    const company = await runtime.services.companies.getCompany(ctx, companyId);
    return { id: company.id, name: company.name };
  }
  if (!companyName?.trim()) return { id: "" };
  const resolved = await resolveCompanyByName(runtime, ctx, companyName);
  if ("needsClarification" in resolved) {
    return clarificationResult(tool, true, resolved.candidates, "empresas");
  }
  return { id: resolved.company.id, name: resolved.company.name };
}

export async function createCompany(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof createCompanySchema>,
): Promise<CrmToolSuccess> {
  const key = crmIdempotencyKey([
    ctx.workspaceId,
    "create_company",
    ctx.idempotencyKey,
    ctx.conversationId,
    input.name,
    input.countryCode,
    input.website,
  ]);
  return remember(runtime, key, async () => {
    const created = await runtime.services.companies.createCompany(ctx, {
      name: input.name,
      countryCode: input.countryCode,
      website: input.website,
      industryIds: input.industryIds,
      useCaseIds: input.useCaseIds,
      notes: input.notes,
      idempotencyKey: ctx.idempotencyKey,
    });
    return ok(
      "create_company",
      {
        company: {
          id: created.company.id,
          name: created.company.name,
          countryCode: created.company.countryCode,
        },
        duplicateWarnings: created.duplicateWarnings,
      },
      {
        entityType: "company",
        entityIds: [created.company.id],
        duplicateWarnings: created.duplicateWarnings,
        summary:
          created.duplicateWarnings.length > 0
            ? `Empresa creada: ${created.company.name}. Posibles duplicados: ${created.duplicateWarnings.map((w) => w.companyId).join(", ")}. No fusioné nada.`
            : `Empresa creada: ${created.company.name}`,
      },
    );
  });
}

export async function updateCompany(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof updateCompanySchema>,
): Promise<CrmToolSuccess> {
  const updated = await runtime.services.companies.updateCompany(ctx, input.companyId, input.changes);
  return ok(
    "update_company",
    { company: { id: updated.id, name: updated.name, commercialStageId: updated.commercialStageId } },
    { entityType: "company", entityIds: [updated.id], summary: `Empresa actualizada: ${updated.name}` },
  );
}

export async function createContact(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof createContactSchema>,
): Promise<CrmToolSuccess> {
  const company = await companyFromNameOrId(runtime, ctx, "create_contact", input.companyId, input.companyName);
  if ("ok" in company) return company;
  const key = crmIdempotencyKey([
    ctx.workspaceId,
    "create_contact",
    ctx.idempotencyKey,
    ctx.conversationId,
    input.email,
    input.linkedinUrl,
    company.id,
  ]);
  return remember(runtime, key, async () => {
    const contact = await runtime.services.contacts.createContact(ctx, {
      email: input.email,
      linkedinUrl: input.linkedinUrl,
      linkedinStatus: input.linkedinStatus,
      linkedinLastContactAt: input.linkedinLastContactAt,
      linkedinNextActionAt: input.linkedinNextActionAt,
      linkedinNotes: input.linkedinNotes,
      prospectingSource: input.prospectingSource,
      name: input.name,
      companyId: company.id || undefined,
      company: company.name,
      title: input.title,
      countryCode: input.countryCode,
      notes: input.notes,
      idempotencyKey: ctx.idempotencyKey,
    });
    return ok(
      "create_contact",
      {
        contact: {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          companyId: contact.companyId || null,
          linkedinUrl: contact.linkedinUrl || null,
          linkedinStatus: contact.linkedinStatus || null,
          linkedinLastContactAt: contact.linkedinLastContactAt || null,
          linkedinNextActionAt: contact.linkedinNextActionAt || null,
          linkedinNotes: contact.linkedinNotes || null,
          prospectingSource: contact.prospectingSource || null,
        },
      },
      {
        entityType: "contact",
        entityIds: [contact.id],
        summary: `Contacto creado: ${contact.name || contact.email || contact.linkedinUrl}`,
      },
    );
  });
}

export async function updateContact(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof updateContactSchema>,
): Promise<CrmToolSuccess> {
  const updated = await runtime.services.contacts.updateContact(ctx, input.contactId, input.changes);
  return ok(
    "update_contact",
    {
      contact: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        linkedinUrl: updated.linkedinUrl || null,
        linkedinStatus: updated.linkedinStatus || null,
        linkedinLastContactAt: updated.linkedinLastContactAt || null,
        linkedinNextActionAt: updated.linkedinNextActionAt || null,
        linkedinNotes: updated.linkedinNotes || null,
        prospectingSource: updated.prospectingSource || null,
      },
    },
    {
      entityType: "contact",
      entityIds: [updated.id],
      summary: `Contacto actualizado: ${updated.name || updated.email || updated.linkedinUrl}`,
    },
  );
}

export async function createTask(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof createTaskSchema>,
): Promise<CrmToolSuccess> {
  const company = await companyFromNameOrId(runtime, ctx, "create_task", input.companyId, input.companyName);
  if ("ok" in company) return company;
  const dueAt =
    input.dueAt ||
    (input.dueInDays != null
      ? new Date(Date.now() + input.dueInDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined);
  const key = crmIdempotencyKey([
    ctx.workspaceId,
    "create_task",
    ctx.idempotencyKey,
    ctx.conversationId,
    input.title,
    company.id,
    dueAt,
  ]);
  return remember(runtime, key, async () => {
    const task = await runtime.services.tasks.createTask(ctx, {
      title: input.title,
      description: input.description,
      type: input.type || "follow_up",
      companyId: company.id || undefined,
      contactId: input.contactId,
      dueAt,
      priority: input.priority,
      source: "ai",
      idempotencyKey: ctx.idempotencyKey,
    });
    return ok(
      "create_task",
      { task: { id: task.id, title: task.title, dueAt: task.dueAt || null, companyId: task.companyId || null } },
      {
        entityType: "task",
        entityIds: [task.id],
        summary: task.dueAt ? `Tarea creada: ${task.title} (${task.dueAt.slice(0, 10)})` : `Tarea creada: ${task.title}`,
      },
    );
  });
}

export async function completeTask(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof completeTaskSchema>,
): Promise<CrmToolSuccess> {
  const task = await runtime.services.tasks.completeTask(ctx, input.taskId);
  return ok(
    "complete_task",
    { task: { id: task.id, title: task.title, status: task.status } },
    { entityType: "task", entityIds: [task.id], summary: `Tarea completada: ${task.title}` },
  );
}

export async function cancelTask(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof cancelTaskSchema>,
): Promise<CrmToolSuccess> {
  const task = await runtime.services.tasks.cancelTask(ctx, input.taskId);
  return ok(
    "cancel_task",
    { task: { id: task.id, title: task.title, status: task.status } },
    { entityType: "task", entityIds: [task.id], summary: `Tarea cancelada: ${task.title}` },
  );
}

export async function createList(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof createListSchema>,
): Promise<CrmToolSuccess> {
  void ctx;
  const list = await runtime.catalog.createList({ name: input.name, country: input.countryCode });
  return ok(
    "create_list",
    { list },
    { entityType: "list", entityIds: [list.id], summary: `Lista creada: ${list.name}` },
  );
}

export async function addContactToList(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof addContactToListSchema>,
): Promise<CrmToolSuccess> {
  if (input.listId.startsWith(COUNTRY_LIST_PREFIX)) {
    throw new MarketingValidationError("No se pueden agregar contactos a una lista virtual de país. Usá una lista nominada.");
  }
  const contact = await runtime.services.contacts.getContact(ctx, input.contactId);
  await runtime.services.memberships.addContactToList(ctx, {
    listId: input.listId,
    contactId: contact.id,
    source: "ai",
  });
  const listIds = Array.isArray(contact.listIds) ? contact.listIds.map(String) : [];
  if (!listIds.includes(input.listId)) {
    await runtime.services.contacts.updateContact(ctx, contact.id, { listIds: [...listIds, input.listId] });
  }
  return ok(
    "add_contact_to_list",
    { listId: input.listId, contactId: contact.id },
    { entityType: "list", entityIds: [input.listId, contact.id], summary: `Contacto agregado a la lista` },
  );
}

export async function createNote(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof createNoteSchema>,
): Promise<CrmToolSuccess> {
  if (!input.companyId && !input.contactId) {
    throw new MarketingValidationError("Indicá companyId o contactId para la nota.");
  }
  const activity = await runtime.services.activities.createActivity(ctx, {
    type: "note_added",
    title: input.text.slice(0, 180),
    description: input.text,
    companyId: input.companyId,
    contactId: input.contactId,
    actorType: "ai",
    actorId: ctx.actorId,
  });
  return ok(
    "create_note",
    { activity: { id: activity.id, type: activity.type, title: activity.title } },
    { entityType: "activity", entityIds: [activity.id], summary: "Nota creada" },
  );
}

export async function createOpportunity(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof createOpportunitySchema>,
): Promise<CrmToolSuccess> {
  const company = await companyFromNameOrId(runtime, ctx, "create_opportunity", input.companyId, input.companyName);
  if ("ok" in company) return company;
  if (!company.id) throw new MarketingValidationError("Indicá companyId o un companyName inequívoco.");
  const key = crmIdempotencyKey([
    ctx.workspaceId,
    "create_opportunity",
    ctx.idempotencyKey,
    ctx.conversationId,
    input.name,
    company.id,
  ]);
  return remember(runtime, key, async () => {
    const opportunity = await runtime.services.opportunities.createOpportunity(ctx, {
      name: input.name,
      companyId: company.id,
      commercialStageId: input.commercialStageId,
      countryCode: input.countryCode,
      contactIds: input.contactIds,
      industryId: input.industryId,
      useCaseId: input.useCaseId,
      nextStep: input.nextStep,
      nextActionAt: input.nextActionAt,
      notes: input.notes,
      estimatedValue: input.estimatedValue,
      currency: input.currency,
      idempotencyKey: ctx.idempotencyKey,
    });
    return ok(
      "create_opportunity",
      { opportunity: { id: opportunity.id, name: opportunity.name, commercialStageId: opportunity.commercialStageId } },
      { entityType: "opportunity", entityIds: [opportunity.id], summary: `Oportunidad creada: ${opportunity.name}` },
    );
  });
}

export async function updateOpportunity(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof updateOpportunitySchema>,
): Promise<CrmToolSuccess> {
  const updated = await runtime.services.opportunities.updateOpportunity(ctx, input.opportunityId, input.changes);
  return ok(
    "update_opportunity",
    { opportunity: { id: updated.id, name: updated.name, commercialStageId: updated.commercialStageId } },
    { entityType: "opportunity", entityIds: [updated.id], summary: `Oportunidad actualizada: ${updated.name}` },
  );
}

export async function createCampaignDraft(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof createCampaignDraftSchema>,
): Promise<CrmToolSuccess> {
  const key = crmIdempotencyKey([
    ctx.workspaceId,
    "create_campaign_draft",
    ctx.idempotencyKey,
    input.idempotencyKey,
    ctx.conversationId,
    input.name,
    input.listId,
    input.subject,
    input.industryId,
  ]);
  return remember(runtime, key, async () => {
    let listId = input.listId;
    if (!listId && input.listName) {
      const created = await runtime.catalog.createList({
        name: input.listName,
        country: input.countryCode,
      });
      listId = created.id;
    }
    const htmlBody =
      input.htmlBody?.trim() ||
      `<p>Borrador generado por el asistente CRM. Revisar antes de enviar.</p><p>${input.subject}</p>`;
    const campaign = await runtime.catalog.createCampaignDraft({
      name: input.name,
      listId,
      subject: input.subject,
      htmlBody,
      textBody: input.textBody,
      country: input.countryCode,
      includeStages: input.includeStages,
      industryId: input.industryId,
      useCaseId: input.useCaseId,
      useCaseIds: input.useCaseIds,
    });
    return ok(
      "create_campaign_draft",
      { campaign: { ...campaign, status: "draft" }, sent: false },
      {
        entityType: "campaign",
        entityIds: [campaign.id],
        summary: `Borrador de campaña creado: ${campaign.name}. No se envió.`,
      },
    );
  });
}

export async function updateCampaignDraft(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof updateCampaignDraftSchema>,
): Promise<CrmToolSuccess> {
  void ctx;
  const campaign = await runtime.catalog.updateCampaignDraft(input.campaignId, input.changes);
  return ok(
    "update_campaign_draft",
    { campaign, sent: false },
    {
      entityType: "campaign",
      entityIds: [campaign.id],
      summary: `Borrador actualizado: ${campaign.name}. No se envió.`,
    },
  );
}

export async function copyCampaign(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof campaignIdSchema>,
): Promise<CrmToolSuccess> {
  const key = crmIdempotencyKey([
    ctx.workspaceId,
    "copy_campaign",
    ctx.idempotencyKey,
    input.idempotencyKey,
    input.campaignId,
  ]);
  return remember(runtime, key, async () => {
    const campaign = await runtime.catalog.copyCampaign(input.campaignId);
    return ok(
      "copy_campaign",
      { campaign, sent: false },
      {
        entityType: "campaign",
        entityIds: [campaign.id],
        summary: `Copia en borrador: ${campaign.name}. No se envió.`,
      },
    );
  });
}

export async function archiveCampaign(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof campaignIdSchema>,
): Promise<CrmToolSuccess> {
  void ctx;
  const campaign = await runtime.catalog.archiveCampaign(input.campaignId);
  return ok(
    "archive_campaign",
    { campaign },
    { entityType: "campaign", entityIds: [campaign.id], summary: `Campaña archivada: ${campaign.name}` },
  );
}

export async function restoreCampaign(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof campaignIdSchema>,
): Promise<CrmToolSuccess> {
  void ctx;
  const campaign = await runtime.catalog.restoreCampaign(input.campaignId);
  return ok(
    "restore_campaign",
    { campaign },
    { entityType: "campaign", entityIds: [campaign.id], summary: `Campaña restaurada: ${campaign.name}` },
  );
}

export async function pauseCampaign(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof campaignIdSchema>,
): Promise<CrmToolSuccess> {
  void ctx;
  const campaign = await runtime.catalog.pauseCampaign(input.campaignId);
  return ok(
    "pause_campaign",
    { campaign },
    { entityType: "campaign", entityIds: [campaign.id], summary: `Campaña pausada: ${campaign.name}` },
  );
}

export async function resumeCampaign(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof campaignIdSchema>,
): Promise<CrmToolSuccess> {
  void ctx;
  const campaign = await runtime.catalog.resumeCampaign(input.campaignId);
  return ok(
    "resume_campaign",
    { campaign },
    { entityType: "campaign", entityIds: [campaign.id], summary: `Campaña reanudada: ${campaign.name}` },
  );
}

function linkedInMemberChanges(input: {
  status?: string;
  connectionMessage?: string;
  directMessage?: string;
  followUpMessage?: string;
  notes?: string;
  nextActionAt?: string | null;
}) {
  return {
    status: input.status,
    connectionMessage: input.connectionMessage,
    message: input.directMessage,
    followUpMessage: input.followUpMessage,
    notes: input.notes,
    nextActionAt: input.nextActionAt,
  };
}

function linkedInCampaignResult(campaign: { id: string; name: string; status: string; message?: string; [key: string]: unknown }) {
  const { message, ...rest } = campaign;
  return { ...rest, directMessage: message || null, automated: false };
}

function linkedInMemberResult(member: { id: string; message?: string; [key: string]: unknown }) {
  const { message, ...rest } = member;
  return { ...rest, directMessage: message || null, automated: false };
}

export async function createLinkedinCampaignDraft(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof createLinkedinCampaignDraftSchema>,
): Promise<CrmToolSuccess> {
  const key = crmIdempotencyKey([
    ctx.workspaceId,
    "create_linkedin_campaign_draft",
    ctx.idempotencyKey,
    input.idempotencyKey,
    ctx.conversationId,
    input.name,
  ]);
  return remember(runtime, key, async () => {
    const campaign = await runtime.services.linkedInCampaigns.createCampaign(ctx, {
      name: input.name,
      description: input.description,
      countryCode: input.countryCode,
      industryIds: input.industryIds,
      useCaseIds: input.useCaseIds,
      listId: input.listId,
      commercialInitiativeId: input.commercialInitiativeId,
      messageType: input.messageType,
      connectionMessage: input.connectionMessage,
      message: input.directMessage,
      followUpMessage: input.followUpMessage,
      notes: input.notes,
    });
    return ok("create_linkedin_campaign_draft", { campaign: linkedInCampaignResult(campaign) }, {
      entityType: "linkedin_campaign",
      entityIds: [campaign.id],
      summary: `Borrador LinkedIn creado para organización manual: ${campaign.name}. No se envió ni automatizó nada.`,
    });
  });
}

export async function updateLinkedinCampaign(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof updateLinkedinCampaignSchema>,
): Promise<CrmToolSuccess> {
  const key = crmIdempotencyKey([
    ctx.workspaceId,
    "update_linkedin_campaign",
    ctx.idempotencyKey,
    input.idempotencyKey,
    input.campaignId,
    JSON.stringify(input.changes),
  ]);
  return remember(runtime, key, async () => {
    const { directMessage, ...changes } = input.changes;
    const campaign = await runtime.services.linkedInCampaigns.updateCampaign(ctx, input.campaignId, {
      ...changes,
      message: directMessage,
    });
    return ok("update_linkedin_campaign", { campaign: linkedInCampaignResult(campaign) }, {
      entityType: "linkedin_campaign",
      entityIds: [campaign.id],
      summary: `Campaña LinkedIn actualizada para organización manual: ${campaign.name}`,
    });
  });
}

export async function addContactToLinkedinCampaign(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof addContactToLinkedinCampaignSchema>,
): Promise<CrmToolSuccess> {
  const key = crmIdempotencyKey([
    ctx.workspaceId,
    "add_contact_to_linkedin_campaign",
    ctx.idempotencyKey,
    input.idempotencyKey,
    input.campaignId,
    input.contactId,
    JSON.stringify(input.member),
  ]);
  return remember(runtime, key, async () => {
    let member = await runtime.services.linkedInCampaigns.addMember(ctx, input.campaignId, input.contactId);
    if (input.member && Object.keys(input.member).length) {
      member = await runtime.services.linkedInCampaigns.updateMember(
        ctx,
        input.campaignId,
        member.id,
        linkedInMemberChanges(input.member) as never,
      );
    }
    return ok("add_contact_to_linkedin_campaign", { member: linkedInMemberResult(member) }, {
      entityType: "linkedin_campaign_member",
      entityIds: [input.campaignId, member.id, input.contactId],
      summary: "Contacto agregado a campaña LinkedIn para organización manual; no se envió nada",
    });
  });
}

export async function removeContactFromLinkedinCampaign(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof removeContactFromLinkedinCampaignSchema>,
): Promise<CrmToolSuccess> {
  const key = crmIdempotencyKey([
    ctx.workspaceId,
    "remove_contact_from_linkedin_campaign",
    ctx.idempotencyKey,
    input.idempotencyKey,
    input.campaignId,
    input.memberId,
  ]);
  return remember(runtime, key, async () => {
    await runtime.services.linkedInCampaigns.removeMember(ctx, input.campaignId, input.memberId);
    return ok("remove_contact_from_linkedin_campaign", {
      campaignId: input.campaignId,
      memberId: input.memberId,
      removed: true,
      automated: false,
    }, {
      entityType: "linkedin_campaign_member",
      entityIds: [input.campaignId, input.memberId],
      summary: "Contacto removido de la organización manual de la campaña LinkedIn",
    });
  });
}

export async function updateLinkedinCampaignMember(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof updateLinkedinCampaignMemberSchema>,
): Promise<CrmToolSuccess> {
  const key = crmIdempotencyKey([
    ctx.workspaceId,
    "update_linkedin_campaign_member",
    ctx.idempotencyKey,
    input.idempotencyKey,
    input.campaignId,
    input.memberId,
    JSON.stringify(input.changes),
  ]);
  return remember(runtime, key, async () => {
    const member = await runtime.services.linkedInCampaigns.updateMember(
      ctx,
      input.campaignId,
      input.memberId,
      linkedInMemberChanges(input.changes) as never,
    );
    return ok("update_linkedin_campaign_member", { member: linkedInMemberResult(member) }, {
      entityType: "linkedin_campaign_member",
      entityIds: [input.campaignId, member.id],
      summary: "Miembro LinkedIn actualizado para organización manual; no se envió nada",
    });
  });
}

export async function recordLinkedinAction(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  input: z.infer<typeof recordLinkedinActionSchema>,
): Promise<CrmToolSuccess> {
  const key = crmIdempotencyKey([
    ctx.workspaceId,
    "record_linkedin_action",
    ctx.idempotencyKey,
    input.idempotencyKey,
    input.campaignId,
    input.memberId,
    input.action,
    input.occurredAt,
  ]);
  return remember(runtime, key, async () => {
    const member = await runtime.services.linkedInCampaigns.recordAction(ctx, input.campaignId, input.memberId, {
      action: input.action,
      at: input.occurredAt,
      notes: input.notes,
      nextActionAt: input.nextActionAt,
    });
    return ok("record_linkedin_action", { member: linkedInMemberResult(member), recorded: true }, {
      entityType: "linkedin_campaign_member",
      entityIds: [input.campaignId, member.id],
      summary: `Acción LinkedIn registrada manualmente: ${input.action}. La herramienta no ejecutó la acción.`,
    });
  });
}

export const CRM_WRITE_HANDLERS = {
  create_company: { schema: createCompanySchema, run: createCompany },
  update_company: { schema: updateCompanySchema, run: updateCompany },
  create_contact: { schema: createContactSchema, run: createContact },
  update_contact: { schema: updateContactSchema, run: updateContact },
  create_task: { schema: createTaskSchema, run: createTask },
  complete_task: { schema: completeTaskSchema, run: completeTask },
  cancel_task: { schema: cancelTaskSchema, run: cancelTask },
  create_list: { schema: createListSchema, run: createList },
  add_contact_to_list: { schema: addContactToListSchema, run: addContactToList },
  create_note: { schema: createNoteSchema, run: createNote },
  create_opportunity: { schema: createOpportunitySchema, run: createOpportunity },
  update_opportunity: { schema: updateOpportunitySchema, run: updateOpportunity },
  create_campaign_draft: { schema: createCampaignDraftSchema, run: createCampaignDraft },
  update_campaign_draft: { schema: updateCampaignDraftSchema, run: updateCampaignDraft },
  copy_campaign: { schema: campaignIdSchema, run: copyCampaign },
  archive_campaign: { schema: campaignIdSchema, run: archiveCampaign },
  restore_campaign: { schema: campaignIdSchema, run: restoreCampaign },
  pause_campaign: { schema: campaignIdSchema, run: pauseCampaign },
  resume_campaign: { schema: campaignIdSchema, run: resumeCampaign },
  create_linkedin_campaign_draft: {
    schema: createLinkedinCampaignDraftSchema,
    run: createLinkedinCampaignDraft,
  },
  update_linkedin_campaign: { schema: updateLinkedinCampaignSchema, run: updateLinkedinCampaign },
  add_contact_to_linkedin_campaign: {
    schema: addContactToLinkedinCampaignSchema,
    run: addContactToLinkedinCampaign,
  },
  remove_contact_from_linkedin_campaign: {
    schema: removeContactFromLinkedinCampaignSchema,
    run: removeContactFromLinkedinCampaign,
  },
  update_linkedin_campaign_member: {
    schema: updateLinkedinCampaignMemberSchema,
    run: updateLinkedinCampaignMember,
  },
  record_linkedin_action: { schema: recordLinkedinActionSchema, run: recordLinkedinAction },
} as const;
