import { test } from "node:test";
import assert from "node:assert/strict";
import { marketingContext } from "./context";
import { normalizeLinkedInUrl } from "./normalizers";
import { createMemoryMarketingRepositories } from "./repositories/memory";
import { createMarketingServices } from "./services";
import { createLinkedInAssistantService } from "./linkedin-assistant";
import {
  connectionReviewDays,
  defaultNextActionAfterConnectionSent,
} from "./linkedin-assistant";

function setup() {
  const repos = createMemoryMarketingRepositories();
  const services = createMarketingServices(repos);
  const context = marketingContext("notificas-internal", {
    actorType: "user",
    actorId: "assistant-test",
  });
  const assistant = createLinkedInAssistantService({
    linkedIn: services.linkedInCampaigns,
    campaigns: repos.linkedInCampaigns,
    members: repos.linkedInCampaignMembers,
    contacts: repos.contacts,
    activities: repos.activities,
  });
  return { repos, services, context, assistant };
}

test("LinkedIn URL normalization for assistant", () => {
  assert.equal(
    normalizeLinkedInUrl("https://www.linkedin.com/in/usuario/"),
    "https://linkedin.com/in/usuario",
  );
  assert.equal(
    normalizeLinkedInUrl("https://pa.linkedin.com/in/usuario?utm=1"),
    "https://linkedin.com/in/usuario",
  );
  assert.equal(
    normalizeLinkedInUrl("https://cr.linkedin.com/in/usuario"),
    "https://linkedin.com/in/usuario",
  );
});

test("next action priority: follow_up_due before connection_ready", async () => {
  const { services, context, assistant } = setup();
  const campaign = await services.linkedInCampaigns.createCampaign(context, {
    name: "Panamá | Telecom",
    connectionMessage: "Hola conexión",
    message: "Hola mensaje",
    followUpMessage: "Hola followup",
  });
  await services.linkedInCampaigns.updateCampaign(context, campaign.id, { status: "active" });

  const contactA = await services.contacts.createContact(context, {
    email: "a@example.com",
    linkedinUrl: "https://linkedin.com/in/a-test",
    name: "Ana A",
    country: "AR",
  });
  const contactB = await services.contacts.createContact(context, {
    email: "b@example.com",
    linkedinUrl: "https://linkedin.com/in/b-test",
    name: "Bob B",
    country: "AR",
  });

  const memberA = await services.linkedInCampaigns.addMember(context, campaign.id, contactA.id);
  const memberB = await services.linkedInCampaigns.addMember(context, campaign.id, contactB.id);

  await services.linkedInCampaigns.updateMember(context, campaign.id, memberA.id, {
    status: "connection_ready",
  });
  await services.linkedInCampaigns.updateMember(context, campaign.id, memberB.id, {
    status: "follow_up_due",
    nextActionAt: new Date(Date.now() - 86_400_000).toISOString(),
  });

  const next = await assistant.getNextAction(context, { campaignId: campaign.id });
  assert.ok(next);
  assert.equal(next.memberId, memberB.id);
  assert.equal(next.action, "followup");
});

test("complete action uses recordAction and schedules connection review", async () => {
  const { services, context, assistant } = setup();
  const campaign = await services.linkedInCampaigns.createCampaign(context, {
    name: "Test campaign",
    connectionMessage: "Invite",
  });
  await services.linkedInCampaigns.updateCampaign(context, campaign.id, { status: "active" });

  const contact = await services.contacts.createContact(context, {
    email: "c@example.com",
    linkedinUrl: "https://linkedin.com/in/c-test",
    name: "Carlos C",
    country: "AR",
  });
  const member = await services.linkedInCampaigns.addMember(context, campaign.id, contact.id);
  await services.linkedInCampaigns.updateMember(context, campaign.id, member.id, {
    status: "connection_ready",
    connectionMessage: "Personal invite",
  });

  const result = await assistant.completeAction(context, member.id, {
    action: "connection_sent",
  });
  assert.equal(result.member.status, "connection_sent");
  assert.ok(result.member.connectionSentAt);
  assert.ok(result.member.nextActionAt);

  const contactRow = await services.contacts.getContact(context, contact.id);
  assert.equal(contactRow.linkedinStatus, "connection_sent");
});

test("audit prepared event does not change member status", async () => {
  const { services, context, assistant, repos } = setup();
  const campaign = await services.linkedInCampaigns.createCampaign(context, {
    name: "Audit campaign",
  });
  await services.linkedInCampaigns.updateCampaign(context, campaign.id, { status: "active" });
  const contact = await services.contacts.createContact(context, {
    email: "audit@example.com",
    linkedinUrl: "https://linkedin.com/in/audit-test",
    name: "Audit User",
    country: "AR",
  });
  const member = await services.linkedInCampaigns.addMember(context, campaign.id, contact.id);
  await services.linkedInCampaigns.updateMember(context, campaign.id, member.id, {
    status: "message_ready",
  });

  await assistant.recordAuditEvent(context, member.id, { event: "prepared_message" });
  const unchanged = await repos.linkedInCampaignMembers.getById(context.workspaceId, member.id);
  assert.equal(unchanged?.status, "message_ready");
});

test("connection review days default", () => {
  const days = connectionReviewDays();
  assert.ok(days >= 1);
  const next = defaultNextActionAfterConnectionSent(new Date("2026-01-01T00:00:00.000Z"));
  assert.match(next, /^2026-/);
});
