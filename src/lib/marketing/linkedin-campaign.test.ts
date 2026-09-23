import { test } from "node:test";
import assert from "node:assert/strict";
import { marketingContext } from "./context";
import { contactIdForEmail } from "./csv";
import { marketingLinkedInCampaignMemberId } from "./domain/ids";
import { createMemoryMarketingRepositories } from "./repositories/memory";
import { createMarketingServices } from "./services";
import { assertEmailOnlyMarketingCampaign, canQueueMarketingEmail } from "./send";

function setup() {
  const repos = createMemoryMarketingRepositories();
  const services = createMarketingServices(repos);
  const context = marketingContext("notificas-internal", {
    actorType: "user",
    actorId: "admin-test",
  });
  return { repos, services, context };
}

test("LinkedIn campaign lifecycle and personalized member messages", async () => {
  const { services, context } = setup();
  const campaign = await services.linkedInCampaigns.createCampaign(context, {
    name: "Prospecting insurance",
    countryCode: "ar",
    industryIds: ["insurance"],
    useCaseIds: ["collections"],
    listId: "list-ar-insurance",
    commercialInitiativeId: "initiative-q4",
    connectionMessage: "Default connection",
    message: "Default message",
  });
  assert.equal(campaign.status, "draft");
  assert.equal(campaign.countryCode, "AR");
  assert.deepEqual(campaign.industryIds, ["insurance"]);
  assert.deepEqual(campaign.useCaseIds, ["collections"]);
  assert.equal(campaign.listId, "list-ar-insurance");
  assert.equal(campaign.commercialInitiativeId, "initiative-q4");
  assert.equal(campaign.messageType, "multistep");
  assert.match(campaign.id, /^[0-9a-f-]{36}$/);

  const active = await services.linkedInCampaigns.updateCampaign(context, campaign.id, {
    status: "active",
  });
  assert.equal(active.status, "active");
  assert.ok(active.activatedAt);

  const contact = await services.contacts.createContact(context, {
    email: "ana@example.com",
    linkedinUrl: "https://www.linkedin.com/in/Ana-Test/",
    name: "Ana Test",
    company: "Acme",
    title: "CEO",
    country: "AR",
  });
  assert.equal(contact.id, contactIdForEmail("ana@example.com"));

  const member = await services.linkedInCampaigns.addMember(context, campaign.id, contact.id);
  assert.equal(
    member.id,
    marketingLinkedInCampaignMemberId(campaign.id, contact.id, context.workspaceId),
  );
  assert.equal(member.firstName, "Ana");
  assert.equal(member.companyName, "Acme");
  assert.equal(member.jobTitle, "CEO");

  const customized = await services.linkedInCampaigns.updateMember(
    context,
    campaign.id,
    member.id,
    { message: "Hi Ana, personalized", status: "message_ready" },
  );
  assert.equal(customized.message, "Hi Ana, personalized");
  assert.equal(customized.status, "message_ready");

  const preview = await services.linkedInCampaigns.previewCampaign(context, campaign.id);
  assert.equal(preview.members[0].connectionMessage, "Default connection");
  assert.equal(preview.members[0].message, "Hi Ana, personalized");
  assert.equal(preview.summary.total, 1);
  assert.equal(preview.summary.pending, 1);
  assert.equal(preview.summary.byStatus.message_ready, 1);

  const completed = await services.linkedInCampaigns.updateCampaign(context, campaign.id, {
    status: "completed",
  });
  assert.ok(completed.completedAt);
  const archived = await services.linkedInCampaigns.archiveCampaign(context, campaign.id);
  assert.equal(archived.status, "archived");
  assert.ok(archived.archivedAt);
});

test("LinkedIn campaign targeting metadata persists and search handles country and archives", async () => {
  const { services, context } = setup();
  const archived = await services.linkedInCampaigns.createCampaign(context, {
    name: "Argentina archived",
    countryCode: "AR",
    industryIds: ["insurance", "banking"],
    useCaseIds: ["collections"],
    listId: "list-1",
    commercialInitiativeId: "initiative-1",
    messageType: "direct_message",
  });
  const archivedByStatus = await services.linkedInCampaigns.updateCampaign(context, archived.id, {
    status: "archived",
  });
  assert.ok(archivedByStatus.archivedAt);
  const current = await services.linkedInCampaigns.createCampaign(context, {
    name: "Argentina current",
    countryCode: "ar",
    messageType: "connection_request",
  });
  await services.linkedInCampaigns.createCampaign(context, {
    name: "Chile current",
    countryCode: "CL",
  });

  const defaultSearch = await services.linkedInCampaigns.searchCampaigns(context, {
    countryCode: "AR",
  });
  assert.deepEqual(defaultSearch.items.map((item) => item.id), [current.id]);

  const withArchived = await services.linkedInCampaigns.searchCampaigns(context, {
    countryCode: "ar",
    archived: "include",
  });
  assert.deepEqual(
    new Set(withArchived.items.map((item) => item.id)),
    new Set([archived.id, current.id]),
  );
  const archivedOnly = await services.linkedInCampaigns.searchCampaigns(context, {
    countryCode: "AR",
    archived: "only",
  });
  assert.deepEqual(archivedOnly.items.map((item) => item.id), [archived.id]);
  assert.equal(archived.messageType, "direct_message");
  const withoutCountry = await services.linkedInCampaigns.updateCampaign(context, current.id, {
    countryCode: null,
  });
  assert.equal(withoutCountry.countryCode, null);
});

test("LinkedIn preview summarizes workflow statuses and members can be filtered", async () => {
  const { services, context } = setup();
  const campaign = await services.linkedInCampaigns.createCampaign(context, { name: "Summary" });
  const statuses = [
    "not_contacted",
    "connection_sent",
    "connected",
    "message_sent",
    "replied",
    "interested",
  ] as const;
  for (const [index, status] of statuses.entries()) {
    const contact = await services.contacts.createContact(context, {
      linkedinUrl: `https://linkedin.com/in/summary-${index}`,
      country: "AR",
    });
    const member = await services.linkedInCampaigns.addMember(context, campaign.id, contact.id);
    if (status !== "not_contacted") {
      await services.linkedInCampaigns.updateMember(context, campaign.id, member.id, { status });
    }
  }

  const preview = await services.linkedInCampaigns.previewCampaign(context, campaign.id);
  assert.equal(preview.summary.total, 6);
  assert.equal(preview.summary.pending, 1);
  assert.equal(preview.summary.connectionSent, 1);
  assert.equal(preview.summary.connected, 1);
  assert.equal(preview.summary.messageSent, 1);
  assert.equal(preview.summary.replied, 1);
  assert.equal(preview.summary.interested, 1);
  const replied = await services.linkedInCampaigns.listMembers(context, campaign.id, {
    status: "replied",
    limit: 10,
  });
  assert.equal(replied.items.length, 1);
  assert.equal(replied.items[0].status, "replied");
});

test("LinkedIn-only contacts use UUID and dedupe normalized URL in workspace", async () => {
  const { services, context } = setup();
  const first = await services.contacts.createContact(context, {
    linkedinUrl: "www.linkedin.com/in/Only-LinkedIn/",
    name: "No Email",
    country: "UY",
    prospectingSource: "linkedin",
  });
  assert.equal(first.email, "");
  assert.match(first.id, /^[0-9a-f-]{36}$/);
  assert.equal(first.linkedinUrl, "https://linkedin.com/in/only-linkedin");
  const regional = await services.contacts.createContact(context, {
    name: "Jennifer Portillo",
    linkedinUrl: "https://sv.linkedin.com/in/Jennifer-Portillo/",
    country: "SV",
  });
  assert.equal(regional.linkedinUrl, "https://linkedin.com/in/jennifer-portillo");

  const duplicate = await services.contacts.createContact(context, {
    linkedinUrl: "https://linkedin.com/in/only-linkedin",
    name: "Updated Name",
    country: "UY",
  });
  assert.equal(duplicate.id, first.id);
  assert.equal(duplicate.name, "Updated Name");
});

test("contact creation rejects email and LinkedIn identifiers owned by different contacts", async () => {
  const { services, context } = setup();
  const emailContact = await services.contacts.createContact(context, {
    email: "collision@example.com",
    country: "AR",
  });
  const linkedinContact = await services.contacts.createContact(context, {
    linkedinUrl: "https://linkedin.com/in/collision-owner",
    country: "AR",
  });
  await assert.rejects(
    () => services.contacts.createContact(context, {
      email: emailContact.email,
      linkedinUrl: linkedinContact.linkedinUrl,
      country: "AR",
    }),
    /pertenecen a contactos diferentes/,
  );
  await assert.rejects(
    () => services.contacts.createContact(context, {
      email: "new-email@example.com",
      linkedinUrl: linkedinContact.linkedinUrl,
      country: "AR",
    }),
    /linkedinUrl ya pertenece a otro contacto/,
  );
});

test("member count is idempotent for duplicate adds and never negative", async () => {
  const { repos, services, context } = setup();
  const campaign = await services.linkedInCampaigns.createCampaign(context, { name: "Atomic count" });
  const contact = await services.contacts.createContact(context, {
    linkedinUrl: "https://linkedin.com/in/atomic-count",
    country: "AR",
  });
  const members = await Promise.all(
    Array.from({ length: 5 }, () =>
      services.linkedInCampaigns.addMember(context, campaign.id, contact.id)),
  );
  assert.equal(new Set(members.map((member) => member.id)).size, 1);
  assert.equal((await services.linkedInCampaigns.getCampaign(context, campaign.id)).memberCount, 1);
  await services.linkedInCampaigns.removeMember(context, campaign.id, members[0].id);
  assert.equal((await services.linkedInCampaigns.getCampaign(context, campaign.id)).memberCount, 0);
  await repos.linkedInCampaigns.adjustMemberCount(
    context.workspaceId,
    campaign.id,
    -10,
    "2026-09-23T12:00:00.000Z",
  );
  assert.equal((await services.linkedInCampaigns.getCampaign(context, campaign.id)).memberCount, 0);
});

test("preview funnel keeps historical milestones after interest", async () => {
  const { services, context } = setup();
  const campaign = await services.linkedInCampaigns.createCampaign(context, { name: "Progression" });
  const contact = await services.contacts.createContact(context, {
    linkedinUrl: "https://linkedin.com/in/progression",
    country: "AR",
  });
  const member = await services.linkedInCampaigns.addMember(context, campaign.id, contact.id);
  for (const action of ["connection_sent", "connected", "message_sent", "replied", "interested"] as const) {
    await services.linkedInCampaigns.recordAction(context, campaign.id, member.id, {
      action,
      at: "2026-09-23T12:00:00.000Z",
    });
  }
  const preview = await services.linkedInCampaigns.previewCampaign(context, campaign.id);
  assert.equal(preview.summary.pending, 0);
  assert.equal(preview.summary.connectionSent, 1);
  assert.equal(preview.summary.connected, 1);
  assert.equal(preview.summary.messageSent, 1);
  assert.equal(preview.summary.replied, 1);
  assert.equal(preview.summary.interested, 1);
  assert.equal(preview.summary.byStatus.interested, 1);
});

test("LinkedIn actions transition member, contact summary, and activity history", async () => {
  const { repos, services, context } = setup();
  const contact = await services.contacts.createContact(context, {
    email: "actions@example.com",
    linkedinUrl: "https://linkedin.com/in/actions-test",
    name: "Action Test",
    country: "CL",
  });
  const campaign = await services.linkedInCampaigns.createCampaign(context, { name: "Actions" });
  const member = await services.linkedInCampaigns.addMember(context, campaign.id, contact.id);

  const transitions = [
    ["connection_sent", "connection_sent"],
    ["connected", "connected"],
    ["message_sent", "message_sent"],
    ["followup_sent", "follow_up_sent"],
    ["replied", "replied"],
    ["interested", "interested"],
    ["not_interested", "not_interested"],
  ] as const;
  let current = member;
  for (const [action, expected] of transitions) {
    current = await services.linkedInCampaigns.recordAction(context, campaign.id, member.id, {
      action,
      at: "2026-09-23T12:00:00.000Z",
      notes: action,
    });
    assert.equal(current.status, expected);
  }
  assert.equal(current.responseType, "not_interested");
  assert.equal(current.notInterestedAt, "2026-09-23T12:00:00.000Z");

  const updatedContact = await services.contacts.getContact(context, contact.id);
  assert.equal(updatedContact.linkedinStatus, "not_interested");
  assert.equal(updatedContact.linkedinLastContactAt, "2026-09-23T12:00:00.000Z");
  const history = await repos.activities.listByContact(context.workspaceId, contact.id, { limit: 20 });
  assert.equal(history.items.length, transitions.length);
  assert.ok(history.items.every((activity) => activity.metadata?.channel === "linkedin"));
});

test("pending LinkedIn actions are due-date filtered and omit terminal members", async () => {
  const { services, context } = setup();
  const campaign = await services.linkedInCampaigns.createCampaign(context, { name: "Pending" });
  const due = await services.contacts.createContact(context, {
    linkedinUrl: "https://linkedin.com/in/due-contact",
    country: "AR",
  });
  const future = await services.contacts.createContact(context, {
    linkedinUrl: "https://linkedin.com/in/future-contact",
    country: "AR",
  });
  const terminal = await services.contacts.createContact(context, {
    linkedinUrl: "https://linkedin.com/in/terminal-contact",
    country: "AR",
  });
  const dueMember = await services.linkedInCampaigns.addMember(context, campaign.id, due.id);
  const futureMember = await services.linkedInCampaigns.addMember(context, campaign.id, future.id);
  const terminalMember = await services.linkedInCampaigns.addMember(context, campaign.id, terminal.id);
  await services.linkedInCampaigns.updateMember(context, campaign.id, dueMember.id, {
    nextActionAt: "2026-09-23T10:00:00.000Z",
  });
  await services.linkedInCampaigns.updateMember(context, campaign.id, futureMember.id, {
    nextActionAt: "2026-09-25T10:00:00.000Z",
  });
  await services.linkedInCampaigns.updateMember(context, campaign.id, terminalMember.id, {
    nextActionAt: "2026-09-23T09:00:00.000Z",
    status: "do_not_contact",
  });
  const pending = await services.linkedInCampaigns.pendingActions(
    context,
    "2026-09-24T00:00:00.000Z",
  );
  assert.deepEqual(pending.items.map((item) => item.id), [dueMember.id]);
});

test("email enqueue isolation rejects LinkedIn campaigns and skips no-email contacts", () => {
  assert.equal(canQueueMarketingEmail({ email: "valid@example.com" }), true);
  assert.equal(canQueueMarketingEmail({ linkedinUrl: "https://linkedin.com/in/no-email" }), false);
  assert.doesNotThrow(() => assertEmailOnlyMarketingCampaign({ channel: "email" }));
  assert.doesNotThrow(() => assertEmailOnlyMarketingCampaign({}));
  assert.throws(
    () => assertEmailOnlyMarketingCampaign({ channel: "linkedin" }),
    /no es de email/,
  );
});
