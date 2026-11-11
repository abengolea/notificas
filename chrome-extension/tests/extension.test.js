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

test("connect URL parsing reads the admin handshake code", async () => {
  const { connectCodeFromUrl, adminConnectUrl } = await import("../lib/session.js");
  assert.equal(
    connectCodeFromUrl("https://notificas.com.ar/admin/linkedin-assistant/connect/done?code=abc123"),
    "abc123",
  );
  assert.equal(connectCodeFromUrl("https://notificas.com.ar/admin"), "");
  assert.equal(adminConnectUrl("https://notificas.com.ar"), "https://notificas.com.ar/admin/linkedin-assistant/connect");
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
  assert.ok(manifest.permissions.includes("scripting"));
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
  assert.match(popupHtml, /INICIAR SESIÓN EN EL ADMIN/);
  const popupJs = readFileSync(join(root, "popup.js"), "utf8");
  assert.match(popupJs, /campaña en borrador/);
  assert.doesNotMatch(popupJs, /sin campaña activa/);
  assert.match(popupJs, /assistantQueue/);
  assert.match(popupJs, /Cargando el siguiente prospecto/);
  assert.match(popupJs, /fetchActions/);
  assert.match(popupJs, /START_BATCH/);
  assert.doesNotMatch(
    popupJs.slice(popupJs.indexOf("async function loadDetectedProfile"), popupJs.indexOf("async function recordOutcome")),
    /renderAction\(/,
  );
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

test("findConnectButton matches Invite to connect and ignores Follow", () => {
  const { NS, vmContext } = loadAssistant();

  function button(text, aria) {
    const el = new vmContext.Element();
    el.textContent = text;
    el.getAttribute = (name) => (name === "aria-label" ? aria : "");
    return el;
  }

  const connect = button("Connect", "Invite Carlos Guardado to connect");
  const follow = button("Follow", "Follow Carlos Guardado");
  const nodes = [follow, connect];
  const root = {
    querySelector: () => null,
    querySelectorAll: () => nodes,
  };
  const doc = {
    querySelector: (sel) => (sel === "main" ? root : null),
    querySelectorAll: () => nodes,
    body: root,
  };
  root.ownerDocument = doc;
  assert.equal(NS.findConnectButton(doc, "auto"), connect);
});

test("isForbiddenSendElement detects Enviar label", () => {
  const { NS, vmContext } = loadAssistant();
  const btn = new vmContext.Element();
  btn.textContent = "Enviar";
  btn.getAttribute = () => "";
  assert.equal(NS.isForbiddenSendElement(btn), true);
  assert.throws(() => NS.assertSafeToClick(btn));
});

function mockEl(vmContext, opts = {}) {
  const el = new vmContext.Element();
  el.textContent = opts.text || "";
  el.className = opts.className || "";
  el.classList = {
    contains: (name) => (el.className || "").split(/\s+/).includes(name),
  };
  const attrs = opts.attrs || {};
  el.getAttribute = (name) => attrs[name] || "";
  el.closest = (sel) => {
    const tokens = String(sel)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const token of tokens) {
      const cls = token.startsWith(".") ? token.slice(1).split(".")[0] : "";
      if (cls && el.className.split(/\s+/).includes(cls)) return el;
      if (opts.inside && opts.inside.some((c) => token.includes(c))) return { className: opts.inside[0] };
    }
    return null;
  };
  return el;
}

test("message composer ignores comment boxes and only accepts the DM overlay", () => {
  const { NS, vmContext } = loadAssistant();
  const comment = mockEl(vmContext, {
    className: "ql-editor",
    attrs: { "aria-label": "Añadir un comentario", contenteditable: "true" },
    inside: ["comments-comment-box", "feed-shared-update-v2"],
  });
  const dm = mockEl(vmContext, {
    className: "msg-form__contenteditable",
    attrs: { "aria-label": "Write a message", contenteditable: "true" },
    inside: ["msg-form"],
  });

  assert.equal(NS.isCommentComposer(comment), true);
  assert.equal(NS.isDirectMessageComposer(comment), false);
  assert.equal(NS.isCommentComposer(dm), false);
  assert.equal(NS.isDirectMessageComposer(dm), true);

  const doc = {
    querySelectorAll: () => [comment, dm],
  };
  assert.equal(NS.findMessageComposer(doc), dm);
});

test("extracts profile slug from posts URLs and builds compose URL", () => {
  const { NS } = loadAssistant();
  assert.equal(
    NS.extractProfileSlug("https://www.linkedin.com/posts/lisania-barria_leadthechange2026-activity-1"),
    "lisania-barria",
  );
  assert.equal(
    NS.normalizeLinkedInProfileUrl("https://www.linkedin.com/posts/lisania-barria_leadthechange2026-activity-1"),
    "https://www.linkedin.com/in/lisania-barria/",
  );
  assert.equal(
    NS.messagingComposeUrl("https://www.linkedin.com/in/carlos-guardado-123/"),
    "https://www.linkedin.com/messaging/compose/?recipient=carlos-guardado-123",
  );
  assert.equal(NS.isMessagingPage("https://www.linkedin.com/messaging/compose/?recipient=x"), true);
});

test("batch helpers cap at 20 and match sent LinkedIn text", async () => {
  const { BATCH_SIZE, messagesMatch, fingerprint } = await import("../lib/batch.js");
  assert.equal(BATCH_SIZE, 20);
  assert.equal(fingerprint("  Hola  Mundo  "), "hola mundo");
  assert.equal(
    messagesMatch(
      "Lisania, vi tu trabajo en CX B2B en Tigo Panamá. Desde Notificas estamos trabajando.",
      "Lisania, vi tu trabajo en CX B2B en Tigo Panamá. Desde Notificas estamos trabajando.",
    ),
    true,
  );
  assert.equal(messagesMatch("mensaje preparado largo para detectar envio real en linkedin chat", "otro texto"), false);
});

test("outbound extractor skips incoming comments and keeps sent bubbles", () => {
  const { NS, vmContext } = loadAssistant();
  const incoming = mockEl(vmContext, {
    className: "msg-s-event-listitem__body",
    text: "Gracias por escribir",
    inside: ["msg-s-event-listitem--other"],
  });
  incoming.closest = () => {
    const wrap = mockEl(vmContext, { className: "msg-s-event-listitem msg-s-event-listitem--other" });
    wrap.classList = { contains: (name) => name === "msg-s-event-listitem--other" };
    return wrap;
  };
  const sent = mockEl(vmContext, {
    className: "msg-s-event-listitem__body",
    text: "Hola, te escribo desde Notificas",
  });
  sent.closest = () => {
    const wrap = mockEl(vmContext, { className: "msg-s-event-listitem" });
    wrap.classList = { contains: () => false };
    return wrap;
  };
  const doc = { querySelectorAll: () => [incoming, sent] };
  const outbound = NS.extractOutboundMessages(doc);
  assert.equal(outbound.length, 1);
  assert.equal(outbound[0], "Hola, te escribo desde Notificas");
});

test("prepare always targets a direct message, never a comment field", () => {
  const prepareSource = readFileSync(join(root, "lib/linkedinPrepare.js"), "utf8");
  const selectors = readFileSync(join(root, "lib/linkedinSelectors.js"), "utf8");
  assert.match(prepareSource, /prepareDirectMessage/);
  assert.match(prepareSource, /forbidCompose/);
  assert.doesNotMatch(prepareSource, /prepareConnection|findInvitationNoteField/);
  assert.match(selectors, /isCommentComposer/);
  assert.match(selectors, /msg-form__contenteditable/);
  const popupHtml = readFileSync(join(root, "popup.html"), "utf8");
  assert.match(popupHtml, /MENSAJE DIRECTO/);
  assert.match(popupHtml, /ABRIR 20 PERFILES/);
  assert.match(popupHtml, /ACTIVAR OTROS 20/);
  assert.match(popupHtml, /REVISAR ENVIADOS EN LINKEDIN/);
  const background = readFileSync(join(root, "background.js"), "utf8");
  assert.match(background, /START_BATCH/);
  assert.match(background, /SCAN_SENT/);
  assert.match(background, /message_drafted/);
  assert.match(background, /syncDraftToCrm/);
  assert.match(background, /openProspectTab/);
  assert.doesNotMatch(background, /clickSend|send_message/);
});
