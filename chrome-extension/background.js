import { auditEvent } from "./lib/api.js";
import { extensionLog } from "./lib/log.js";
import { getPreferences } from "./lib/session.js";

const lastProfile = {
  linkedinUrl: "",
  detectedAt: 0,
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
  if (message?.type === "PROFILE_DETECTED") {
    if (typeof message.linkedinUrl === "string" && message.linkedinUrl.includes("/in/")) {
      lastProfile.linkedinUrl = message.linkedinUrl;
      lastProfile.detectedAt = Date.now();
      extensionLog(`profile detected: ${summarizeProfile(message.linkedinUrl)}`);
    }
    sendResponse({ ok: true });
    return false;
  }
  if (message?.type === "GET_DETECTED_PROFILE") {
    resolveDetectedProfile()
      .then(sendResponse)
      .catch(() => sendResponse({ ok: true, ...lastProfile, tabUrl: "" }));
    return true;
  }
  return false;
});

async function resolveDetectedProfile() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  const tabUrl = tab?.url || "";
  if (tab?.id && /linkedin\.com\/in\//i.test(tabUrl)) {
    try {
      const page = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_PROFILE" });
      if (page?.linkedinUrl) {
        lastProfile.linkedinUrl = page.linkedinUrl;
        lastProfile.detectedAt = Date.now();
      }
    } catch {
      if (/\/in\//i.test(tabUrl)) {
        lastProfile.linkedinUrl = tabUrl;
        lastProfile.detectedAt = Date.now();
      }
    }
  }
  return { ok: true, linkedinUrl: lastProfile.linkedinUrl, detectedAt: lastProfile.detectedAt, tabUrl };
}

function summarizeProfile(url) {
  try {
    const match = new URL(url).pathname.match(/\/in\/([^/?#]+)/i);
    return match ? `/in/${decodeURIComponent(match[1])}` : "/in/*";
  } catch {
    return "/in/*";
  }
}

async function openAndPrepare(message) {
  const { action, memberId } = message;
  if (!action?.contact?.linkedinUrl) {
    return { ok: false, error: "El prospecto no tiene linkedinUrl." };
  }

  const prefs = await getPreferences();
  const url = action.contact.linkedinUrl;
  const tab = await chrome.tabs.create({ url, active: true });
  await waitForTabLoad(tab.id);
  await sleep(1800);

  if (memberId) {
    await auditEvent(memberId, { event: "opened_profile" }).catch(() => {});
  }

  const payload = {
    action: action.action,
    message: action.message,
    linkedinUrl: url,
    locale: prefs.locale,
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
  return auditEvent(message.memberId, message.body);
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
