const TRUE = new Set(["1", "true", "yes", "on"]);

function envFlag(name: string): boolean {
  return TRUE.has((process.env[name] || "").trim().toLowerCase());
}

function envCsv(name: string): string[] {
  return (process.env[name] || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const MCP_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;
export const MCP_PROTOCOL_VERSION = "2025-06-18";
export const MCP_SERVER_NAME = "notificas-mcp";
export const MCP_SERVER_VERSION = "1.0.0";

export function mcpEnabled(): boolean {
  return envFlag("MCP_ENABLED");
}

export function mcpAllowAllUsers(): boolean {
  return envFlag("MCP_ALLOW_ALL");
}

export function mcpAllowedUsers(): string[] {
  return envCsv("MCP_ALLOWED_USERS");
}

export function isMcpUserAllowlisted(uid: string, email?: string | null): boolean {
  if (mcpAllowAllUsers()) return true;
  const allow = mcpAllowedUsers();
  if (allow.length === 0) return false;
  const uidNorm = uid.trim().toLowerCase();
  const emailNorm = (email || "").trim().toLowerCase();
  return allow.includes(uidNorm) || (emailNorm.length > 0 && allow.includes(emailNorm));
}

export function mcpBaseUrl(): string {
  const raw = (
    process.env.MCP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://notificas.com.ar"
  )
    .trim()
    .replace(/\/$/, "");
  return raw || "https://notificas.com.ar";
}

export function mcpResourceUrl(): string {
  return `${mcpBaseUrl()}/mcp`;
}

export function mcpIssuer(): string {
  return mcpBaseUrl();
}

export function mcpAppUrl(): string {
  return mcpBaseUrl();
}

export function oauthAccessTokenTtlSeconds(): number {
  const n = Number(process.env.MCP_OAUTH_ACCESS_TTL_SECONDS);
  if (Number.isFinite(n) && n >= 60 && n <= 86_400) return Math.floor(n);
  return 3600;
}

export function oauthRefreshTokenTtlSeconds(): number {
  const n = Number(process.env.MCP_OAUTH_REFRESH_TTL_SECONDS);
  if (Number.isFinite(n) && n >= 3600 && n <= 90 * 24 * 3600) return Math.floor(n);
  return 30 * 24 * 3600;
}

export function oauthAuthCodeTtlSeconds(): number {
  return 600;
}

export const MAX_MCP_DRAFT_INLINE_RECIPIENTS = 200;
export const MAX_MCP_JSON_BYTES = 64 * 1024;
