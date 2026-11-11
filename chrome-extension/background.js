import { auditEvent, completeAction, fetchActions } from "./lib/api.js";
import {
  BATCH_SIZE,
  messagesMatch,
  readBatch,
  readQueue,
  rememberSeen,
  writeBatch,
} from "./lib/batch.js";
import { extensionLog } from "./lib/log.js";
import { adminConnectUrl, claimConnectCode, connectCodeFromUrl, getPreferences } from "./lib/session.js";

let batchRunning = false;

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
  if (message?.type === "START_ADMIN_CONNECT") {
    startAdminConnect()
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true;
  }
  if (message?.type === "START_BATCH") {
    startPrepareBatch(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true;
  }
  if (message?.type === "STOP_BATCH") {
    stopPrepareBatch()
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true;
  }
  if (message?.type === "GET_BATCH") {
    readBatch()
      .then((batch) => sendResponse({ ok: true, batch }))
      .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true;
  }
  if (message?.type === "SCAN_SENT") {
    scanPreparedSent()
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true;
  }
  return false;
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (!info.url && info.status !== "complete") return;
  const url = info.url || tab.url || "";
  const code = connectCodeFromUrl(url);
  if (!code) return;
  claimConnectFromTab(tabId, code).catch((err) => {
    extensionLog(`auth connect: failed ${String(err.message || err)}`);
  });
});

let claimingCode = "";

async function claimConnectFromTab(tabId, code) {
  if (!code || claimingCode === code) return;
  claimingCode = code;
  try {
    await claimConnectCode(code);
    extensionLog("auth connect: success");
    if (tabId) chrome.tabs.remove(tabId).catch(() => {});
  } finally {
    claimingCode = "";
  }
}

async function startAdminConnect() {
  const prefs = await getPreferences();
  const url = adminConnectUrl(prefs.apiUrl);
  extensionLog("auth connect: opening admin");
  const tab = await chrome.tabs.create({ url, active: true });
  return { ok: true, tabId: tab.id };
}

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

function extractProfileSlug(linkedinUrl) {
  try {
    const path = new URL(linkedinUrl).pathname;
    const inMatch = path.match(/\/in\/([^/?#]+)/i);
    if (inMatch) return decodeURIComponent(inMatch[1]).replace(/\/+$/, "");
    const postMatch = path.match(/\/posts\/([^/?#]+)/i);
    if (postMatch) return decodeURIComponent(postMatch[1]).split("_")[0];
    return "";
  } catch {
    return "";
  }
}

function profileUrlForPrepare(raw) {
  const slug = extractProfileSlug(raw);
  return slug ? `https://www.linkedin.com/in/${slug}/` : raw;
}

function messagingComposeUrl(raw) {
  const slug = extractProfileSlug(raw);
  if (!slug) return "";
  return `https://www.linkedin.com/messaging/compose/?recipient=${encodeURIComponent(slug)}`;
}

async function runPrepareOnTab(tabId, payload, memberId) {
  let prepareResult = { ok: false, error: "No pude preparar el mensaje directo." };
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const res = await chrome.tabs.sendMessage(tabId, {
        type: "RUN_PREPARE",
        payload,
        memberId,
      });
      if (res) {
        prepareResult = res;
        if (res.ok || res.fallback === "compose") break;
      }
    } catch {
      extensionLog(`prepare attempt ${attempt + 1} failed`);
      await ensureContentScript(tabId);
    }
    await sleep(1500);
  }
  return prepareResult;
}

async function openAndPrepare(message) {
  const { action, memberId } = message;
  if (!action?.contact?.linkedinUrl) {
    return { ok: false, error: "El prospecto no tiene linkedinUrl." };
  }

  const prefs = await getPreferences();
  const url = profileUrlForPrepare(action.contact.linkedinUrl);
  const tab = await chrome.tabs.create({ url, active: true });
  await waitForLinkedInProfile(tab.id);

  if (memberId) {
    await auditEvent(memberId, { event: "opened_profile" }).catch(() => {});
  }

  await ensureContentScript(tab.id);

  const payload = {
    action: "message",
    message: action.message,
    linkedinUrl: url,
    locale: prefs.locale,
  };

  let prepareResult = await runPrepareOnTab(tab.id, payload, memberId);

  if (!prepareResult.ok && prepareResult.fallback === "compose") {
    const composeUrl = messagingComposeUrl(url);
    if (composeUrl) {
      extensionLog("prepare: opening messaging compose");
      await chrome.tabs.update(tab.id, { url: composeUrl });
      await waitForMessagingPage(tab.id);
      await ensureContentScript(tab.id);
      prepareResult = await runPrepareOnTab(tab.id, payload, memberId);
    }
  }

  if (prepareResult.ok && memberId) {
    await syncDraftToCrm(memberId, action.message);
  }

  extensionLog(`prepare: ${prepareResult.ok ? "success" : "failed"}`);
  return { ok: prepareResult.ok, tabId: tab.id, ...prepareResult };
}

async function waitForLinkedInProfile(tabId) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url && /linkedin\.com\/in\//i.test(tab.url) && tab.status === "complete") {
      await sleep(2000);
      return tab;
    }
    await sleep(400);
  }
  await waitForTabLoad(tabId);
  await sleep(2000);
}

async function waitForMessagingPage(tabId) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url && /linkedin\.com\/messaging\//i.test(tab.url) && tab.status === "complete") {
      await sleep(2200);
      return tab;
    }
    await sleep(400);
  }
  await waitForTabLoad(tabId);
  await sleep(2200);
}

async function ensureContentScript(tabId) {
  try {
    const ping = await chrome.tabs.sendMessage(tabId, { type: "PING" });
    if (ping?.ok) return;
  } catch {
    /* inject below */
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["lib/safety.js", "lib/linkedinSelectors.js", "lib/linkedinPrepare.js", "content.js"],
  });
  await sleep(500);
}

async function syncDraftToCrm(memberId, message) {
  if (!memberId) return;
  try {
    await completeAction(memberId, {
      action: "message_drafted",
      notes: `Borrador escrito en LinkedIn. Envío pendiente.\n\n${message || ""}`.slice(0, 8000),
    });
  } catch (err) {
    extensionLog(`crm draft sync failed: ${String(err.message || err)}`);
  }
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

async function updateBatch(patch) {
  const batch = await readBatch();
  Object.assign(batch, patch);
  await writeBatch(batch);
  return batch;
}

async function startPrepareBatch(message) {
  const current = await readBatch();
  if (current.status === "running" || batchRunning) {
    return { ok: true, alreadyRunning: true, batch: current };
  }
  const campaignId = message.campaignId || "";
  await writeBatch({
    ...current,
    status: "running",
    target: BATCH_SIZE,
    lotePrepared: 0,
    loteFailed: 0,
    currentName: "Cargando la cola…",
    error: "",
    campaignId,
    resume: true,
  });
  chrome.alarms.create("notificas-batch", { periodInMinutes: 1 });
  runPrepareBatch(campaignId).catch(async (err) => {
    extensionLog(`batch failed: ${String(err.message || err)}`);
    await updateBatch({ status: "paused", error: String(err.message || err), resume: false, currentName: "" });
    batchRunning = false;
  });
  return { ok: true, started: true, target: BATCH_SIZE };
}

async function stopPrepareBatch() {
  await updateBatch({ status: "stopped", resume: false, currentName: "" });
  batchRunning = false;
  chrome.alarms.clear("notificas-batch").catch(() => {});
  return { ok: true, stopped: true };
}

async function pickBatchActions(campaignId) {
  const queue = await readQueue();
  const batch = await readBatch();
  const skip = new Set([
    ...queue.seenMemberIds,
    ...batch.items.map((item) => item.memberId),
  ]);
  const data = await fetchActions({
    campaignId: campaignId || undefined,
    limit: 200,
  });
  return (data.actions || []).filter((action) => action?.memberId && !skip.has(action.memberId));
}

async function openProspectTab(action) {
  const url = profileUrlForPrepare(action.contact.linkedinUrl);
  if (!url) return { ok: false, error: "El prospecto no tiene linkedinUrl." };
  const tab = await chrome.tabs.create({ url, active: false });
  return { ok: true, tabId: tab.id };
}

async function runPrepareBatch(campaignId) {
  if (batchRunning) return;
  batchRunning = true;
  try {
    const actions = await pickBatchActions(campaignId);
    if (!actions.length) {
      await updateBatch({
        status: "paused",
        resume: false,
        currentName: "",
        error: "No hay más prospectos pendientes para preparar.",
      });
      return;
    }

    for (const action of actions) {
      const live = await readBatch();
      if (live.status !== "running") break;
      if (live.lotePrepared >= BATCH_SIZE) break;

      await updateBatch({ currentName: action.contact?.name || "Prospecto", error: "" });
      let result;
      try {
        result = await openProspectTab(action);
      } catch (err) {
        result = { ok: false, error: String(err.message || err) };
      }

      const latest = await readBatch();
      if (result.tabId) latest.tabId = result.tabId;
      if (result.ok) {
        latest.lotePrepared += 1;
        latest.totalPrepared += 1;
        latest.items.push({
          memberId: action.memberId,
          campaignId: action.campaignId,
          name: action.contact?.name || "",
          linkedinUrl: action.contact?.linkedinUrl || "",
          message: action.message || "",
          preparedAt: Date.now(),
          sentAt: null,
          tabId: result.tabId || null,
          ok: true,
        });
        if (latest.items.length > 200) latest.items = latest.items.slice(-200);
        await writeBatch(latest);
        await rememberSeen(action.memberId, campaignId);
        if (action.memberId) {
          await auditEvent(action.memberId, { event: "opened_profile" }).catch(() => {});
        }
      } else {
        latest.loteFailed += 1;
        latest.items.push({
          memberId: action.memberId,
          campaignId: action.campaignId,
          name: action.contact?.name || "",
          linkedinUrl: action.contact?.linkedinUrl || "",
          message: action.message || "",
          preparedAt: Date.now(),
          sentAt: null,
          tabId: result.tabId || null,
          ok: false,
          error: result.error || "No pude abrir el perfil.",
        });
        await writeBatch(latest);
        await rememberSeen(action.memberId, campaignId);
      }

      await sleep(400);
    }

    const done = await readBatch();
    const firstTabId = done.items.find((item) => item.tabId)?.tabId;
    if (firstTabId) {
      chrome.tabs.update(firstTabId, { active: true }).catch(() => {});
    }
    const paused = done.lotePrepared >= BATCH_SIZE;
    await updateBatch({
      status: paused ? "paused" : "idle",
      resume: false,
      currentName: "",
      error: paused
        ? `Lote de ${BATCH_SIZE} perfiles abiertos. Copiá el mensaje en el CRM y pegalo vos en cada chat.`
        : done.error || (done.lotePrepared ? "Cola terminada." : done.error),
    });
    if (paused || done.status !== "running") {
      chrome.alarms.clear("notificas-batch").catch(() => {});
    }
  } finally {
    batchRunning = false;
  }
}

async function readOutboundFromTab(tabId) {
  await ensureContentScript(tabId);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await chrome.tabs.sendMessage(tabId, { type: "GET_OUTBOUND_MESSAGES" });
      if (res?.messages?.length) return res.messages;
    } catch {
      await ensureContentScript(tabId);
    }
    await sleep(800);
  }
  return [];
}

async function scanPreparedSent() {
  const batch = await readBatch();
  const pending = batch.items.filter((item) => item.ok && item.message && !item.sentAt);
  if (!pending.length) {
    return { ok: true, checked: 0, marked: 0, message: "No hay mensajes preparados pendientes de revisar." };
  }

  await updateBatch({ currentName: "Revisando enviados…", error: "" });
  const draftTabIds = new Set(batch.items.map((item) => item.tabId).filter(Boolean));

  let marked = 0;
  for (const item of pending) {
    const live = await readBatch();
    if (live.status === "stopped") break;
    await updateBatch({ currentName: `Revisando ${item.name || "prospecto"}…` });

    let outbound = [];
    let tabId = item.tabId || null;
    if (tabId) {
      try {
        await chrome.tabs.get(tabId);
      } catch {
        tabId = null;
      }
    }
    if (tabId) {
      outbound = await readOutboundFromTab(tabId);
    } else {
      const scratch = await chrome.tabs.create({
        url: profileUrlForPrepare(item.linkedinUrl),
        active: true,
      });
      await waitForLinkedInProfile(scratch.id);
      outbound = await readOutboundFromTab(scratch.id);
      if (!draftTabIds.has(scratch.id)) {
        chrome.tabs.remove(scratch.id).catch(() => {});
      }
    }

    const matched = outbound.some((text) => messagesMatch(item.message, text));
    if (matched) {
      await completeAction(item.memberId, {
        action: "message_sent",
        notes: "Detectado en LinkedIn: el mensaje preparado aparece enviado.",
      }).catch(() => {});
      const next = await readBatch();
      const row = next.items.find((rowItem) => rowItem.memberId === item.memberId && !rowItem.sentAt);
      if (row) row.sentAt = Date.now();
      next.sentDetected = next.items.filter((rowItem) => rowItem.sentAt).length;
      await writeBatch(next);
      marked += 1;
    }
    await sleep(900);
  }

  await updateBatch({ currentName: "", error: "" });
  return {
    ok: true,
    checked: pending.length,
    marked,
    message:
      marked > 0
        ? `Marqué ${marked} mensaje(s) como enviados en el CRM.`
        : "No encontré coincidencias enviadas en LinkedIn. Si los mandaste editados, confirmá a mano.",
  };
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== "notificas-batch") return;
  readBatch().then((batch) => {
    if (batch.status === "running" && batch.resume && !batchRunning) {
      runPrepareBatch(batch.campaignId).catch(() => {});
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  readBatch().then((batch) => {
    if (batch.status === "running") {
      runPrepareBatch(batch.campaignId).catch(() => {});
    }
  });
});

