import {
  SessionExpiredError,
  auditEvent,
  completeAction,
  fetchCampaigns,
  fetchNext,
  lookupContactByLinkedInUrl,
} from "./lib/api.js";
import { extensionLog } from "./lib/log.js";
import { getRuntimeConfig, login, logout } from "./lib/session.js";

const els = {
  campaignSelect: document.getElementById("campaign-select"),
  campaignWrap: document.getElementById("campaign-wrap"),
  prospect: document.getElementById("prospect"),
  empty: document.getElementById("empty"),
  login: document.getElementById("login"),
  expired: document.getElementById("expired"),
  sessionCard: document.getElementById("session-card"),
  sessionEmail: document.getElementById("session-email"),
  sessionEnv: document.getElementById("session-env"),
  detected: document.getElementById("detected"),
  detectedUrl: document.getElementById("detected-url"),
  detectedContact: document.getElementById("detected-contact"),
  statusBanner: document.getElementById("status-banner"),
  name: document.getElementById("prospect-name"),
  company: document.getElementById("prospect-company"),
  title: document.getElementById("prospect-title"),
  status: document.getElementById("prospect-status"),
  message: document.getElementById("message"),
  actions: document.getElementById("actions"),
  btnPrepare: document.getElementById("btn-prepare"),
  btnConfirm: document.getElementById("btn-confirm"),
  btnCopy: document.getElementById("btn-copy"),
  btnSkip: document.getElementById("btn-skip"),
  btnNext: document.getElementById("btn-next"),
  btnLogin: document.getElementById("btn-login"),
  btnLogout: document.getElementById("btn-logout"),
  btnRelogin: document.getElementById("btn-relogin"),
  btnConnected: document.getElementById("btn-connected"),
  btnReplied: document.getElementById("btn-replied"),
  btnInterested: document.getElementById("btn-interested"),
  btnNotInterested: document.getElementById("btn-not-interested"),
  loginEmail: document.getElementById("login-email"),
  loginPassword: document.getElementById("login-password"),
};

/** @type {object|null} */
let currentAction = null;
let prepared = false;
let lastSkippedId = null;

function showBanner(text, kind = "warn") {
  els.statusBanner.textContent = text;
  els.statusBanner.className = `banner ${kind}`;
  els.statusBanner.classList.remove("hidden");
}

function hideBanner() {
  els.statusBanner.classList.add("hidden");
}

function show(el, visible) {
  el.classList.toggle("hidden", !visible);
}

function completeActionForKind(kind) {
  if (kind === "connection") return "connection_sent";
  if (kind === "message") return "message_sent";
  return "followup_sent";
}

function renderSession(cfg) {
  els.sessionEmail.textContent = cfg.sessionEmail || "—";
  els.sessionEnv.textContent = cfg.environmentLabel;
  show(els.sessionCard, cfg.hasSession);
}

function renderLoggedOut(expired) {
  currentAction = null;
  show(els.sessionCard, false);
  show(els.login, !expired);
  show(els.expired, expired);
  show(els.campaignWrap, false);
  show(els.prospect, false);
  show(els.empty, false);
  show(els.detected, false);
  show(els.actions, false);
}

function renderAction(action) {
  currentAction = action;
  prepared = false;
  hideBanner();
  show(els.actions, true);

  if (!action) {
    show(els.prospect, false);
    show(els.empty, true);
    disableActionButtons(true);
    return;
  }

  show(els.empty, false);
  show(els.prospect, true);
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
  els.btnConnected.disabled = disabled;
  els.btnReplied.disabled = disabled;
  els.btnInterested.disabled = disabled;
  els.btnNotInterested.disabled = disabled;
}

async function handleAuthError(err) {
  if (err instanceof SessionExpiredError) {
    renderLoggedOut(true);
    return true;
  }
  showBanner(err.message || "No se pudo completar la solicitud.", "error");
  return false;
}

async function loadCampaigns() {
  const data = await fetchCampaigns();
  els.campaignSelect.innerHTML = '<option value="">Todas las campañas</option>';
  for (const c of data.campaigns || []) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.pending} pendientes)`;
    els.campaignSelect.appendChild(opt);
  }
}

async function loadNext(excludeMemberId) {
  const cfg = await getRuntimeConfig();
  if (!cfg.hasSession) {
    renderLoggedOut(false);
    return;
  }
  show(els.login, false);
  show(els.expired, false);
  show(els.campaignWrap, true);
  renderSession(cfg);

  if (cfg.sessionCount >= cfg.maxPerSession) {
    showBanner(`Límite de sesión alcanzado (${cfg.maxPerSession}).`, "warn");
    return;
  }

  const params = {};
  if (els.campaignSelect.value) params.campaignId = els.campaignSelect.value;
  if (excludeMemberId) params.excludeMemberId = excludeMemberId;

  const data = await fetchNext(params);
  renderAction(data.action);
}

async function loadDetectedProfile() {
  try {
    const detected = await chrome.runtime.sendMessage({ type: "GET_DETECTED_PROFILE" });
    const url = detected?.linkedinUrl || "";
    if (!url) {
      show(els.detected, false);
      return;
    }
    show(els.detected, true);
    els.detectedUrl.textContent = url;
    els.detectedContact.textContent = "Consultando CRM…";
    const result = await lookupContactByLinkedInUrl(url);
    if (!result.contact) {
      els.detectedContact.textContent = "Este perfil no está en el CRM.";
      return;
    }
    const membership = result.memberships?.[0];
    els.detectedContact.textContent = membership
      ? `${result.contact.name || "Contacto"} · ${membership.campaignName} · ${membership.statusLabel}`
      : `${result.contact.name || "Contacto"} · en CRM, sin campaña activa`;
  } catch (err) {
    if (err instanceof SessionExpiredError) throw err;
    els.detectedContact.textContent = "No pude consultar el CRM para este perfil.";
  }
}

async function recordOutcome(actionType) {
  if (!currentAction) return;
  await completeAction(currentAction.memberId, { action: actionType });
  const cfg = await getRuntimeConfig();
  await chrome.storage.sync.set({ sessionCount: cfg.sessionCount + 1 });
  lastSkippedId = null;
  prepared = false;
  await loadNext();
}

els.btnLogin.addEventListener("click", async () => {
  try {
    hideBanner();
    els.btnLogin.disabled = true;
    await login(els.loginEmail.value, els.loginPassword.value);
    els.loginPassword.value = "";
    await boot();
  } catch (err) {
    showBanner(err.message || "No se pudo iniciar sesión.", "error");
  } finally {
    els.btnLogin.disabled = false;
  }
});

els.btnLogout.addEventListener("click", async () => {
  await logout();
  renderLoggedOut(false);
});

els.btnRelogin.addEventListener("click", () => {
  renderLoggedOut(false);
});

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
    showBanner(result?.error || "No pude preparar automáticamente esta acción.", "error");
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
  try {
    await recordOutcome(completeActionForKind(currentAction.action));
  } catch (err) {
    await handleAuthError(err);
  }
});

els.btnConnected.addEventListener("click", () => recordOutcome("connected").catch(handleAuthError));
els.btnReplied.addEventListener("click", () => recordOutcome("replied").catch(handleAuthError));
els.btnInterested.addEventListener("click", () => recordOutcome("interested").catch(handleAuthError));
els.btnNotInterested.addEventListener("click", () => recordOutcome("not_interested").catch(handleAuthError));

els.btnCopy.addEventListener("click", async () => {
  const text = els.message.value;
  if (!text) return;
  await navigator.clipboard.writeText(text);
  showBanner("Mensaje copiado al portapapeles.", "warn");
});

els.btnSkip.addEventListener("click", async () => {
  if (!currentAction) return;
  lastSkippedId = currentAction.memberId;
  try {
    await auditEvent(currentAction.memberId, { event: "skipped" });
    await loadNext(lastSkippedId);
  } catch (err) {
    await handleAuthError(err);
  }
});

els.btnNext.addEventListener("click", async () => {
  try {
    await loadNext(currentAction?.memberId);
  } catch (err) {
    await handleAuthError(err);
  }
});

els.campaignSelect.addEventListener("change", () => {
  loadNext().catch(handleAuthError);
});

async function boot() {
  try {
    const cfg = await getRuntimeConfig();
    extensionLog(`API: ${cfg.env}`);
    if (!cfg.hasSession) {
      renderLoggedOut(false);
      return;
    }
    renderSession(cfg);
    show(els.login, false);
    show(els.expired, false);
    show(els.campaignWrap, true);
    show(els.actions, true);
    await loadCampaigns();
    await loadNext();
    await loadDetectedProfile();
  } catch (err) {
    if (!(await handleAuthError(err))) {
      showBanner(err.message || "No se pudo conectar con Notificas.", "error");
    }
  }
}

boot();
