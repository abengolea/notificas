"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bookmark, BookmarkCheck, Building2, CheckCircle2, Loader2, MoreHorizontal, Plus, LayoutGrid, List, Search, Trophy, X, XCircle } from "lucide-react";
import { MarketingSubnav } from "./marketing-subnav";
import { CommercialStageBadge } from "./commercial-stage-badge";
import { MARKETING_COMMERCIAL_STAGE_SEED } from "@/lib/marketing/domain/commercial-stages";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Opportunity = {
  id: string;
  name: string;
  companyId?: string | null;
  companyName?: string | null;
  commercialStageId: string;
  estimatedValue?: number | null;
  currency?: string;
  nextStep?: string | null;
  nextActionAt?: string | null;
  status: string;
};

// Only show the "active" stages (not lost/won terminal stages) in the kanban
const KANBAN_STAGES = MARKETING_COMMERCIAL_STAGE_SEED.filter((s) => !s.isLost);

function formatValue(value?: number | null, currency?: string) {
  if (!value) return null;
  try {
    return new Intl.NumberFormat("es", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency || "USD"} ${value.toLocaleString()}`;
  }
}

function formatDue(ts: string | null | undefined) {
  if (!ts) return null;
  try {
    const d = new Date(ts);
    const now = new Date();
    const overdue = d < now;
    return { label: d.toLocaleDateString("es", { day: "2-digit", month: "short" }), overdue };
  } catch {
    return null;
  }
}

type CardAction = "won" | "lost" | "paused" | "reopen";

type CardProps = {
  opp: Opportunity;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  dragging: boolean;
  onAction: (id: string, action: CardAction) => void;
};

function OpportunityCard({ opp, onDragStart, onDragEnd, dragging, onAction }: CardProps) {
  const val = formatValue(opp.estimatedValue, opp.currency);
  const due = formatDue(opp.nextActionAt);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, opp.id)}
      onDragEnd={onDragEnd}
      className={cn(
        "group rounded-lg border bg-background p-3 shadow-sm cursor-grab active:cursor-grabbing select-none transition-opacity",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <Link
          href={`/admin/marketing/oportunidades/${opp.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-sm font-medium leading-snug hover:underline flex-1 min-w-0"
          draggable={false}
        >
          {opp.name}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-foreground transition-all p-0.5 rounded"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem asChild>
              <Link href={`/admin/marketing/oportunidades/${opp.id}`} className="cursor-pointer">
                Ver detalle
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {opp.status !== "won" && (
              <DropdownMenuItem
                className="text-emerald-700 focus:text-emerald-700 focus:bg-emerald-50 dark:text-emerald-400 dark:focus:bg-emerald-950 cursor-pointer"
                onSelect={() => onAction(opp.id, "won")}
              >
                <Trophy className="mr-2 h-3.5 w-3.5" />
                Marcar como ganada
              </DropdownMenuItem>
            )}
            {opp.status !== "lost" && (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                onSelect={() => onAction(opp.id, "lost")}
              >
                <XCircle className="mr-2 h-3.5 w-3.5" />
                Marcar como perdida
              </DropdownMenuItem>
            )}
            {opp.status !== "paused" && (
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={() => onAction(opp.id, "paused")}
              >
                <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                Poner en pausa
              </DropdownMenuItem>
            )}
            {opp.status !== "open" && (
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={() => onAction(opp.id, "reopen")}
              >
                Reabrir
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {opp.companyId && (
        <Link
          href={`/admin/marketing/empresas/${opp.companyId}`}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 block text-xs text-muted-foreground hover:underline truncate"
          draggable={false}
        >
          {opp.companyName || "ver empresa"}
        </Link>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        {val && (
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 font-medium tabular-nums">
            {val}
          </span>
        )}
        {due && (
          <span className={cn("rounded px-1.5 py-0.5", due.overdue ? "bg-red-50 text-red-600 dark:bg-red-950" : "bg-muted text-muted-foreground")}>
            {due.label}
          </span>
        )}
        {opp.status === "won" && (
          <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-white font-medium">Ganada</span>
        )}
        {opp.status === "lost" && (
          <span className="rounded bg-destructive/80 px-1.5 py-0.5 text-white font-medium">Perdida</span>
        )}
        {opp.status === "paused" && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground font-medium">Pausada</span>
        )}
      </div>
      {opp.nextStep && (
        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-1">{opp.nextStep}</p>
      )}
    </div>
  );
}

type ColumnProps = {
  stageId: string;
  stageName: string;
  isWon: boolean;
  opps: Opportunity[];
  draggingId: string | null;
  onDragOver: (e: React.DragEvent, stageId: string) => void;
  onDrop: (e: React.DragEvent, stageId: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onAddClick: (stageId: string) => void;
  onAction: (id: string, action: CardAction) => void;
};

function KanbanColumn({ stageId, stageName, isWon, opps, draggingId, onDragOver, onDrop, onDragStart, onDragEnd, onAddClick, onAction }: ColumnProps) {
  const totalValue = opps.reduce((n, o) => n + (o.estimatedValue || 0), 0);

  return (
    <div
      className={cn(
        "flex w-56 shrink-0 flex-col rounded-lg border bg-muted/30",
        isWon && "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900 dark:bg-emerald-950/20",
      )}
      onDragOver={(e) => onDragOver(e, stageId)}
      onDrop={(e) => onDrop(e, stageId)}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="min-w-0">
          <p className={cn("text-xs font-semibold truncate", isWon && "text-emerald-700 dark:text-emerald-400")}>
            {stageName}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {opps.length} {opps.length === 1 ? "oportunidad" : "oportunidades"}
            {totalValue > 0 && ` · ${formatValue(totalValue, opps[0]?.currency)}`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => onAddClick(stageId)}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex flex-col gap-2 p-2 min-h-[120px]">
        {opps.map((o) => (
          <OpportunityCard
            key={o.id}
            opp={o}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            dragging={draggingId === o.id}
            onAction={onAction}
          />
        ))}
      </div>
    </div>
  );
}

type ViewMode = "kanban" | "list";

function OpportunitiesListView({ opps, onStageChange }: {
  opps: Opportunity[];
  onStageChange: (id: string, stageId: string) => Promise<void>;
}) {
  const sorted = [...opps].sort((a, b) => {
    const si = MARKETING_COMMERCIAL_STAGE_SEED.findIndex((s) => s.id === a.commercialStageId);
    const sj = MARKETING_COMMERCIAL_STAGE_SEED.findIndex((s) => s.id === b.commercialStageId);
    if (si !== sj) return si - sj;
    return (b.estimatedValue || 0) - (a.estimatedValue || 0);
  });

  return (
    <div className="rounded-lg border bg-background overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Oportunidad</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead className="text-right">Valor est.</TableHead>
            <TableHead>Próximo paso</TableHead>
            <TableHead>Vence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-sm text-muted-foreground py-8 text-center">
                Sin oportunidades. Creá una con el botón de arriba.
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((opp) => {
              const due = formatDue(opp.nextActionAt);
              const val = formatValue(opp.estimatedValue, opp.currency);
              return (
                <TableRow key={opp.id} className="cursor-pointer hover:bg-muted/40">
                  <TableCell>
                    <Link href={`/admin/marketing/oportunidades/${opp.id}`} className="font-medium hover:underline block">
                      {opp.name}
                    </Link>
                    {opp.companyId && (
                      <Link href={`/admin/marketing/empresas/${opp.companyId}`} className="text-xs text-muted-foreground hover:underline" onClick={(e) => e.stopPropagation()}>
                        {opp.companyName || "ver empresa"}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell>
                    <CommercialStageBadge stageId={opp.commercialStageId} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                    {val || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {opp.nextStep || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {due ? (
                      <span className={due.overdue ? "text-destructive" : "text-muted-foreground"}>{due.label}</span>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function MarketingOpportunities() {
  const { toast } = useToast();
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStageRef = useRef<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");

  type OppStatus = "open" | "won" | "lost" | "paused" | "all";
  type OppFilters = { q: string; stageId: string };
  const EMPTY_FILTERS: OppFilters = { q: "", stageId: "" };
  const [filters, setFilters] = useState<OppFilters>(EMPTY_FILTERS);
  const [statusView, setStatusView] = useState<OppStatus>("open");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [savedSearches, setSavedSearches] = useState<{ id: string; name: string; filters: OppFilters }[]>([]);
  const [savingSearch, setSavingSearch] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState("");
  const [showSaveSearch, setShowSaveSearch] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [defaultStage, setDefaultStage] = useState("interesado");
  const [form, setForm] = useState({ name: "", commercialStageId: "interesado", estimatedValue: "", currency: "USD", nextStep: "", companyId: "", companyName: "" });
  const [saving, setSaving] = useState(false);
  const [companyQuery, setCompanyQuery] = useState("");
  const [companySuggestions, setCompanySuggestions] = useState<{ id: string; name: string }[]>([]);
  const companySearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const companyDropdownRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (f?: OppFilters, sv?: OppStatus) => {
    setLoading(true);
    try {
      const active = f ?? filters;
      const activeStatus = sv ?? statusView;
      const sp = new URLSearchParams({ limit: "500" });
      if (activeStatus !== "all") sp.set("status", activeStatus);
      if (active.q) sp.set("q", active.q);
      if (active.stageId) sp.set("commercialStageId", active.stageId);
      const res = await fetch(`/api/admin/marketing/opportunities?${sp}`);
      if (res.ok) {
        const data = await res.json();
        setOpps(data.opportunities ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [filters, statusView]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/admin/marketing/saved-searches?entityType=opportunity")
      .then((r) => r.ok ? r.json() : { searches: [] })
      .then((body) => setSavedSearches(
        (body.searches || []).map((s: { id: string; name?: string; filters?: unknown }) => ({
          id: s.id,
          name: s.name || "Sin nombre",
          filters: (s.filters || {}) as OppFilters,
        }))
      ))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveSearch() {
    if (!saveSearchName.trim()) return;
    setSavingSearch(true);
    try {
      const res = await fetch("/api/admin/marketing/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: saveSearchName.trim(), entityType: "opportunity", filters }),
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

  async function deleteSavedSearch(id: string) {
    await fetch(`/api/admin/marketing/saved-searches/${id}`, { method: "DELETE" });
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
  }

  function applyFilters(next: OppFilters) {
    setFilters(next);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(next), 300);
  }

  function applyStatus(sv: OppStatus) {
    setStatusView(sv);
    load(undefined, sv);
  }

  const dirty = filters.q !== "" || filters.stageId !== "";

  useEffect(() => {
    if (!showForm) { setCompanyQuery(""); setCompanySuggestions([]); return; }
  }, [showForm]);

  useEffect(() => {
    if (!companyQuery.trim()) { setCompanySuggestions([]); return; }
    if (companySearchTimer.current) clearTimeout(companySearchTimer.current);
    companySearchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/marketing/companies?q=${encodeURIComponent(companyQuery)}&limit=6`);
        if (res.ok) {
          const data = await res.json();
          setCompanySuggestions((data.companies || []).map((c: Record<string, unknown>) => ({ id: String(c.id), name: String(c.name || "") })));
        }
      } catch { /* ignore */ }
    }, 280);
    return () => { if (companySearchTimer.current) clearTimeout(companySearchTimer.current); };
  }, [companyQuery]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(e.target as Node)) {
        setCompanySuggestions([]);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragEnd() {
    setDraggingId(null);
    dragStageRef.current = null;
  }

  function handleDragOver(e: React.DragEvent, stageId: string) {
    e.preventDefault();
    dragStageRef.current = stageId;
  }

  async function handleDrop(e: React.DragEvent, targetStageId: string) {
    e.preventDefault();
    if (!draggingId || !targetStageId) return;
    const opp = opps.find((o) => o.id === draggingId);
    if (!opp || opp.commercialStageId === targetStageId) { setDraggingId(null); return; }

    // optimistic update
    setOpps((prev) => prev.map((o) => o.id === draggingId ? { ...o, commercialStageId: targetStageId } : o));
    setDraggingId(null);

    try {
      const res = await fetch(`/api/admin/marketing/opportunities/${draggingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commercialStageId: targetStageId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // rollback
      setOpps((prev) => prev.map((o) => o.id === draggingId ? { ...o, commercialStageId: opp.commercialStageId } : o));
      toast({ title: "Error al mover oportunidad", variant: "destructive" });
    }
  }

  function openFormForStage(stageId: string) {
    setDefaultStage(stageId);
    setForm((p) => ({ ...p, commercialStageId: stageId }));
    setShowForm(true);
  }

  async function createOpp() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        commercialStageId: form.commercialStageId,
        currency: form.currency,
        nextStep: form.nextStep,
      };
      if (form.estimatedValue) body.estimatedValue = parseFloat(form.estimatedValue);
      if (form.companyId) body.companyId = form.companyId;
      const res = await fetch("/api/admin/marketing/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setShowForm(false);
      setForm({ name: "", commercialStageId: "interesado", estimatedValue: "", currency: "USD", nextStep: "", companyId: "", companyName: "" });
      setCompanyQuery("");
      await load();
      toast({ title: "Oportunidad creada" });
    } catch {
      toast({ title: "Error al crear oportunidad", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleCardAction(id: string, action: CardAction) {
    const statusMap: Record<CardAction, string> = { won: "won", lost: "lost", paused: "paused", reopen: "open" };
    const newStatus = statusMap[action];
    const opp = opps.find((o) => o.id === id);
    if (!opp) return;
    // optimistic
    setOpps((prev) => prev.map((o) => o.id === id ? { ...o, status: newStatus } : o));
    try {
      const res = await fetch(`/api/admin/marketing/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      const labels: Record<CardAction, string> = { won: "¡Ganada!", lost: "Marcada como perdida", paused: "Oportunidad pausada", reopen: "Oportunidad reabierta" };
      toast({ title: labels[action] });
    } catch {
      setOpps((prev) => prev.map((o) => o.id === id ? { ...o, status: opp.status } : o));
      toast({ title: "Error al actualizar oportunidad", variant: "destructive" });
    }
  }

  async function changeStage(id: string, stageId: string) {
    const opp = opps.find((o) => o.id === id);
    if (!opp || opp.commercialStageId === stageId) return;
    setOpps((prev) => prev.map((o) => o.id === id ? { ...o, commercialStageId: stageId } : o));
    try {
      const res = await fetch(`/api/admin/marketing/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commercialStageId: stageId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setOpps((prev) => prev.map((o) => o.id === id ? { ...o, commercialStageId: opp.commercialStageId } : o));
      toast({ title: "Error al mover oportunidad", variant: "destructive" });
    }
  }

  const byStage = (stageId: string) => opps.filter((o) => o.commercialStageId === stageId);
  const totalValue = opps.reduce((n, o) => n + (o.estimatedValue || 0), 0);
  const openOpps = opps.filter((o) => o.status === "open" || o.status === "paused");
  const overdueOpps = opps.filter((o) => o.nextActionAt && new Date(o.nextActionAt) < new Date()).length;

  return (
    <div className="space-y-6">
      <MarketingSubnav />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Oportunidades</h1>
          {!loading && (
            <p className="text-sm text-muted-foreground">
              {statusView === "open" && openOpps.length > 0 && (
                <>
                  {openOpps.length} abiertas
                  {totalValue > 0 && ` · ${formatValue(totalValue, "USD")} en pipeline`}
                </>
              )}
              {statusView === "won" && `${opps.length} ganadas`}
              {statusView === "lost" && `${opps.length} perdidas`}
              {statusView === "paused" && `${opps.length} pausadas`}
              {statusView === "all" && `${opps.length} en total`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* status tabs */}
          <div className="flex rounded-md border bg-background text-xs">
            {(([["open","Abiertas"],["won","Ganadas"],["lost","Perdidas"],["all","Todas"]] as [OppStatus, string][])).map(([v, label], i) => (
              <button
                key={v}
                type="button"
                onClick={() => applyStatus(v)}
                className={cn(
                  "px-2.5 py-1.5 text-xs transition-colors",
                  i === 0 && "rounded-l-[calc(theme(borderRadius.md)-1px)]",
                  i === 3 && "rounded-r-[calc(theme(borderRadius.md)-1px)]",
                  i > 0 && "border-l",
                  statusView === v ? "bg-muted font-medium" : "hover:bg-muted/50 text-muted-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {/* view toggle */}
          <div className="flex rounded-md border bg-background">
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8 rounded-r-none", viewMode === "kanban" && "bg-muted")}
              onClick={() => setViewMode("kanban")}
              title="Vista kanban"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8 rounded-l-none border-l", viewMode === "list" && "bg-muted")}
              onClick={() => setViewMode("list")}
              title="Vista lista"
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button size="sm" onClick={() => openFormForStage("interesado")}>
            + Oportunidad
          </Button>
        </div>
      </div>

      {/* search + stage filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Buscar oportunidad..."
            value={filters.q}
            onChange={(e) => applyFilters({ ...filters, q: e.target.value })}
          />
          {filters.q && (
            <button
              type="button"
              onClick={() => applyFilters({ ...filters, q: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select
          value={filters.stageId || "__all__"}
          onValueChange={(v) => applyFilters({ ...filters, stageId: v === "__all__" ? "" : v })}
        >
          <SelectTrigger className="h-8 text-sm w-[160px]">
            <SelectValue placeholder="Todas las etapas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas las etapas</SelectItem>
            {KANBAN_STAGES.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {dirty && (
          <button
            type="button"
            onClick={() => applyFilters(EMPTY_FILTERS)}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* saved searches */}
      {(savedSearches.length > 0 || showSaveSearch) && (
        <div className="flex flex-wrap items-center gap-2">
          {savedSearches.map((s) => (
            <div key={s.id} className="flex items-center gap-0.5 rounded-full border bg-background pl-2.5 pr-1 py-1 text-xs">
              <button
                type="button"
                onClick={() => applyFilters({ ...EMPTY_FILTERS, ...s.filters })}
                className="font-medium text-foreground hover:text-primary transition-colors"
              >
                {s.name}
              </button>
              <button
                type="button"
                onClick={() => deleteSavedSearch(s.id)}
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

      {/* pipeline metrics bar — only for open view */}
      {!loading && statusView === "open" && openOpps.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3 rounded-lg border bg-background p-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Pipeline total</p>
            <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400 mt-0.5">
              {formatValue(totalValue, "USD") || "$0"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Oportunidades</p>
            <p className="text-2xl font-bold tabular-nums mt-0.5">{openOpps.length}</p>
            <p className="text-xs text-muted-foreground">
              {openOpps.length > 0 && totalValue > 0
                ? `${formatValue(Math.round(totalValue / openOpps.length), "USD")} promedio`
                : "abiertas"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Acción requerida</p>
            <p className={`text-2xl font-bold tabular-nums mt-0.5 ${overdueOpps > 0 ? "text-destructive" : ""}`}>
              {overdueOpps}
            </p>
            <p className="text-xs text-muted-foreground">con acción vencida</p>
          </div>
        </div>
      )}

      {showForm && (
        <div className="grid gap-3 rounded-lg border bg-background p-4 md:grid-cols-6">
          <div className="space-y-1 md:col-span-3">
            <Label className="text-xs text-muted-foreground">Nombre *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Nombre de la oportunidad"
              autoFocus
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs text-muted-foreground">Etapa</Label>
            <Select value={form.commercialStageId} onValueChange={(v) => setForm((p) => ({ ...p, commercialStageId: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {KANBAN_STAGES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Valor est.</Label>
            <Input
              type="number"
              value={form.estimatedValue}
              onChange={(e) => setForm((p) => ({ ...p, estimatedValue: e.target.value }))}
              placeholder="0"
            />
          </div>
          <div className="space-y-1 md:col-span-6">
            <Label className="text-xs text-muted-foreground">Próximo paso</Label>
            <Input
              value={form.nextStep}
              onChange={(e) => setForm((p) => ({ ...p, nextStep: e.target.value }))}
              placeholder="Enviar propuesta, agendar demo..."
            />
          </div>
          <div className="space-y-1 md:col-span-3 relative" ref={companyDropdownRef}>
            <Label className="text-xs text-muted-foreground">Empresa (opcional)</Label>
            {form.companyId ? (
              <div className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-3 py-1.5 text-sm">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <Link href={`/admin/marketing/empresas/${form.companyId}`} className="flex-1 truncate hover:underline text-foreground">
                  {form.companyName}
                </Link>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, companyId: "", companyName: "" }))}
                  className="text-muted-foreground hover:text-foreground ml-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <Input
                  value={companyQuery}
                  onChange={(e) => setCompanyQuery(e.target.value)}
                  placeholder="Buscar empresa..."
                />
                {companySuggestions.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-lg">
                    {companySuggestions.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setForm((p) => ({ ...p, companyId: c.id, companyName: c.name }));
                          setCompanyQuery("");
                          setCompanySuggestions([]);
                        }}
                      >
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex gap-2 md:col-span-6">
            <Button size="sm" onClick={createOpp} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Crear
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {loading ? (
        viewMode === "kanban" ? (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-64 w-56 shrink-0" />)}
          </div>
        ) : (
          <Skeleton className="h-64 w-full" />
        )
      ) : viewMode === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {KANBAN_STAGES.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stageId={stage.id}
              stageName={stage.name}
              isWon={stage.isWon ?? false}
              opps={byStage(stage.id)}
              draggingId={draggingId}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onAddClick={openFormForStage}
              onAction={handleCardAction}
            />
          ))}
        </div>
      ) : (
        <OpportunitiesListView opps={opps} onStageChange={changeStage} />
      )}
    </div>
  );
}
