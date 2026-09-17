import { z } from "zod";
import type { MarketingServiceContext } from "../context";
import { isMarketingCommercialStageId } from "../domain/commercial-stages";
import { newMarketingEntityId } from "../domain/ids";
import type { MarketingOpportunity } from "../domain/types";
import { MarketingValidationError } from "../errors";
import { isMarketingStage } from "../stages";
import type {
  MarketingCompanyRepository,
  MarketingContactRepository,
  MarketingIndustryRepository,
  MarketingOpportunityRepository,
  MarketingUseCaseRepository,
  OpportunitySearchFilters,
} from "../repositories/types";
import { nowIso } from "../persistence/timestamps";
import { createStamps, requireFound, resolveContactWorkspace, updateStamps } from "./scope";
import { createCountryService } from "./country";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  companyId: z.string().min(1),
  contactIds: z.array(z.string()).optional(),
  countryCode: z.string().optional(),
  industryId: z.string().optional(),
  useCaseId: z.string().optional(),
  commercialStageId: z.string().min(1),
  ownerId: z.string().optional(),
  estimatedValue: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  nextStep: z.string().max(400).optional(),
  nextActionAt: z.string().optional(),
  notes: z.string().max(8000).optional(),
  idempotencyKey: z.string().max(80).optional(),
});

export function createOpportunityService(deps: {
  opportunities: MarketingOpportunityRepository;
  companies: MarketingCompanyRepository;
  contacts: MarketingContactRepository;
  industries: MarketingIndustryRepository;
  useCases: MarketingUseCaseRepository;
}) {
  const countries = createCountryService();

  async function assertRefs(
    ctx: MarketingServiceContext,
    input: {
      companyId: string;
      contactIds: string[];
      industryId?: string;
      useCaseId?: string;
      countryCode?: string;
      commercialStageId: string;
    },
  ) {
    if (isMarketingStage(input.commercialStageId)) {
      throw new MarketingValidationError("commercialStageId no debe ser un engagement stage de email");
    }
    if (!isMarketingCommercialStageId(input.commercialStageId)) {
      throw new MarketingValidationError(`commercialStageId desconocido: ${input.commercialStageId}`);
    }
    const company = await deps.companies.getById(ctx.workspaceId, input.companyId);
    if (!company || company.deletedAt) throw new MarketingValidationError("companyId obligatorio y debe existir");
    if (input.industryId) {
      const industry = await deps.industries.getById(ctx.workspaceId, input.industryId)
        || (await deps.industries.findByKey(ctx.workspaceId, input.industryId));
      if (!industry) throw new MarketingValidationError("industryId inexistente");
    }
    if (input.useCaseId) {
      const useCase = await deps.useCases.getById(ctx.workspaceId, input.useCaseId)
        || (await deps.useCases.findByKey(ctx.workspaceId, input.useCaseId));
      if (!useCase) throw new MarketingValidationError("useCaseId inexistente");
    }
    if (input.countryCode) countries.validateCountryCode(input.countryCode);
    for (const contactId of input.contactIds) {
      const contact = await deps.contacts.getById(contactId);
      if (!contact) throw new MarketingValidationError(`contactId inexistente: ${contactId}`);
      if (resolveContactWorkspace(contact.workspaceId) !== ctx.workspaceId) {
        throw new MarketingValidationError(`El contacto ${contactId} no pertenece a este workspace`);
      }
    }
  }

  return {
    async createOpportunity(ctx: MarketingServiceContext, input: z.input<typeof createSchema>) {
      const parsed = createSchema.safeParse(input);
      if (!parsed.success) throw new MarketingValidationError("Oportunidad inválida", parsed.error.flatten());
      const contactIds = parsed.data.contactIds || [];
      await assertRefs(ctx, { ...parsed.data, contactIds });
      const stamps = createStamps(ctx);
      const doc: MarketingOpportunity = {
        id: newMarketingEntityId(),
        workspaceId: ctx.workspaceId,
        name: parsed.data.name.trim(),
        companyId: parsed.data.companyId,
        contactIds,
        countryCode: parsed.data.countryCode ? countries.validateCountryCode(parsed.data.countryCode) : undefined,
        industryId: parsed.data.industryId,
        useCaseId: parsed.data.useCaseId,
        commercialStageId: parsed.data.commercialStageId,
        ownerId: parsed.data.ownerId,
        estimatedValue: parsed.data.estimatedValue,
        currency: parsed.data.currency,
        nextStep: parsed.data.nextStep,
        nextActionAt: parsed.data.nextActionAt,
        notes: parsed.data.notes,
        status: "open",
        deletedAt: null,
        ...stamps,
      };
      await deps.opportunities.create(doc);
      return doc;
    },

    async getOpportunity(ctx: MarketingServiceContext, id: string, opts?: { includeDeleted?: boolean }) {
      const doc = requireFound(await deps.opportunities.getById(ctx.workspaceId, id), "Oportunidad", id);
      if (doc.deletedAt && !opts?.includeDeleted) throw new MarketingValidationError("Oportunidad eliminada");
      return doc;
    },

    async updateOpportunity(ctx: MarketingServiceContext, id: string, input: Partial<z.input<typeof createSchema>>) {
      const current = await this.getOpportunity(ctx, id);
      if (input.commercialStageId) {
        if (isMarketingStage(input.commercialStageId)) {
          throw new MarketingValidationError("commercialStageId no debe ser un engagement stage de email");
        }
      }
      const companyId = input.companyId || current.companyId;
      const contactIds = input.contactIds || current.contactIds;
      const commercialStageId = input.commercialStageId || current.commercialStageId;
      await assertRefs(ctx, {
        companyId,
        contactIds,
        industryId: input.industryId ?? current.industryId,
        useCaseId: input.useCaseId ?? current.useCaseId,
        countryCode: input.countryCode ?? current.countryCode,
        commercialStageId,
      });
      await deps.opportunities.update(ctx.workspaceId, id, { ...input, commercialStageId, ...updateStamps(ctx) });
      return this.getOpportunity(ctx, id);
    },

    async softDeleteOpportunity(ctx: MarketingServiceContext, id: string) {
      await this.getOpportunity(ctx, id);
      await deps.opportunities.update(ctx.workspaceId, id, {
        deletedAt: nowIso(),
        deletedBy: ctx.actorId || null,
        ...updateStamps(ctx),
      });
    },

    async searchOpportunities(ctx: MarketingServiceContext, filters: OpportunitySearchFilters = {}) {
      return deps.opportunities.search(ctx.workspaceId, filters);
    },
  };
}

export type OpportunityService = ReturnType<typeof createOpportunityService>;
