import { defaultApiUrl, environmentLabel, extensionEnv, resolveApiUrl } from "./config.js";
import { apiLog, extensionLog } from "./log.js";

const LOCAL_KEYS = [
  "accessToken",
  "refreshToken",
  "accessExpiresAt",
  "sessionEmail",
  "workspaceId",
];

const SESSION_EXPIRED_MESSAGE = "Tu sesión venció. Volvé a iniciar sesión.";

export class SessionExpiredError extends Error {
  constructor(message = SESSION_EXPIRED_MESSAGE) {
    super(message);
    this.name = "SessionExpiredError";
    this.code = "session_expired";
  }
}

export async function getPreferences() {
  const stored = await chrome.storage.sync.get(["apiUrl", "maxPerSession", "sessionCount", "locale"]);
  return {
    apiUrl: resolveApiUrl(stored.apiUrl),
    maxPerSession: Number(stored.maxPerSession || 50),
    sessionCount: Number(stored.sessionCount || 0),
    locale: stored.locale || "auto",
  };
}

export async function getStoredSession() {
  const stored = await chrome.storage.local.get(LOCAL_KEYS);
  return {
    accessToken: stored.accessToken || "",
    refreshToken: stored.refreshToken || "",
    accessExpiresAt: Number(stored.accessExpiresAt || 0),
    sessionEmail: stored.sessionEmail || "",
    workspaceId: stored.workspaceId || "",
  };
}

export async function saveSession(session) {
  const expiresIn = Number(session.expiresIn || 1800);
  await chrome.storage.local.set({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    accessExpiresAt: Date.now() + expiresIn * 1000,
    sessionEmail: session.user?.email || "",
    workspaceId: session.workspaceId || "",
  });
}

export async function clearSession() {
  await chrome.storage.local.remove(LOCAL_KEYS);
}

export async function getRuntimeConfig() {
  const prefs = await getPreferences();
  const session = await getStoredSession();
  return {
    ...prefs,
    ...session,
    env: extensionEnv(),
    environmentLabel: environmentLabel(),
    hasSession: Boolean(session.refreshToken || session.accessToken),
  };
}

function authPath(path) {
  return path.replace(/^\/api/, "") || path;
}

async function postAuth(apiUrl, path, body) {
  const url = `${apiUrl.replace(/\/$/, "")}${path}`;
  apiLog({ env: extensionEnv(), method: "POST", path: authPath(path) });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  apiLog({ env: extensionEnv(), method: "POST", path: authPath(path), status: res.status });
  return { res, data };
}

export function adminConnectUrl(apiUrl) {
  return `${(apiUrl || defaultApiUrl()).replace(/\/$/, "")}/admin/linkedin-assistant/connect`;
}

export function connectCodeFromUrl(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.includes("/admin/linkedin-assistant/connect/done")) return "";
    return parsed.searchParams.get("code")?.trim() || "";
  } catch {
    return "";
  }
}

export async function claimConnectCode(code) {
  const prefs = await getPreferences();
  const apiUrl = prefs.apiUrl || defaultApiUrl();
  const { res, data } = await postAuth(apiUrl, "/api/linkedin-assistant/auth/claim", { code });
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("El admin todavía no tiene el conector de la extensión. Hay que desplegar la API de producción.");
    }
    throw new Error(data.message || "No se pudo tomar la sesión del admin.");
  }
  await saveSession(data);
  extensionLog("auth connect: success");
  return data;
}

export async function login(email, password) {
  const prefs = await getPreferences();
  const apiUrl = prefs.apiUrl || defaultApiUrl();
  const { res, data } = await postAuth(apiUrl, "/api/linkedin-assistant/auth/login", { email, password });
  if (!res.ok) {
    throw new Error(data.message || "Email o contraseña incorrectos.");
  }
  await saveSession(data);
  extensionLog("auth login: success");
  return data;
}

export async function logout() {
  const cfg = await getRuntimeConfig();
  try {
    if (cfg.apiUrl) {
      await postAuth(cfg.apiUrl, "/api/linkedin-assistant/auth/logout", {});
    }
  } catch {
    // El cierre local siempre gana.
  }
  await clearSession();
  extensionLog("auth logout: success");
}

export async function refreshSession() {
  const cfg = await getRuntimeConfig();
  if (!cfg.refreshToken) {
    await clearSession();
    throw new SessionExpiredError();
  }
  try {
    const { res, data } = await postAuth(cfg.apiUrl, "/api/linkedin-assistant/auth/refresh", {
      refreshToken: cfg.refreshToken,
    });
    if (!res.ok) {
      await clearSession();
      extensionLog("auth refresh: failed");
      throw new SessionExpiredError(data.message || SESSION_EXPIRED_MESSAGE);
    }
    await saveSession(data);
    extensionLog("auth refresh: success");
    return data;
  } catch (err) {
    if (err instanceof SessionExpiredError) throw err;
    await clearSession();
    extensionLog("auth refresh: failed");
    throw new SessionExpiredError();
  }
}

export async function getValidAccessToken() {
  const session = await getStoredSession();
  if (session.accessToken && session.accessExpiresAt - Date.now() > 15_000) {
    return session.accessToken;
  }
  if (!session.refreshToken) {
    await clearSession();
    throw new SessionExpiredError();
  }
  const refreshed = await refreshSession();
  return refreshed.accessToken;
}
