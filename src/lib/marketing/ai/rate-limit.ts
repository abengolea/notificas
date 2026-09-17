const windows = new Map<string, number[]>();

export function consumeAiRateLimit(userId: string, limitPerMinute: number, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  const windowStart = now - 60_000;
  const prev = (windows.get(userId) || []).filter((t) => t > windowStart);
  if (prev.length >= limitPerMinute) {
    const retryAfterSec = Math.max(1, Math.ceil((prev[0] + 60_000 - now) / 1000));
    windows.set(userId, prev);
    return { ok: false, retryAfterSec };
  }
  prev.push(now);
  windows.set(userId, prev);
  return { ok: true, retryAfterSec: 0 };
}
