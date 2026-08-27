export const PUBLIC_API_SCOPES = [
  "notifications:read",
  "notifications:write",
  "batches:read",
  "batches:write",
  "webhooks:read",
  "webhooks:write",
] as const;

export type PublicApiScope = (typeof PUBLIC_API_SCOPES)[number];

export const DEFAULT_LIVE_SCOPES: PublicApiScope[] = [
  "notifications:read",
  "notifications:write",
  "batches:read",
  "batches:write",
  "webhooks:read",
  "webhooks:write",
];

export function hasScope(granted: string[] | undefined, needed: PublicApiScope): boolean {
  if (!Array.isArray(granted) || granted.length === 0) return true;
  if (granted.includes("*")) return true;
  return granted.includes(needed);
}
