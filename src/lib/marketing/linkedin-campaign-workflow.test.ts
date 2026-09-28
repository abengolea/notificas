import { test } from "node:test";
import assert from "node:assert/strict";
import {
  linkedInCompleteActionForMember,
  linkedInPrimaryOutreachField,
  linkedInWorkBucket,
  sortLinkedInCampaignMembersForWork,
} from "./linkedin-campaign-workflow";
import type { MarketingLinkedInCampaignMember } from "./domain/types";

function member(status: MarketingLinkedInCampaignMember["status"], id: string): MarketingLinkedInCampaignMember {
  return {
    id,
    workspaceId: "w",
    campaignId: "c",
    contactId: id,
    linkedinUrl: "https://linkedin.com/in/test",
    status,
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as MarketingLinkedInCampaignMember;
}

test("work buckets priorizan todo antes que waiting", () => {
  const sorted = sortLinkedInCampaignMembersForWork([
    member("connection_sent", "a"),
    member("connection_ready", "b"),
    member("message_sent", "c"),
    member("follow_up_due", "d"),
  ]);
  assert.equal(linkedInWorkBucket(sorted[0].status), "todo");
  assert.equal(sorted[0].id, "d");
  assert.equal(sorted[1].id, "b");
  assert.equal(linkedInWorkBucket(sorted[2].status), "waiting");
});

test("complete action mapping para marcar enviado", () => {
  assert.equal(linkedInCompleteActionForMember("connection_ready"), "connection_sent");
  assert.equal(linkedInCompleteActionForMember("message_ready"), "message_sent");
  assert.equal(linkedInCompleteActionForMember("follow_up_due"), "followup_sent");
});

test("primary outreach field sigue el paso actual", () => {
  assert.equal(linkedInPrimaryOutreachField("connection_ready"), "connectionMessage");
  assert.equal(linkedInPrimaryOutreachField("message_ready"), "message");
  assert.equal(linkedInPrimaryOutreachField("follow_up_due"), "followUpMessage");
  assert.equal(linkedInPrimaryOutreachField("connection_sent"), "message");
});
