import type { CrmJsonSchema, CrmReadToolName, CrmToolDefinition, CrmWriteToolName } from "./types";

function obj(properties: Record<string, CrmJsonSchema>, required: string[] = []): CrmJsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    ...(required.length ? { required } : {}),
  };
}

const limit = {
  type: "integer",
  minimum: 1,
  maximum: 100,
  description: "Page size. Default 20, maximum 100.",
};
const cursor = { type: "string", description: "Opaque pagination cursor from a previous response." };

export const CRM_READ_TOOL_DEFINITIONS: CrmToolDefinition[] = [
  {
    name: "search_companies",
    access: "read",
    description:
      "Search internal Notificas CRM companies. Read-only. Returns companies of the authenticated internal CRM workspace. Never invent companies. Paginated.",
    inputSchema: obj({
      query: { type: "string", description: "Company name or website/domain." },
      countryCode: { type: "string", description: "ISO-2 country code, e.g. UY, AR, CL, CO, PE." },
      industryId: { type: "string", description: "Singular industry catalog key to filter search, e.g. gas. Distinct from create_company.industryIds." },
      useCaseId: { type: "string", description: "Use-case catalog key, e.g. aviso_corte, cesion_credito. Not an industry." },
      commercialStageId: { type: "string", description: "Commercial pipeline id, not email engagement stage." },
      limit,
      cursor,
    }),
  },
  {
    name: "get_company",
    access: "read",
    description:
      "Get one internal CRM company by id, plus primary contacts, use cases, open opportunities, pending tasks and recent activity. Read-only. Bounded lists, never unlimited rows.",
    inputSchema: obj({ companyId: { type: "string" } }, ["companyId"]),
  },
  {
    name: "search_contacts",
    access: "read",
    description:
      "Search internal Notificas CRM contacts. Read-only. Filter by text, company, country, commercial stage, email presence or LinkedIn presence. Returns optional email and LinkedIn prospecting fields. Paginated.",
    inputSchema: obj({
      query: { type: "string", description: "Name, email or free text." },
      companyId: { type: "string" },
      countryCode: { type: "string" },
      commercialStageId: { type: "string" },
      hasEmail: { type: "boolean" },
      hasLinkedin: { type: "boolean" },
      limit,
      cursor,
    }),
  },
  {
    name: "get_contact",
    access: "read",
    description:
      "Get one CRM contact by id with company, optional email, LinkedIn prospecting fields, email engagement stage, commercial stage, recent activity and tasks. Read-only.",
    inputSchema: obj({ contactId: { type: "string" } }, ["contactId"]),
  },
  {
    name: "search_campaigns",
    access: "read",
    description:
      "Search Notificas commercial CRM email campaigns (marketing, not certified product campaigns). Read-only. Does not return individual deliveries and never sends email.",
    inputSchema: obj({
      query: { type: "string" },
      countryCode: { type: "string" },
      status: { type: "string", description: "draft | sending | paused | sent | cancelled" },
      limit,
      cursor,
    }),
  },
  {
    name: "get_campaign",
    access: "read",
    description:
      "Get one commercial CRM campaign: metadata, audience totals, subject/HTML snapshot and aggregated stats. Read-only. Never returns thousands of deliveries and never sends email.",
    inputSchema: obj({ campaignId: { type: "string" } }, ["campaignId"]),
  },
  {
    name: "search_lists",
    access: "read",
    description: "Search CRM recipient lists. Read-only. Paginated.",
    inputSchema: obj({ query: { type: "string" }, limit, cursor }),
  },
  {
    name: "get_list",
    access: "read",
    description: "Get one recipient list metadata and size. Read-only. Does not dump every member.",
    inputSchema: obj({ listId: { type: "string" } }, ["listId"]),
  },
  {
    name: "search_templates",
    access: "read",
    description: "Search CRM email message templates. Read-only. Does not return secrets.",
    inputSchema: obj({ query: { type: "string" }, countryCode: { type: "string" }, limit, cursor }),
  },
  {
    name: "get_template",
    access: "read",
    description: "Get one CRM email template metadata and current version snapshot. Read-only.",
    inputSchema: obj({ templateId: { type: "string" } }, ["templateId"]),
  },
  {
    name: "get_company_activity",
    access: "read",
    description: "List recent CRM activity for a company. Read-only. Paginated.",
    inputSchema: obj({ companyId: { type: "string" }, limit, cursor }, ["companyId"]),
  },
  {
    name: "get_contact_activity",
    access: "read",
    description: "List recent CRM activity for a contact. Read-only. Paginated.",
    inputSchema: obj({ contactId: { type: "string" }, limit, cursor }, ["contactId"]),
  },
  {
    name: "get_pending_tasks",
    access: "read",
    description: "List CRM tasks, typically pending follow-ups. Read-only. Filter by due window, company or contact.",
    inputSchema: obj({
      dueBefore: { type: "string", description: "ISO-8601 inclusive upper bound." },
      dueAfter: { type: "string", description: "ISO-8601 inclusive lower bound." },
      companyId: { type: "string" },
      contactId: { type: "string" },
      status: { type: "string", enum: ["open", "completed", "cancelled"] },
      limit,
      cursor,
    }),
  },
  {
    name: "get_crm_stats",
    access: "read",
    description:
      "Workspace totals for companies, contacts, countries, campaigns, pending tasks, new contacts and replies. Read-only. Uses counts, not full-table dumps.",
    inputSchema: obj({}),
  },
  {
    name: "list_taxonomy",
    access: "read",
    description:
      "List the canonical CRM catalog: countries, industry keys (rubros), use-case keys and commercial pipeline stages. Read-only. Use these keys in search and create tools instead of inventing labels.",
    inputSchema: obj({}),
  },
  {
    name: "search_opportunities",
    access: "read",
    description:
      "Search commercial CRM opportunities (pipeline deals), not email campaigns. Read-only. Paginated. Filter by company, country, commercialStageId or status.",
    inputSchema: obj({
      query: { type: "string", description: "Opportunity name." },
      companyId: { type: "string" },
      countryCode: { type: "string" },
      commercialStageId: { type: "string", description: "Commercial pipeline id, not email engagement stage." },
      status: { type: "string", enum: ["open", "won", "lost", "paused"] },
      limit,
      cursor,
    }),
  },
  {
    name: "get_opportunity",
    access: "read",
    description: "Get one commercial CRM opportunity by id. Read-only.",
    inputSchema: obj({ opportunityId: { type: "string" } }, ["opportunityId"]),
  },
  {
    name: "preview_campaign",
    access: "read",
    description:
      "Preview a commercial CRM campaign without sending: subject, HTML snapshot and audience counts. Read-only. Never enqueues email.",
    inputSchema: obj({ campaignId: { type: "string" } }, ["campaignId"]),
  },
  {
    name: "search_linkedin_campaigns",
    access: "read",
    description:
      "Search internal CRM LinkedIn campaign records for manual organization only. Read-only; never automates, sends, connects, messages, or scrapes LinkedIn. Paginated and bounded.",
    inputSchema: obj({
      query: { type: "string" },
      status: { type: "string", enum: ["draft", "active", "paused", "completed", "archived"] },
      countryCode: { type: "string" },
      industryId: { type: "string" },
      archived: { type: "string", enum: ["exclude", "include", "only"] },
      limit,
      cursor,
    }),
  },
  {
    name: "get_linkedin_campaign",
    access: "read",
    description:
      "Get one internal CRM LinkedIn campaign with metadata, aggregate prospect counts and a bounded member sample for manual organization only. Read-only; never automates, sends, connects, messages, or scrapes LinkedIn.",
    inputSchema: obj({ campaignId: { type: "string" } }, ["campaignId"]),
  },
  {
    name: "preview_linkedin_campaign",
    access: "read",
    description:
      "Preview one internal CRM LinkedIn campaign and its bounded member workflow summary for manual organization only. Never automates, sends, connects, messages, or scrapes LinkedIn.",
    inputSchema: obj({ campaignId: { type: "string" } }, ["campaignId"]),
  },
  {
    name: "search_linkedin_pending_actions",
    access: "read",
    description:
      "Search bounded due LinkedIn follow-up records in the internal CRM for manual organization only. Filters by dueBefore. Never automates, sends, connects, messages, or scrapes LinkedIn.",
    inputSchema: obj({
      dueBefore: { type: "string", description: "ISO-8601 inclusive due-date upper bound. Defaults to now." },
      limit,
    }),
  },
  {
    name: "get_linkedin_pending_actions",
    access: "read",
    description:
      "Alias of search_linkedin_pending_actions. Returns due LinkedIn follow-up records in the internal CRM for manual organization only. Never automates, sends, connects, messages, or scrapes LinkedIn.",
    inputSchema: obj({
      dueBefore: { type: "string", description: "ISO-8601 inclusive due-date upper bound. Defaults to now." },
      limit,
    }),
  },
  {
    name: "search_linkedin_outreach",
    access: "read",
    description:
      "Search LinkedIn campaign members/outreach records for manual organization only. Filter by campaignId, companyId, contactId, status (canonical or aliases like invitation_prepared) and due window. Never automates, sends, connects, messages, or scrapes LinkedIn.",
    inputSchema: obj({
      campaignId: { type: "string" },
      companyId: { type: "string" },
      contactId: { type: "string" },
      status: { type: "string" },
      dueBefore: { type: "string" },
      dueAfter: { type: "string" },
      limit,
      cursor,
    }),
  },
];

export const CRM_WRITE_TOOL_DEFINITIONS: CrmToolDefinition[] = [
  {
    name: "create_company",
    access: "write",
    description:
      "Create a company in the internal Notificas CRM. Companies use industryIds (array of catalog keys), matching the domain model. Do not send industryId — that singular field is only for search_companies filters and campaign segments. Always report duplicateWarnings. Never merge duplicates.",
    inputSchema: obj(
      {
        name: { type: "string" },
        countryCode: { type: "string" },
        website: { type: "string" },
        industryIds: {
          type: "array",
          items: { type: "string" },
          description: "Company industry catalog keys, e.g. [\"gas\"]. Domain field is industryIds, not industryId.",
        },
        useCaseIds: { type: "array", items: { type: "string" } },
        notes: { type: "string" },
      },
      ["name"],
    ),
  },
  {
    name: "update_company",
    access: "write",
    description: "Update allowed fields of an existing CRM company. Requires companyId. Does not delete.",
    inputSchema: obj(
      {
        companyId: { type: "string" },
        changes: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            countryCode: { type: "string" },
            website: { type: "string" },
            industryIds: { type: "array", items: { type: "string" } },
            useCaseIds: { type: "array", items: { type: "string" } },
            notes: { type: "string" },
            commercialStageId: { type: "string" },
            priority: { type: "string", enum: ["low", "normal", "high"] },
            phone: { type: "string" },
            legalName: { type: "string" },
            city: { type: "string" },
            state: { type: "string" },
            status: { type: "string", enum: ["active", "inactive"] },
            tagIds: { type: "array", items: { type: "string" } },
          },
        },
      },
      ["companyId", "changes"],
    ),
  },
  {
    name: "create_contact",
    access: "write",
    description:
      "Create a CRM contact with an email, a LinkedIn URL, or both. LinkedIn-only contacts are supported. If company is given by name, search first. Never invent an email and never automates, sends, or scrapes LinkedIn.",
    inputSchema: obj(
      {
        email: { type: "string", description: "Optional when linkedinUrl is supplied." },
        linkedinUrl: { type: "string" },
        linkedinStatus: { type: "string" },
        linkedinLastContactAt: { type: "string" },
        linkedinNextActionAt: { type: "string" },
        linkedinNotes: { type: "string" },
        prospectingSource: { type: "string", enum: ["clay", "linkedin", "web", "manual", "association", "other"] },
        name: { type: "string" },
        companyId: { type: "string" },
        companyName: { type: "string" },
        title: { type: "string" },
        countryCode: { type: "string" },
        notes: { type: "string" },
      },
      [],
    ),
  },
  {
    name: "update_contact",
    access: "write",
    description: "Update allowed fields of an existing CRM contact. Requires contactId. Does not delete.",
    inputSchema: obj(
      {
        contactId: { type: "string" },
        changes: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            email: { type: "string" },
            title: { type: "string" },
            company: { type: "string" },
            companyId: { type: "string" },
            countryCode: { type: "string" },
            notes: { type: "string" },
            commercialStageId: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            linkedinUrl: { type: "string" },
            linkedinStatus: { type: "string" },
            linkedinLastContactAt: { type: "string" },
            linkedinNextActionAt: { type: "string" },
            linkedinNotes: { type: "string" },
            prospectingSource: { type: "string", enum: ["clay", "linkedin", "web", "manual", "association", "other"] },
          },
        },
      },
      ["contactId", "changes"],
    ),
  },
  {
    name: "create_task",
    access: "write",
    description:
      "Create a follow-up CRM task. If the company is named without id, search first and ask when ambiguous. Never send email.",
    inputSchema: obj(
      {
        title: { type: "string" },
        description: { type: "string" },
        type: {
          type: "string",
          enum: ["call", "email", "research", "meeting", "demo", "follow_up", "proposal", "data_completion", "other"],
        },
        companyId: { type: "string" },
        companyName: { type: "string" },
        contactId: { type: "string" },
        dueAt: { type: "string", description: "ISO-8601 due date." },
        dueInDays: { type: "integer", minimum: 0, maximum: 365 },
        priority: { type: "string", enum: ["low", "normal", "high"] },
      },
      ["title"],
    ),
  },
  {
    name: "complete_task",
    access: "write",
    description: "Mark an existing CRM task as completed.",
    inputSchema: obj({ taskId: { type: "string" } }, ["taskId"]),
  },
  {
    name: "cancel_task",
    access: "write",
    description: "Cancel an existing CRM task. Does not delete the task record.",
    inputSchema: obj({ taskId: { type: "string" } }, ["taskId"]),
  },
  {
    name: "create_list",
    access: "write",
    description: "Create a named CRM recipient list. Does not add hundreds of contacts in one call.",
    inputSchema: obj({ name: { type: "string" }, countryCode: { type: "string" } }, ["name"]),
  },
  {
    name: "add_contact_to_list",
    access: "write",
    description: "Add one existing contact to a named list. Not for bulk imports.",
    inputSchema: obj({ listId: { type: "string" }, contactId: { type: "string" } }, ["listId", "contactId"]),
  },
  {
    name: "create_note",
    access: "write",
    description: "Add a CRM note as activity type note_added on a company and/or contact.",
    inputSchema: obj(
      {
        text: { type: "string" },
        companyId: { type: "string" },
        contactId: { type: "string" },
      },
      ["text"],
    ),
  },
  {
    name: "create_opportunity",
    access: "write",
    description: "Create a commercial opportunity. Requires a company (id or unambiguous name) and commercialStageId.",
    inputSchema: obj(
      {
        name: { type: "string" },
        companyId: { type: "string" },
        companyName: { type: "string" },
        commercialStageId: { type: "string" },
        countryCode: { type: "string" },
        contactIds: { type: "array", items: { type: "string" } },
        industryId: { type: "string" },
        useCaseId: { type: "string" },
        nextStep: { type: "string" },
        nextActionAt: { type: "string" },
        notes: { type: "string" },
        estimatedValue: { type: "number" },
        currency: { type: "string" },
      },
      ["name", "commercialStageId"],
    ),
  },
  {
    name: "update_opportunity",
    access: "write",
    description: "Update allowed fields of an existing opportunity. Does not delete or mark won/lost automatically unless asked with a clear id.",
    inputSchema: obj(
      {
        opportunityId: { type: "string" },
        changes: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            commercialStageId: { type: "string" },
            nextStep: { type: "string" },
            nextActionAt: { type: "string" },
            notes: { type: "string" },
            estimatedValue: { type: "number" },
            currency: { type: "string" },
            contactIds: { type: "array", items: { type: "string" } },
            countryCode: { type: "string" },
            industryId: { type: "string" },
            useCaseId: { type: "string" },
          },
        },
      },
      ["opportunityId", "changes"],
    ),
  },
  {
    name: "create_campaign_draft",
    access: "write",
    description:
      "Create a commercial CRM email campaign DRAFT only. Never sends, schedules or changes status away from draft. Provide either listId/listName or a CRM segment (countryCode + industryId + useCaseIds). Sending is a separate tool that is not available.",
    inputSchema: obj(
      {
        name: { type: "string" },
        listId: { type: "string", description: "Named recipient list id. Do not send in this call." },
        listName: { type: "string" },
        countryCode: { type: "string" },
        industryId: { type: "string", description: "Industry catalog key for a CRM segment audience." },
        useCaseId: { type: "string" },
        useCaseIds: { type: "array", items: { type: "string" } },
        subject: {
          type: "string",
          description:
            "Subject template. Merge fields like {{firstName}} or {{companyName}} are substituted per recipient at send time, not when saving the draft.",
        },
        htmlBody: {
          type: "string",
          description:
            "HTML template. Use {{firstName}} {{fullName}} {{companyName}} {{jobTitle}} (legacy: {{nombre}} {{empresa}} {{cargo}}). Substituted per recipient at send time. If firstName is missing, Hola {{firstName}}, becomes Hola,. Never invent missing CRM data.",
        },
        textBody: {
          type: "string",
          description: "Plain-text template. Same merge fields as htmlBody; substituted per recipient at send time.",
        },
        includeStages: { type: "array", items: { type: "string" } },
        idempotencyKey: { type: "string" },
      },
      ["name", "subject"],
    ),
  },
  {
    name: "update_campaign_draft",
    access: "write",
    description:
      "Update subject, HTML, list or name of an existing campaign ONLY if status is draft. Fails with CAMPAIGN_NOT_DRAFT otherwise. Never sends email.",
    inputSchema: obj(
      {
        campaignId: { type: "string" },
        changes: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            subject: {
              type: "string",
              description: "Subject template. Merge fields are substituted per recipient at send time.",
            },
            htmlBody: {
              type: "string",
              description:
                "HTML template. Merge fields: {{firstName}} {{fullName}} {{companyName}} {{jobTitle}}. Substituted per recipient at send time.",
            },
            textBody: {
              type: "string",
              description: "Plain-text template. Same merge fields as htmlBody.",
            },
            listId: { type: "string" },
            includeStages: { type: "array", items: { type: "string" } },
          },
        },
        idempotencyKey: { type: "string" },
      },
      ["campaignId", "changes"],
    ),
  },
  {
    name: "copy_campaign",
    access: "write",
    description:
      "Copy an existing commercial CRM campaign into a new DRAFT. The copy is never sent. Use this instead of recreating the audience and copy by hand.",
    inputSchema: obj({ campaignId: { type: "string" }, idempotencyKey: { type: "string" } }, ["campaignId"]),
  },
  {
    name: "archive_campaign",
    access: "write",
    description:
      "Archive a commercial CRM campaign. If it is sending, it is paused then archived. Does not delete history and does not send email.",
    inputSchema: obj({ campaignId: { type: "string" }, idempotencyKey: { type: "string" } }, ["campaignId"]),
  },
  {
    name: "restore_campaign",
    access: "write",
    description: "Restore an archived commercial CRM campaign. Does not send email.",
    inputSchema: obj({ campaignId: { type: "string" }, idempotencyKey: { type: "string" } }, ["campaignId"]),
  },
  {
    name: "pause_campaign",
    access: "write",
    description:
      "Pause a commercial CRM campaign that is currently sending. Cannot start a draft. Does not send email.",
    inputSchema: obj({ campaignId: { type: "string" }, idempotencyKey: { type: "string" } }, ["campaignId"]),
  },
  {
    name: "resume_campaign",
    access: "write",
    description:
      "Resume a paused commercial CRM campaign (status paused → sending). Cannot be used on a draft. Restore first if archived.",
    inputSchema: obj({ campaignId: { type: "string" }, idempotencyKey: { type: "string" } }, ["campaignId"]),
  },
  {
    name: "create_linkedin_campaign_draft",
    access: "write",
    description:
      "Create an internal CRM LinkedIn campaign record in draft status for manual organization only, with targeting metadata and connection/direct/follow-up templates. Never automates, sends, connects, messages, or scrapes LinkedIn.",
    inputSchema: obj(
      {
        name: { type: "string" },
        description: { type: "string" },
        countryCode: { type: "string" },
        industryId: { type: "string" },
        industryIds: { type: "array", items: { type: "string" } },
        useCaseId: { type: "string" },
        useCaseIds: { type: "array", items: { type: "string" } },
        listId: { type: "string" },
        commercialInitiativeId: { type: "string" },
        messageType: { type: "string", enum: ["connection_request", "direct_message", "multistep"] },
        connectionMessage: { type: "string" },
        directMessage: { type: "string" },
        followUpMessage: { type: "string" },
        notes: { type: "string" },
        idempotencyKey: { type: "string" },
      },
      ["name"],
    ),
  },
  {
    name: "update_linkedin_campaign",
    access: "write",
    description:
      "Update internal CRM LinkedIn campaign metadata, templates, or draft/active/paused/completed/archived workflow status for manual organization only. Never automates, sends, connects, messages, or scrapes LinkedIn.",
    inputSchema: obj(
      {
        campaignId: { type: "string" },
        changes: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            countryCode: { type: "string" },
            industryIds: { type: "array", items: { type: "string" } },
            useCaseIds: { type: "array", items: { type: "string" } },
            listId: { type: "string" },
            commercialInitiativeId: { type: "string" },
            messageType: { type: "string", enum: ["connection_request", "direct_message", "multistep"] },
            connectionMessage: { type: "string" },
            directMessage: { type: "string" },
            followUpMessage: { type: "string" },
            notes: { type: "string" },
            status: { type: "string", enum: ["draft", "active", "paused", "completed", "archived"] },
          },
        },
        idempotencyKey: { type: "string" },
      },
      ["campaignId", "changes"],
    ),
  },
  {
    name: "update_linkedin_campaign_draft",
    access: "write",
    description:
      "Alias of update_linkedin_campaign. Update internal CRM LinkedIn campaign metadata, templates, or draft/active/paused/completed/archived workflow status for manual organization only. Never automates, sends, connects, messages, or scrapes LinkedIn.",
    inputSchema: obj(
      {
        campaignId: { type: "string" },
        changes: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            countryCode: { type: "string" },
            industryIds: { type: "array", items: { type: "string" } },
            useCaseIds: { type: "array", items: { type: "string" } },
            listId: { type: "string" },
            commercialInitiativeId: { type: "string" },
            messageType: { type: "string", enum: ["connection_request", "direct_message", "multistep"] },
            connectionMessage: { type: "string" },
            directMessage: { type: "string" },
            followUpMessage: { type: "string" },
            notes: { type: "string" },
            status: { type: "string", enum: ["draft", "active", "paused", "completed", "archived"] },
          },
        },
        idempotencyKey: { type: "string" },
      },
      ["campaignId", "changes"],
    ),
  },
  {
    name: "add_contact_to_linkedin_campaign",
    access: "write",
    description:
      "Add one existing LinkedIn-profile contact to an internal campaign record, optionally with personalized connection/direct/follow-up text, status and nextActionAt, for manual organization only. Never automates, sends, connects, messages, or scrapes LinkedIn.",
    inputSchema: obj(
      {
        campaignId: { type: "string" },
        contactId: { type: "string" },
        member: {
          type: "object",
          additionalProperties: false,
          properties: {
            status: { type: "string" },
            invitationMessage: { type: "string" },
            connectionMessage: { type: "string" },
            directMessage: { type: "string" },
            followUpMessage: { type: "string" },
            notes: { type: "string" },
            nextActionAt: { type: "string" },
          },
        },
        idempotencyKey: { type: "string" },
      },
      ["campaignId", "contactId"],
    ),
  },
  {
    name: "create_linkedin_outreach",
    access: "write",
    description:
      "Alias of add_contact_to_linkedin_campaign. Add one existing LinkedIn-profile contact to an internal campaign with optional invitation/follow-up copy and status (invitation_prepared maps to connection_ready). Never automates, sends, connects, messages, or scrapes LinkedIn.",
    inputSchema: obj(
      {
        campaignId: { type: "string" },
        contactId: { type: "string" },
        member: {
          type: "object",
          additionalProperties: false,
          properties: {
            status: { type: "string" },
            invitationMessage: { type: "string" },
            connectionMessage: { type: "string" },
            directMessage: { type: "string" },
            followUpMessage: { type: "string" },
            notes: { type: "string" },
            nextActionAt: { type: "string" },
          },
        },
        idempotencyKey: { type: "string" },
      },
      ["campaignId", "contactId"],
    ),
  },
  {
    name: "remove_contact_from_linkedin_campaign",
    access: "write",
    description:
      "Remove one member record from an internal CRM LinkedIn campaign for manual organization only. Never automates, sends, disconnects, messages, or scrapes LinkedIn.",
    inputSchema: obj(
      { campaignId: { type: "string" }, memberId: { type: "string" }, idempotencyKey: { type: "string" } },
      ["campaignId", "memberId"],
    ),
  },
  {
    name: "update_linkedin_campaign_member",
    access: "write",
    description:
      "Update one internal LinkedIn campaign member's personalized connection/direct/follow-up text, workflow status or nextActionAt for manual organization only. Never automates, sends, connects, messages, or scrapes LinkedIn.",
    inputSchema: obj(
      {
        campaignId: { type: "string" },
        memberId: { type: "string" },
        changes: {
          type: "object",
          additionalProperties: false,
          properties: {
            status: { type: "string" },
            invitationMessage: { type: "string" },
            connectionMessage: { type: "string" },
            directMessage: { type: "string" },
            followUpMessage: { type: "string" },
            notes: { type: "string" },
            nextActionAt: { type: "string" },
          },
        },
        idempotencyKey: { type: "string" },
      },
      ["campaignId", "memberId", "changes"],
    ),
  },
  {
    name: "record_linkedin_action",
    access: "write",
    description:
      "Record a manually completed LinkedIn action in the internal CRM with occurredAt, notes and nextActionAt. Manual organization only: this records history and never automates, sends, connects, messages, or scrapes LinkedIn.",
    inputSchema: obj(
      {
        campaignId: { type: "string" },
        memberId: { type: "string" },
        action: {
          type: "string",
          enum: ["connection_sent", "connected", "message_sent", "followup_sent", "replied", "interested", "not_interested"],
        },
        occurredAt: { type: "string" },
        notes: { type: "string" },
        nextActionAt: { type: "string" },
        idempotencyKey: { type: "string" },
      },
      ["campaignId", "memberId", "action"],
    ),
  },
  {
    name: "update_linkedin_outreach_status",
    access: "write",
    description:
      "Record a manual LinkedIn outreach status in the internal CRM only. Accepts canonical statuses or aliases (pending, invitation_prepared, invitation_sent, message_prepared, skipped) and optional action/lastActionAt/nextActionAt/notes. Never automates, sends, connects, messages, or scrapes LinkedIn.",
    inputSchema: obj(
      {
        campaignId: { type: "string" },
        memberId: { type: "string" },
        status: { type: "string" },
        action: { type: "string" },
        lastActionAt: { type: "string" },
        occurredAt: { type: "string" },
        notes: { type: "string" },
        nextActionAt: { type: "string" },
        idempotencyKey: { type: "string" },
      },
      ["campaignId", "memberId"],
    ),
  },
  {
    name: "archive_linkedin_campaign",
    access: "write",
    description:
      "Archive an internal CRM LinkedIn campaign record. Does not delete history and never automates or sends LinkedIn.",
    inputSchema: obj({ campaignId: { type: "string" }, idempotencyKey: { type: "string" } }, ["campaignId"]),
  },
  {
    name: "restore_linkedin_campaign",
    access: "write",
    description:
      "Restore an archived internal CRM LinkedIn campaign to draft. Never automates or sends LinkedIn.",
    inputSchema: obj({ campaignId: { type: "string" }, idempotencyKey: { type: "string" } }, ["campaignId"]),
  },
];

export const CRM_TOOL_DEFINITIONS: CrmToolDefinition[] = [
  ...CRM_READ_TOOL_DEFINITIONS,
  ...CRM_WRITE_TOOL_DEFINITIONS,
];

export function crmReadToolNames(): CrmReadToolName[] {
  return CRM_READ_TOOL_DEFINITIONS.map((t) => t.name as CrmReadToolName);
}

export function crmWriteToolNames(): CrmWriteToolName[] {
  return CRM_WRITE_TOOL_DEFINITIONS.map((t) => t.name as CrmWriteToolName);
}
