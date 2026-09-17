import { z } from "zod";
import type { MarketingServiceContext } from "../context";
import { MARKETING_COUNTRY_CATALOG_SEED, MARKETING_COUNTRY_SEED_CORE } from "../domain/country-seed";
import { marketingCatalogId } from "../domain/ids";
import type { MarketingCountry } from "../domain/types";
import { MarketingValidationError } from "../errors";
import { normalizeMarketingCountryCode } from "../normalizers";
import type { MarketingCountryRepository } from "../repositories/types";
import { createStamps, requireFound, updateStamps } from "./scope";

const createSchema = z.object({
  code: z.string().min(2).max(40),
  name: z.string().min(1).max(80),
  defaultLanguage: z.string().min(2).max(8).optional(),
  active: z.boolean().optional(),
  idempotencyKey: z.string().max(80).optional(),
});

export function createCountryService(countries?: MarketingCountryRepository) {
  function requireRepo(): MarketingCountryRepository {
    if (!countries) {
      throw new MarketingValidationError("El catálogo persistido de países no está disponible en este contexto");
    }
    return countries;
  }

  return {
    listCountries() {
      return MARKETING_COUNTRY_CATALOG_SEED.map((row) => ({ ...row }));
    },
    getCountry(code: string) {
      const normalized = normalizeMarketingCountryCode(code);
      if (!normalized) return null;
      return MARKETING_COUNTRY_CATALOG_SEED.find((row) => row.code === normalized) || null;
    },
    validateCountryCode(code: string): string {
      const normalized = normalizeMarketingCountryCode(code);
      if (!normalized) throw new MarketingValidationError(`País inválido: ${code}`);
      const known =
        MARKETING_COUNTRY_CATALOG_SEED.some((row) => row.code === normalized) ||
        MARKETING_COUNTRY_SEED_CORE.some((row) => row.code === normalized);
      if (!known) throw new MarketingValidationError(`País no habilitado en el catálogo CRM: ${normalized}`);
      return normalized;
    },

    async createCountry(ctx: MarketingServiceContext, input: z.input<typeof createSchema>) {
      const repo = requireRepo();
      const parsed = createSchema.safeParse(input);
      if (!parsed.success) throw new MarketingValidationError("País inválido", parsed.error.flatten());
      const code = this.validateCountryCode(parsed.data.code);
      const existing = await repo.findByKey(ctx.workspaceId, code);
      if (existing) throw new MarketingValidationError("Ya existe un país con ese código", { id: existing.id, key: code });
      const stamps = createStamps(ctx);
      const doc: MarketingCountry = {
        id: marketingCatalogId(ctx.workspaceId, "country", code),
        workspaceId: ctx.workspaceId,
        key: code,
        code,
        name: parsed.data.name.trim(),
        defaultLanguage: parsed.data.defaultLanguage,
        active: parsed.data.active ?? true,
        ...stamps,
      };
      await repo.create(doc);
      return doc;
    },

    async getPersistedCountry(ctx: MarketingServiceContext, id: string) {
      return requireFound(await requireRepo().getById(ctx.workspaceId, id), "País", id);
    },

    async getByKey(ctx: MarketingServiceContext, key: string) {
      const code = this.validateCountryCode(key);
      return requireRepo().findByKey(ctx.workspaceId, code);
    },

    async updateCountry(ctx: MarketingServiceContext, id: string, input: Partial<z.input<typeof createSchema>>) {
      const repo = requireRepo();
      const current = await this.getPersistedCountry(ctx, id);
      if (input.code && this.validateCountryCode(input.code) !== current.code) {
        throw new MarketingValidationError("El código de país es inmutable");
      }
      const patch: Partial<MarketingCountry> = { ...updateStamps(ctx) };
      if (input.name) patch.name = input.name.trim();
      if (input.defaultLanguage !== undefined) patch.defaultLanguage = input.defaultLanguage;
      if (input.active !== undefined) patch.active = input.active;
      await repo.update(ctx.workspaceId, id, patch);
      return { ...current, ...patch };
    },

    async listPersistedCountries(ctx: MarketingServiceContext, cursor?: string, limit?: number) {
      return requireRepo().list(ctx.workspaceId, cursor, limit);
    },
  };
}

export type CountryService = ReturnType<typeof createCountryService>;
