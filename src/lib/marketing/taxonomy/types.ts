import type { CompanyTaxonomyIntent } from "./classify";

export type TaxonomySeedMode = "preview" | "apply";

export type TaxonomyRowAction = "CREATE" | "UPDATE" | "UNCHANGED";

export type TaxonomyCatalogRow = {
  kind: "country" | "industry" | "use_case" | "tag";
  key: string;
  name: string;
  action: TaxonomyRowAction;
  changes?: string[];
};

export type TaxonomyCompanyRow = {
  companyId: string;
  name: string;
  normalizedName: string;
  countryCode?: string;
  intent: CompanyTaxonomyIntent;
  action: "CLASSIFY" | "UNCHANGED" | "UNRESOLVED";
  industryIds: string[];
  useCaseIds: string[];
  tagIds: string[];
  reason: string;
  legacyNameIntact: boolean;
  sourceIds: string[];
};

export type TaxonomyCatalogCounts = {
  create: number;
  update: number;
  unchanged: number;
};

export type TaxonomyPreview = {
  migrationId: string;
  workspaceId: string;
  countries: TaxonomyCatalogRow[];
  industries: TaxonomyCatalogRow[];
  useCases: TaxonomyCatalogRow[];
  tags: TaxonomyCatalogRow[];
  companies: TaxonomyCompanyRow[];
  extras: {
    countries: number;
    industries: number;
    useCases: number;
    tags: number;
  };
  stats: {
    countries: TaxonomyCatalogCounts;
    industries: TaxonomyCatalogCounts;
    useCases: TaxonomyCatalogCounts;
    tags: TaxonomyCatalogCounts;
    companiesClassify: number;
    companiesUnchanged: number;
    companiesUnresolved: number;
    keyConflicts: string[];
  };
};

export type TaxonomyApplyResult = TaxonomyPreview & {
  appliedAt: string;
  actorId: string;
  wrote: {
    countries: number;
    industries: number;
    useCases: number;
    tags: number;
    companies: number;
    activities: number;
  };
};

export function countCatalogActions(rows: TaxonomyCatalogRow[]): TaxonomyCatalogCounts {
  return {
    create: rows.filter((r) => r.action === "CREATE").length,
    update: rows.filter((r) => r.action === "UPDATE").length,
    unchanged: rows.filter((r) => r.action === "UNCHANGED").length,
  };
}

export function sameSorted(a?: string[], b?: string[]): boolean {
  return [...(a || [])].sort().join("\0") === [...(b || [])].sort().join("\0");
}
