"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { MarketingSubnav } from "./marketing-subnav";
import { catalogUseCasesForIndustry, type TaxonomyCatalog } from "./marketing-taxonomy-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type UpsertRow = {
  key: string;
  name: string;
  created?: boolean;
  skipped?: boolean;
  linked?: boolean;
  reason?: string;
};

export function MarketingCatalogPage() {
  const { toast } = useToast();
  const [catalog, setCatalog] = useState<TaxonomyCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [industryName, setIndustryName] = useState("");
  const [useCaseNames, setUseCaseNames] = useState("");
  const [query, setQuery] = useState("");

  async function refresh() {
    const res = await fetch("/api/admin/marketing/catalog", { credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudo cargar el catálogo");
    setCatalog({
      countries: data.countries || [],
      industries: data.industries || [],
      useCases: data.useCases || [],
    });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch (e) {
        if (!cancelled) {
          toast({ title: e instanceof Error ? e.message : "No se pudo cargar", variant: "destructive" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const industries = useMemo(() => {
    const rows = catalog?.industries || [];
    const q = query.trim();
    if (!q) return rows;
    const needle = q.toLowerCase();
    return rows.filter((row) => {
      if (row.name.toLowerCase().includes(needle) || row.key.includes(needle)) return true;
      return catalogUseCasesForIndustry(catalog, row.key).some((useCase) =>
        useCase.name.toLowerCase().includes(needle),
      );
    });
  }, [catalog, query]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/marketing/catalog", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industryName, useCaseNames }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      if (data.catalog) {
        setCatalog({
          countries: data.catalog.countries || [],
          industries: data.catalog.industries || [],
          useCases: data.catalog.useCases || [],
        });
      } else {
        await refresh();
      }
      const industry = data.industry as UpsertRow | undefined;
      const useCases = (data.useCases || []) as UpsertRow[];
      const createdUseCases = useCases.filter((row) => row.created).length;
      const linkedUseCases = useCases.filter((row) => row.linked).length;
      if (industry?.created || createdUseCases || linkedUseCases) {
        toast({
          title: industry?.created ? `Rubro “${industry.name}” agregado` : `Casos de uso actualizados en “${industry?.name}”`,
          description: `${createdUseCases} nuevos, ${linkedUseCases} vinculados, ${useCases.filter((row) => row.skipped).length} ya estaban.`,
        });
        setIndustryName("");
        setUseCaseNames("");
      } else {
        toast({
          title: "Ese rubro ya estaba en el catálogo",
          description: "No se cargó de nuevo. Los casos de uso también coincidían.",
        });
      }
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <MarketingSubnav />
      <form onSubmit={onSubmit} className="max-w-3xl space-y-4 rounded-lg border bg-background p-4">
        <div>
          <h1 className="text-lg font-semibold">Catálogo de rubros</h1>
          <p className="text-sm text-muted-foreground">
            Cargá un rubro y sus casos de uso. Si el nombre ya existe, no se duplica.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="catalog-industry">Nombre del rubro</Label>
          <Input
            id="catalog-industry"
            required
            minLength={2}
            value={industryName}
            onChange={(e) => setIndustryName(e.target.value)}
            placeholder="Operadoras de petróleo y gas"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="catalog-use-cases">Casos de uso</Label>
          <Textarea
            id="catalog-use-cases"
            required
            value={useCaseNames}
            onChange={(e) => setUseCaseNames(e.target.value)}
            placeholder={"Notificaciones contractuales a contratistas\nDocumentación laboral con constancia de entrega"}
            className="min-h-[120px]"
          />
          <p className="text-xs text-muted-foreground">Uno por línea. El CSV de campañas no inventa rubros: se eligen de acá.</p>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Agregar al catálogo
        </Button>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando catálogo…</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {catalog?.industries.length || 0} rubros · {catalog?.useCases.length || 0} casos de uso
            </p>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar rubros"
              className="max-w-xs"
            />
          </div>
          <div className="divide-y rounded-lg border bg-background">
            {industries.map((row) => {
              const useCases = catalogUseCasesForIndustry(catalog, row.key);
              return (
                <div key={row.key} className="px-4 py-3">
                  <p className="font-medium">{row.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {useCases.length
                      ? useCases.map((useCase) => useCase.name).join(" · ")
                      : "Sin casos de uso todavía"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
