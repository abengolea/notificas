import { z } from "zod";
import type { MarketingServiceContext } from "../context";
import { isMarketingCatalogKey, marketingCatalogId } from "../domain/ids";
import type { MarketingIndustry } from "../domain/types";
import { MarketingValidationError } from "../errors";
import { normalizeMarketingCompanyName } from "../normalizers";
import type { MarketingIndustryRepository } from "../repositories/types";
import { canonicalIndustryKey, expandSeedIndustryKeys, seedIndustryByKey } from "../taxonomy/seed";
import { createStamps, requireFound, updateStamps } from "./scope";

const createSchema = z.object({
  key: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  parentIndustryId: z.string().max(128).optional(),
  active: z.boolean().optional(),
  idempotencyKey: z.string().max(80).optional(),
});

function requireCatalogKey(raw: string): string {
  const key = raw.trim();
  if (!isMarketingCatalogKey(key)) throw new MarketingValidationError(`key de industria inválido: ${raw}`);
  return key;
}

export function createIndustryService(industries: MarketingIndustryRepository) {
  return {
    async resolveIndustry(ctx: MarketingServiceContext, idOrKey: string) {
      const direct = await industries.getById(ctx.workspaceId, idOrKey);
      if (direct) return direct;
      if (isMarketingCatalogKey(idOrKey)) return industries.findByKey(ctx.workspaceId, idOrKey);
      return null;
    },

    async getByKey(ctx: MarketingServiceContext, key: string) {
      return industries.findByKey(ctx.workspaceId, requireCatalogKey(key));
    },

    async expandAssignedIndustryKeys(ctx: MarketingServiceContext, keys: string[]) {
      const out = new Set<string>();
      for (const raw of keys) {
        const canonical = canonicalIndustryKey(raw);
        let current = await this.resolveIndustry(ctx, raw);
        if (!current && canonical !== raw) current = await this.resolveIndustry(ctx, canonical);
        if (!current) {
          const seedKeys = expandSeedIndustryKeys([canonical]);
          if (seedKeys.length && seedIndustryByKey(canonical)) {
            for (const key of seedKeys) out.add(key);
            continue;
          }
          throw new MarketingValidationError(`industryId inexistente: ${raw}`);
        }
        const seen = new Set<string>();
        while (current) {
          if (seen.has(current.id)) throw new MarketingValidationError("Ciclo en parentIndustryId");
          seen.add(current.id);
          out.add(current.key);
          current = current.parentIndustryId
            ? await industries.getById(ctx.workspaceId, current.parentIndustryId)
            : null;
        }
      }
      return [...out].sort();
    },

    async createIndustry(ctx: MarketingServiceContext, input: z.input<typeof createSchema>) {
      const parsed = createSchema.safeParse(input);
      if (!parsed.success) throw new MarketingValidationError("Industria inválida", parsed.error.flatten());
      const key = requireCatalogKey(parsed.data.key);
      const normalizedName = normalizeMarketingCompanyName(parsed.data.name);
      if (!normalizedName) throw new MarketingValidationError("Nombre de industria vacío");
      const existingKey = await industries.findByKey(ctx.workspaceId, key);
      if (existingKey) throw new MarketingValidationError("Ya existe una industria con esa key", { id: existingKey.id, key });
      const existingName = await industries.findByNormalizedName(ctx.workspaceId, normalizedName);
      if (existingName) throw new MarketingValidationError("Ya existe una industria con ese nombre", { id: existingName.id });
      let parentIndustryId: string | undefined;
      if (parsed.data.parentIndustryId) {
        const parent = await this.resolveIndustry(ctx, parsed.data.parentIndustryId);
        if (!parent) throw new MarketingValidationError("parentIndustryId no existe en este workspace");
        parentIndustryId = parent.id;
      }
      const stamps = createStamps(ctx);
      const doc: MarketingIndustry = {
        id: marketingCatalogId(ctx.workspaceId, "industry", key),
        workspaceId: ctx.workspaceId,
        key,
        name: parsed.data.name.trim(),
        normalizedName,
        parentIndustryId,
        active: parsed.data.active ?? true,
        ...stamps,
      };
      await industries.create(doc);
      return doc;
    },

    async getIndustry(ctx: MarketingServiceContext, id: string) {
      return requireFound(await industries.getById(ctx.workspaceId, id), "Industria", id);
    },

    async updateIndustry(ctx: MarketingServiceContext, id: string, input: Partial<z.input<typeof createSchema>>) {
      const current = await this.getIndustry(ctx, id);
      if (input.key && requireCatalogKey(input.key) !== current.key) {
        throw new MarketingValidationError("La key de industria es inmutable");
      }
      let parentIndustryId = current.parentIndustryId;
      if (input.parentIndustryId !== undefined) {
        if (!input.parentIndustryId) {
          parentIndustryId = undefined;
        } else {
          const parent = await this.resolveIndustry(ctx, input.parentIndustryId);
          if (!parent) throw new MarketingValidationError("parentIndustryId no existe en este workspace");
          if (parent.id === id) throw new MarketingValidationError("Una industria no puede ser padre de sí misma");
          parentIndustryId = parent.id;
        }
      }
      const patch: Partial<MarketingIndustry> = { ...updateStamps(ctx) };
      if (input.name) {
        patch.name = input.name.trim();
        patch.normalizedName = normalizeMarketingCompanyName(input.name);
        const clash = await industries.findByNormalizedName(ctx.workspaceId, patch.normalizedName);
        if (clash && clash.id !== id) throw new MarketingValidationError("Ya existe una industria con ese nombre");
      }
      if (input.parentIndustryId !== undefined) patch.parentIndustryId = parentIndustryId;
      if (input.active !== undefined) patch.active = input.active;
      await industries.update(ctx.workspaceId, id, patch);
      return { ...current, ...patch };
    },

    async listIndustries(ctx: MarketingServiceContext, cursor?: string, limit?: number) {
      return industries.list(ctx.workspaceId, cursor, limit);
    },
  };
}

export type IndustryService = ReturnType<typeof createIndustryService>;
