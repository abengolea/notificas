import { extensionEnv } from "./config.js";
import { apiLog } from "./log.js";
import {
  SessionExpiredError,
  getRuntimeConfig,
  getValidAccessToken,
  refreshSession,
} from "./session.js";

function friendlyError(data, status) {
  if (data?.error === "session_expired" || data?.error === "No autorizado" || status === 401) {
    return new SessionExpiredError(data?.message || "Tu sesión venció. Volvé a iniciar sesión.");
  }
  return new Error(data?.message || data?.error || "No se pudo completar la solicitud.");
}

function requestPath(path) {
  return path.replace(/^\/api/, "") || path;
}

/**
 * @param {string} path
 * @param {RequestInit} [init]
 * @param {{ retried?: boolean }} [opts]
 */
export async function apiFetch(path, init = {}, opts = {}) {
  const cfg = await getRuntimeConfig();
  const token = await getValidAccessToken();
  const headers = {
    "Content-Type": "application/json",
    ...(init.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  const method = (init.method || "GET").toUpperCase();
  apiLog({ env: cfg.env, method, path: requestPath(path) });

  const res = await fetch(`${cfg.apiUrl}${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  apiLog({ env: cfg.env, method, path: requestPath(path), status: res.status });

  if (res.status === 401 && !opts.retried) {
    await refreshSession();
    return apiFetch(path, init, { retried: true });
  }
  if (!res.ok) throw friendlyError(data, res.status);
  return data;
}

export async function fetchSession() {
  return apiFetch("/api/linkedin-assistant/auth/session");
}

export async function fetchNext(params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const q = qs.toString();
  return apiFetch(`/api/linkedin-assistant/next${q ? `?${q}` : ""}`);
}

export async function fetchCampaigns() {
  return apiFetch("/api/linkedin-assistant/campaigns");
}

export async function fetchCampaignMembers(campaignId) {
  return apiFetch(`/api/linkedin-assistant/campaigns/${encodeURIComponent(campaignId)}/members`);
}

export async function fetchAction(memberId) {
  return apiFetch(`/api/linkedin-assistant/actions/${encodeURIComponent(memberId)}`);
}

export async function lookupContactByLinkedInUrl(linkedinUrl) {
  const qs = new URLSearchParams({ linkedinUrl });
  return apiFetch(`/api/linkedin-assistant/contacts?${qs}`);
}

export async function searchContacts(query) {
  const qs = new URLSearchParams({ q: query });
  return apiFetch(`/api/linkedin-assistant/contacts?${qs}`);
}

export async function getContact(contactId) {
  return apiFetch(`/api/linkedin-assistant/contacts/${encodeURIComponent(contactId)}`);
}

export async function updateContact(contactId, body) {
  return apiFetch(`/api/linkedin-assistant/contacts/${encodeURIComponent(contactId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function completeAction(memberId, body) {
  return apiFetch(`/api/linkedin-assistant/actions/${encodeURIComponent(memberId)}/complete`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function auditEvent(memberId, body) {
  return apiFetch(`/api/linkedin-assistant/actions/${encodeURIComponent(memberId)}/audit`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export { SessionExpiredError };
