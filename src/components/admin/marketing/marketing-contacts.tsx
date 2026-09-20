"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark, BookmarkCheck, Download, Loader2, X } from "lucide-react";
import { downloadCsv } from "@/lib/marketing/export-csv";
import { MarketingSubnav } from "./marketing-subnav";
import { StageBadge } from "./stage-badge";
import { MarketingListUpload } from "./marketing-list-upload";
import {
  CONTACT_FILTER_SHOW,
  EMPTY_MARKETING_FILTERS,
  MarketingFilterBar,
  filtersFromSearchParams,
  filtersToSearchParams,
  type MarketingFilterValues,
} from "./marketing-filter-bar";
import type { TaxonomyCatalog } from "./marketing-taxonomy-fields";
import { MARKETING_COUNTRIES } from "@/lib/marketing/countries";
import type { MarketingStage } from "@/lib/marketing/stages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type Contact = {
  id: string;
  email: string;
  name: string;
  company: string;
  companyId?: string | null;
  title: string;
  country: string;
  stage: MarketingStage;
  lastSentAt?: string | null;
  lastRepliedAt?: string | null;
};

type ListOption = {
  id: string;
  name: string;
  contactCount: number;
  virtual?: boolean;
};

type ContactsTab = "listas" | "manual";

function contactsPageUrl(filters: MarketingFilterValues, tab: ContactsTab): string {
  const sp = filtersToSearchParams(filters);
  if (tab === "manual") sp.set("tab", "manual");
  const qs = sp.toString();
  return `/admin/marketing/contactos${qs ? `?${qs}` : ""}`;
}

export function MarketingContacts() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [filters, setFilters] = useState<MarketingFilterValues>(() => ({
    ...EMPTY_MARKETING_FILTERS,
    ...filtersFromSearchParams(params),
  }));
  const [rows, setRows] = useState<Contact[]>([]);
  const [lists, setLists] = useState<ListOption[]>([]);
  const [catalog, setCatalog] = useState<TaxonomyCatalog | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<ContactsTab>(() => (params.get("tab") === "manual" ? "manual" : "listas"));
  const [form, setForm] = useState({
    email: "",
    name: "",
    company: "",
    title: "",
    country: "AR",
    notes: "",
    listId: "",
  });

  const [savedSearches, setSavedSearches] = useState<{ id: string; name: string; filters: MarketingFilterValues }[]>([]);
  const [savingSearch, setSavingSearch] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState("");
  const [showSaveSearch, setShowSaveSearch] = useState(false);

  useEffect(() => {
    fetch("/api/admin/marketing/saved-searches?entityType=contact")
      .then((r) => r.ok ? r.json() : { searches: [] })
      .then((body) => setSavedSearches(
        (body.searches || []).map((s: { id: string; name?: string; filters?: unknown }) => ({
          id: s.id,
          name: s.name || "Sin nombre",
          filters: (s.filters || {}) as MarketingFilterValues,
        }))
      ))
      .catch(() => {});
  }, []);

  async function saveSearch() {
    if (!saveSearchName.trim()) return;
    setSavingSearch(true);
    try {
      const res = await fetch("/api/admin/marketing/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: saveSearchName.trim(), entityType: "contact", filters }),
      });
      if (res.ok) {
        const data = await res.json();
        setSavedSearches((prev) => [{ id: data.search.id, name: data.search.name, filters }, ...prev]);
        setSaveSearchName("");
        setShowSaveSearch(false);
        toast({ title: "Búsqueda guardada" });
      }
    } finally {
      setSavingSearch(false);
    }
  }

  async function deleteSearch(id: string) {
    await fetch(`/api/admin/marketing/saved-searches/${id}`, { method: "DELETE" });
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
  }

  const dirty = JSON.stringify(filters) !== JSON.stringify(EMPTY_MARKETING_FILTERS);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = filtersToSearchParams(filters);
      const res = await fetch(`/api/admin/marketing/contacts?${sp}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setRows(data.contacts || []);
      setTotal(data.total || 0);
      setHasMore(data.hasMore ?? false);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const sp = filtersToSearchParams(filters);
      sp.set("offset", String(rows.length));
      const res = await fetch(`/api/admin/marketing/contacts?${sp}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setRows((prev) => [...prev, ...(data.contacts || [])]);
      setTotal(data.total || 0);
      setHasMore(data.hasMore ?? false);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setLoadingMore(false);
    }
  }, [filters, rows.length, toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    router.replace(contactsPageUrl(filters, tab));
  }, [filters, tab, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [listsRes, catalogRes] = await Promise.all([
          fetch("/api/admin/marketing/lists", { credentials: "include" }),
          fetch("/api/admin/marketing/catalog", { credentials: "include" }),
        ]);
        const listsData = await listsRes.json();
        const catalogData = await catalogRes.json();
        if (!cancelled) {
          if (listsRes.ok) setLists(listsData.lists || []);
          if (catalogRes.ok) {
            setCatalog({
              countries: catalogData.countries || [],
              industries: catalogData.industries || [],
              useCases: catalogData.useCases || [],
            });
          }
        }
      } catch {
        /* el listado de contactos igual sirve */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/marketing/contacts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, listId: form.listId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "No se pudo guardar");
      setForm({ email: "", name: "", company: "", title: "", country: form.country, notes: "", listId: form.listId });
      toast({ title: "Contacto guardado" });
      setTab("listas");
      await load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <MarketingSubnav />

      <Tabs value={tab} onValueChange={(value) => setTab(value === "manual" ? "manual" : "listas")}>
        <TabsList>
          <TabsTrigger value="listas">Listas CSV</TabsTrigger>
          <TabsTrigger value="manual">Agregar manual</TabsTrigger>
        </TabsList>

        <TabsContent value="listas" className="mt-6 space-y-6">
          <MarketingListUpload
            catalog={catalog}
            requireTaxonomy
            onImported={async () => {
              const listsRes = await fetch("/api/admin/marketing/lists", { credentials: "include" });
              const listsData = await listsRes.json().catch(() => ({}));
              if (listsRes.ok) setLists(listsData.lists || []);
              await load();
            }}
          />

          {/* saved searches */}
          {(savedSearches.length > 0 || showSaveSearch) && (
            <div className="flex flex-wrap items-center gap-2">
              {savedSearches.map((s) => (
                <div key={s.id} className="flex items-center gap-0.5 rounded-full border bg-background pl-2.5 pr-1 py-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setFilters({ ...EMPTY_MARKETING_FILTERS, ...s.filters })}
                    className="font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {s.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSearch(s.id)}
                    className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors p-0.5"
                    title="Eliminar búsqueda"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {showSaveSearch ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); void saveSearch(); }}
                  className="flex items-center gap-1"
                >
                  <input
                    autoFocus
                    value={saveSearchName}
                    onChange={(e) => setSaveSearchName(e.target.value)}
                    placeholder="Nombre de la búsqueda"
                    className="h-7 rounded-md border bg-background px-2 text-xs outline-none focus:border-ring"
                  />
                  <button type="submit" className="flex items-center justify-center h-7 w-7 rounded-md border bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50" disabled={savingSearch || !saveSearchName.trim()}>
                    {savingSearch ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookmarkCheck className="h-3 w-3" />}
                  </button>
                  <button type="button" className="flex items-center justify-center h-7 w-7 rounded-md border bg-background hover:bg-muted" onClick={() => setShowSaveSearch(false)}>
                    <X className="h-3 w-3" />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSaveSearch(true)}
                  className="flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  <Bookmark className="h-3 w-3" />
                  Guardar filtros
                </button>
              )}
            </div>
          )}
          {savedSearches.length === 0 && !showSaveSearch && dirty && (
            <button
              type="button"
              onClick={() => setShowSaveSearch(true)}
              className="flex w-fit items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <Bookmark className="h-3 w-3" />
              Guardar esta búsqueda
            </button>
          )}

          <MarketingFilterBar
            catalog={catalog}
            lists={lists}
            values={filters}
            onChange={setFilters}
            show={CONTACT_FILTER_SHOW}
          />

          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {total === 0 ? "No hay contactos con ese filtro. Importá un CSV." : "Nada coincide con la búsqueda."}
            </p>
          ) : (
        <div className="rounded-lg border bg-background overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>País</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Último envío</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.companyId ? (
                      <Link href={`/admin/marketing/empresas/${r.companyId}`} className="font-medium hover:underline">
                        {r.company || "—"}
                      </Link>
                    ) : (
                      <span className="font-medium">{r.company || "—"}</span>
                    )}
                    {r.title ? <div className="text-sm text-muted-foreground">{r.title}</div> : null}
                  </TableCell>
                  <TableCell>
                    <div>{r.name || "—"}</div>
                    <div className="text-sm text-muted-foreground">{r.email}</div>
                  </TableCell>
                  <TableCell>{MARKETING_COUNTRIES.find((c) => c.code === r.country)?.name || r.country}</TableCell>
                  <TableCell><StageBadge stage={r.stage} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {r.lastRepliedAt
                      ? `Resp. ${new Date(r.lastRepliedAt).toLocaleDateString("es-AR")}`
                      : r.lastSentAt
                        ? new Date(r.lastSentAt).toLocaleDateString("es-AR")
                        : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">{rows.length} de {total}</p>
              {hasMore && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  Cargar más
                </Button>
              )}
            </div>
            {rows.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() =>
                  downloadCsv(rows, "contactos.csv", [
                    { key: "email", label: "Email" },
                    { key: "name", label: "Nombre" },
                    { key: "company", label: "Empresa" },
                    { key: "title", label: "Cargo" },
                    { key: "country", label: "País" },
                    { key: "stage", label: "Etapa" },
                    { key: "lastSentAt", label: "Último envío" },
                    { key: "lastRepliedAt", label: "Última respuesta" },
                  ])
                }
              >
                <Download className="mr-1 h-3 w-3" />
                Exportar CSV
              </Button>
            )}
          </div>
        </div>
          )}
        </TabsContent>

        <TabsContent value="manual" className="mt-6">
          <form onSubmit={onCreate} className="grid gap-3 rounded-lg border bg-background p-4 md:grid-cols-6">
            <div className="md:col-span-6 space-y-1">
              <p className="text-sm font-medium">Agregar un contacto a mano</p>
              <p className="text-sm text-muted-foreground">
                Lo habitual es importar una lista CSV. Usá esto solo para un contacto suelto.
              </p>
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-name">Nombre</Label>
              <Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-co">Empresa</Label>
              <Input id="c-co" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-title">Cargo</Label>
              <Input id="c-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>País</Label>
              <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MARKETING_COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Lista</Label>
              <Select
                value={form.listId || "__none__"}
                onValueChange={(v) => setForm({ ...form, listId: v === "__none__" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin lista</SelectItem>
                  {lists.filter((l) => !l.virtual).map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-5 space-y-1">
              <Label htmlFor="c-notes">Notas</Label>
              <Textarea id="c-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Agregar"}
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
