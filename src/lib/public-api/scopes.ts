export const PUBLIC_API_SCOPES = [
  "notifications:read",
  "notifications:write",
  "batches:read",
  "batches:write",
  "webhooks:read",
  "webhooks:write",
  "art:read",
  "art:write",
] as const;

export type PublicApiScope = (typeof PUBLIC_API_SCOPES)[number];

export const DEFAULT_LIVE_SCOPES: PublicApiScope[] = [
  "notifications:read",
  "notifications:write",
  "batches:read",
  "batches:write",
  "webhooks:read",
  "webhooks:write",
  "art:read",
  "art:write",
];

export function hasScope(granted: string[] | undefined, needed: PublicApiScope): boolean {
  if (!Array.isArray(granted) || granted.length === 0) return true;
  if (granted.includes("*")) return true;
  if (granted.includes(needed)) return true;
  if (needed === "art:read" && (granted.includes("notifications:read") || granted.includes("art:write"))) return true;
  if (needed === "art:write" && granted.includes("notifications:write")) return true;
  return false;
}
