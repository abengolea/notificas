import {
  SessionExpiredError,
  auditEvent,
  completeAction,
  fetchAction,
  fetchActions,
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
  detectedDetail: document.getElementById("detected-detail"),
  detectedName: document.getElementById("detected-name"),
  detectedCompany: document.getElementById("detected-company"),
  detectedCampaign: document.getElementById("detected-campaign"),
  detectedCampaignStatus: document.getElementById("detected-campaign-status"),
  detectedMemberStatus: document.getElementById("detected-member-status"),
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
  btnConnectAdmin: document.getElementById("btn-connect-admin"),
  btnLogout: document.getElementById("btn-logout"),
  btnRelogin: document.getElementById("btn-relogin"),
  btnConnected: document.getElementById("btn-connected"),
  btnReplied: document.getElementById("btn-replied"),
  btnInterested: document.getElementById("btn-interested"),
  btnNotInterested: document.getElementById("btn-not-interested"),
  loginEmail: document.getElementById("login-email"),
  loginPassword: document.getElementById("login-password"),
  btnUseDetected: document.getElementById("btn-use-detected"),
  btnResetQueue: document.getElementById("btn-reset-queue"),
  emptyText: document.getElementById("empty-text"),
  batchCard: document.getElementById("batch-card"),
  batchStatus: document.getElementById("batch-status"),
  batchProgress: document.getElementById("batch-progress"),
  batchCurrent: document.getElementById("batch-current"),
  btnBatchStart: document.getElementById("btn-batch-start"),
  btnBatchMore: document.getElementById("btn-batch-more"),
  btnBatchStop: document.getElementById("btn-batch-stop"),
  btnScanSent: document.getElementById("btn-scan-sent"),
};

const QUEUE_KEY = "assistantQueue";

/** @type {object|null} */
let currentAction = null;
let prepared = false;
/** @type {string|null} */
let detectedMemberId = null;

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
  if (els.batchCard) show(els.batchCard, false);
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
    els.btnNext.disabled = false;
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
    const draft = c.status === "draft" ? " · Borrador" : "";
    opt.textContent = `${c.name}${draft} (${c.pending} pendientes)`;
    els.campaignSelect.appendChild(opt);
  }
}

async function readQueue() {
  const data = await chrome.storage.local.get(QUEUE_KEY);
  const raw = data[QUEUE_KEY] || {};
  return {
    campaignId: typeof raw.campaignId === "string" ? raw.campaignId : "",
    seenMemberIds: Array.isArray(raw.seenMemberIds) ? raw.seenMemberIds.filter(Boolean) : [],
  };
}

async function writeQueue(queue) {
  await chrome.storage.local.set({ [QUEUE_KEY]: queue });
}

async function rememberSeen(memberId) {
  if (!memberId) return;
  const queue = await readQueue();
  queue.campaignId = els.campaignSelect.value;
  if (!queue.seenMemberIds.includes(memberId)) queue.seenMemberIds.push(memberId);
  await writeQueue(queue);
}

async function resetQueue() {
  await writeQueue({ campaignId: els.campaignSelect.value, seenMemberIds: [] });
}

async function loadNext(options = {}) {
  const cfg = await getRuntimeConfig();
  if (!cfg.hasSession) {
    renderLoggedOut(false);
    return;
  }
  show(els.login, false);
  show(els.expired, false);
  show(els.campaignWrap, true);
  if (els.batchCard) show(els.batchCard, true);
  renderSession(cfg);
  renderBatchCard();

  if (options.advance && currentAction?.memberId) {
    await rememberSeen(currentAction.memberId);
  }

  const queue = await readQueue();
  const campaignId = els.campaignSelect.value;
  if (queue.campaignId !== campaignId) {
    queue.campaignId = campaignId;
    queue.seenMemberIds = [];
    await writeQueue(queue);
  }

  const seen = new Set(queue.seenMemberIds);
  const params = { limit: 200 };
  if (campaignId) params.campaignId = campaignId;

  let actions = [];
  try {
    const data = await fetchActions(params);
    actions = data.actions || [];
  } catch {
    const data = await fetchNext({
      campaignId: campaignId || undefined,
      excludeMemberIds: [...seen],
    });
    actions = data.action ? [data.action] : [];
  }

  const next = actions.find((action) => action?.memberId && !seen.has(action.memberId)) || null;
  renderAction(next);

  if (!next) {
    const exhausted = seen.size > 0 && actions.length > 0;
    if (els.emptyText) {
      els.emptyText.textContent = exhausted
        ? "Ya recorriste la cola de esta campaña."
        : "No hay acciones pendientes para esta campaña.";
    }
    showBanner(
      exhausted
        ? "No hay más prospectos. Tocá Volver al primero para empezar de nuevo."
        : "No hay acciones pendientes para esta campaña.",
      "warn",
    );
  } else if (cfg.sessionCount >= cfg.maxPerSession) {
    showBanner(`Límite de sesión alcanzado (${cfg.maxPerSession}). Podés seguir pasando prospectos.`, "warn");
  }
}

async function renderBatchCard() {
  if (!els.batchCard) return;
  try {
    const result = await chrome.runtime.sendMessage({ type: "GET_BATCH" });
    const batch = result?.batch;
    if (!batch) return;
    const sent = batch.sentDetected || batch.items.filter((item) => item.sentAt).length;
    els.batchProgress.textContent = `${batch.lotePrepared || 0} / ${batch.target || 20} listos · ${sent} detectados enviados`;
    const running = batch.status === "running";
    const paused = batch.status === "paused";
    els.batchStatus.textContent = running
      ? "Abriendo perfiles. Copiá el mensaje en el CRM y pegalo vos."
      : paused
        ? batch.error || "Lote en pausa. Los perfiles ya están abiertos."
        : "Abre hasta 20 perfiles. El mensaje se copia en el CRM, no lo escribe LinkedIn.";
    if (els.batchCurrent) {
      els.batchCurrent.textContent = batch.currentName || "";
      show(els.batchCurrent, Boolean(batch.currentName));
    }
    show(els.btnBatchStart, !running && !paused);
    show(els.btnBatchMore, paused && !running);
    show(els.btnBatchStop, running);
    els.btnBatchStart.disabled = running;
    els.btnBatchMore.disabled = running;
    els.btnScanSent.disabled = running;
  } catch {
    /* el lote es informativo */
  }
}

function campaignLine(membership) {
  if (!membership) return "En CRM · sin campaña LinkedIn";
  if (membership.campaignStatus === "draft") return "En CRM · campaña en borrador";
  return "En CRM · campaña activa";
}

async function loadDetectedProfile() {
  detectedMemberId = null;
  if (els.btnUseDetected) show(els.btnUseDetected, false);
  try {
    const detected = await chrome.runtime.sendMessage({ type: "GET_DETECTED_PROFILE" });
    const url = detected?.linkedinUrl || "";
    if (!url) {
      show(els.detected, false);
      return;
    }
    show(els.detected, true);
    show(els.detectedDetail, false);
    els.detectedUrl.textContent = url;
    els.detectedContact.textContent = "Consultando CRM…";
    const result = await lookupContactByLinkedInUrl(url);
    if (!result.contact) {
      els.detectedContact.textContent = "Perfil no encontrado en CRM";
      return;
    }
    const membership = result.memberships?.[0];
    els.detectedContact.textContent = campaignLine(membership);
    show(els.detectedDetail, true);
    els.detectedName.textContent = result.contact.name || "Contacto";
    els.detectedCompany.textContent = result.contact.companyName || "—";
    els.detectedCampaign.textContent = membership?.campaignName || "—";
    els.detectedCampaignStatus.textContent = membership
      ? (membership.campaignStatusLabel || membership.campaignStatus || "—").toUpperCase()
      : "—";
    els.detectedMemberStatus.textContent = membership?.statusLabel || result.contact.linkedinStatus || "—";
    detectedMemberId = membership?.memberId || null;
    if (els.btnUseDetected) show(els.btnUseDetected, Boolean(detectedMemberId));
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
  prepared = false;
  await loadNext({ advance: true });
}

els.btnConnectAdmin.addEventListener("click", async () => {
  try {
    hideBanner();
    els.btnConnectAdmin.disabled = true;
    showBanner("Abriendo el admin de Notificas…", "warn");
    const result = await chrome.runtime.sendMessage({ type: "START_ADMIN_CONNECT" });
    if (!result?.ok) {
      showBanner(result?.error || "No pude abrir el admin.", "error");
    }
  } catch (err) {
    showBanner(err.message || "No pude abrir el admin.", "error");
  } finally {
    els.btnConnectAdmin.disabled = false;
  }
});

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
    action: { ...currentAction, message: els.message.value },
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
  els.btnSkip.disabled = true;
  els.btnNext.disabled = true;
  try {
    await auditEvent(currentAction.memberId, { event: "skipped" });
    showBanner("Pasando al siguiente…", "warn");
    await loadNext({ advance: true });
  } catch (err) {
    await handleAuthError(err);
  } finally {
    els.btnNext.disabled = false;
  }
});

els.btnNext.addEventListener("click", async () => {
  els.btnNext.disabled = true;
  showBanner("Cargando el siguiente prospecto…", "warn");
  try {
    await loadNext({ advance: true });
  } catch (err) {
    await handleAuthError(err);
  } finally {
    els.btnNext.disabled = false;
  }
});

els.campaignSelect.addEventListener("change", () => {
  resetQueue()
    .then(() => loadNext())
    .catch(handleAuthError);
});

els.btnResetQueue?.addEventListener("click", async () => {
  try {
    await resetQueue();
    hideBanner();
    await loadNext();
  } catch (err) {
    await handleAuthError(err);
  }
});

els.btnBatchStart?.addEventListener("click", async () => {
  showBanner("Abriendo 20 perfiles. Después copiá el mensaje en el CRM y pegalo.", "warn");
  const result = await chrome.runtime.sendMessage({
    type: "START_BATCH",
    campaignId: els.campaignSelect.value || "",
  });
  if (!result?.ok) {
    showBanner(result?.error || "No pude iniciar el lote.", "error");
  }
  await renderBatchCard();
});

els.btnBatchMore?.addEventListener("click", async () => {
  showBanner("Activando otros 20…", "warn");
  const result = await chrome.runtime.sendMessage({
    type: "START_BATCH",
    campaignId: els.campaignSelect.value || "",
  });
  if (!result?.ok) {
    showBanner(result?.error || "No pude activar el lote.", "error");
  }
  await renderBatchCard();
});

els.btnBatchStop?.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "STOP_BATCH" });
  showBanner("Lote pausado.", "warn");
  await renderBatchCard();
});

els.btnScanSent?.addEventListener("click", async () => {
  els.btnScanSent.disabled = true;
  showBanner("Revisando en LinkedIn si esos mensajes ya se enviaron…", "warn");
  try {
    const result = await chrome.runtime.sendMessage({ type: "SCAN_SENT" });
    showBanner(result?.message || "Revisión terminada.", result?.marked ? "warn" : "warn");
    await renderBatchCard();
  } catch (err) {
    await handleAuthError(err);
  } finally {
    els.btnScanSent.disabled = false;
  }
});

els.btnUseDetected?.addEventListener("click", async () => {
  if (!detectedMemberId) return;
  try {
    const actionData = await fetchAction(detectedMemberId);
    if (!actionData.action) {
      showBanner("Este contacto no tiene una acción pendiente.", "warn");
      return;
    }
    const queue = await readQueue();
    queue.seenMemberIds = queue.seenMemberIds.filter((id) => id !== detectedMemberId);
    await writeQueue(queue);
    renderAction(actionData.action);
  } catch (err) {
    await handleAuthError(err);
  }
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
    const queue = await readQueue();
    if (queue.campaignId && [...els.campaignSelect.options].some((opt) => opt.value === queue.campaignId)) {
      els.campaignSelect.value = queue.campaignId;
    }
    await loadNext();
    await loadDetectedProfile();
    await renderBatchCard();
  } catch (err) {
    if (!(await handleAuthError(err))) {
      showBanner(err.message || "No se pudo conectar con Notificas.", "error");
    }
  }
}

chrome.storage.local.onChanged.addListener((changes) => {
  if (changes.accessToken?.newValue) {
    hideBanner();
    boot();
  }
  if (changes.assistantBatch) {
    renderBatchCard();
  }
});

boot();
