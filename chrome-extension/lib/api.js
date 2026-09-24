/** @typedef {{ apiUrl: string, token: string }} ApiConfig */

/**
 * @param {ApiConfig} cfg
 * @param {string} path
 * @param {RequestInit} [init]
 */
export async function apiFetch(cfg, path, init = {}) {
  const base = cfg.apiUrl.replace(/\/$/, "");
  const headers = {
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };
  if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`;

  const res = await fetch(`${base}${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

/** @param {ApiConfig} cfg @param {Record<string,string|undefined>} [params] */
export async function fetchNext(cfg, params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const q = qs.toString();
  return apiFetch(cfg, `/api/linkedin-assistant/next${q ? `?${q}` : ""}`);
}

/** @param {ApiConfig} cfg */
export async function fetchCampaigns(cfg) {
  return apiFetch(cfg, "/api/linkedin-assistant/campaigns");
}

/** @param {ApiConfig} cfg @param {string} memberId @param {object} body */
export async function completeAction(cfg, memberId, body) {
  return apiFetch(cfg, `/api/linkedin-assistant/actions/${memberId}/complete`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** @param {ApiConfig} cfg @param {string} memberId @param {object} body */
export async function auditEvent(cfg, memberId, body) {
  return apiFetch(cfg, `/api/linkedin-assistant/actions/${memberId}/audit`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
