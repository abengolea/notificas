import { z } from "zod";
import type { MarketingServiceContext } from "../context";
import { contactIdForEmail, isValidEmail } from "../csv";
import { newMarketingEntityId } from "../domain/ids";
import { isMarketingCommercialStageId } from "../domain/commercial-stages";
import type { MarketingContactRecord, MarketingContactRepository, MarketingCompanyRepository, ContactSearchFilters } from "../repositories/types";
import { MarketingValidationError, MarketingWorkspaceMismatchError } from "../errors";
import { normalizeLinkedInUrl, normalizeMarketingCountryCode, normalizeMarketingEmail } from "../normalizers";
import { isMarketingStage } from "../stages";
import { nowIso } from "../persistence/timestamps";
import { assertWorkspaceOwned, createStamps, requireFound, resolveContactWorkspace, updateStamps } from "./scope";

const linkedinStatusSchema = z.enum([
  "not_contacted",
  "connection_ready",
  "connection_sent",
  "connected",
  "message_ready",
  "message_sent",
  "follow_up_due",
  "follow_up_sent",
  "replied",
  "interested",
  "not_interested",
  "do_not_contact",
  "not_found",
]);

const contactFieldsSchema = z.object({
  email: z.string().max(254).optional(),
  linkedinUrl: z.string().max(500).optional(),
  linkedinStatus: linkedinStatusSchema.optional(),
  linkedinLastContactAt: z.string().datetime().nullable().optional(),
  linkedinNextActionAt: z.string().datetime().nullable().optional(),
  linkedinNotes: z.string().max(8000).optional(),
  prospectingSource: z.enum(["clay", "linkedin", "web", "manual", "association", "other"]).optional(),
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

const createSchema = contactFieldsSchema.superRefine((value, ctx) => {
  if (!value.email?.trim() && !value.linkedinUrl?.trim()) {
    ctx.addIssue({ code: "custom", message: "Se requiere email o linkedinUrl", path: ["email"] });
  }
});

const updateSchema = contactFieldsSchema.partial().extend({
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
      const email = data.email?.trim() ? normalizeMarketingEmail(data.email) : "";
      if (email && !isValidEmail(email)) throw new MarketingValidationError("Email inválido");
      const linkedinUrl = data.linkedinUrl?.trim() ? normalizeLinkedInUrl(data.linkedinUrl) : null;
      if (data.linkedinUrl && !linkedinUrl) throw new MarketingValidationError("URL de LinkedIn inválida");
      const country = normalizeMarketingCountryCode(data.countryCode || data.country || "");
      if (!country) throw new MarketingValidationError("País inválido o faltante");
      assertStages("new", data.commercialStageId);
      await assertCompany(ctx, data.companyId);
      const stamps = createStamps(ctx);
      const [emailExisting, linkedinExisting] = await Promise.all([
        email ? contacts.getByEmail(email) : Promise.resolve(null),
        linkedinUrl ? contacts.getByLinkedInUrl(ctx.workspaceId, linkedinUrl) : Promise.resolve(null),
      ]);
      if (
        emailExisting &&
        linkedinExisting &&
        emailExisting.id !== linkedinExisting.id
      ) {
        throw new MarketingValidationError("email y linkedinUrl pertenecen a contactos diferentes");
      }
      if (email && linkedinExisting && linkedinExisting.id !== contactIdForEmail(email)) {
        throw new MarketingValidationError("linkedinUrl ya pertenece a otro contacto");
      }
      const existing = emailExisting || linkedinExisting;
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
          linkedinUrl: linkedinUrl ?? existing.linkedinUrl,
          linkedinStatus: data.linkedinStatus ?? existing.linkedinStatus,
          linkedinLastContactAt: data.linkedinLastContactAt ?? existing.linkedinLastContactAt,
          linkedinNextActionAt: data.linkedinNextActionAt ?? existing.linkedinNextActionAt,
          linkedinNotes: data.linkedinNotes?.trim() ?? existing.linkedinNotes,
          prospectingSource: data.prospectingSource ?? existing.prospectingSource,
          workspaceId: ctx.workspaceId,
          ...updateStamps(ctx),
        });
        return requireFound(await contacts.getById(existing.id), "Contacto", existing.id);
      }
      const id = email ? contactIdForEmail(email) : newMarketingEntityId();
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
        linkedinUrl: linkedinUrl || undefined,
        linkedinStatus: data.linkedinStatus || (linkedinUrl ? "not_contacted" : undefined),
        linkedinLastContactAt: data.linkedinLastContactAt,
        linkedinNextActionAt: data.linkedinNextActionAt,
        linkedinNotes: data.linkedinNotes?.trim(),
        prospectingSource: data.prospectingSource,
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
      if (data.email !== undefined) {
        const email = data.email.trim() ? normalizeMarketingEmail(data.email) : "";
        if (email && !isValidEmail(email)) throw new MarketingValidationError("Email inválido");
        if (!email && !current.linkedinUrl) {
          throw new MarketingValidationError("Se requiere email o linkedinUrl");
        }
        if (email) {
          const duplicate = await contacts.getByEmail(email);
          if (duplicate && duplicate.id !== id) throw new MarketingValidationError("email ya pertenece a otro contacto");
        }
        patch.email = email;
        patch.emailKey = email;
        patch.normalizedEmail = email;
      }
      if (data.name !== undefined) patch.name = data.name.trim();
      if (data.company !== undefined) patch.company = data.company.trim();
      if (data.companyId !== undefined) patch.companyId = data.companyId;
      if (data.title !== undefined) patch.title = data.title.trim();
      if (data.notes !== undefined) patch.notes = data.notes.trim();
      if (data.linkedinUrl !== undefined) {
        const linkedinUrl = normalizeLinkedInUrl(data.linkedinUrl);
        if (!linkedinUrl) throw new MarketingValidationError("URL de LinkedIn inválida");
        const duplicate = await contacts.getByLinkedInUrl(ctx.workspaceId, linkedinUrl);
        if (duplicate && duplicate.id !== id) throw new MarketingValidationError("linkedinUrl ya pertenece a otro contacto");
        patch.linkedinUrl = linkedinUrl;
      }
      if (data.linkedinStatus !== undefined) patch.linkedinStatus = data.linkedinStatus;
      if (data.linkedinLastContactAt !== undefined) patch.linkedinLastContactAt = data.linkedinLastContactAt;
      if (data.linkedinNextActionAt !== undefined) patch.linkedinNextActionAt = data.linkedinNextActionAt;
      if (data.linkedinNotes !== undefined) patch.linkedinNotes = data.linkedinNotes.trim();
      if (data.prospectingSource !== undefined) patch.prospectingSource = data.prospectingSource;
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
