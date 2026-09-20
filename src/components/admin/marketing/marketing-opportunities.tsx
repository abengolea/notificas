"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, LayoutGrid, List } from "lucide-react";
import { MarketingSubnav } from "./marketing-subnav";
import { CommercialStageBadge } from "./commercial-stage-badge";
import { MARKETING_COMMERCIAL_STAGE_SEED } from "@/lib/marketing/domain/commercial-stages";
import { Button } from "@/components/ui/button";
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

type CardProps = {
  opp: Opportunity;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  dragging: boolean;
};

function OpportunityCard({ opp, onDragStart, onDragEnd, dragging }: CardProps) {
  const val = formatValue(opp.estimatedValue, opp.currency);
  const due = formatDue(opp.nextActionAt);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, opp.id)}
      onDragEnd={onDragEnd}
      className={cn(
        "rounded-lg border bg-background p-3 shadow-sm cursor-grab active:cursor-grabbing select-none transition-opacity",
        dragging && "opacity-40",
      )}
    >
      <p className="text-sm font-medium leading-snug">{opp.name}</p>
      {opp.companyId && (
        <Link
          href={`/admin/marketing/empresas/${opp.companyId}`}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 block text-xs text-muted-foreground hover:underline"
        >
          ver empresa
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
};

function KanbanColumn({ stageId, stageName, isWon, opps, draggingId, onDragOver, onDrop, onDragStart, onDragEnd, onAddClick }: ColumnProps) {
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
                <TableRow key={opp.id}>
                  <TableCell>
                    <p className="font-medium">{opp.name}</p>
                    {opp.companyId && (
                      <Link href={`/admin/marketing/empresas/${opp.companyId}`} className="text-xs text-muted-foreground hover:underline">
                        ver empresa
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

  const [showForm, setShowForm] = useState(false);
  const [defaultStage, setDefaultStage] = useState("interesado");
  const [form, setForm] = useState({ name: "", commercialStageId: "interesado", estimatedValue: "", currency: "USD", nextStep: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/marketing/opportunities?status=open&limit=300");
      if (res.ok) {
        const data = await res.json();
        setOpps(data.opportunities ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
      const res = await fetch("/api/admin/marketing/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setShowForm(false);
      setForm({ name: "", commercialStageId: "interesado", estimatedValue: "", currency: "USD", nextStep: "" });
      await load();
      toast({ title: "Oportunidad creada" });
    } catch {
      toast({ title: "Error al crear oportunidad", variant: "destructive" });
    } finally {
      setSaving(false);
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
  const openOpps = opps.filter((o) => o.status !== "won" && o.status !== "lost");

  return (
    <div className="space-y-6">
      <MarketingSubnav />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Oportunidades</h1>
          {openOpps.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {openOpps.length} abiertas
              {totalValue > 0 && ` · ${formatValue(totalValue, "USD")} en pipeline`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
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
            />
          ))}
        </div>
      ) : (
        <OpportunitiesListView opps={opps} onStageChange={changeStage} />
      )}
    </div>
  );
}
