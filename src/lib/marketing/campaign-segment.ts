import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { bumpListCount, getOrCreateMarketingList } from "./audience";
import { MARKETING_CONTACTS } from "./collections";
import { marketingContext, type MarketingServiceContext } from "./context";
import { MARKETING_COUNTRY_SEED_CORE } from "./domain/country-seed";
import { countryName, isMarketingCountryCode, type MarketingCountryCode } from "./countries";
import { MarketingValidationError } from "./errors";
import {
  decorateRecipient,
  includeStageSet,
  toRecipientRow,
  type RecipientRow,
} from "./lists";
import { createFirestoreMarketingRepositories } from "./repositories/firestore";
import { createMarketingServices, type MarketingServices } from "./services";
import { companyClassificationTarget } from "./taxonomy/classify";
import {
  canonicalIndustryKey,
  canonicalUseCaseKey,
  isCanonicalIndustryKey,
  isCanonicalUseCaseKey,
  parseCatalogKeyList,
  seedIndustryByKey,
  seedUseCaseByKey,
  storedKeysMatch,
  TAXONOMY_INDUSTRIES,
  TAXONOMY_USE_CASES,
  catalogUseCaseAppliesToIndustry,
} from "./taxonomy/seed";
import type { MarketingCompany } from "./domain/types";
import type { MarketingContactRecord } from "./repositories/types";
import { getMarketingWorkspaceId } from "./workspace";

const COMPANY_CAP = 200;
const CONTACT_CAP = 500;
const PREVIEW_LIMIT = 80;

export type CampaignSegmentDeps = {
  services: MarketingServices;
  workspaceId?: string;
};

export type CampaignIndustryOption = {
  key: string;
  name: string;
  keywords?: string[];
};

export type CampaignUseCaseOption = {
  key: string;
  name: string;
  industryKeys: string[];
  keywords?: string[];
};

export type CampaignCatalog = {
  countries: Array<{ code: string; name: string }>;
  industries: CampaignIndustryOption[];
  useCases: CampaignUseCaseOption[];
};

export type CrmCampaignSegment = {
  countryCode: string;
  industryId: string;
  useCaseId?: string;
  useCaseIds?: string[];
};

export type CrmAudiencePreview = {
  total: number;
  eligible: number;
  skipped: number;
  companyCount: number;
  contacts: RecipientRow[];
  truncated: boolean;
};

export type CrmAudienceLoad = CrmAudiencePreview & {
  eligibleContactIds: string[];
  industryName: string;
  useCaseName: string;
};

let liveServices: MarketingServices | null = null;

function defaultServices(): MarketingServices {
  if (!liveServices) {
    liveServices = createMarketingServices(createFirestoreMarketingRepositories());
  }
  return liveServices;
}

function resolveDeps(deps?: CampaignSegmentDeps): {
  services: MarketingServices;
  ctx: MarketingServiceContext;
} {
  const workspaceId = deps?.workspaceId || getMarketingWorkspaceId();
  return {
    services: deps?.services || defaultServices(),
    ctx: marketingContext(workspaceId, { actorType: "system", actorId: "campaign-ui" }),
  };
}

export async function loadCampaignCatalog(deps?: CampaignSegmentDeps): Promise<CampaignCatalog> {
  const { services, ctx } = resolveDeps(deps);
  const industries: CampaignIndustryOption[] = TAXONOMY_INDUSTRIES.filter((row) => row.active).map((row) => ({
    key: row.key,
    name: row.name,
    keywords: [...(row.keywords || [])],
  }));
  const useCases: CampaignUseCaseOption[] = TAXONOMY_USE_CASES.filter((row) => row.active).map((row) => ({
    key: row.key,
    name: row.name,
    industryKeys: [...row.industryKeys],
    keywords: [...(row.keywords || [])],
  }));
  const industryByKey = new Map(industries.map((row) => [row.key, row]));
  const useCaseByKey = new Map(useCases.map((row) => [row.key, row]));
  try {
    const [persistedIndustries, persistedUseCases] = await Promise.all([
      services.industries.listIndustries(ctx, undefined, 100),
      services.useCases.listUseCases(ctx, undefined, 100),
    ]);
    for (const row of persistedIndustries.items) {
      if (row.active === false || !isCanonicalIndustryKey(row.key)) continue;
      const key = canonicalIndustryKey(row.key);
      const current = industryByKey.get(key);
      if (current) current.name = row.name;
    }
    for (const row of persistedUseCases.items) {
      if (row.active === false || !isCanonicalUseCaseKey(row.key)) continue;
      const key = canonicalUseCaseKey(row.key);
      const current = useCaseByKey.get(key);
      if (current) current.name = row.name;
    }
  } catch {
    // El formulario muestra la semilla aunque el catálogo Firestore no esté aplicado.
  }
  return {
    countries: MARKETING_COUNTRY_SEED_CORE.map((row) => ({ code: row.code, name: row.name })),
    industries: [...industryByKey.values()].sort((a, b) => a.name.localeCompare(b.name, "es")),
    useCases: [...useCaseByKey.values()].sort((a, b) => a.name.localeCompare(b.name, "es")),
  };
}

function companyMatchesIndustry(company: MarketingCompany, industryId: string): boolean {
  if (storedKeysMatch(company.industryIds, industryId, "industry")) return true;
  const classified = companyClassificationTarget(company.normalizedName);
  return storedKeysMatch(classified?.industryKeys, industryId, "industry");
}

function companyMatchesUseCase(company: MarketingCompany, useCaseId: string): boolean {
  if (storedKeysMatch(company.useCaseIds, useCaseId, "useCase")) return true;
  const classified = companyClassificationTarget(company.normalizedName);
  return storedKeysMatch(classified?.useCaseKeys, useCaseId, "useCase");
}

function companyMatchesAnyUseCase(company: MarketingCompany, useCaseIds: string[]): boolean {
  if (useCaseIds.length === 0) return true;
  return useCaseIds.some((useCaseId) => companyMatchesUseCase(company, useCaseId));
}

export type LooseTaxonomyFilter = {
  countryCode?: string;
  industryId?: string;
  useCaseId?: string;
  useCaseIds?: string[];
};

export async function listCompaniesMatchingTaxonomy(
  filter: LooseTaxonomyFilter,
  deps?: CampaignSegmentDeps,
): Promise<MarketingCompany[]> {
  const { services, ctx } = resolveDeps(deps);
  const countryCode = String(filter.countryCode || "").trim().toUpperCase();
  const industryId = filter.industryId ? canonicalIndustryKey(filter.industryId) : "";
  const useCaseIds = parseCatalogKeyList(filter.useCaseIds?.length ? filter.useCaseIds : filter.useCaseId).map(canonicalUseCaseKey);
  if (!industryId && useCaseIds.length === 0) return [];
  const out: MarketingCompany[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 5 && out.length < COMPANY_CAP; page += 1) {
    const result = await services.companies.searchCompanies(ctx, {
      countryCode: countryCode && isMarketingCountryCode(countryCode) ? countryCode : undefined,
      limit: 100,
      cursor,
    });
    for (const company of result.items) {
      if (company.deletedAt) continue;
      if (countryCode && isMarketingCountryCode(countryCode) && company.countryCode !== countryCode) continue;
      if (industryId && !companyMatchesIndustry(company, industryId)) continue;
      if (useCaseIds.length && !companyMatchesAnyUseCase(company, useCaseIds)) continue;
      out.push(company);
      if (out.length >= COMPANY_CAP) break;
    }
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }
  return out;
}

async function matchingCompanies(
  services: MarketingServices,
  ctx: MarketingServiceContext,
  segment: CrmCampaignSegment,
): Promise<MarketingCompany[]> {
  const useCaseIds = parseCatalogKeyList(segment.useCaseIds?.length ? segment.useCaseIds : segment.useCaseId).map(canonicalUseCaseKey);
  const out: MarketingCompany[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 5 && out.length < COMPANY_CAP; page += 1) {
    const result = await services.companies.searchCompanies(ctx, {
      countryCode: segment.countryCode,
      limit: 100,
      cursor,
    });
    for (const company of result.items) {
      if (company.deletedAt) continue;
      if (!companyMatchesIndustry(company, segment.industryId)) continue;
      if (!companyMatchesAnyUseCase(company, useCaseIds)) continue;
      out.push(company);
      if (out.length >= COMPANY_CAP) break;
    }
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }
  return out;
}

async function contactsForCompanies(
  services: MarketingServices,
  ctx: MarketingServiceContext,
  companies: MarketingCompany[],
): Promise<MarketingContactRecord[]> {
  if (companies.length === 0) return [];
  const ids = new Set(companies.map((c) => c.id));
  const names = new Set(companies.map((c) => c.name.trim().toLowerCase()).filter(Boolean));
  const found: MarketingContactRecord[] = [];
  const seen = new Set<string>();

  if (companies.length <= 20) {
    for (const company of companies) {
      if (found.length >= CONTACT_CAP) break;
      const page = await services.contacts.searchContacts(ctx, { companyId: company.id, limit: 50 });
      for (const contact of page.items) {
        if (contact.deletedAt || seen.has(contact.id)) continue;
        seen.add(contact.id);
        found.push(contact);
        if (found.length >= CONTACT_CAP) break;
      }
    }
  }

  {
    let cursor: string | undefined;
    const countryCode = companies[0]?.countryCode;
    for (let page = 0; page < 5 && found.length < CONTACT_CAP; page += 1) {
      const result = await services.contacts.searchContacts(ctx, {
        countryCode,
        limit: 100,
        cursor,
      });
      for (const contact of result.items) {
        if (contact.deletedAt || seen.has(contact.id)) continue;
        const byId = Boolean(contact.companyId && ids.has(contact.companyId));
        const byName = names.has(String(contact.company || "").trim().toLowerCase());
        if (!byId && !byName) continue;
        seen.add(contact.id);
        found.push(contact);
        if (found.length >= CONTACT_CAP) break;
      }
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
    }
  }
  return found;
}

function parseSegment(segment: CrmCampaignSegment): CrmCampaignSegment {
  const countryCode = String(segment.countryCode || "").trim().toUpperCase();
  const industryId = canonicalIndustryKey(String(segment.industryId || "").trim());
  const useCaseIds = [...new Set(
    parseCatalogKeyList(segment.useCaseIds?.length ? segment.useCaseIds : segment.useCaseId).map(canonicalUseCaseKey),
  )];
  if (!isMarketingCountryCode(countryCode)) {
    throw new MarketingValidationError("País inválido");
  }
  if (!seedIndustryByKey(industryId)) {
    throw new MarketingValidationError("Elegí un rubro del catálogo");
  }
  if (useCaseIds.length === 0) {
    throw new MarketingValidationError("Elegí al menos un caso de uso");
  }
  for (const useCaseId of useCaseIds) {
    if (!seedUseCaseByKey(useCaseId)) {
      throw new MarketingValidationError("Elegí un caso de uso del catálogo");
    }
    if (!catalogUseCaseAppliesToIndustry(useCaseId, industryId)) {
      throw new MarketingValidationError("Ese caso de uso no corresponde a ese rubro");
    }
  }
  return { countryCode, industryId, useCaseId: useCaseIds[0], useCaseIds };
}

export async function loadCrmCampaignAudience(
  segment: CrmCampaignSegment,
  includeStages?: unknown,
  deps?: CampaignSegmentDeps,
): Promise<CrmAudienceLoad> {
  const parsed = parseSegment(segment);
  const { services, ctx } = resolveDeps(deps);
  const catalog = await loadCampaignCatalog(deps);
  const industry = catalog.industries.find((row) => row.key === parsed.industryId);
  const useCases = catalog.useCases.filter((row) => (parsed.useCaseIds || []).includes(row.key));
  if (!industry) throw new MarketingValidationError("Rubro desconocido");
  if (useCases.length === 0) throw new MarketingValidationError("Caso de uso desconocido");
  const companies = await matchingCompanies(services, ctx, parsed);
  const contacts = await contactsForCompanies(services, ctx, companies);
  const include = includeStageSet(includeStages);
  const rows = contacts
    .map((c) =>
      decorateRecipient(
        toRecipientRow({
          id: c.id,
          email: c.email,
          name: c.name,
          company: c.company,
          title: c.title,
          country: c.country,
          stage: c.stage,
          lastSentAt: c.lastSentAt,
          listIds: c.listIds,
        }),
        include,
      ),
    )
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.email.localeCompare(b.email, "es"));
  return {
    total: rows.length,
    eligible: rows.filter((r) => r.eligible).length,
    skipped: rows.filter((r) => !r.eligible).length,
    companyCount: companies.length,
    contacts: rows.slice(0, PREVIEW_LIMIT),
    truncated: companies.length >= COMPANY_CAP || contacts.length >= CONTACT_CAP,
    eligibleContactIds: rows.filter((r) => r.eligible).map((r) => r.id),
    industryName: industry.name,
    useCaseName: useCases.map((row) => row.name).join(" · "),
  };
}

export async function previewCrmCampaignAudience(
  segment: CrmCampaignSegment,
  includeStages?: unknown,
  deps?: CampaignSegmentDeps,
): Promise<CrmAudiencePreview> {
  const loaded = await loadCrmCampaignAudience(segment, includeStages, deps);
  return {
    total: loaded.total,
    eligible: loaded.eligible,
    skipped: loaded.skipped,
    companyCount: loaded.companyCount,
    contacts: loaded.contacts,
    truncated: loaded.truncated,
  };
}

export async function materializeCrmCampaignList(input: {
  segment: CrmCampaignSegment;
  includeStages?: unknown;
}): Promise<{ listId: string; listName: string; country: MarketingCountryCode | "all"; eligible: number }> {
  const loaded = await loadCrmCampaignAudience(input.segment, input.includeStages);
  if (loaded.eligibleContactIds.length === 0) {
    throw new MarketingValidationError(
      loaded.companyCount === 0
        ? "No hay empresas de ese rubro y caso de uso en ese país. Clasificá las empresas o elegí otro filtro."
        : "Esas empresas no tienen contactos enviables.",
    );
  }
  const parsed = parseSegment(input.segment);
  const country = parsed.countryCode as MarketingCountryCode;
  const listName = `${loaded.industryName} — ${loaded.useCaseName} — ${countryName(country)}`.slice(0, 80);
  const list = await getOrCreateMarketingList({
    name: listName,
    country,
    source: "manual",
  });
  const db = getAdminDb();
  let added = 0;
  let batch = db.batch();
  let ops = 0;
  const flush = async () => {
    if (!ops) return;
    await batch.commit();
    batch = db.batch();
    ops = 0;
  };
  for (const contactId of loaded.eligibleContactIds) {
    const ref = db.collection(MARKETING_CONTACTS).doc(contactId);
    const snap = await ref.get();
    if (!snap.exists) continue;
    const already =
      Array.isArray(snap.data()?.listIds) && snap.data()!.listIds.map(String).includes(list.id);
    batch.set(ref, { listIds: FieldValue.arrayUnion(list.id), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (!already) added += 1;
    ops += 1;
    if (ops >= 400) await flush();
  }
  await flush();
  if (added > 0) await bumpListCount(list.id, added);
  return {
    listId: list.id,
    listName: list.name,
    country: list.country,
    eligible: loaded.eligible,
  };
}
