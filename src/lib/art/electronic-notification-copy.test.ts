import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ELECTRONIC_NOTIFICATION_BLOCK_MESSAGE,
  explainElectronicNotificationBlock,
} from "./electronic-notification-copy";

test("explica el bloqueo de notificación electrónica sin adhesión", () => {
  assert.equal(
    explainElectronicNotificationBlock("REQUIRES_CONVENTIONAL_CHANNEL"),
    ELECTRONIC_NOTIFICATION_BLOCK_MESSAGE
  );
  assert.equal(explainElectronicNotificationBlock("NO_ADHESION"), ELECTRONIC_NOTIFICATION_BLOCK_MESSAGE);
  assert.equal(explainElectronicNotificationBlock("timeout"), null);
});
