import { marketingContext, type MarketingServiceContext } from "../context";
import { normalizeMarketingCompanyName } from "../normalizers";
import { createFirestoreMarketingRepositories } from "../repositories/firestore";
import { createMarketingServices, type MarketingServices } from "../services";
import { MarketingValidationError } from "../errors";
import { isMarketingCountryCode } from "../countries";
import { getMarketingWorkspaceId } from "../workspace";
import {
  canonicalIndustryKey,
  canonicalUseCaseKey,
  parseCatalogKeyList,
  seedIndustryByKey,
  seedUseCaseByKey,
  catalogUseCaseAppliesToIndustry,
} from "./seed";

export type ImportTaxonomyStamp = {
  industryId: string;
  useCaseIds: string[];
};

function liveServices(): MarketingServices {
  return createMarketingServices(createFirestoreMarketingRepositories());
}

export function parseImportTaxonomy(input: {
  industryId?: string;
  useCaseId?: string;
  useCaseIds?: unknown;
}): ImportTaxonomyStamp | null {
  const industryId = canonicalIndustryKey(String(input.industryId || "").trim());
  const useCaseIds = [...new Set(
    parseCatalogKeyList([input.useCaseIds, input.useCaseId]).map(canonicalUseCaseKey),
  )];
  if (!industryId && useCaseIds.length === 0) return null;
  if (!seedIndustryByKey(industryId)) throw new MarketingValidationError("Elegí un rubro del catálogo");
  if (useCaseIds.length === 0) throw new MarketingValidationError("Elegí al menos un caso de uso");
  for (const useCaseId of useCaseIds) {
    if (!seedUseCaseByKey(useCaseId)) throw new MarketingValidationError("Elegí un caso de uso del catálogo");
    if (!catalogUseCaseAppliesToIndustry(useCaseId, industryId)) {
      throw new MarketingValidationError("Ese caso de uso no corresponde a ese rubro");
    }
  }
  return { industryId, useCaseIds };
}

function companyCacheKey(countryCode: string, name: string): string {
  return `${countryCode}|${normalizeMarketingCompanyName(name)}`;
}

export async function stampImportedCompanies(input: {
  items: Array<{ name: string; countryCode: string }>;
  taxonomy: ImportTaxonomyStamp;
  services?: MarketingServices;
  ctx?: MarketingServiceContext;
}): Promise<Map<string, string>> {
  const services = input.services || liveServices();
  const ctx = input.ctx || marketingContext(getMarketingWorkspaceId(), { actorType: "system", actorId: "csv-import" });
  const ids = new Map<string, string>();
  for (const item of input.items) {
    const name = item.name.trim();
    const countryCode = String(item.countryCode || "").trim().toUpperCase();
    if (!name || !isMarketingCountryCode(countryCode)) continue;
    const cacheKey = companyCacheKey(countryCode, name);
    if (ids.has(cacheKey)) continue;
    const found = await services.companies.searchCompanies(ctx, { query: name, countryCode, limit: 5 });
    const match = found.items.find((row) => !row.deletedAt && row.countryCode === countryCode);
    if (match) {
      const industryIds = [...new Set([...(match.industryIds || []), input.taxonomy.industryId])];
      const useCaseIds = [...new Set([...(match.useCaseIds || []), ...input.taxonomy.useCaseIds])];
      await services.companies.updateCompany(ctx, match.id, { industryIds, useCaseIds });
      ids.set(cacheKey, match.id);
      continue;
    }
    const created = await services.companies.createCompany(ctx, {
      name,
      countryCode,
      industryIds: [input.taxonomy.industryId],
      useCaseIds: [...input.taxonomy.useCaseIds],
      sourceIds: ["csv-import"],
    });
    ids.set(cacheKey, created.company.id);
  }
  return ids;
}

export function lookupStampedCompanyId(
  stamped: Map<string, string>,
  name: string,
  countryCode: string,
): string | undefined {
  const country = String(countryCode || "").trim().toUpperCase();
  if (!name.trim() || !country) return undefined;
  return stamped.get(companyCacheKey(country, name));
}
