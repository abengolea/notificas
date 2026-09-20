"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Building2, Download, Phone, Mic } from "lucide-react";
import { downloadCsv } from "@/lib/marketing/export-csv";
import { MarketingSubnav } from "./marketing-subnav";
import { CommercialStageBadge, CommercialStageSelect } from "./commercial-stage-badge";
import { MARKETING_COUNTRIES } from "@/lib/marketing/countries";
import { MARKETING_COMMERCIAL_STAGE_SEED } from "@/lib/marketing/domain/commercial-stages";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type Company = {
  id: string;
  name: string;
  countryCode?: string;
  website?: string;
  commercialStageId?: string;
  lastContactAt?: string | null;
  nextFollowUpAt?: string | null;
  size?: string;
  generalEmail?: string | null;
};

type Filters = {
  q: string;
  country: string;
  commercialStageId: string;
  urgency: "all" | "overdue" | "stale";
};

const EMPTY: Filters = { q: "", country: "all", commercialStageId: "all", urgency: "all" };

const COMPANY_SIZES: Record<string, string> = {
  micro: "Micro",
  small: "Pequeña",
  medium: "Mediana",
  large: "Grande",
  enterprise: "Enterprise",
};

function filtersToParams(f: Filters) {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.country && f.country !== "all") sp.set("country", f.country);
  if (f.commercialStageId && f.commercialStageId !== "all") sp.set("commercialStageId", f.commercialStageId);
  if (f.urgency && f.urgency !== "all") sp.set("urgency", f.urgency);
  return sp;
}

function buildApiUrl(f: Filters) {
  const sp = filtersToParams(f);
  sp.set("limit", "200");
  return `/api/admin/marketing/companies?${sp}`;
}

function formatDate(s?: string | null) {
  if (!s) return "-";
  try { return new Date(s).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return s; }
}

function getUrgency(row: Company): "overdue" | "stale" | null {
  const now = new Date();
  if (row.nextFollowUpAt && new Date(row.nextFollowUpAt) < now) return "overdue";
  if (!row.lastContactAt) return null;
  const daysSince = (now.getTime() - new Date(row.lastContactAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince > 30 && !row.nextFollowUpAt) return "stale";
  return null;
}

export function MarketingCompanies() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useSearchParams();

  const [filters, setFilters] = useState<Filters>(() => ({
    q: params.get("q") || "",
    country: params.get("country") || "all",
    commercialStageId: params.get("commercialStageId") || "all",
    urgency: (params.get("urgency") as Filters["urgency"]) || "all",
  }));
  const [rows, setRows] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", countryCode: "AR", website: "", notes: "", commercialStageId: "nuevo" });
  const [saving, setSaving] = useState(false);

  const [actDialog, setActDialog] = useState<{ companyId: string; companyName: string } | null>(null);
  const [actForm, setActForm] = useState({ type: "call" as "call" | "meeting" | "demo" | "note_added", title: "", description: "" });
  const [savingAct, setSavingAct] = useState(false);

  const [editingStageCompanyId, setEditingStageCompanyId] = useState<string | null>(null);

  const load = useCallback(async (f: Filters) => {
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl(f));
      if (res.ok) {
        const data = await res.json();
        setRows(data.companies ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const sp = filtersToParams(filters);
      router.replace(`/admin/marketing/empresas${sp.toString() ? `?${sp}` : ""}`);
      load(filters);
    }, 200);
    return () => clearTimeout(t);
  }, [filters, load, router]);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function createCompany() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/marketing/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          countryCode: form.countryCode,
          website: form.website,
          notes: form.notes,
          commercialStageId: form.commercialStageId,
        }),
      });
      if (!res.ok) throw new Error();
      setShowForm(false);
      setForm({ name: "", countryCode: "AR", website: "", notes: "", commercialStageId: "nuevo" });
      await load(filters);
      toast({ title: "Empresa creada" });
    } catch {
      toast({ title: "Error al crear empresa", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function changeStage(companyId: string, stageId: string) {
    setEditingStageCompanyId(null);
    try {
      const res = await fetch(`/api/admin/marketing/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commercialStageId: stageId }),
      });
      if (!res.ok) throw new Error();
      setRows((prev) => prev.map((r) => r.id === companyId ? { ...r, commercialStageId: stageId } : r));
    } catch {
      toast({ title: "Error al cambiar etapa", variant: "destructive" });
    }
  }

  async function logActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!actDialog || !actForm.title.trim()) return;
    setSavingAct(true);
    try {
      const [actRes] = await Promise.all([
        fetch("/api/admin/marketing/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: actForm.type,
            title: actForm.title.trim(),
            description: actForm.description.trim() || undefined,
            companyId: actDialog.companyId,
          }),
        }),
        fetch(`/api/admin/marketing/companies/${actDialog.companyId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lastContactAt: new Date().toISOString() }),
        }),
      ]);
      if (!actRes.ok) throw new Error();
      setRows((prev) => prev.map((r) =>
        r.id === actDialog.companyId ? { ...r, lastContactAt: new Date().toISOString() } : r
      ));
      setActDialog(null);
      setActForm({ type: "call", title: "", description: "" });
      toast({ title: "Actividad registrada" });
    } catch {
      toast({ title: "Error al registrar actividad", variant: "destructive" });
    } finally {
      setSavingAct(false);
    }
  }

  const dirty = filters.q || filters.country !== "all" || filters.commercialStageId !== "all" || filters.urgency !== "all";
  const displayRows = filters.urgency === "all"
    ? rows
    : rows.filter((r) => getUrgency(r) === filters.urgency);
  const overdueCount = rows.filter((r) => getUrgency(r) === "overdue").length;
  const staleCount = rows.filter((r) => getUrgency(r) === "stale").length;

  return (
    <div className="space-y-6">
      <MarketingSubnav />

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">Empresas</h1>
        <div className="flex gap-2">
          {rows.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                downloadCsv(rows, "empresas.csv", [
                  { key: "name", label: "Nombre" },
                  { key: "countryCode", label: "País" },
                  { key: "website", label: "Web" },
                  { key: "generalEmail", label: "Email" },
                  { key: "commercialStageId", label: "Etapa" },
                  { key: "size", label: "Tamaño" },
                  { key: "lastContactAt", label: "Último contacto" },
                  { key: "nextFollowUpAt", label: "Próximo follow-up" },
                ])
              }
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              Exportar CSV
            </Button>
          )}
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            + Empresa
          </Button>
        </div>
      </div>

      {/* urgency summary chips */}
      {!loading && (overdueCount > 0 || staleCount > 0) && (
        <div className="flex flex-wrap gap-2">
          {overdueCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter("urgency", filters.urgency === "overdue" ? "all" : "overdue")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filters.urgency === "overdue"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-destructive/10 text-destructive hover:bg-destructive/20"
              }`}
            >
              ⚠ {overdueCount} {overdueCount === 1 ? "follow-up vencido" : "follow-ups vencidos"}
            </button>
          )}
          {staleCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter("urgency", filters.urgency === "stale" ? "all" : "stale")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filters.urgency === "stale"
                  ? "bg-amber-600 text-white"
                  : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-400"
              }`}
            >
              ○ {staleCount} sin contacto en 30+ días
            </button>
          )}
        </div>
      )}

      {/* filter bar */}
      <div className="grid gap-3 rounded-lg border bg-background p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1 sm:col-span-2 lg:col-span-1">
          <Label className="text-xs text-muted-foreground">Buscar</Label>
          <Input
            placeholder="Nombre, dominio..."
            value={filters.q}
            onChange={(e) => setFilter("q", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">País</Label>
          <Select value={filters.country} onValueChange={(v) => setFilter("country", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {MARKETING_COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Etapa comercial</Label>
          <Select value={filters.commercialStageId} onValueChange={(v) => setFilter("commercialStageId", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {MARKETING_COMMERCIAL_STAGE_SEED.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Urgencia</Label>
          <Select value={filters.urgency} onValueChange={(v) => setFilter("urgency", v as Filters["urgency"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="overdue">Follow-up vencido {overdueCount > 0 ? `(${overdueCount})` : ""}</SelectItem>
              <SelectItem value="stale">Sin contacto 30d+ {staleCount > 0 ? `(${staleCount})` : ""}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {dirty && (
          <Button variant="ghost" size="sm" className="self-end" onClick={() => setFilters(EMPTY)}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* create form */}
      {showForm && (
        <div className="grid gap-3 rounded-lg border bg-background p-4 md:grid-cols-6">
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs text-muted-foreground">Nombre *</Label>
            <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Empresa S.A." />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">País *</Label>
            <Select value={form.countryCode} onValueChange={(v) => setForm((p) => ({ ...p, countryCode: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MARKETING_COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Etapa</Label>
            <Select value={form.commercialStageId} onValueChange={(v) => setForm((p) => ({ ...p, commercialStageId: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MARKETING_COMMERCIAL_STAGE_SEED.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs text-muted-foreground">Sitio web</Label>
            <Input value={form.website} onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))} placeholder="empresa.com" />
          </div>
          <div className="space-y-1 md:col-span-6">
            <Label className="text-xs text-muted-foreground">Notas</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="resize-none" />
          </div>
          <div className="flex gap-2 md:col-span-6">
            <Button size="sm" onClick={createCompany} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Crear empresa
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* log activity dialog */}
      <Dialog open={!!actDialog} onOpenChange={(open) => !open && setActDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              <span className="flex items-center gap-2">
                <Mic className="h-4 w-4" />
                Registrar actividad
              </span>
            </DialogTitle>
          </DialogHeader>
          {actDialog && (
            <form onSubmit={logActivity} className="space-y-3">
              <p className="text-xs text-muted-foreground">{actDialog.companyName}</p>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={actForm.type} onValueChange={(v) => setActForm({ ...actForm, type: v as typeof actForm.type })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Llamada</SelectItem>
                    <SelectItem value="meeting">Reunión</SelectItem>
                    <SelectItem value="demo">Demo</SelectItem>
                    <SelectItem value="note_added">Nota</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="act-title">Resumen</Label>
                <Input
                  id="act-title"
                  required
                  autoFocus
                  value={actForm.title}
                  onChange={(e) => setActForm({ ...actForm, title: e.target.value })}
                  placeholder="Ej: Llamada de 15 min con el CEO"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="act-desc">Notas (opcional)</Label>
                <Textarea
                  id="act-desc"
                  rows={3}
                  value={actForm.description}
                  onChange={(e) => setActForm({ ...actForm, description: e.target.value })}
                  className="resize-none"
                  placeholder="Detalles importantes..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setActDialog(null)}>Cancelar</Button>
                <Button type="submit" size="sm" disabled={savingAct || !actForm.title.trim()}>
                  {savingAct ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Registrar"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* table */}
      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Building2 className="h-8 w-8 opacity-40" />
          <p className="text-sm">
            {dirty ? "Sin resultados para estos filtros." : "Todavía no hay empresas."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-background overflow-x-auto">
          <div className="px-4 py-2 text-sm text-muted-foreground">
            {displayRows.length} de {total} empresas
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>País</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Tamaño</TableHead>
                <TableHead>Último contacto</TableHead>
                <TableHead>Próximo follow-up</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.map((row) => {
                const urgency = getUrgency(row);
                return (
                  <TableRow
                    key={row.id}
                    className={`cursor-pointer hover:bg-muted/50 ${
                      urgency === "overdue" ? "bg-destructive/5" :
                      urgency === "stale" ? "bg-amber-50/50 dark:bg-amber-950/20" : ""
                    }`}
                  >
                    <TableCell>
                      <Link href={`/admin/marketing/empresas/${row.id}`} className="hover:underline font-medium">
                        {row.name}
                      </Link>
                      {row.website && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{row.website}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{row.countryCode || "-"}</TableCell>
                    <TableCell>
                      {editingStageCompanyId === row.id ? (
                        <CommercialStageSelect
                          value={row.commercialStageId}
                          onChange={(stageId) => changeStage(row.id, stageId)}
                          className="text-xs h-7 rounded-md border px-1.5 bg-background"
                          onBlur={() => setEditingStageCompanyId(null)}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setEditingStageCompanyId(row.id); }}
                          title="Cambiar etapa"
                          className="cursor-pointer"
                        >
                          <CommercialStageBadge stageId={row.commercialStageId} />
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {COMPANY_SIZES[row.size ?? ""] || "-"}
                    </TableCell>
                    <TableCell className={`text-sm tabular-nums ${urgency === "stale" ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                      {formatDate(row.lastContactAt)}
                    </TableCell>
                    <TableCell className={`text-sm tabular-nums ${urgency === "overdue" ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {formatDate(row.nextFollowUpAt)}
                      {urgency === "overdue" && <span className="ml-1.5 text-[10px] rounded-full bg-destructive/15 px-1.5 py-0.5">vencido</span>}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        title="Registrar actividad"
                        onClick={(e) => { e.stopPropagation(); setActDialog({ companyId: row.id, companyName: row.name }); setActForm({ type: "call", title: `Llamada a ${row.name}`, description: "" }); }}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
