import assert from "node:assert/strict";
import { test } from "node:test";

import { parseReadCodeDoc } from "./read-code";

test("el documento del código corto trae mail y token", () => {
  assert.deepEqual(parseReadCodeDoc({ mailId: "mail-1", token: "secret" }), {
    mailId: "mail-1",
    token: "secret",
  });
  assert.equal(parseReadCodeDoc({ mailId: "mail-1" }), null);
  assert.equal(parseReadCodeDoc(null), null);
});
