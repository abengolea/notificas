import { parseCountry } from "../countries";
import { normalizeEmail } from "../csv";

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Reutiliza `normalizeEmail`. No duplicar la regla. */
export function normalizeMarketingEmail(value: string): string {
  return normalizeEmail(value);
}

const LEGAL_SUFFIXES = [
  "s.a.s",
  "s.a",
  "sas",
  "sa",
  "s.r.l",
  "srl",
  "s.l",
  "sl",
  "ltda",
  "ltd",
  "llc",
  "inc",
  "corp",
  "gmbh",
  "plc",
  "spa",
  "eirl",
  "cia",
  "co",
  "company",
];

function stripLegalSuffixes(name: string): string {
  let current = name;
  for (let i = 0; i < 4; i++) {
    const next = current.replace(
      new RegExp(`(?:^|\\s)(?:${LEGAL_SUFFIXES.map((s) => s.replace(/\./g, "\\.")).join("|")})\\.?$`, "i"),
      "",
    );
    const trimmed = next.trim();
    if (trimmed === current) break;
    current = trimmed;
  }
  return current;
}

export function normalizeMarketingCompanyName(value: string): string {
  const withoutLegal = stripLegalSuffixes(fold(value));
  return withoutLegal.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function hostnameFromInput(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    if (!url.hostname) return null;
    return url.hostname;
  } catch {
    return null;
  }
}

export function normalizeMarketingDomain(value: string): string | null {
  const host = hostnameFromInput(value);
  if (!host) return null;
  const lower = host.toLowerCase().replace(/\.$/, "");
  const noWww = lower.startsWith("www.") ? lower.slice(4) : lower;
  if (!noWww || !noWww.includes(".")) return null;
  return noWww;
}

export function normalizeMarketingUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    if (!url.hostname) return null;
    url.hash = "";
    url.username = "";
    url.password = "";
    if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) {
      url.port = "";
    }
    const host = url.hostname.toLowerCase();
    url.hostname = host;
    let href = url.toString();
    if (href.endsWith("/") && url.pathname === "/") href = href.slice(0, -1);
    return href;
  } catch {
    return null;
  }
}

export function normalizeLinkedInUrl(value: string): string | null {
  const normalized = normalizeMarketingUrl(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "linkedin.com" || !/^\/in\/[^/]+\/?$/i.test(url.pathname)) return null;
  url.protocol = "https:";
  url.hostname = "linkedin.com";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "").toLowerCase();
  return url.toString().replace(/\/$/, "");
}

export function normalizeMarketingPhone(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  const plus = digits.startsWith("+");
  const rest = (plus ? digits.slice(1) : digits).replace(/\D/g, "");
  if (rest.length < 6 || rest.length > 15) return null;
  return plus ? `+${rest}` : rest;
}

const EXTRA_COUNTRY_ALIASES: Record<string, string> = {
  us: "US",
  usa: "US",
  "united states": "US",
  "united states of america": "US",
  "estados unidos": "US",
  eeuu: "US",
  "ee.uu": "US",
  "ee uu": "US",
};

export function normalizeMarketingCountryCode(value: string): string | null {
  const fromV1 = parseCountry(value);
  if (fromV1) return fromV1;
  const folded = fold(String(value || ""));
  if (!folded) return null;
  const extra = EXTRA_COUNTRY_ALIASES[folded] || EXTRA_COUNTRY_ALIASES[folded.replace(/\./g, "")];
  if (extra) return extra;
  const upper = folded.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  return null;
}
