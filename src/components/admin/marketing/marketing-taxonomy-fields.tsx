"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CatalogSearchSelect } from "./marketing-catalog-search";

export type TaxonomyCatalog = {
  countries: Array<{ code: string; name: string }>;
  industries: Array<{ key: string; name: string; keywords?: string[] }>;
  useCases: Array<{ key: string; name: string; industryKeys: string[]; keywords?: string[] }>;
};

export function catalogUseCasesForIndustry(
  catalog: TaxonomyCatalog | null,
  industryId: string,
): TaxonomyCatalog["useCases"] {
  if (!catalog || !industryId) return [];
  return catalog.useCases.filter((row) => row.industryKeys.includes(industryId));
}

export function MarketingTaxonomyFields({
  catalog,
  countryCode,
  industryId,
  useCaseIds,
  onCountryChange,
  onIndustryChange,
  onUseCaseIdsChange,
  showCountry = true,
}: {
  catalog: TaxonomyCatalog | null;
  countryCode: string;
  industryId: string;
  useCaseIds: string[];
  onCountryChange: (value: string) => void;
  onIndustryChange: (value: string) => void;
  onUseCaseIdsChange: (value: string[]) => void;
  showCountry?: boolean;
}) {
  const useCases = catalogUseCasesForIndustry(catalog, industryId);

  return (
    <div className={`grid gap-3 ${showCountry ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      {showCountry ? (
        <div className="space-y-1">
          <Label>País</Label>
          <Select value={countryCode || undefined} onValueChange={onCountryChange}>
            <SelectTrigger><SelectValue placeholder="Elegí un país" /></SelectTrigger>
            <SelectContent>
              {(catalog?.countries || []).map((row) => (
                <SelectItem key={row.code} value={row.code}>
                  {row.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <CatalogSearchSelect
        label="Rubro"
        placeholder="Buscá un rubro"
        searchPlaceholder="alyc, gas, carteras…"
        value={industryId}
        options={catalog?.industries || []}
        onChange={(value) => {
          onIndustryChange(value);
          onUseCaseIdsChange([]);
        }}
      />
      <CatalogSearchSelect
        label="Caso de uso"
        placeholder={industryId ? "Todos o algunos" : "Primero el rubro"}
        searchPlaceholder="comitentes, corte, cesión…"
        multiple
        values={useCaseIds}
        options={useCases}
        onValuesChange={onUseCaseIdsChange}
        disabled={!industryId}
      />
    </div>
  );
}
