export const MCP_SCOPES = [
  "account:read",
  "notifications:read",
  "notifications:prepare",
  "notifications:send",
  "campaigns:read",
  "campaigns:create",
  "certificates:read",
] as const;

export type McpScope = (typeof MCP_SCOPES)[number];

export const DEFAULT_REQUESTED_SCOPES: McpScope[] = [
  "account:read",
  "notifications:read",
  "notifications:prepare",
  "campaigns:read",
  "certificates:read",
];

export const ALL_MCP_SCOPES: McpScope[] = [...MCP_SCOPES];

const SET = new Set<string>(MCP_SCOPES);

export function isMcpScope(value: string): value is McpScope {
  return SET.has(value);
}

export function parseScopeString(raw: string | null | undefined): McpScope[] {
  if (!raw || !raw.trim()) return [...DEFAULT_REQUESTED_SCOPES];
  const out: McpScope[] = [];
  for (const part of raw.split(/[\s,]+/)) {
    const s = part.trim();
    if (isMcpScope(s) && !out.includes(s)) out.push(s);
  }
  return out.length ? out : [...DEFAULT_REQUESTED_SCOPES];
}

export function hasMcpScope(granted: readonly string[] | undefined, needed: McpScope): boolean {
  if (!Array.isArray(granted) || granted.length === 0) return false;
  if (granted.includes("*")) return true;
  return granted.includes(needed);
}

export function scopeDescriptions(): Record<McpScope, string> {
  return {
    "account:read": "Read the authenticated company name, plan and permissions.",
    "notifications:read": "Read notifications, delivery status and verification data of this account.",
    "notifications:prepare": "Validate and estimate WhatsApp or email notifications without sending.",
    "notifications:send": "Send one certified WhatsApp or email notification. Consumes credits.",
    "campaigns:read": "Read campaign status and metrics of this account.",
    "campaigns:create": "Create campaign drafts. Cannot start or send a campaign.",
    "certificates:read": "Obtain a time-limited URL for a constancia PDF of this account.",
  };
}
