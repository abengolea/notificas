import { normalizeMarketingCompanyName } from "../normalizers";
import { CLASSIFICATION_PENDING_TAG_KEY, CAPITAL_MARKETS_INDUSTRY_KEYS, CAPITAL_MARKETS_USE_CASE_KEYS, GAS_INDUSTRY_KEYS, GAS_USE_CASE_KEYS } from "./constants";
import { expandSeedIndustryKeys } from "./seed";

export type CompanyTaxonomyIntent = "classify" | "unresolved" | "leave";

export type CompanyClassificationTarget = {
  normalizedName: string;
  intent: CompanyTaxonomyIntent;
  reason: string;
  industryKeys: string[];
  useCaseKeys: string[];
  pending: boolean;
};

const GAS_REASON =
  "Dataset de prospección de gas: rubro Gas / Distribución de Gas y oferta inicial de aviso previo de corte.";

const GAS_DISPLAY_NAMES = [
  "Camuzzi Gas",
  "Ecogas",
  "Gas NEA",
  "Gasnor / Naturgy NOA",
  "Litoral Gas",
  "Metrogas",
  "Naturgy",
  "Naturgy NOA",
  "Redengas",
];

const GAS_TARGETS: CompanyClassificationTarget[] = GAS_DISPLAY_NAMES.map((name) => ({
  normalizedName: normalizeMarketingCompanyName(name),
  intent: "classify",
  reason: GAS_REASON,
  industryKeys: expandSeedIndustryKeys([...GAS_INDUSTRY_KEYS]),
  useCaseKeys: [...GAS_USE_CASE_KEYS],
  pending: false,
}));

const EMPRESA_SUR_TARGET: CompanyClassificationTarget = {
  normalizedName: normalizeMarketingCompanyName("Empresa Sur"),
  intent: "unresolved",
  reason: "El nombre no identifica rubro con certeza. No se inventa industria ni caso de uso.",
  industryKeys: [],
  useCaseKeys: [],
  pending: true,
};

const CAPITAL_MARKETS_REASON =
  "Dataset de prospección ALyC: rubro Mercado de Capitales y oferta inicial de aviso fehaciente a comitentes.";

const CAPITAL_MARKETS_DISPLAY_NAMES = [
  "InvertirOnline S.A.U.",
  "Bull Market Brokers S.A.",
  "Balanz Capital Valores S.A.U.",
  "PP Inversiones S.A. - Portfolio Personal Inversiones",
  "Cocos Capital S.A.",
  "Allaria S.A.",
  "SBS Trading S.A. - Grupo SBS",
  "Cohen S.A.",
  "Adcap Securities Argentina S.A.",
  "Max Capital S.A.",
  "Criteria WM S.A.",
];

const CAPITAL_MARKETS_TARGETS: CompanyClassificationTarget[] = CAPITAL_MARKETS_DISPLAY_NAMES.map((name) => ({
  normalizedName: normalizeMarketingCompanyName(name),
  intent: "classify",
  reason: CAPITAL_MARKETS_REASON,
  industryKeys: expandSeedIndustryKeys([...CAPITAL_MARKETS_INDUSTRY_KEYS]),
  useCaseKeys: [...CAPITAL_MARKETS_USE_CASE_KEYS],
  pending: false,
}));

const TARGETS = new Map<string, CompanyClassificationTarget>(
  [...GAS_TARGETS, ...CAPITAL_MARKETS_TARGETS, EMPRESA_SUR_TARGET].map((row) => [row.normalizedName, row]),
);

export function companyClassificationTarget(normalizedName: string): CompanyClassificationTarget | null {
  return TARGETS.get(normalizedName) || null;
}

export function pendingTagKey(): string {
  return CLASSIFICATION_PENDING_TAG_KEY;
}

export function mergeCompanyTagKeys(current: string[] | undefined, pending: boolean): string[] {
  const next = new Set((current || []).filter((key) => key !== CLASSIFICATION_PENDING_TAG_KEY));
  if (pending) next.add(CLASSIFICATION_PENDING_TAG_KEY);
  return [...next].sort();
}
