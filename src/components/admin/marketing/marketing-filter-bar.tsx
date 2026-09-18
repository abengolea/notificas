"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AUDIENCE_KIND_LABEL,
  AUDIENCE_KINDS,
  CAMPAIGN_OUTCOME_LABEL,
  CAMPAIGN_OUTCOMES,
  CAMPAIGN_STATUS_LABEL,
  CAMPAIGN_STATUSES,
} from "@/lib/marketing/admin-filters";
import { MARKETING_STAGES, STAGE_LABEL } from "@/lib/marketing/stages";
import { catalogUseCaseAppliesToIndustry } from "@/lib/marketing/taxonomy/seed";
import { CatalogSearchSelect } from "./marketing-catalog-search";
import type { TaxonomyCatalog } from "./marketing-taxonomy-fields";
import { catalogUseCasesForIndustry } from "./marketing-taxonomy-fields";
import { parseCatalogKeyList } from "@/lib/marketing/taxonomy/seed";

export type AdminListOption = {
  id: string;
  name: string;
  contactCount?: number;
  virtual?: boolean;
};

export type MarketingFilterValues = {
  q: string;
  country: string;
  industryId: string;
  useCaseId: string;
  stage: string;
  status: string;
  outcome: string;
  listId: string;
  audienceKind: string;
};

export const EMPTY_MARKETING_FILTERS: MarketingFilterValues = {
  q: "",
  country: "all",
  industryId: "all",
  useCaseId: "all",
  stage: "all",
  status: "all",
  outcome: "all",
  listId: "all",
  audienceKind: "all",
};

export const CONTACT_FILTER_SHOW = {
  search: true,
  country: true,
  industry: true,
  useCase: true,
  stage: true,
  outcome: true,
  list: true,
} as const;

export const CAMPAIGN_FILTER_SHOW = {
  ...CONTACT_FILTER_SHOW,
  status: true,
  audienceKind: true,
} as const;

export function MarketingFilterBar({
  catalog,
  lists,
  values,
  onChange,
  show,
}: {
  catalog: TaxonomyCatalog | null;
  lists?: AdminListOption[];
  values: MarketingFilterValues;
  onChange: (next: MarketingFilterValues) => void;
  show: {
    search?: boolean;
    country?: boolean;
    industry?: boolean;
    useCase?: boolean;
    stage?: boolean;
    status?: boolean;
    outcome?: boolean;
    list?: boolean;
    audienceKind?: boolean;
  };
}) {
  const namedLists = (lists || []).filter((row) => !row.virtual);
  const useCases =
    values.industryId !== "all"
      ? catalogUseCasesForIndustry(catalog, values.industryId)
      : catalog?.useCases || [];

  function patch(partial: Partial<MarketingFilterValues>) {
    const next = { ...values, ...partial };
    if (partial.industryId && partial.industryId !== "all") {
      const kept = parseCatalogKeyList(next.useCaseId).filter((key) =>
        catalogUseCaseAppliesToIndustry(key, partial.industryId || ""),
      );
      next.useCaseId = kept.length ? kept.join(",") : "all";
    }
    onChange(next);
  }

  return (
    <div className="grid gap-3 rounded-lg border bg-background p-4 sm:grid-cols-2 lg:grid-cols-4">
      {show.search ? (
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="mkt-filter-q">Buscar</Label>
          <Input
            id="mkt-filter-q"
            value={values.q}
            onChange={(e) => patch({ q: e.target.value })}
            placeholder="Nombre, asunto, empresa, email"
          />
        </div>
      ) : null}
      {show.country ? (
        <div className="space-y-1">
          <Label>País</Label>
          <Select value={values.country} onValueChange={(country) => patch({ country })}>
            <SelectTrigger><SelectValue placeholder="País" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {(catalog?.countries || []).map((row) => (
                <SelectItem key={row.code} value={row.code}>{row.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {show.industry ? (
        <CatalogSearchSelect
          label="Rubro"
          placeholder="Todos"
          searchPlaceholder="alyc, gas, carteras…"
          value={values.industryId}
          options={catalog?.industries || []}
          onChange={(industryId) => patch({ industryId })}
          emptyValue="all"
          emptyLabel="Todos"
        />
      ) : null}
      {show.useCase ? (
        <CatalogSearchSelect
          label="Caso de uso"
          placeholder="Todos o algunos"
          searchPlaceholder="comitentes, corte, cesión…"
          multiple
          values={values.useCaseId === "all" ? [] : parseCatalogKeyList(values.useCaseId)}
          options={useCases}
          onValuesChange={(keys) => patch({ useCaseId: keys.length ? keys.join(",") : "all" })}
        />
      ) : null}
      {show.status ? (
        <div className="space-y-1">
          <Label>Estado de campaña</Label>
          <Select value={values.status} onValueChange={(status) => patch({ status })}>
            <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {CAMPAIGN_STATUSES.map((row) => (
                <SelectItem key={row} value={row}>{CAMPAIGN_STATUS_LABEL[row]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {show.outcome ? (
        <div className="space-y-1">
          <Label>Resultado</Label>
          <Select value={values.outcome} onValueChange={(outcome) => patch({ outcome })}>
            <SelectTrigger><SelectValue placeholder="Resultado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {CAMPAIGN_OUTCOMES.map((row) => (
                <SelectItem key={row} value={row}>{CAMPAIGN_OUTCOME_LABEL[row]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {show.stage ? (
        <div className="space-y-1">
          <Label>Etapa del contacto</Label>
          <Select value={values.stage} onValueChange={(stage) => patch({ stage })}>
            <SelectTrigger><SelectValue placeholder="Etapa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {MARKETING_STAGES.map((row) => (
                <SelectItem key={row} value={row}>{STAGE_LABEL[row]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {show.list ? (
        <div className="space-y-1">
          <Label>Lista</Label>
          <Select value={values.listId} onValueChange={(listId) => patch({ listId })}>
            <SelectTrigger><SelectValue placeholder="Lista" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {namedLists.length ? (
                <SelectGroup>
                  <SelectLabel>Listas cargadas</SelectLabel>
                  {namedLists.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.name}{typeof row.contactCount === "number" ? ` (${row.contactCount})` : ""}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {show.audienceKind ? (
        <div className="space-y-1">
          <Label>Origen</Label>
          <Select value={values.audienceKind} onValueChange={(audienceKind) => patch({ audienceKind })}>
            <SelectTrigger><SelectValue placeholder="Origen" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {AUDIENCE_KINDS.map((row) => (
                <SelectItem key={row} value={row}>{AUDIENCE_KIND_LABEL[row]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {filtersHaveValues(values) ? (
        <div className="flex items-end">
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => onChange({ ...EMPTY_MARKETING_FILTERS })}
          >
            Limpiar filtros
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function filtersHaveValues(values: MarketingFilterValues): boolean {
  return Object.entries(values).some(([key, value]) => {
    if (key === "q") return Boolean(value.trim());
    return Boolean(value) && value !== "all";
  });
}

export function filtersToSearchParams(values: MarketingFilterValues): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (!value || value === "all") continue;
    sp.set(key, value);
  }
  return sp;
}

export function filtersFromSearchParams(params: { get: (key: string) => string | null }): MarketingFilterValues {
  return {
    q: params.get("q") || "",
    country: params.get("country") || "all",
    industryId: params.get("industryId") || "all",
    useCaseId: params.get("useCaseIds") || params.get("useCaseId") || "all",
    stage: params.get("stage") || "all",
    status: params.get("status") || "all",
    outcome: params.get("outcome") || "all",
    listId: params.get("listId") || "all",
    audienceKind: params.get("audienceKind") || "all",
  };
}
