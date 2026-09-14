export type MarketingCountryCode =
  | "AR"
  | "BO"
  | "BR"
  | "CL"
  | "CO"
  | "CR"
  | "CU"
  | "DO"
  | "EC"
  | "ES"
  | "GT"
  | "HN"
  | "MX"
  | "NI"
  | "PA"
  | "PE"
  | "PY"
  | "SV"
  | "UY"
  | "VE";

export type MarketingCountry = {
  code: MarketingCountryCode;
  name: string;
};

export const MARKETING_COUNTRIES: readonly MarketingCountry[] = [
  { code: "AR", name: "Argentina" },
  { code: "BO", name: "Bolivia" },
  { code: "BR", name: "Brasil" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "CR", name: "Costa Rica" },
  { code: "CU", name: "Cuba" },
  { code: "DO", name: "República Dominicana" },
  { code: "EC", name: "Ecuador" },
  { code: "SV", name: "El Salvador" },
  { code: "GT", name: "Guatemala" },
  { code: "HN", name: "Honduras" },
  { code: "MX", name: "México" },
  { code: "NI", name: "Nicaragua" },
  { code: "PA", name: "Panamá" },
  { code: "PY", name: "Paraguay" },
  { code: "PE", name: "Perú" },
  { code: "UY", name: "Uruguay" },
  { code: "VE", name: "Venezuela" },
  { code: "ES", name: "España" },
] as const;

const BY_CODE = new Map<string, MarketingCountry>(
  MARKETING_COUNTRIES.map((c) => [c.code, c]),
);

const ALIASES: Record<string, MarketingCountryCode> = {
  ar: "AR",
  argentina: "AR",
  argentyna: "AR",
  bo: "BO",
  bolivia: "BO",
  br: "BR",
  brasil: "BR",
  brazil: "BR",
  cl: "CL",
  chile: "CL",
  co: "CO",
  colombia: "CO",
  cr: "CR",
  "costa rica": "CR",
  costarica: "CR",
  cu: "CU",
  cuba: "CU",
  do: "DO",
  "republica dominicana": "DO",
  "república dominicana": "DO",
  "dominican republic": "DO",
  dominicana: "DO",
  ec: "EC",
  ecuador: "EC",
  sv: "SV",
  "el salvador": "SV",
  salvador: "SV",
  gt: "GT",
  guatemala: "GT",
  hn: "HN",
  honduras: "HN",
  mx: "MX",
  mexico: "MX",
  méxico: "MX",
  ni: "NI",
  nicaragua: "NI",
  pa: "PA",
  panama: "PA",
  panamá: "PA",
  py: "PY",
  paraguay: "PY",
  pe: "PE",
  peru: "PE",
  perú: "PE",
  uy: "UY",
  uruguay: "UY",
  ve: "VE",
  venezuela: "VE",
  es: "ES",
  espana: "ES",
  españa: "ES",
  spain: "ES",
};

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function isMarketingCountryCode(value: string): value is MarketingCountryCode {
  return BY_CODE.has(value.toUpperCase());
}

export function countryName(code: string): string {
  return BY_CODE.get(code.toUpperCase())?.name || code;
}

export function parseCountry(raw: string | null | undefined): MarketingCountryCode | null {
  const folded = fold(String(raw || ""));
  if (!folded) return null;
  const upper = folded.toUpperCase();
  if (isMarketingCountryCode(upper)) return upper;
  return ALIASES[folded] || null;
}
