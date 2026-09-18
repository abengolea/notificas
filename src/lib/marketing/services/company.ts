import { z } from "zod";
import type { MarketingServiceContext } from "../context";
import { newMarketingEntityId } from "../domain/ids";
import type { MarketingCompany, MarketingCompanyStatus, MarketingPriority } from "../domain/types";
import {
  MarketingDuplicateWarning,
  MarketingNotFoundError,
  MarketingValidationError,
} from "../errors";
import {
  normalizeMarketingCompanyName,
  normalizeMarketingCountryCode,
  normalizeMarketingDomain,
  normalizeMarketingEmail,
  normalizeMarketingPhone,
  normalizeMarketingUrl,
} from "../normalizers";
import type { CompanySearchFilters, MarketingCompanyRepository, MarketingIndustryRepository, MarketingUseCaseRepository } from "../repositories/types";
import { seedUseCaseByKey } from "../taxonomy/seed";
import { nowIso } from "../persistence/timestamps";
import { createIndustryService } from "./industry";
import { createUseCaseService } from "./use-case";
import { assertWorkspaceOwned, createStamps, requireFound, updateStamps } from "./scope";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  legalName: z.string().max(240).optional(),
  website: z.string().max(500).optional(),
  countryCode: z.string().min(2).max(40).optional(),
  state: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
  industryIds: z.array(z.string()).optional(),
  subIndustryIds: z.array(z.string()).optional(),
  useCaseIds: z.array(z.string()).optional(),
  organizationTypeId: z.string().max(128).optional(),
  size: z.enum(["micro", "small", "medium", "large", "enterprise"]).optional(),
  employees: z.number().int().nonnegative().optional(),
  generalEmail: z.string().max(254).optional(),
  phone: z.string().max(32).optional(),
  linkedin: z.string().max(500).optional(),
  sourceIds: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
  commercialStageId: z.string().max(80).optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
  ownerId: z.string().max(128).optional(),
  notes: z.string().max(8000).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  idempotencyKey: z.string().max(80).optional(),
});

const updateSchema = createSchema.partial().extend({
  name: z.string().min(1).max(200).optional(),
});

function countryOrThrow(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const code = normalizeMarketingCountryCode(raw);
  if (!code) throw new MarketingValidationError(`País inválido: ${raw}`);
  return code;
}

function unsupportedSearch(filters: CompanySearchFilters): void {
  const extras = [
    filters.countryCode,
    filters.status,
    filters.commercialStageId,
    filters.industryId,
    filters.useCaseId,
  ].filter(Boolean);
  const arrayFilter = Boolean(filters.industryId || filters.useCaseId);
  const scalar = Boolean(filters.countryCode || filters.status || filters.commercialStageId);
  if (arrayFilter && scalar) {
    throw new MarketingValidationError(
      "Esa combinación de filtros aún no está indexada. Usá país/estado o industria/caso de uso, no ambos.",
    );
  }
  if (filters.industryId && filters.useCaseId) {
    throw new MarketingValidationError("No se puede filtrar industria y caso de uso a la vez todavía.");
  }
  if (extras.length > 1 && !arrayFilter) {
    throw new MarketingValidationError(
      "Combiná un solo filtro de igualdad (país, estado o etapa comercial) además del workspace.",
    );
  }
}

export function createCompanyService(
  companies: MarketingCompanyRepository,
  industries: MarketingIndustryRepository,
  useCases: MarketingUseCaseRepository,
) {
  const industryService = createIndustryService(industries);
  const useCaseService = createUseCaseService(useCases, industries);

  async function resolveIndustryKeys(ctx: MarketingServiceContext, keys: string[] | undefined) {
    if (!keys) return undefined;
    if (keys.length === 0) return [];
    return industryService.expandAssignedIndustryKeys(ctx, keys);
  }

  async function resolveUseCaseKeys(ctx: MarketingServiceContext, keys: string[] | undefined) {
    if (!keys) return undefined;
    const out: string[] = [];
    for (const raw of keys) {
      const row = await useCaseService.resolveUseCase(ctx, raw);
      if (row) {
        out.push(row.key);
        continue;
      }
      const seed = seedUseCaseByKey(raw);
      if (seed) {
        out.push(seed.key);
        continue;
      }
      throw new MarketingValidationError(`useCaseId inexistente: ${raw}`);
    }
    return [...new Set(out)].sort();
  }

  return {
    async createCompany(ctx: MarketingServiceContext, input: z.input<typeof createSchema>) {
      const parsed = createSchema.safeParse(input);
      if (!parsed.success) throw new MarketingValidationError("Empresa inválida", parsed.error.flatten());
      const data = parsed.data;
      const normalizedName = normalizeMarketingCompanyName(data.name);
      if (!normalizedName) throw new MarketingValidationError("El nombre de empresa queda vacío al normalizar.");
      const website = data.website ? normalizeMarketingUrl(data.website) || data.website.trim() : undefined;
      const normalizedDomain = data.website ? normalizeMarketingDomain(data.website) || undefined : undefined;
      const countryCode = countryOrThrow(data.countryCode);
      const industryIds = (await resolveIndustryKeys(ctx, data.industryIds)) || [];
      const useCaseIds = (await resolveUseCaseKeys(ctx, data.useCaseIds)) || [];
      const stamps = createStamps(ctx);
      const company: MarketingCompany = {
        id: newMarketingEntityId(),
        workspaceId: ctx.workspaceId,
        name: data.name.trim(),
        normalizedName,
        legalName: data.legalName?.trim(),
        website,
        normalizedDomain,
        countryCode,
        state: data.state?.trim(),
        city: data.city?.trim(),
        industryIds,
        subIndustryIds: data.subIndustryIds,
        useCaseIds,
        organizationTypeId: data.organizationTypeId,
        size: data.size,
        employees: data.employees,
        generalEmail: data.generalEmail ? normalizeMarketingEmail(data.generalEmail) : undefined,
        phone: data.phone ? normalizeMarketingPhone(data.phone) || data.phone.trim() : undefined,
        linkedin: data.linkedin?.trim(),
        sourceIds: data.sourceIds || [],
        tagIds: data.tagIds || [],
        commercialStageId: data.commercialStageId,
        priority: (data.priority || "normal") as MarketingPriority,
        ownerId: data.ownerId,
        notes: data.notes?.trim(),
        status: (data.status || "active") as MarketingCompanyStatus,
        deletedAt: null,
        ...stamps,
      };

      const duplicateWarnings: MarketingDuplicateWarning[] = [];
      if (normalizedDomain) {
        const exact = await companies.findByNormalizedDomain(ctx.workspaceId, normalizedDomain);
        for (const hit of exact) {
          duplicateWarnings.push({
            matchType: "exact",
            companyId: hit.id,
            reasons: [`normalizedDomain=${normalizedDomain}`],
          });
        }
      }
      const probable = await companies.findByNormalizedName(ctx.workspaceId, normalizedName, countryCode);
      for (const hit of probable) {
        if (duplicateWarnings.some((w) => w.companyId === hit.id)) continue;
        duplicateWarnings.push({
          matchType: "probable",
          companyId: hit.id,
          reasons: [`normalizedName=${normalizedName}`, countryCode ? `countryCode=${countryCode}` : "countryCode="],
        });
      }

      await companies.create(company);
      return { company, duplicateWarnings };
    },

    async getCompany(ctx: MarketingServiceContext, id: string, opts?: { includeDeleted?: boolean }) {
      const doc = requireFound(await companies.getById(ctx.workspaceId, id), "Empresa", id);
      assertWorkspaceOwned(ctx, doc.workspaceId);
      if (doc.deletedAt && !opts?.includeDeleted) throw new MarketingNotFoundError("Empresa", id);
      return doc;
    },

    async updateCompany(ctx: MarketingServiceContext, id: string, input: z.input<typeof updateSchema>) {
      await this.getCompany(ctx, id);
      const parsed = updateSchema.safeParse(input);
      if (!parsed.success) throw new MarketingValidationError("Empresa inválida", parsed.error.flatten());
      const data = parsed.data;
      const patch: Partial<MarketingCompany> = { ...updateStamps(ctx) };
      if (data.name) {
        patch.name = data.name.trim();
        patch.normalizedName = normalizeMarketingCompanyName(data.name);
      }
      if (data.website !== undefined) {
        patch.website = data.website ? normalizeMarketingUrl(data.website) || data.website.trim() : undefined;
        patch.normalizedDomain = data.website ? normalizeMarketingDomain(data.website) || undefined : undefined;
      }
      if (data.countryCode !== undefined) patch.countryCode = countryOrThrow(data.countryCode);
      if (data.legalName !== undefined) patch.legalName = data.legalName;
      if (data.state !== undefined) patch.state = data.state;
      if (data.city !== undefined) patch.city = data.city;
      if (data.industryIds) patch.industryIds = await resolveIndustryKeys(ctx, data.industryIds);
      if (data.useCaseIds) patch.useCaseIds = await resolveUseCaseKeys(ctx, data.useCaseIds);
      if (data.tagIds) patch.tagIds = data.tagIds;
      if (data.status) patch.status = data.status;
      if (data.notes !== undefined) patch.notes = data.notes;
      if (data.commercialStageId !== undefined) patch.commercialStageId = data.commercialStageId;
      if (data.priority) patch.priority = data.priority;
      if (data.ownerId !== undefined) patch.ownerId = data.ownerId;
      if (data.phone !== undefined) patch.phone = data.phone ? normalizeMarketingPhone(data.phone) || data.phone : undefined;
      await companies.update(ctx.workspaceId, id, patch);
      return requireFound(await companies.getById(ctx.workspaceId, id), "Empresa", id);
    },

    async deleteCompany(ctx: MarketingServiceContext, id: string) {
      await this.getCompany(ctx, id);
      await companies.update(ctx.workspaceId, id, {
        deletedAt: nowIso(),
        deletedBy: ctx.actorId || null,
        status: "inactive",
        ...updateStamps(ctx),
      });
    },

    async searchCompanies(ctx: MarketingServiceContext, filters: CompanySearchFilters = {}) {
      unsupportedSearch(filters);
      if (filters.query?.trim()) {
        const q = filters.query.trim();
        const domain = normalizeMarketingDomain(q);
        const name = normalizeMarketingCompanyName(q);
        const byDomain = domain ? await companies.findByNormalizedDomain(ctx.workspaceId, domain) : [];
        const byName = name ? await companies.findByNormalizedName(ctx.workspaceId, name, filters.countryCode) : [];
        const merged = new Map<string, MarketingCompany>();
        for (const row of [...byDomain, ...byName]) merged.set(row.id, row);
        return { items: [...merged.values()].slice(0, 50) };
      }
      return companies.search(ctx.workspaceId, filters);
    },
  };
}

export type CompanyService = ReturnType<typeof createCompanyService>;
