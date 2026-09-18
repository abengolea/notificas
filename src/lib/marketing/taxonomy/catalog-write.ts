import { marketingContext, type MarketingServiceContext } from "../context";
import { MarketingValidationError } from "../errors";
import { isMarketingCatalogKey } from "../domain/ids";
import { listAllMarketingPages } from "../pagination";
import { createFirestoreMarketingRepositories } from "../repositories/firestore";
import { createMarketingServices, type MarketingServices } from "../services";
import { getMarketingWorkspaceId } from "../workspace";
import {
  canonicalIndustryKey,
  canonicalUseCaseKey,
  findCatalogNameMatch,
  seedIndustryByKey,
  seedUseCaseByKey,
  slugFromCatalogName,
  TAXONOMY_INDUSTRIES,
  TAXONOMY_USE_CASES,
} from "./seed";

export type CatalogWriteDeps = {
  services: MarketingServices;
  ctx: MarketingServiceContext;
};

export type CatalogUpsertRow = {
  key: string;
  name: string;
  created: boolean;
  skipped: boolean;
  linked?: boolean;
  reason?: string;
};

export type CatalogUpsertResult = {
  industry: CatalogUpsertRow;
  useCases: CatalogUpsertRow[];
};

function liveDeps(actorId?: string): CatalogWriteDeps {
  return {
    services: createMarketingServices(createFirestoreMarketingRepositories()),
    ctx: marketingContext(getMarketingWorkspaceId(), {
      actorType: "user",
      actorId: actorId || "catalog-ui",
    }),
  };
}

function parseUseCaseNames(value: unknown): string[] {
  const parts = Array.isArray(value)
    ? value.flatMap((item) => String(item || "").split(/\n|;/))
    : String(value || "").split(/\n|;/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const name = part.trim();
    if (!name) continue;
    const folded = name.toLowerCase();
    if (seen.has(folded)) continue;
    seen.add(folded);
    out.push(name);
  }
  return out;
}

function requireSlug(name: string, kind: "rubro" | "caso de uso"): string {
  const key = slugFromCatalogName(name);
  if (!isMarketingCatalogKey(key)) {
    throw new MarketingValidationError(`No se pudo armar una key válida para el ${kind}`);
  }
  return key;
}

export async function upsertCatalogFromNames(
  input: { industryName?: string; useCaseNames?: unknown },
  deps?: CatalogWriteDeps,
): Promise<CatalogUpsertResult> {
  const { services, ctx } = deps || liveDeps();
  const industryName = String(input.industryName || "").trim();
  if (!industryName) throw new MarketingValidationError("Escribí el nombre del rubro");
  const useCaseNames = parseUseCaseNames(input.useCaseNames);
  if (useCaseNames.length === 0) throw new MarketingValidationError("Agregá al menos un caso de uso");

  const [persistedIndustries, persistedUseCases] = await Promise.all([
    listAllMarketingPages((cursor) => services.industries.listIndustries(ctx, cursor, 100)),
    listAllMarketingPages((cursor) => services.useCases.listUseCases(ctx, cursor, 100)),
  ]);

  const industryRows = [
    ...TAXONOMY_INDUSTRIES.map((row) => ({ key: row.key, name: row.name })),
    ...persistedIndustries.map((row) => ({ key: canonicalIndustryKey(row.key), name: row.name })),
  ];
  const industryKey = requireSlug(industryName, "rubro");
  const existingIndustry = findCatalogNameMatch(industryName, industryRows) || seedIndustryByKey(industryKey);
  let industry: CatalogUpsertRow;
  if (existingIndustry) {
    industry = {
      key: existingIndustry.key,
      name: existingIndustry.name,
      created: false,
      skipped: true,
      reason: "Ya existía ese rubro",
    };
  } else {
    const created = await services.industries.createIndustry(ctx, {
      key: industryKey,
      name: industryName,
      active: true,
    });
    industry = { key: created.key, name: created.name, created: true, skipped: false };
  }

  const useCaseRows = [
    ...TAXONOMY_USE_CASES.map((row) => ({ key: row.key, name: row.name, industryKeys: [...row.industryKeys] })),
    ...persistedUseCases.map((row) => ({
      key: canonicalUseCaseKey(row.key),
      name: row.name,
      industryKeys: [...(row.industryIds || [])],
    })),
  ];

  const useCases: CatalogUpsertRow[] = [];
  for (const name of useCaseNames) {
    const key = requireSlug(name, "caso de uso");
    const existing = findCatalogNameMatch(name, useCaseRows) || seedUseCaseByKey(key);
    if (existing) {
      const alreadyLinked = (existing as { industryKeys?: string[] }).industryKeys?.some(
        (item) => canonicalIndustryKey(item) === industry.key,
      );
      const persisted = persistedUseCases.find((row) => canonicalUseCaseKey(row.key) === existing.key);
      if (persisted && !alreadyLinked) {
        await services.useCases.updateUseCase(ctx, persisted.id, {
          industryIds: [...new Set([...(persisted.industryIds || []), industry.key])],
        });
        useCases.push({
          key: existing.key,
          name: existing.name,
          created: false,
          skipped: false,
          linked: true,
          reason: "Ya existía; se vinculó a este rubro",
        });
        continue;
      }
      useCases.push({
        key: existing.key,
        name: existing.name,
        created: false,
        skipped: true,
        reason: alreadyLinked ? "Ya existía para este rubro" : "Ya existía ese caso de uso",
      });
      continue;
    }
    const created = await services.useCases.createUseCase(ctx, {
      key,
      name,
      industryIds: [industry.key],
      countryCodes: [],
      active: true,
    });
    useCaseRows.push({ key: created.key, name: created.name, industryKeys: [...(created.industryIds || [])] });
    useCases.push({ key: created.key, name: created.name, created: true, skipped: false });
  }

  return { industry, useCases };
}
