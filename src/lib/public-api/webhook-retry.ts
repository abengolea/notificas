/** Backoff de reintentos de webhooks salientes (segundos). */
export const WEBHOOK_RETRY_DELAYS_SECONDS = [0, 60, 300, 1800, 7200, 21600, 86400] as const;

export function nextWebhookDelaySeconds(attemptIndex: number): number | null {
  if (attemptIndex < 0 || attemptIndex >= WEBHOOK_RETRY_DELAYS_SECONDS.length) return null;
  return WEBHOOK_RETRY_DELAYS_SECONDS[attemptIndex];
}

export function shouldRetryWebhookStatus(status: number | null, networkError: boolean): boolean {
  if (networkError) return true;
  if (status == null) return true;
  if (status >= 500) return true;
  if (status === 408 || status === 429) return true;
  return false;
}
