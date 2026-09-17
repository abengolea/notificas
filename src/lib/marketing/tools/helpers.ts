import type { MarketingCompany } from "../domain/types";
import { MarketingValidationError } from "../errors";
import { clampMarketingLimit } from "../pagination";
import type { CrmToolContext, CrmToolRuntime, CrmToolSuccess } from "./types";

export const DEFAULT_TOOL_LIMIT = 20;
export const DETAIL_LIMIT = 8;

export function pageLimit(limit?: number, fallback = DEFAULT_TOOL_LIMIT, max = 100): number {
  return clampMarketingLimit(limit, fallback, max);
}

export async function resolveCompanyByName(
  runtime: CrmToolRuntime,
  ctx: CrmToolContext,
  companyName: string,
): Promise<{ company: MarketingCompany } | { needsClarification: true; candidates: Array<{ id: string; name: string; countryCode?: string }> }> {
  const found = await runtime.services.companies.searchCompanies(ctx, {
    query: companyName,
    limit: 8,
  });
  const items = found.items.filter((c) => !c.deletedAt);
  if (items.length === 1) return { company: items[0] };
  if (items.length === 0) {
    throw new MarketingValidationError(`No encontré una empresa que coincida con «${companyName}». Indicá el id o un nombre más preciso.`);
  }
  return {
    needsClarification: true,
    candidates: items.slice(0, 8).map((c) => ({
      id: c.id,
      name: c.name,
      countryCode: c.countryCode,
    })),
  };
}

export function clarificationResult(
  tool: CrmToolSuccess["tool"],
  write: boolean,
  candidates: Array<{ id: string; name: string; countryCode?: string }>,
  entityLabel: string,
): CrmToolSuccess {
  return {
    ok: true,
    tool,
    write,
    needsClarification: true,
    summary: `Hay varias ${entityLabel}. Pedí al usuario que elija un id; no elijas en silencio.`,
    data: { needsClarification: true, candidates },
  };
}

export function summarizeCompany(c: {
  id: string;
  name: string;
  countryCode?: string;
  industryIds?: string[];
  useCaseIds?: string[];
  commercialStageId?: string;
  lastContactAt?: string;
  nextFollowUpAt?: string;
}) {
  return {
    id: c.id,
    name: c.name,
    countryCode: c.countryCode || null,
    industryIds: c.industryIds || [],
    useCaseIds: c.useCaseIds || [],
    commercialStageId: c.commercialStageId || null,
    lastContactAt: c.lastContactAt || null,
    nextFollowUpAt: c.nextFollowUpAt || null,
  };
}
