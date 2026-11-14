/**
 * Defensa del formulario público de contacto. Los bots típicos POST-ean el JSON
 * sin abrir la página; un humano no ve ni completa estos controles.
 */

export const CONTACT_FORM_CLIENT_HEADER = "x-notificas-form";
export const CONTACT_FORM_CLIENT_HEADER_VALUE = "web";

export const CONTACT_MIN_DWELL_MS = 2_000;
export const CONTACT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
export const CONTACT_LIMIT_PER_HOUR = 5;

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "discard.email",
  "emailondeck.com",
  "fakeinbox.com",
  "getnada.com",
  "grr.la",
  "guerrillamail.com",
  "guerrillamailblock.com",
  "mailinator.com",
  "mailnesia.com",
  "maildrop.cc",
  "mintemail.com",
  "mytemp.email",
  "pokemail.net",
  "sharklasers.com",
  "spam4.me",
  "temp-mail.org",
  "tempmail.com",
  "throwaway.email",
  "tmpmail.org",
  "trashmail.com",
  "trashmailer.com",
  "yopmail.com",
]);

const SPAM_PHRASES = [
  "backlink",
  "binary options",
  "casino bonus",
  "cheap viagra",
  "crypto investment",
  "guest post",
  "increase your traffic",
  "link building",
  "onlyfans",
  "seo ranking",
  "seo service",
];

export type ContactSpamInput = {
  website?: string;
  formStartedAt?: number;
  nombre: string;
  apellido?: string;
  email: string;
  mensaje?: string;
  compania?: string;
  now?: number;
};

export type ContactSpamReason =
  | "honeypot"
  | "too_fast"
  | "stale"
  | "content"
  | "disposable_email";

export type ContactSpamVerdict =
  | { drop: false }
  | { drop: true; reason: ContactSpamReason };

export function hasContactFormClientHeader(headerValue: string | null): boolean {
  return (headerValue || "").trim().toLowerCase() === CONTACT_FORM_CLIENT_HEADER_VALUE;
}

export function contactRateLimitKey(ip: string): string {
  return `contact_${ip.replace(/[^a-zA-Z0-9:._-]/g, "_")}`;
}

function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0) return "";
  return email.slice(at + 1).trim().toLowerCase();
}

function combinedText(input: ContactSpamInput): string {
  return [input.nombre, input.apellido, input.compania, input.mensaje]
    .filter(Boolean)
    .join(" ");
}

function urlCount(text: string): number {
  return (text.match(/https?:\/\/|www\./gi) || []).length;
}

function nonLatinRatio(text: string): number {
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (letters.length < 20) return 0;
  const foreign = (letters.match(/[\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/g) || [])
    .length;
  return foreign / letters.length;
}

function hasSpamPhrase(text: string): boolean {
  const lower = text.toLowerCase();
  return SPAM_PHRASES.some((phrase) => lower.includes(phrase));
}

export function evaluateContactSpam(input: ContactSpamInput): ContactSpamVerdict {
  if (String(input.website || "").trim()) {
    return { drop: true, reason: "honeypot" };
  }

  const now = input.now ?? Date.now();
  const started = input.formStartedAt;
  if (!Number.isFinite(started)) {
    return { drop: true, reason: "too_fast" };
  }
  const elapsed = now - (started as number);
  if (elapsed < CONTACT_MIN_DWELL_MS) {
    return { drop: true, reason: "too_fast" };
  }
  if (elapsed > CONTACT_MAX_AGE_MS) {
    return { drop: true, reason: "stale" };
  }

  if (DISPOSABLE_EMAIL_DOMAINS.has(emailDomain(input.email))) {
    return { drop: true, reason: "disposable_email" };
  }

  const text = combinedText(input);
  if (urlCount(text) >= 3 || hasSpamPhrase(text) || nonLatinRatio(text) > 0.4) {
    return { drop: true, reason: "content" };
  }

  return { drop: false };
}
