import { fetchCampaigns, fetchSession } from "./lib/api.js";
import { defaultApiUrl, environmentLabel, isProductionEnv } from "./lib/config.js";
import { SessionExpiredError, getRuntimeConfig } from "./lib/session.js";

async function load() {
  const cfg = await getRuntimeConfig();
  document.getElementById("session-email").textContent = cfg.sessionEmail || "Sin sesión";
  document.getElementById("session-env").textContent = environmentLabel();
  document.getElementById("api-display").textContent = cfg.apiUrl;
  document.getElementById("maxPerSession").value = String(cfg.maxPerSession);
  document.getElementById("locale").value = cfg.locale;

  const overrideWrap = document.getElementById("api-override-wrap");
  if (!isProductionEnv()) {
    overrideWrap.classList.remove("hidden");
    document.getElementById("apiUrl").value = cfg.apiUrl || defaultApiUrl();
  }
}

document.getElementById("save").addEventListener("click", async () => {
  const payload = {
    maxPerSession: document.getElementById("maxPerSession").value,
    locale: document.getElementById("locale").value,
  };
  if (!isProductionEnv()) {
    payload.apiUrl = document.getElementById("apiUrl").value.trim().replace(/\/$/, "");
  }
  await chrome.storage.sync.set(payload);
  const saved = document.getElementById("saved");
  saved.classList.remove("hidden");
  setTimeout(() => saved.classList.add("hidden"), 2000);
  await load();
});

document.getElementById("reset-session").addEventListener("click", async () => {
  await chrome.storage.sync.set({ sessionCount: 0 });
});

document.getElementById("test").addEventListener("click", async () => {
  const result = document.getElementById("test-result");
  result.classList.remove("hidden");
  try {
    const session = await fetchSession();
    const campaigns = await fetchCampaigns();
    result.textContent = `Conexión OK · ${session.user?.email || "sesión"} · ${(campaigns.campaigns || []).length} campañas · ${environmentLabel()}`;
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      result.textContent = "Tu sesión venció. Volvé a iniciar sesión desde el popup.";
      return;
    }
    result.textContent = err.message || "No se pudo conectar.";
  }
});

load();
