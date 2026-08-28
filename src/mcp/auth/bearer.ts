export function bearerFromAuthorization(header: string | null): string | null {
  if (!header) return null;
  const m = header.match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : null;
}

export function isExpiredToken(expiresAtMs: number, now = Date.now()): boolean {
  return !Number.isFinite(expiresAtMs) || expiresAtMs <= now;
}

export function isApiKeyOnMcp(token: string): boolean {
  return token.startsWith("ntf_live_") || token.startsWith("ntf_test_");
}
