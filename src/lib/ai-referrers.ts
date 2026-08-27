export const AI_REFERRER_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "claude.ai",
  "perplexity.ai",
  "copilot.microsoft.com",
] as const;

export function matchAiReferrerHost(hostname: string): string | null {
  const host = hostname.replace(/^www\./, "").toLowerCase();
  return AI_REFERRER_HOSTS.find((item) => host === item || host.endsWith(`.${item}`)) ?? null;
}

export function utmParamsFromSearch(search: string): Record<string, string> {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const utm: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const value = params.get(key)?.trim();
    if (value) utm[key] = value.slice(0, 100);
  }
  return utm;
}
