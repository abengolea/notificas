import { randomBytes } from "crypto";

/** Crockford Base32 (ULID). */
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeTime(now: number): string {
  let time = now;
  let out = "";
  for (let i = 0; i < 10; i++) {
    const mod = time % 32;
    out = ENCODING[mod] + out;
    time = Math.floor(time / 32);
  }
  return out;
}

function encodeRandom(bytes: Buffer): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += ENCODING[bytes[i] % 32];
  }
  return out;
}

/** Identificador público tipo ULID (26 chars). */
export function newUlid(): string {
  return encodeTime(Date.now()) + encodeRandom(randomBytes(16));
}

export function newRequestId(): string {
  return `req_${newUlid()}`;
}

export function newNotificationId(testMode: boolean): string {
  return testMode ? `ntf_test_${newUlid()}` : `ntf_${newUlid()}`;
}

export function newBatchId(testMode: boolean): string {
  return testMode ? `batch_test_${newUlid()}` : `batch_${newUlid()}`;
}

export function newEventId(): string {
  return `evt_${newUlid()}`;
}

export function newApiKeyId(): string {
  return `key_${newUlid()}`;
}

export function newWebhookEndpointId(): string {
  return `wh_${newUlid()}`;
}

export function isNotificationPublicId(id: string): boolean {
  return /^ntf_(test_)?[0-9A-HJKMNP-TV-Z]{26}$/i.test(id.trim());
}

export function isBatchPublicId(id: string): boolean {
  return /^batch_(test_)?[0-9A-HJKMNP-TV-Z]{26}$/i.test(id.trim());
}

export function isWebhookEndpointPublicId(id: string): boolean {
  return /^wh_[0-9A-HJKMNP-TV-Z]{26}$/i.test(id.trim());
}
