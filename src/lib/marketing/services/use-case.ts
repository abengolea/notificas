import { z } from "zod";
import type { MarketingServiceContext } from "../context";
import { isMarketingCatalogKey, marketingCatalogId } from "../domain/ids";
import type { MarketingUseCase } from "../domain/types";
import { MarketingValidationError } from "../errors";
import type { MarketingIndustryRepository, MarketingUseCaseRepository } from "../repositories/types";
import { createStamps, requireFound, updateStamps } from "./scope";
import { createCountryService } from "./country";
import { canonicalUseCaseKey } from "../taxonomy/seed";
import { createIndustryService } from "./industry";

const createSchema = z.object({
  key: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  description: z.string().max(4000).optional(),
  industryIds: z.array(z.string()).optional(),
  countryCodes: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  idempotencyKey: z.string().max(80).optional(),
});

function requireCatalogKey(raw: string): string {
  const key = raw.trim();
  if (!isMarketingCatalogKey(key)) throw new MarketingValidationError(`key de caso de uso inválido: ${raw}`);
  return key;
}

function countryScope(countryCodes: string[]) {
  return {
    countryCodes,
    appliesToAllCountries: countryCodes.length === 0,
  };
}

export function createUseCaseService(
  useCases: MarketingUseCaseRepository,
  industries: MarketingIndustryRepository,
) {
  const countries = createCountryService();
  const industryService = createIndustryService(industries);

  async function assertCountryCodes(countryCodes: string[]) {
    return countryCodes.map((c) => countries.validateCountryCode(c));
  }

  return {
    async getByKey(ctx: MarketingServiceContext, key: string) {
      return useCases.findByKey(ctx.workspaceId, requireCatalogKey(key));
    },

    async resolveUseCase(ctx: MarketingServiceContext, idOrKey: string) {
      const direct = await useCases.getById(ctx.workspaceId, idOrKey);
      if (direct) return direct;
      if (isMarketingCatalogKey(idOrKey)) {
        const found = await useCases.findByKey(ctx.workspaceId, idOrKey);
        if (found) return found;
        const canonical = canonicalUseCaseKey(idOrKey);
        if (canonical !== idOrKey) return useCases.findByKey(ctx.workspaceId, canonical);
      }
      return null;
    },

    async createUseCase(ctx: MarketingServiceContext, input: z.input<typeof createSchema>) {
      const parsed = createSchema.safeParse(input);
      if (!parsed.success) throw new MarketingValidationError("Caso de uso inválido", parsed.error.flatten());
      const key = requireCatalogKey(parsed.data.key);
      const existing = await useCases.findByKey(ctx.workspaceId, key);
      if (existing) throw new MarketingValidationError("Ya existe un caso de uso con esa key", { id: existing.id, key });
      const industryIds = await industryService.expandAssignedIndustryKeys(ctx, parsed.data.industryIds || []);
      const countryCodes = await assertCountryCodes(parsed.data.countryCodes || []);
      const stamps = createStamps(ctx);
      const doc: MarketingUseCase = {
        id: marketingCatalogId(ctx.workspaceId, "use_case", key),
        workspaceId: ctx.workspaceId,
        key,
        name: parsed.data.name.trim(),
        description: parsed.data.description,
        industryIds,
        tagIds: parsed.data.tagIds,
        active: parsed.data.active ?? true,
        ...countryScope(countryCodes),
        ...stamps,
      };
      await useCases.create(doc);
      return doc;
    },

    async getUseCase(ctx: MarketingServiceContext, id: string) {
      return requireFound(await useCases.getById(ctx.workspaceId, id), "Caso de uso", id);
    },

    async updateUseCase(ctx: MarketingServiceContext, id: string, input: Partial<z.input<typeof createSchema>>) {
      const current = await this.getUseCase(ctx, id);
      if (input.key && requireCatalogKey(input.key) !== current.key) {
        throw new MarketingValidationError("La key de caso de uso es inmutable");
      }
      const industryIds = input.industryIds
        ? await industryService.expandAssignedIndustryKeys(ctx, input.industryIds)
        : current.industryIds;
      const countryCodes = input.countryCodes
        ? await assertCountryCodes(input.countryCodes)
        : current.countryCodes;
      const patch: Partial<MarketingUseCase> = {
        ...updateStamps(ctx),
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        industryIds,
        ...countryScope(countryCodes),
        ...(input.active !== undefined ? { active: input.active } : {}),
      };
      await useCases.update(ctx.workspaceId, id, patch);
      return { ...current, ...patch };
    },

    async listUseCases(ctx: MarketingServiceContext, cursor?: string, limit?: number) {
      return useCases.list(ctx.workspaceId, cursor, limit);
    },
  };
}

export type UseCaseService = ReturnType<typeof createUseCaseService>;
