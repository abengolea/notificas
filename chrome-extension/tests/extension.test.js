import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadAssistant() {
  const context = {
    window: {},
    self: {},
    URL,
    Element: class Element {},
    HTMLTextAreaElement: class HTMLTextAreaElement {},
    HTMLInputElement: class HTMLInputElement {},
    InputEvent: class InputEvent {},
    Event: class Event {},
    setTimeout: (fn) => fn(),
  };
  context.window = context;
  context.self = context;
  for (const file of ["lib/safety.js", "lib/linkedinSelectors.js", "lib/linkedinPrepare.js"]) {
    runInNewContext(readFileSync(join(root, file), "utf8"), context);
  }
  return { NS: context.NotificasAssistant, vmContext: context };
}

test("forbidden auto send actions are blocked", () => {
  const { NS } = loadAssistant();
  NS.__test_forbiddenSendBlocked();
  assert.deepEqual([...NS.FORBIDDEN_AUTO_ACTIONS], [
    "send_invitation",
    "send_message",
    "send_followup",
  ]);
});

test("profile slug extraction and matching", () => {
  const { NS } = loadAssistant();
  assert.equal(NS.extractProfileSlug("https://pa.linkedin.com/in/fernando-alborta/"), "fernando-alborta");
  assert.equal(
    NS.profileSlugMatches("https://www.linkedin.com/in/fernando-alborta/", "fernando-alborta"),
    true,
  );
});

test("prepare module never implements final send clicks", () => {
  const prepareSource = readFileSync(join(root, "lib/linkedinPrepare.js"), "utf8");
  assert.doesNotMatch(prepareSource, /send_invitation|send_message|send_followup/);
  assert.doesNotMatch(prepareSource, /findSend|clickSend|Enviar invitaci/);
});

test("isForbiddenSendElement detects Enviar label", () => {
  const { NS, vmContext } = loadAssistant();
  const btn = new vmContext.Element();
  btn.textContent = "Enviar";
  btn.getAttribute = () => "";
  assert.equal(NS.isForbiddenSendElement(btn), true);
  assert.throws(() => NS.assertSafeToClick(btn));
});
