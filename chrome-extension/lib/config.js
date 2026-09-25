import { EXTENSION_ENV } from "./env.js";

export const PRODUCTION_API_URL = "https://notificas.com.ar";
export const DEVELOPMENT_API_URL = "http://localhost:9006";
export const ADMIN_CONNECT_PATH = "/admin/linkedin-assistant/connect";
export const ADMIN_CONNECT_DONE_PATH = "/admin/linkedin-assistant/connect/done";

export function extensionEnv() {
  return EXTENSION_ENV === "development" ? "development" : "production";
}

export function isProductionEnv() {
  return extensionEnv() === "production";
}

export function defaultApiUrl() {
  return isProductionEnv() ? PRODUCTION_API_URL : DEVELOPMENT_API_URL;
}

export function environmentLabel() {
  return isProductionEnv() ? "Producción" : "Desarrollo";
}

export function resolveApiUrl(storedApiUrl) {
  if (isProductionEnv()) return PRODUCTION_API_URL;
  const override = typeof storedApiUrl === "string" ? storedApiUrl.trim().replace(/\/$/, "") : "";
  if (override) return override;
  return DEVELOPMENT_API_URL;
}
