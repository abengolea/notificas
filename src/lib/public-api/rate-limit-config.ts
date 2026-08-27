export const RATE_LIMIT_WINDOWS_SECONDS = 60;

export type RateBucket = "general" | "notifications" | "batches";

export type RateLimitConfig = Record<RateBucket, number>;

const DEFAULTS: RateLimitConfig = {
  general: 120,
  notifications: 30,
  batches: 5,
};

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export function getRateLimitConfig(): RateLimitConfig {
  return {
    general: envInt("PUBLIC_API_RATE_LIMIT_GENERAL", DEFAULTS.general),
    notifications: envInt("PUBLIC_API_RATE_LIMIT_NOTIFICATIONS", DEFAULTS.notifications),
    batches: envInt("PUBLIC_API_RATE_LIMIT_BATCHES", DEFAULTS.batches),
  };
}

export function windowStartMs(nowMs: number, windowSeconds = RATE_LIMIT_WINDOWS_SECONDS): number {
  const w = windowSeconds * 1000;
  return Math.floor(nowMs / w) * w;
}

export function retryAfterSeconds(nowMs: number, windowSeconds = RATE_LIMIT_WINDOWS_SECONDS): number {
  const start = windowStartMs(nowMs, windowSeconds);
  return Math.max(1, Math.ceil((start + windowSeconds * 1000 - nowMs) / 1000));
}
