import type { MarketingServiceContext } from "../context";
import { nowIso } from "../persistence/timestamps";
import type { MarketingServices } from "../services";
import { CRM_TAXONOMY_MIGRATION_ID } from "./constants";
import { previewTaxonomySeed } from "./preview";
import { TAXONOMY_COUNTRIES, TAXONOMY_INDUSTRIES, TAXONOMY_TAGS, TAXONOMY_USE_CASES } from "./seed";
import type { TaxonomyApplyResult, TaxonomyPreview } from "./types";

export function assertTaxonomyApplyConfirm(confirm: string): void {
  if (confirm !== CRM_TAXONOMY_MIGRATION_ID) {
    throw new Error(`APPLY_BLOCKED: se requiere --confirm=${CRM_TAXONOMY_MIGRATION_ID}`);
  }
}

export async function applyTaxonomySeed(input: {
  confirm: string;
  workspaceId: string;
  services: MarketingServices;
  ctx: MarketingServiceContext;
  preview?: TaxonomyPreview;
}): Promise<TaxonomyApplyResult> {
  assertTaxonomyApplyConfirm(input.confirm);
  const preview = input.preview || (await previewTaxonomySeed(input));
  if (preview.stats.keyConflicts.length) {
    throw new Error(`APPLY_BLOCKED: key conflicts ${preview.stats.keyConflicts.join(", ")}`);
  }

  const { services, ctx } = input;
  let countriesWrote = 0;
  let industriesWrote = 0;
  let useCasesWrote = 0;
  let tagsWrote = 0;
  let companiesWrote = 0;

  for (const row of preview.countries) {
    if (row.action === "UNCHANGED") continue;
    const seed = TAXONOMY_COUNTRIES.find((c) => c.code === row.key);
    if (!seed) continue;
    if (row.action === "CREATE") {
      await services.countries.createCountry(ctx, {
        code: seed.code,
        name: seed.name,
        defaultLanguage: seed.defaultLanguage,
        active: seed.active,
      });
    } else {
      const current = await services.countries.getByKey(ctx, seed.code);
      if (!current) continue;
      await services.countries.updateCountry(ctx, current.id, {
        name: seed.name,
        defaultLanguage: seed.defaultLanguage,
        active: seed.active,
      });
    }
    countriesWrote += 1;
  }

  for (const row of preview.industries) {
    if (row.action === "UNCHANGED") continue;
    const seed = TAXONOMY_INDUSTRIES.find((c) => c.key === row.key);
    if (!seed) continue;
    if (row.action === "CREATE") {
      await services.industries.createIndustry(ctx, {
        key: seed.key,
        name: seed.name,
        parentIndustryId: seed.parentKey,
        active: seed.active,
      });
    } else {
      const current = await services.industries.getByKey(ctx, seed.key);
      if (!current) continue;
      await services.industries.updateIndustry(ctx, current.id, {
        name: seed.name,
        parentIndustryId: seed.parentKey,
        active: seed.active,
      });
    }
    industriesWrote += 1;
  }

  for (const row of preview.tags) {
    if (row.action === "UNCHANGED") continue;
    const seed = TAXONOMY_TAGS.find((c) => c.key === row.key);
    if (!seed) continue;
    if (row.action === "CREATE") {
      await services.tags.createTag(ctx, { key: seed.key, name: seed.name, active: seed.active });
    } else {
      const current = await services.tags.getByKey(ctx, seed.key);
      if (!current) continue;
      await services.tags.updateTag(ctx, current.id, { name: seed.name, active: seed.active });
    }
    tagsWrote += 1;
  }

  for (const row of preview.useCases) {
    if (row.action === "UNCHANGED") continue;
    const seed = TAXONOMY_USE_CASES.find((c) => c.key === row.key);
    if (!seed) continue;
    if (row.action === "CREATE") {
      await services.useCases.createUseCase(ctx, {
        key: seed.key,
        name: seed.name,
        industryIds: seed.industryKeys,
        countryCodes: seed.countryCodes,
        active: seed.active,
      });
    } else {
      const current = await services.useCases.getByKey(ctx, seed.key);
      if (!current) continue;
      await services.useCases.updateUseCase(ctx, current.id, {
        name: seed.name,
        industryIds: seed.industryKeys,
        countryCodes: seed.countryCodes,
        active: seed.active,
      });
    }
    useCasesWrote += 1;
  }

  for (const row of preview.companies) {
    if (row.action === "UNCHANGED") continue;
    await services.companies.updateCompany(ctx, row.companyId, {
      industryIds: row.industryIds,
      useCaseIds: row.useCaseIds,
      tagIds: row.tagIds,
    });
    companiesWrote += 1;
  }

  const after = await previewTaxonomySeed(input);
  return {
    ...after,
    appliedAt: nowIso(),
    actorId: ctx.actorId || CRM_TAXONOMY_MIGRATION_ID,
    wrote: {
      countries: countriesWrote,
      industries: industriesWrote,
      useCases: useCasesWrote,
      tags: tagsWrote,
      companies: companiesWrote,
      activities: 0,
    },
  };
}
