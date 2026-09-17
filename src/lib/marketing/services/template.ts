import { z } from "zod";
import type { MarketingServiceContext } from "../context";
import { newMarketingEntityId } from "../domain/ids";
import type { MarketingMessageTemplate } from "../domain/types";
import { MarketingConflictError, MarketingValidationError } from "../errors";
import type { MarketingTemplateRepository } from "../repositories/types";
import { nowIso } from "../persistence/timestamps";
import { createStamps, requireFound, updateStamps } from "./scope";

const createSchema = z.object({
  name: z.string().min(1).max(160),
  language: z.string().min(2).max(8).optional(),
  countryCodes: z.array(z.string().length(2)).optional(),
  industryIds: z.array(z.string()).optional(),
  useCaseIds: z.array(z.string()).optional(),
  subject: z.string().max(300).optional(),
  html: z.string().max(80_000).optional(),
  text: z.string().max(40_000).optional(),
  idempotencyKey: z.string().max(80).optional(),
});

const versionSchema = z.object({
  subject: z.string().max(300).optional(),
  html: z.string().max(80_000).optional(),
  text: z.string().max(40_000).optional(),
});

const metadataSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  language: z.string().min(2).max(8).optional(),
  countryCodes: z.array(z.string().length(2)).optional(),
  industryIds: z.array(z.string()).optional(),
  useCaseIds: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export function createTemplateService(templates: MarketingTemplateRepository) {
  return {
    async createTemplate(ctx: MarketingServiceContext, input: z.input<typeof createSchema>) {
      const parsed = createSchema.safeParse(input);
      if (!parsed.success) throw new MarketingValidationError("Template inválido", parsed.error.flatten());
      const stamps = createStamps(ctx);
      const template: MarketingMessageTemplate = {
        id: newMarketingEntityId(),
        workspaceId: ctx.workspaceId,
        name: parsed.data.name.trim(),
        channel: "email",
        countryCodes: parsed.data.countryCodes || [],
        industryIds: parsed.data.industryIds || [],
        useCaseIds: parsed.data.useCaseIds || [],
        language: parsed.data.language || "es",
        currentVersion: 0,
        active: true,
        deletedAt: null,
        ...stamps,
      };
      await templates.create(template);
      const first = await templates.appendVersion(ctx.workspaceId, template.id, {
        subject: parsed.data.subject,
        html: parsed.data.html,
        text: parsed.data.text,
        createdAt: nowIso(),
        createdBy: ctx.actorId,
      });
      return first;
    },

    async getTemplate(ctx: MarketingServiceContext, id: string) {
      return requireFound(await templates.getById(ctx.workspaceId, id), "Template", id);
    },

    async listTemplates(ctx: MarketingServiceContext, cursor?: string, limit?: number) {
      return templates.list(ctx.workspaceId, cursor, limit);
    },

    async updateTemplateMetadata(ctx: MarketingServiceContext, id: string, input: z.input<typeof metadataSchema>) {
      const parsed = metadataSchema.safeParse(input);
      if (!parsed.success) throw new MarketingValidationError("Metadata inválida", parsed.error.flatten());
      await this.getTemplate(ctx, id);
      await templates.updateMetadata(ctx.workspaceId, id, { ...parsed.data, ...updateStamps(ctx) });
      return this.getTemplate(ctx, id);
    },

    async createTemplateVersion(ctx: MarketingServiceContext, templateId: string, input: z.input<typeof versionSchema>) {
      const parsed = versionSchema.safeParse(input);
      if (!parsed.success) throw new MarketingValidationError("Versión inválida", parsed.error.flatten());
      await this.getTemplate(ctx, templateId);
      try {
        return await templates.appendVersion(ctx.workspaceId, templateId, {
          subject: parsed.data.subject,
          html: parsed.data.html,
          text: parsed.data.text,
          createdAt: nowIso(),
          createdBy: ctx.actorId,
        });
      } catch (e) {
        if (e instanceof Error && e.message === "version_conflict") {
          throw new MarketingConflictError("Conflicto de versión de template");
        }
        throw e;
      }
    },

    async getTemplateVersion(ctx: MarketingServiceContext, templateId: string, version: number) {
      return requireFound(
        await templates.getVersion(ctx.workspaceId, templateId, version),
        "Versión de template",
        `${templateId}@${version}`,
      );
    },

    async listTemplateVersions(ctx: MarketingServiceContext, templateId: string) {
      await this.getTemplate(ctx, templateId);
      return templates.listVersions(ctx.workspaceId, templateId);
    },
  };
}

export type TemplateService = ReturnType<typeof createTemplateService>;
