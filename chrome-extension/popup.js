import { completeAction, fetchCampaigns, fetchNext } from "./lib/api.js";

const els = {
  campaignSelect: document.getElementById("campaign-select"),
  prospect: document.getElementById("prospect"),
  empty: document.getElementById("empty"),
  setup: document.getElementById("setup"),
  statusBanner: document.getElementById("status-banner"),
  name: document.getElementById("prospect-name"),
  company: document.getElementById("prospect-company"),
  title: document.getElementById("prospect-title"),
  status: document.getElementById("prospect-status"),
  message: document.getElementById("message"),
  btnPrepare: document.getElementById("btn-prepare"),
  btnConfirm: document.getElementById("btn-confirm"),
  btnCopy: document.getElementById("btn-copy"),
  btnSkip: document.getElementById("btn-skip"),
  btnNext: document.getElementById("btn-next"),
  openOptions: document.getElementById("open-options"),
};

/** @type {object|null} */
let currentAction = null;
let prepared = false;
let lastSkippedId = null;

async function getConfig() {
  const stored = await chrome.storage.sync.get([
    "apiUrl",
    "token",
    "maxPerSession",
    "sessionCount",
  ]);
  return {
    apiUrl: stored.apiUrl || "http://localhost:9006",
    token: stored.token || "",
    maxPerSession: Number(stored.maxPerSession || 50),
    sessionCount: Number(stored.sessionCount || 0),
  };
}

function showBanner(text, kind = "warn") {
  els.statusBanner.textContent = text;
  els.statusBanner.className = `banner ${kind}`;
  els.statusBanner.classList.remove("hidden");
}

function hideBanner() {
  els.statusBanner.classList.add("hidden");
}

function completeActionForKind(kind) {
  if (kind === "connection") return "connection_sent";
  if (kind === "message") return "message_sent";
  return "followup_sent";
}

function renderAction(action) {
  currentAction = action;
  prepared = false;
  hideBanner();

  if (!action) {
    els.prospect.classList.add("hidden");
    els.empty.classList.remove("hidden");
    disableActionButtons(true);
    return;
  }

  els.empty.classList.add("hidden");
  els.prospect.classList.remove("hidden");
  els.name.textContent = action.contact.name;
  els.company.textContent = action.contact.companyName || "—";
  els.title.textContent = action.contact.title || "—";
  els.status.textContent = action.statusLabel || action.status;
  els.message.value = action.message || "";
  disableActionButtons(false);
  els.btnConfirm.disabled = true;
}

function disableActionButtons(disabled) {
  els.btnPrepare.disabled = disabled;
  els.btnCopy.disabled = disabled;
  els.btnSkip.disabled = disabled;
  els.btnConfirm.disabled = disabled || !prepared;
}

async function loadCampaigns(cfg) {
  const data = await fetchCampaigns(cfg);
  els.campaignSelect.innerHTML = '<option value="">Todas las campañas</option>';
  for (const c of data.campaigns || []) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.pending} pendientes)`;
    els.campaignSelect.appendChild(opt);
  }
}

async function loadNext(excludeMemberId) {
  const cfg = await getConfig();
  if (!cfg.token) {
    els.setup.classList.remove("hidden");
    els.prospect.classList.add("hidden");
    els.empty.classList.add("hidden");
    return;
  }
  els.setup.classList.add("hidden");

  if (cfg.sessionCount >= cfg.maxPerSession) {
    showBanner(`Límite de sesión alcanzado (${cfg.maxPerSession}).`, "warn");
    return;
  }

  const params = {};
  if (els.campaignSelect.value) params.campaignId = els.campaignSelect.value;
  if (excludeMemberId) params.excludeMemberId = excludeMemberId;

  const data = await fetchNext(cfg, params);
  renderAction(data.action);
}

els.btnPrepare.addEventListener("click", async () => {
  if (!currentAction) return;
  els.btnPrepare.disabled = true;
  showBanner("Abriendo LinkedIn y preparando…", "warn");

  const result = await chrome.runtime.sendMessage({
    type: "OPEN_AND_PREPARE",
    action: currentAction,
    memberId: currentAction.memberId,
  });

  if (!result?.ok) {
    showBanner(
      result?.error || "No pude preparar automáticamente esta acción.",
      "error",
    );
    els.btnPrepare.disabled = false;
    els.btnCopy.disabled = false;
    return;
  }

  prepared = true;
  hideBanner();
  els.btnConfirm.disabled = false;
  els.btnPrepare.disabled = false;
});

els.btnConfirm.addEventListener("click", async () => {
  if (!currentAction || !prepared) return;
  const cfg = await getConfig();
  const actionType = completeActionForKind(currentAction.action);
  await completeAction(cfg, currentAction.memberId, { action: actionType });
  await chrome.storage.sync.set({ sessionCount: cfg.sessionCount + 1 });
  lastSkippedId = null;
  prepared = false;
  await loadNext();
});

els.btnCopy.addEventListener("click", async () => {
  const text = els.message.value;
  if (!text) return;
  await navigator.clipboard.writeText(text);
  showBanner("Mensaje copiado al portapapeles.", "warn");
});

els.btnSkip.addEventListener("click", async () => {
  if (!currentAction) return;
  lastSkippedId = currentAction.memberId;
  const cfg = await getConfig();
  await fetch(`${cfg.apiUrl.replace(/\/$/, "")}/api/linkedin-assistant/actions/${currentAction.memberId}/audit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.token}`,
    },
    body: JSON.stringify({ event: "skipped" }),
  }).catch(() => {});
  await loadNext(lastSkippedId);
});

els.btnNext.addEventListener("click", async () => {
  await loadNext(currentAction?.memberId);
});

els.campaignSelect.addEventListener("change", () => loadNext());
els.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());

async function init() {
  try {
    const cfg = await getConfig();
    if (!cfg.token) {
      els.setup.classList.remove("hidden");
      return;
    }
    await loadCampaigns(cfg);
    await loadNext();
  } catch (err) {
    showBanner(String(err.message || err), "error");
  }
}

init();
