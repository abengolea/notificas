import { z } from "zod";
import type { MarketingServiceContext } from "../context";
import { newMarketingEntityId } from "../domain/ids";
import type { MarketingSource, MarketingSourceType } from "../domain/types";
import { MarketingValidationError } from "../errors";
import { normalizeMarketingUrl } from "../normalizers";
import { marketingSourceTypeSchema } from "../schemas";
import type { MarketingSourceRepository } from "../repositories/types";
import { createStamps, requireFound } from "./scope";

const createSchema = z.object({
  type: marketingSourceTypeSchema,
  name: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  url: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
  idempotencyKey: z.string().max(80).optional(),
});

export function createSourceService(sources: MarketingSourceRepository) {
  return {
    async createSource(ctx: MarketingServiceContext, input: z.input<typeof createSchema>) {
      const parsed = createSchema.safeParse(input);
      if (!parsed.success) throw new MarketingValidationError("Fuente inválida", parsed.error.flatten());
      if (parsed.data.metadata && "prompt" in parsed.data.metadata) {
        throw new MarketingValidationError("No almacenar prompts completos en metadata de fuentes");
      }
      const stamps = createStamps(ctx);
      const doc: MarketingSource = {
        id: newMarketingEntityId(),
        workspaceId: ctx.workspaceId,
        type: parsed.data.type as MarketingSourceType,
        name: parsed.data.name?.trim(),
        description: parsed.data.description?.trim(),
        url: parsed.data.url ? normalizeMarketingUrl(parsed.data.url) || parsed.data.url : undefined,
        metadata: parsed.data.metadata,
        ...stamps,
      };
      await sources.create(doc);
      return doc;
    },
    async getSource(ctx: MarketingServiceContext, id: string) {
      return requireFound(await sources.getById(ctx.workspaceId, id), "Fuente", id);
    },
    async listSources(ctx: MarketingServiceContext, cursor?: string, limit?: number) {
      return sources.list(ctx.workspaceId, cursor, limit);
    },
  };
}

export type SourceService = ReturnType<typeof createSourceService>;
