import type { MarketingServiceContext } from "../context";
import type { MarketingCompany, MarketingCountry, MarketingIndustry, MarketingTag, MarketingUseCase } from "../domain/types";
import type { MarketingPage } from "../pagination";
import type { MarketingServices } from "../services";
import { companyClassificationTarget, mergeCompanyTagKeys } from "./classify";
import { CRM_TAXONOMY_MIGRATION_ID } from "./constants";
import { expandSeedIndustryKeys, TAXONOMY_COUNTRIES, TAXONOMY_INDUSTRIES, TAXONOMY_TAGS, TAXONOMY_USE_CASES } from "./seed";
import {
  countCatalogActions,
  sameSorted,
  type TaxonomyCatalogRow,
  type TaxonomyCompanyRow,
  type TaxonomyPreview,
  type TaxonomyRowAction,
} from "./types";

async function listAll<T>(pageFn: (cursor?: string) => Promise<MarketingPage<T>>): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 40; i++) {
    const page = await pageFn(cursor);
    items.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return items;
}

async function listAllOrByKey<T>(
  pageFn: (cursor?: string) => Promise<MarketingPage<T>>,
  keys: string[],
  getByKey: (key: string) => Promise<T | null>,
): Promise<T[]> {
  try {
    return await listAll(pageFn);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/FAILED_PRECONDITION|requires an index/i.test(message)) throw err;
    const items: T[] = [];
    for (const key of keys) {
      const row = await getByKey(key);
      if (row) items.push(row);
    }
    return items;
  }
}

function catalogAction(exists: boolean, changed: boolean): TaxonomyRowAction {
  if (!exists) return "CREATE";
  return changed ? "UPDATE" : "UNCHANGED";
}

function parentKeyOf(industry: MarketingIndustry, byId: Map<string, MarketingIndustry>): string | undefined {
  if (!industry.parentIndustryId) return undefined;
  return byId.get(industry.parentIndustryId)?.key;
}

export async function previewTaxonomySeed(input: {
  workspaceId: string;
  services: MarketingServices;
  ctx: MarketingServiceContext;
}): Promise<TaxonomyPreview> {
  const { services, ctx, workspaceId } = input;

  const [countries, industries, useCases, tags, companies] = await Promise.all([
    listAllOrByKey(
      (cursor) => services.countries.listPersistedCountries(ctx, cursor, 100),
      TAXONOMY_COUNTRIES.map((row) => row.code),
      (key) => services.countries.getByKey(ctx, key),
    ),
    listAllOrByKey(
      (cursor) => services.industries.listIndustries(ctx, cursor, 100),
      TAXONOMY_INDUSTRIES.map((row) => row.key),
      (key) => services.industries.getByKey(ctx, key),
    ),
    listAllOrByKey(
      (cursor) => services.useCases.listUseCases(ctx, cursor, 100),
      TAXONOMY_USE_CASES.map((row) => row.key),
      (key) => services.useCases.getByKey(ctx, key),
    ),
    listAllOrByKey(
      (cursor) => services.tags.listTags(ctx, cursor, 100),
      TAXONOMY_TAGS.map((row) => row.key),
      (key) => services.tags.getByKey(ctx, key),
    ),
    listAll((cursor) => services.companies.searchCompanies(ctx, { cursor, limit: 100 })),
  ]);

  const countryByKey = new Map(countries.map((row) => [row.key, row]));
  const industryByKey = new Map(industries.map((row) => [row.key, row]));
  const industryById = new Map(industries.map((row) => [row.id, row]));
  const useCaseByKey = new Map(useCases.map((row) => [row.key, row]));
  const tagByKey = new Map(tags.map((row) => [row.key, row]));

  const keyConflicts: string[] = [];
  const seenIndustryKeys = new Set<string>();
  for (const row of industries) {
    if (seenIndustryKeys.has(row.key)) keyConflicts.push(`industry:${row.key}`);
    seenIndustryKeys.add(row.key);
  }
  const seenUseCaseKeys = new Set<string>();
  for (const row of useCases) {
    if (seenUseCaseKeys.has(row.key)) keyConflicts.push(`use_case:${row.key}`);
    seenUseCaseKeys.add(row.key);
  }

  const countryRows: TaxonomyCatalogRow[] = TAXONOMY_COUNTRIES.map((seed) => {
    const current = countryByKey.get(seed.code);
    const changed = Boolean(
      current &&
        (current.name !== seed.name ||
          current.defaultLanguage !== seed.defaultLanguage ||
          current.active !== seed.active ||
          current.code !== seed.code),
    );
    const changes: string[] = [];
    if (current && current.name !== seed.name) changes.push("name");
    if (current && current.defaultLanguage !== seed.defaultLanguage) changes.push("defaultLanguage");
    if (current && current.active !== seed.active) changes.push("active");
    return {
      kind: "country",
      key: seed.code,
      name: seed.name,
      action: catalogAction(Boolean(current), changed),
      changes: changes.length ? changes : undefined,
    };
  });

  const industryRows: TaxonomyCatalogRow[] = TAXONOMY_INDUSTRIES.map((seed) => {
    const current = industryByKey.get(seed.key);
    const currentParent = current ? parentKeyOf(current, industryById) : undefined;
    const changed = Boolean(
      current &&
        (current.name !== seed.name ||
          current.active !== seed.active ||
          currentParent !== seed.parentKey),
    );
    const changes: string[] = [];
    if (current && current.name !== seed.name) changes.push("name");
    if (current && current.active !== seed.active) changes.push("active");
    if (current && currentParent !== seed.parentKey) changes.push("parentKey");
    return {
      kind: "industry",
      key: seed.key,
      name: seed.name,
      action: catalogAction(Boolean(current), changed),
      changes: changes.length ? changes : undefined,
    };
  });

  const useCaseRows: TaxonomyCatalogRow[] = TAXONOMY_USE_CASES.map((seed) => {
    const current = useCaseByKey.get(seed.key);
    const expectedIndustries = expandSeedIndustryKeys(seed.industryKeys);
    const expectedGlobal = seed.countryCodes.length === 0;
    const changed = Boolean(
      current &&
        (current.name !== seed.name ||
          current.active !== seed.active ||
          !sameSorted(current.industryIds, expectedIndustries) ||
          !sameSorted(current.countryCodes, seed.countryCodes) ||
          current.appliesToAllCountries !== expectedGlobal),
    );
    const changes: string[] = [];
    if (current && current.name !== seed.name) changes.push("name");
    if (current && current.active !== seed.active) changes.push("active");
    if (current && !sameSorted(current.industryIds, expectedIndustries)) changes.push("industryIds");
    if (current && !sameSorted(current.countryCodes, seed.countryCodes)) changes.push("countryCodes");
    if (current && current.appliesToAllCountries !== expectedGlobal) changes.push("appliesToAllCountries");
    return {
      kind: "use_case",
      key: seed.key,
      name: seed.name,
      action: catalogAction(Boolean(current), changed),
      changes: changes.length ? changes : undefined,
    };
  });

  const tagRows: TaxonomyCatalogRow[] = TAXONOMY_TAGS.map((seed) => {
    const current = tagByKey.get(seed.key);
    const changed = Boolean(current && (current.name !== seed.name || current.active !== seed.active));
    const changes: string[] = [];
    if (current && current.name !== seed.name) changes.push("name");
    if (current && current.active !== seed.active) changes.push("active");
    return {
      kind: "tag",
      key: seed.key,
      name: seed.name,
      action: catalogAction(Boolean(current), changed),
      changes: changes.length ? changes : undefined,
    };
  });

  const companyRows: TaxonomyCompanyRow[] = companies.map((company) => toCompanyRow(company));

  return {
    migrationId: CRM_TAXONOMY_MIGRATION_ID,
    workspaceId,
    countries: countryRows,
    industries: industryRows,
    useCases: useCaseRows,
    tags: tagRows,
    companies: companyRows,
    extras: {
      countries: countries.filter((row) => !TAXONOMY_COUNTRIES.some((seed) => seed.code === row.key)).length,
      industries: industries.filter((row) => !TAXONOMY_INDUSTRIES.some((seed) => seed.key === row.key)).length,
      useCases: useCases.filter((row) => !TAXONOMY_USE_CASES.some((seed) => seed.key === row.key)).length,
      tags: tags.filter((row) => !TAXONOMY_TAGS.some((seed) => seed.key === row.key)).length,
    },
    stats: {
      countries: countCatalogActions(countryRows),
      industries: countCatalogActions(industryRows),
      useCases: countCatalogActions(useCaseRows),
      tags: countCatalogActions(tagRows),
      companiesClassify: companyRows.filter((r) => r.action === "CLASSIFY").length,
      companiesUnchanged: companyRows.filter((r) => r.action === "UNCHANGED").length,
      companiesUnresolved: companyRows.filter((r) => r.intent === "unresolved").length,
      keyConflicts,
    },
  };
}

function toCompanyRow(company: MarketingCompany): TaxonomyCompanyRow {
  const target = companyClassificationTarget(company.normalizedName);
  const currentTags = company.tagIds || [];
  if (!target) {
    const unresolved = (company.industryIds || []).length === 0 && (company.useCaseIds || []).length === 0;
    return {
      companyId: company.id,
      name: company.name,
      normalizedName: company.normalizedName,
      countryCode: company.countryCode,
      intent: unresolved ? "unresolved" : "leave",
      action: unresolved ? "UNRESOLVED" : "UNCHANGED",
      industryIds: company.industryIds || [],
      useCaseIds: company.useCaseIds || [],
      tagIds: currentTags,
      reason: unresolved
        ? "Empresa fuera del mapa de clasificación y sin rubro. No se inventa."
        : "Empresa fuera del mapa de clasificación; se deja como está.",
      legacyNameIntact: true,
      sourceIds: company.sourceIds || [],
    };
  }

  const nextTags = mergeCompanyTagKeys(currentTags, target.pending);
  const same =
    sameSorted(company.industryIds, target.industryKeys) &&
    sameSorted(company.useCaseIds, target.useCaseKeys) &&
    sameSorted(currentTags, nextTags);

  if (target.intent === "unresolved") {
    return {
      companyId: company.id,
      name: company.name,
      normalizedName: company.normalizedName,
      countryCode: company.countryCode,
      intent: "unresolved",
      action: same ? "UNCHANGED" : "UNRESOLVED",
      industryIds: target.industryKeys,
      useCaseIds: target.useCaseKeys,
      tagIds: nextTags,
      reason: target.reason,
      legacyNameIntact: true,
      sourceIds: company.sourceIds || [],
    };
  }

  return {
    companyId: company.id,
    name: company.name,
    normalizedName: company.normalizedName,
    countryCode: company.countryCode,
    intent: "classify",
    action: same ? "UNCHANGED" : "CLASSIFY",
    industryIds: target.industryKeys,
    useCaseIds: target.useCaseKeys,
    tagIds: nextTags,
    reason: target.reason,
    legacyNameIntact: true,
    sourceIds: company.sourceIds || [],
  };
}

export function assertTaxonomyPreviewClean(preview: TaxonomyPreview): void {
  if (preview.stats.keyConflicts.length) {
    throw new Error(`TAXONOMY_BLOCKED: key conflicts ${preview.stats.keyConflicts.join(", ")}`);
  }
}

/** Tipos reexportados para tests de listados; no se usan en runtime. */
export type TaxonomyExisting = {
  countries: MarketingCountry[];
  industries: MarketingIndustry[];
  useCases: MarketingUseCase[];
  tags: MarketingTag[];
};
