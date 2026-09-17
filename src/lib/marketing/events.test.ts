import { test } from "node:test";
import assert from "node:assert/strict";
import { marketingEventFromResend, shouldApplyMarketingResendEvent } from "./events";

test("Resend delivered y opened se mapean para marketing", () => {
  assert.equal(marketingEventFromResend("email.sent"), "sent");
  assert.equal(marketingEventFromResend("email.delivered"), "delivered");
  assert.equal(marketingEventFromResend("email.opened"), "opened");
  assert.equal(marketingEventFromResend("email.clicked"), "clicked");
  assert.equal(marketingEventFromResend("email.bounced"), "bounced");
  assert.equal(marketingEventFromResend("email.failed"), "failed");
  assert.equal(marketingEventFromResend("email.scheduled"), null);
});

test("marketing aplica recibido y abierto, no re-aplica sent ni Polygon", () => {
  assert.equal(shouldApplyMarketingResendEvent("email.sent"), false);
  assert.equal(shouldApplyMarketingResendEvent("email.delivered"), true);
  assert.equal(shouldApplyMarketingResendEvent("email.opened"), true);
  assert.equal(shouldApplyMarketingResendEvent("email.bounced"), true);
  assert.equal(shouldApplyMarketingResendEvent("email.scheduled"), false);
});
