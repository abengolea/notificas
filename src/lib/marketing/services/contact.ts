import { z } from "zod";
import type { MarketingServiceContext } from "../context";
import { contactIdForEmail, isValidEmail } from "../csv";
import { isMarketingCommercialStageId } from "../domain/commercial-stages";
import type { MarketingContactRecord, MarketingContactRepository, MarketingCompanyRepository, ContactSearchFilters } from "../repositories/types";
import { MarketingValidationError, MarketingWorkspaceMismatchError } from "../errors";
import { normalizeMarketingCountryCode, normalizeMarketingEmail } from "../normalizers";
import { isMarketingStage } from "../stages";
import { nowIso } from "../persistence/timestamps";
import { assertWorkspaceOwned, createStamps, requireFound, resolveContactWorkspace, updateStamps } from "./scope";

const createSchema = z.object({
  email: z.string().min(3).max(254),
  name: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  companyId: z.string().max(128).optional(),
  title: z.string().max(200).optional(),
  country: z.string().min(2).max(40).optional(),
  countryCode: z.string().min(2).max(40).optional(),
  notes: z.string().max(8000).optional(),
  tags: z.array(z.string().max(40)).optional(),
  listIds: z.array(z.string()).optional(),
  commercialStageId: z.string().max(80).optional(),
  ownerId: z.string().max(128).optional(),
  useCaseIds: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
  sourceIds: z.array(z.string()).optional(),
  idempotencyKey: z.string().max(80).optional(),
});

const updateSchema = createSchema.partial().extend({
  stage: z.string().optional(),
  stageManual: z.boolean().optional(),
});

export function createContactService(
  contacts: MarketingContactRepository,
  companies: MarketingCompanyRepository,
) {
  async function assertCompany(ctx: MarketingServiceContext, companyId: string | undefined) {
    if (!companyId) return;
    const company = await companies.getById(ctx.workspaceId, companyId);
    if (!company || company.deletedAt) {
      throw new MarketingValidationError("companyId no existe en este workspace");
    }
    if (company.workspaceId !== ctx.workspaceId) throw new MarketingWorkspaceMismatchError();
  }

  function assertStages(stage?: string, commercialStageId?: string) {
    if (stage && !isMarketingStage(stage)) {
      throw new MarketingValidationError(`stage de email inválido: ${stage}`);
    }
    if (commercialStageId && isMarketingStage(commercialStageId)) {
      throw new MarketingValidationError("commercialStageId no debe reutilizar el engagement stage de email");
    }
    if (commercialStageId && !isMarketingCommercialStageId(commercialStageId)) {
      throw new MarketingValidationError(`commercialStageId desconocido: ${commercialStageId}`);
    }
  }

  return {
    async createContact(ctx: MarketingServiceContext, input: z.input<typeof createSchema>) {
      const parsed = createSchema.safeParse(input);
      if (!parsed.success) throw new MarketingValidationError("Contacto inválido", parsed.error.flatten());
      const data = parsed.data;
      const email = normalizeMarketingEmail(data.email);
      if (!isValidEmail(email)) throw new MarketingValidationError("Email inválido");
      const country = normalizeMarketingCountryCode(data.countryCode || data.country || "");
      if (!country) throw new MarketingValidationError("País inválido o faltante");
      assertStages("new", data.commercialStageId);
      await assertCompany(ctx, data.companyId);
      const stamps = createStamps(ctx);
      const existing = await contacts.getByEmail(email);
      if (existing) {
        const resolved = resolveContactWorkspace(existing.workspaceId);
        if (resolved !== ctx.workspaceId) throw new MarketingWorkspaceMismatchError();
        await contacts.update(existing.id, {
          name: data.name?.trim() ?? existing.name,
          company: data.company?.trim() ?? existing.company,
          companyId: data.companyId ?? existing.companyId,
          title: data.title?.trim() ?? existing.title,
          country: country as MarketingContactRecord["country"],
          countryCode: country,
          notes: data.notes?.trim() ?? existing.notes,
          commercialStageId: data.commercialStageId ?? existing.commercialStageId,
          workspaceId: ctx.workspaceId,
          ...updateStamps(ctx),
        });
        return requireFound(await contacts.getById(existing.id), "Contacto", existing.id);
      }
      const id = contactIdForEmail(email);
      const doc: MarketingContactRecord = {
        id,
        email,
        emailKey: email,
        normalizedEmail: email,
        name: data.name?.trim() || "",
        company: data.company?.trim() || "",
        title: data.title?.trim() || "",
        country: country as MarketingContactRecord["country"],
        countryCode: country,
        notes: data.notes?.trim() || "",
        stage: "new",
        stageManual: false,
        tags: data.tags || [],
        source: "manual",
        listIds: data.listIds || [],
        lastCampaignId: null,
        lastSendId: null,
        lastSentAt: null,
        lastOpenedAt: null,
        lastClickedAt: null,
        lastRepliedAt: null,
        workspaceId: ctx.workspaceId,
        companyId: data.companyId,
        commercialStageId: data.commercialStageId,
        ownerId: data.ownerId,
        useCaseIds: data.useCaseIds,
        tagIds: data.tagIds,
        sourceIds: data.sourceIds,
        deletedAt: null,
        createdAt: stamps.createdAt,
        updatedAt: stamps.updatedAt,
        createdBy: stamps.createdBy,
        updatedBy: stamps.updatedBy,
      };
      await contacts.create(doc);
      return requireFound(await contacts.getById(id), "Contacto", id);
    },

    async getContact(ctx: MarketingServiceContext, id: string) {
      const doc = requireFound(await contacts.getById(id), "Contacto", id);
      assertWorkspaceOwned(ctx, doc.workspaceId, { legacyContact: true });
      if (doc.deletedAt) throw new MarketingValidationError("Contacto eliminado");
      return doc;
    },

    async updateContact(ctx: MarketingServiceContext, id: string, input: z.input<typeof updateSchema>) {
      const current = await this.getContact(ctx, id);
      const parsed = updateSchema.safeParse(input);
      if (!parsed.success) throw new MarketingValidationError("Contacto inválido", parsed.error.flatten());
      const data = parsed.data;
      assertStages(data.stage, data.commercialStageId ?? current.commercialStageId);
      await assertCompany(ctx, data.companyId);
      const country = data.countryCode || data.country
        ? normalizeMarketingCountryCode(data.countryCode || data.country || "")
        : undefined;
      if ((data.countryCode || data.country) && !country) throw new MarketingValidationError("País inválido");
      const patch: Partial<MarketingContactRecord> = {
        workspaceId: ctx.workspaceId,
        ...updateStamps(ctx),
      };
      if (data.name !== undefined) patch.name = data.name.trim();
      if (data.company !== undefined) patch.company = data.company.trim();
      if (data.companyId !== undefined) patch.companyId = data.companyId;
      if (data.title !== undefined) patch.title = data.title.trim();
      if (data.notes !== undefined) patch.notes = data.notes.trim();
      if (data.commercialStageId !== undefined) patch.commercialStageId = data.commercialStageId;
      if (data.ownerId !== undefined) patch.ownerId = data.ownerId;
      if (data.listIds !== undefined) patch.listIds = data.listIds;
      if (data.tags !== undefined) patch.tags = data.tags;
      if (data.stage && isMarketingStage(data.stage)) {
        patch.stage = data.stage;
        patch.stageManual = data.stageManual ?? true;
      }
      if (country) {
        patch.country = country as MarketingContactRecord["country"];
        patch.countryCode = country;
      }
      await contacts.update(id, patch);
      return this.getContact(ctx, id);
    },

    async deleteContact(ctx: MarketingServiceContext, id: string) {
      await this.getContact(ctx, id);
      await contacts.update(id, {
        deletedAt: nowIso(),
        deletedBy: ctx.actorId || null,
        workspaceId: ctx.workspaceId,
        ...updateStamps(ctx),
      });
    },

    async searchContacts(ctx: MarketingServiceContext, filters: ContactSearchFilters = {}) {
      if (filters.query && filters.query.includes("@")) {
        const found = await contacts.getByEmail(normalizeMarketingEmail(filters.query));
        if (!found || found.deletedAt) return { items: [] };
        try {
          assertWorkspaceOwned(ctx, found.workspaceId, { legacyContact: true });
        } catch {
          return { items: [] };
        }
        return { items: [found] };
      }
      return contacts.search(ctx.workspaceId, filters);
    },
  };
}

export type ContactService = ReturnType<typeof createContactService>;
