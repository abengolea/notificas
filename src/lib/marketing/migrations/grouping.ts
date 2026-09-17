import {
  normalizeMarketingCompanyName,
  normalizeMarketingCountryCode,
  normalizeMarketingDomain,
  normalizeMarketingEmail,
} from "../normalizers";
import { GENERIC_EMAIL_DOMAINS, INSUFFICIENT_COMPANY_NAMES } from "./constants";
import type { CanonicalCompanyNameReason, CompanyMigrationCountryStatus } from "./types";

const GENERIC_DOMAIN_SET = new Set(GENERIC_EMAIL_DOMAINS.map((d) => d.toLowerCase()));

/**
 * Matching normalization ≠ display normalization.
 *
 * Display y persistencia: `normalizeMarketingCompanyName` (conserva la forma
 * canónica elegida; las formas jurídicas se pliegan al guardar `normalizedName`).
 *
 * Matching: además pliega residuos de "S.A. de C.V." y similares que el
 * normalizador de display deja porque terminan en "cv", no en "sa".
 *
 * Nunca persistir este valor como `company.name`.
 */
export function normalizeCompanyNameForMatching(value: string): string {
  let current = normalizeMarketingCompanyName(value);
  const trailing = [
    /(?:\s+de)?\s+c\s*v$/u,
    /\s+s\s*a\s*s$/u,
    /\s+s\s*r\s*l$/u,
    /\s+s\s*l$/u,
    /\s+s\s*a$/u,
    /\s+ltda$/u,
    /\s+ltd$/u,
  ];
  for (let i = 0; i < 4; i++) {
    let next = current;
    for (const re of trailing) next = next.replace(re, "").trim();
    if (next === current) break;
    current = next;
  }
  return current;
}

function compactKey(value: string): string {
  return value.trim().toLowerCase().replace(/[.\-/]/g, "").replace(/\s+/g, " ").trim();
}

const INSUFFICIENT_KEYS = new Set(
  INSUFFICIENT_COMPANY_NAMES.flatMap((raw) => {
    const keys = [
      compactKey(raw),
      normalizeMarketingCompanyName(raw),
      normalizeCompanyNameForMatching(raw),
    ];
    return keys.filter(Boolean);
  }),
);

export function isGenericEmailDomain(domain: string): boolean {
  const normalized = normalizeMarketingDomain(domain) || domain.trim().toLowerCase();
  return GENERIC_DOMAIN_SET.has(normalized);
}

export function extractEmailDomain(email: string | undefined): string | undefined {
  if (!email) return undefined;
  const normalized = normalizeMarketingEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at < 0) return undefined;
  const host = normalized.slice(at + 1);
  return normalizeMarketingDomain(host) || undefined;
}

export function corporateEmailDomain(email: string | undefined): string | undefined {
  const domain = extractEmailDomain(email);
  if (!domain) return undefined;
  if (isGenericEmailDomain(domain)) return undefined;
  return domain;
}

export function isInsufficientCompanyName(raw: string | undefined): boolean {
  const trimmed = (raw || "").trim();
  if (!trimmed) return true;
  if (INSUFFICIENT_KEYS.has(compactKey(trimmed))) return true;
  const normalized = normalizeMarketingCompanyName(trimmed);
  if (!normalized) return true;
  if (INSUFFICIENT_KEYS.has(normalized)) return true;
  const matching = normalizeCompanyNameForMatching(trimmed);
  if (!matching) return true;
  if (INSUFFICIENT_KEYS.has(matching)) return true;
  return false;
}

function isAllCaps(value: string): boolean {
  const letters = value.replace(/[^\p{L}]/gu, "");
  return letters.length > 0 && letters === letters.toUpperCase();
}

export function suggestCanonicalCompanyName(originalValues: string[]): {
  name: string;
  reason: CanonicalCompanyNameReason;
} {
  const counts = new Map<string, { count: number; firstIndex: number }>();
  originalValues.forEach((raw, index) => {
    const value = raw.trim();
    if (!value || isInsufficientCompanyName(value)) return;
    const current = counts.get(value) || { count: 0, firstIndex: index };
    current.count += 1;
    counts.set(value, current);
  });
  const variants = [...counts.entries()];
  if (variants.length === 0) return { name: "", reason: "first_valid_variant" };

  variants.sort((a, b) => b[1].count - a[1].count || a[1].firstIndex - b[1].firstIndex);
  const topCount = variants[0][1].count;
  const tied = variants.filter(([, meta]) => meta.count === topCount);
  if (tied.length === 1) {
    return { name: tied[0][0], reason: "most_frequent_variant" };
  }

  const notAllCaps = tied.filter(([name]) => !isAllCaps(name));
  if (notAllCaps.length > 0 && notAllCaps.length < tied.length) {
    notAllCaps.sort((a, b) => a[1].firstIndex - b[1].firstIndex);
    return { name: notAllCaps[0][0], reason: "tie_prefer_not_all_caps" };
  }

  tied.sort((a, b) => a[1].firstIndex - b[1].firstIndex);
  return {
    name: tied[0][0],
    reason: topCount === 1 ? "first_valid_variant" : "most_frequent_variant",
  };
}

export function collectCountryStatus(countries: Array<string | undefined>): {
  countryCandidates: string[];
  countryStatus: CompanyMigrationCountryStatus;
} {
  const set = new Set<string>();
  for (const raw of countries) {
    const code = raw ? normalizeMarketingCountryCode(raw) : null;
    if (code) set.add(code);
  }
  const countryCandidates = [...set].sort();
  if (countryCandidates.length === 0) return { countryCandidates, countryStatus: "missing" };
  if (countryCandidates.length === 1) return { countryCandidates, countryStatus: "single" };
  return { countryCandidates, countryStatus: "multiple" };
}

export function collectDomainCandidates(emails: Array<string | undefined>): string[] {
  const set = new Set<string>();
  for (const email of emails) {
    const domain = corporateEmailDomain(email);
    if (domain) set.add(domain);
  }
  return [...set].sort();
}
