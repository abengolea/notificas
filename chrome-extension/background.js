import { auditEvent } from "./lib/api.js";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "OPEN_AND_PREPARE") {
    openAndPrepare(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true;
  }
  if (message?.type === "AUDIT_EVENT") {
    handleAudit(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true;
  }
  return false;
});

async function getConfig() {
  const stored = await chrome.storage.sync.get(["apiUrl", "token", "locale"]);
  return {
    apiUrl: stored.apiUrl || "http://localhost:9006",
    token: stored.token || "",
    locale: stored.locale || "auto",
  };
}

async function openAndPrepare(message) {
  const { action, memberId } = message;
  if (!action?.contact?.linkedinUrl) {
    return { ok: false, error: "El prospecto no tiene linkedinUrl." };
  }

  const cfg = await getConfig();
  const url = action.contact.linkedinUrl;
  const tab = await chrome.tabs.create({ url, active: true });
  await waitForTabLoad(tab.id);
  await sleep(1800);

  if (memberId) {
    await auditEvent(cfg, memberId, { event: "opened_profile" }).catch(() => {});
  }

  const payload = {
    action: action.action,
    message: action.message,
    linkedinUrl: url,
    locale: cfg.locale,
  };

  let prepareResult = { ok: false, error: "No pude preparar automáticamente esta acción." };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await chrome.tabs.sendMessage(tab.id, {
        type: "RUN_PREPARE",
        payload,
        memberId,
      });
      if (res) {
        prepareResult = res;
        break;
      }
    } catch {
      await sleep(1200);
    }
  }

  return { ok: prepareResult.ok, tabId: tab.id, ...prepareResult };
}

async function handleAudit(message) {
  const cfg = await getConfig();
  return auditEvent(cfg, message.memberId, message.body);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(undefined);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(undefined);
    }, 25000);
  });
}
