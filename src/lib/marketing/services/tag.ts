import { z } from "zod";
import type { MarketingServiceContext } from "../context";
import { isMarketingCatalogKey, marketingCatalogId } from "../domain/ids";
import type { MarketingTag } from "../domain/types";
import { MarketingValidationError } from "../errors";
import { normalizeMarketingCompanyName } from "../normalizers";
import type { MarketingTagRepository } from "../repositories/types";
import { createStamps, requireFound, updateStamps } from "./scope";

const createSchema = z.object({
  key: z.string().min(1).max(80),
  name: z.string().min(1).max(60),
  active: z.boolean().optional(),
  idempotencyKey: z.string().max(80).optional(),
});

function requireCatalogKey(raw: string): string {
  const key = raw.trim();
  if (!isMarketingCatalogKey(key)) throw new MarketingValidationError(`key de tag inválido: ${raw}`);
  return key;
}

export function createTagService(tags: MarketingTagRepository) {
  return {
    async getByKey(ctx: MarketingServiceContext, key: string) {
      return tags.findByKey(ctx.workspaceId, requireCatalogKey(key));
    },

    async createTag(ctx: MarketingServiceContext, input: z.input<typeof createSchema>) {
      const parsed = createSchema.safeParse(input);
      if (!parsed.success) throw new MarketingValidationError("Tag inválido", parsed.error.flatten());
      const key = requireCatalogKey(parsed.data.key);
      const normalizedName = normalizeMarketingCompanyName(parsed.data.name);
      if (!normalizedName) throw new MarketingValidationError("Nombre de tag vacío");
      const existingKey = await tags.findByKey(ctx.workspaceId, key);
      if (existingKey) throw new MarketingValidationError("Ya existe un tag con esa key", { id: existingKey.id, key });
      const existing = await tags.findByNormalizedName(ctx.workspaceId, normalizedName);
      if (existing) throw new MarketingValidationError("Ya existe un tag con ese nombre", { id: existing.id });
      const stamps = createStamps(ctx);
      const doc: MarketingTag = {
        id: marketingCatalogId(ctx.workspaceId, "tag", key),
        workspaceId: ctx.workspaceId,
        key,
        name: parsed.data.name.trim(),
        normalizedName,
        active: parsed.data.active ?? true,
        ...stamps,
      };
      await tags.create(doc);
      return doc;
    },
    async getTag(ctx: MarketingServiceContext, id: string) {
      return requireFound(await tags.getById(ctx.workspaceId, id), "Tag", id);
    },
    async updateTag(ctx: MarketingServiceContext, id: string, input: Partial<z.input<typeof createSchema>>) {
      const current = await this.getTag(ctx, id);
      if (input.key && requireCatalogKey(input.key) !== current.key) {
        throw new MarketingValidationError("La key de tag es inmutable");
      }
      const patch: Partial<MarketingTag> = { ...updateStamps(ctx) };
      if (input.name) {
        patch.name = input.name.trim();
        patch.normalizedName = normalizeMarketingCompanyName(input.name);
        const clash = await tags.findByNormalizedName(ctx.workspaceId, patch.normalizedName);
        if (clash && clash.id !== id) throw new MarketingValidationError("Ya existe un tag con ese nombre");
      }
      if (input.active !== undefined) patch.active = input.active;
      await tags.update(ctx.workspaceId, id, patch);
      return { ...current, ...patch };
    },
    async listTags(ctx: MarketingServiceContext, cursor?: string, limit?: number) {
      return tags.list(ctx.workspaceId, cursor, limit);
    },
  };
}

export type TagService = ReturnType<typeof createTagService>;
