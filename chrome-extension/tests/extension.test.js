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

test("production build never resolves localhost", async () => {
  const env = readFileSync(join(root, "lib/env.js"), "utf8");
  assert.match(env, /EXTENSION_ENV = "production"/);
  const { isProductionEnv, resolveApiUrl, PRODUCTION_API_URL } = await import("../lib/config.js");
  assert.equal(isProductionEnv(), true);
  assert.equal(PRODUCTION_API_URL, "https://notificas.com.ar");
  assert.equal(resolveApiUrl("http://localhost:9006"), "https://notificas.com.ar");
  assert.equal(resolveApiUrl("http://127.0.0.1:9006"), "https://notificas.com.ar");
});

test("manifest is MV3 and production host is scoped", () => {
  const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.ok(manifest.host_permissions.includes("https://notificas.com.ar/*"));
  assert.ok(!manifest.host_permissions.includes("https://*/*"));
  assert.ok(!JSON.stringify(manifest).includes("chrome.identity"));
});

test("extension UI does not ask for a pasted token", () => {
  const optionsHtml = readFileSync(join(root, "options.html"), "utf8");
  const popupHtml = readFileSync(join(root, "popup.html"), "utf8");
  const optionsJs = readFileSync(join(root, "options.js"), "utf8");
  assert.doesNotMatch(optionsHtml, /LINKEDIN_ASSISTANT_TOKEN|Token de extensión/);
  assert.doesNotMatch(popupHtml, /LINKEDIN_ASSISTANT_TOKEN|pegá/);
  assert.doesNotMatch(optionsJs, /stored\.token|Bearer \$\{token\}/);
  assert.match(popupHtml, /CONECTADO A NOTIFICAS/);
  assert.match(popupHtml, /Sesión vencida/);
});

test("api client never logs a bearer secret", () => {
  const api = readFileSync(join(root, "lib/api.js"), "utf8");
  const log = readFileSync(join(root, "lib/log.js"), "utf8");
  const session = readFileSync(join(root, "lib/session.js"), "utf8");
  assert.doesNotMatch(api, /console\.(log|info|debug|warn).*Authorization/);
  assert.doesNotMatch(session, /console\.(log|info|debug|warn).*accessToken/);
  assert.match(log, /\[redacted\]/);
  assert.match(api, /retried/);
});

test("isForbiddenSendElement detects Enviar label", () => {
  const { NS, vmContext } = loadAssistant();
  const btn = new vmContext.Element();
  btn.textContent = "Enviar";
  btn.getAttribute = () => "";
  assert.equal(NS.isForbiddenSendElement(btn), true);
  assert.throws(() => NS.assertSafeToClick(btn));
});
