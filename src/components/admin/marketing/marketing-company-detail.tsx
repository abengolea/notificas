"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ExternalLink, Plus, CheckCircle2, Circle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { MarketingSubnav } from "./marketing-subnav";
import { CommercialStageBadge } from "./commercial-stage-badge";
import { MarketingActivityTimeline } from "./marketing-activity-timeline";
import { MARKETING_COUNTRIES } from "@/lib/marketing/countries";
import { MARKETING_COMMERCIAL_STAGE_SEED } from "@/lib/marketing/domain/commercial-stages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type Company = Record<string, unknown>;
type Opportunity = { id: string; name?: string; value?: number; commercialStageId?: string; status?: string; dueAt?: string | null };
type Task = { id: string; title?: string; taskType?: string; priority?: string; status?: string; dueAt?: string | null };

const COMPANY_SIZES = [
  { value: "micro", label: "Micro (1-10)" },
  { value: "small", label: "Pequeña (11-50)" },
  { value: "medium", label: "Mediana (51-200)" },
  { value: "large", label: "Grande (201-1000)" },
  { value: "enterprise", label: "Enterprise (1000+)" },
];

function field(c: Company, key: string): string {
  return typeof c[key] === "string" ? (c[key] as string) : "";
}

export function MarketingCompanyDetail({ companyId }: { companyId: string }) {
  const { toast } = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState<Partial<Company>>({});
  const [dirty, setDirty] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completingTask, setCompletingTask] = useState<string | null>(null);
  const [taskDialog, setTaskDialog] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", taskType: "follow_up", priority: "normal", dueAt: "" });
  const [savingTask, setSavingTask] = useState(false);
  const [oppDialog, setOppDialog] = useState(false);
  const [oppForm, setOppForm] = useState({ name: "", commercialStageId: "interesado", estimatedValue: "", nextStep: "" });
  const [savingOpp, setSavingOpp] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [compRes, oppRes, taskRes] = await Promise.all([
        fetch(`/api/admin/marketing/companies/${companyId}`),
        fetch(`/api/admin/marketing/opportunities?companyId=${companyId}&status=open`),
        fetch(`/api/admin/marketing/tasks?companyId=${companyId}&status=open`),
      ]);
      if (compRes.ok) {
        const data = await compRes.json();
        setCompany(data.company ?? null);
        setEdited({});
        setDirty(false);
      }
      if (oppRes.ok) {
        const data = await oppRes.json();
        setOpportunities(data.opportunities ?? []);
      }
      if (taskRes.ok) {
        const data = await taskRes.json();
        setTasks(data.tasks ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  function set<K extends string>(key: K, value: unknown) {
    setEdited((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function val(key: string): string {
    if (key in edited) return String(edited[key] ?? "");
    return company ? field(company, key) : "";
  }

  async function save() {
    if (!dirty) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/marketing/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edited),
      });
      if (!res.ok) throw new Error();
      await load();
      toast({ title: "Empresa actualizada" });
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function createOpportunity(e: React.FormEvent) {
    e.preventDefault();
    if (!oppForm.name.trim()) return;
    setSavingOpp(true);
    try {
      const body: Record<string, unknown> = {
        name: oppForm.name.trim(),
        commercialStageId: oppForm.commercialStageId,
        companyId,
        nextStep: oppForm.nextStep,
      };
      if (oppForm.estimatedValue) body.estimatedValue = parseFloat(oppForm.estimatedValue);
      const res = await fetch("/api/admin/marketing/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOpportunities((prev) => [data.opportunity, ...prev]);
      setOppForm({ name: "", commercialStageId: "interesado", estimatedValue: "", nextStep: "" });
      setOppDialog(false);
      toast({ title: "Oportunidad creada" });
    } catch {
      toast({ title: "Error al crear oportunidad", variant: "destructive" });
    } finally {
      setSavingOpp(false);
    }
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    setSavingTask(true);
    try {
      const body: Record<string, unknown> = {
        title: taskForm.title.trim(),
        taskType: taskForm.taskType,
        priority: taskForm.priority,
        companyId,
      };
      if (taskForm.dueAt) body.dueAt = new Date(taskForm.dueAt).toISOString();
      const res = await fetch("/api/admin/marketing/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTasks((prev) => [data.task, ...prev]);
      setTaskForm({ title: "", taskType: "follow_up", priority: "normal", dueAt: "" });
      setTaskDialog(false);
      toast({ title: "Tarea creada" });
    } catch {
      toast({ title: "Error al crear tarea", variant: "destructive" });
    } finally {
      setSavingTask(false);
    }
  }

  async function completeTask(taskId: string) {
    setCompletingTask(taskId);
    try {
      const res = await fetch(`/api/admin/marketing/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (!res.ok) throw new Error();
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast({ title: "Tarea completada" });
    } catch {
      toast({ title: "Error al completar tarea", variant: "destructive" });
    } finally {
      setCompletingTask(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <MarketingSubnav />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="space-y-6">
        <MarketingSubnav />
        <p className="text-sm text-muted-foreground">Empresa no encontrada.</p>
      </div>
    );
  }

  const website = field(company, "website");

  return (
    <div className="space-y-6">
      <MarketingSubnav />

      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/marketing/empresas" className="text-sm text-muted-foreground hover:text-foreground">
          ← Empresas
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-lg font-semibold">{field(company, "name")}</h1>
        <CommercialStageBadge stageId={field(company, "commercialStageId")} />
        {website && (
          <a
            href={website.startsWith("http") ? website : `https://${website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {website} <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* left: editable fields */}
        <div className="space-y-4">
          <div className="grid gap-4 rounded-lg border bg-background p-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nombre</Label>
              <Input value={val("name")} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Sitio web</Label>
              <Input value={val("website")} onChange={(e) => set("website", e.target.value)} placeholder="empresa.com" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">País</Label>
              <Select value={val("countryCode") || "AR"} onValueChange={(v) => set("countryCode", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MARKETING_COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tamaño</Label>
              <Select value={val("size") || ""} onValueChange={(v) => set("size", v || null)}>
                <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin especificar</SelectItem>
                  {COMPANY_SIZES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Email general</Label>
              <Input type="email" value={val("generalEmail")} onChange={(e) => set("generalEmail", e.target.value)} placeholder="info@empresa.com" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">LinkedIn</Label>
              <Input value={val("linkedin")} onChange={(e) => set("linkedin", e.target.value)} placeholder="linkedin.com/company/..." />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs text-muted-foreground">Etapa comercial</Label>
              <Select value={val("commercialStageId") || "nuevo"} onValueChange={(v) => set("commercialStageId", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MARKETING_COMMERCIAL_STAGE_SEED.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs text-muted-foreground">Notas</Label>
              <Textarea
                rows={3}
                value={val("notes")}
                onChange={(e) => set("notes", e.target.value)}
                className="resize-none"
              />
            </div>
          </div>

          {dirty && (
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving}>
                {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Guardar cambios
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setEdited({}); setDirty(false); }}>
                Cancelar
              </Button>
            </div>
          )}

          {/* Oportunidades */}
          <div className="rounded-lg border bg-background">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <h2 className="text-sm font-medium">Oportunidades</h2>
              <button
                type="button"
                onClick={() => setOppDialog(true)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Nueva
              </button>
            </div>
            {opportunities.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">Sin oportunidades abiertas.</p>
            ) : (
              <ul className="divide-y">
                {opportunities.map((opp) => {
                  const stage = MARKETING_COMMERCIAL_STAGE_SEED.find((s) => s.id === opp.commercialStageId);
                  const overdue = opp.dueAt && new Date(opp.dueAt) < new Date();
                  return (
                    <li key={opp.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <div>
                        <span className="font-medium">{opp.name || "Sin nombre"}</span>
                        {stage && (
                          <span className="ml-2 text-xs text-muted-foreground">{stage.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {opp.value != null && (
                          <span className="font-medium text-foreground">
                            {new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(opp.value)}
                          </span>
                        )}
                        {opp.dueAt && (
                          <span className={overdue ? "text-destructive" : ""}>
                            {formatDistanceToNow(new Date(opp.dueAt), { addSuffix: true, locale: es })}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Tareas abiertas */}
          <div className="rounded-lg border bg-background">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <h2 className="text-sm font-medium">Tareas abiertas</h2>
              <button
                type="button"
                onClick={() => setTaskDialog(true)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Nueva
              </button>
            </div>
            {tasks.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">Sin tareas abiertas.</p>
            ) : (
              <ul className="divide-y">
                {tasks.map((task) => {
                  const overdue = task.dueAt && new Date(task.dueAt) < new Date();
                  const completing = completingTask === task.id;
                  return (
                    <li key={task.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <button
                        type="button"
                        onClick={() => completeTask(task.id)}
                        disabled={completing}
                        className="shrink-0 text-muted-foreground hover:text-emerald-600 transition-colors"
                        title="Marcar completada"
                      >
                        {completing
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Circle className="h-4 w-4" />
                        }
                      </button>
                      <div className="flex-1 min-w-0">
                        <span className="truncate">{task.title || "Tarea"}</span>
                        {task.taskType && (
                          <span className="ml-2 text-xs text-muted-foreground">{task.taskType}</span>
                        )}
                      </div>
                      {task.dueAt && (
                        <span className={`text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                          {formatDistanceToNow(new Date(task.dueAt), { addSuffix: true, locale: es })}
                        </span>
                      )}
                      {task.priority === "high" && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Alta</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* right: activity timeline */}
        <div className="rounded-lg border bg-background p-4">
          <MarketingActivityTimeline companyId={companyId} />
        </div>
      </div>

      {/* inline task creation dialog */}
      <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva tarea</DialogTitle>
          </DialogHeader>
          <form onSubmit={createTask} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="td-title">Título</Label>
              <Input
                id="td-title"
                required
                autoFocus
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                placeholder="Ej: Llamar a Juan de Naturgy"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={taskForm.taskType} onValueChange={(v) => setTaskForm({ ...taskForm, taskType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      ["follow_up", "Follow-up"],
                      ["call", "Llamada"],
                      ["email", "Email"],
                      ["meeting", "Reunión"],
                      ["demo", "Demo"],
                      ["proposal", "Propuesta"],
                      ["other", "Otro"],
                    ].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Prioridad</Label>
                <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="td-due">Fecha límite</Label>
              <Input
                id="td-due"
                type="date"
                value={taskForm.dueAt}
                onChange={(e) => setTaskForm({ ...taskForm, dueAt: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setTaskDialog(false)}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={savingTask || !taskForm.title.trim()}>
                {savingTask ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Crear tarea"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* inline opportunity creation dialog */}
      <Dialog open={oppDialog} onOpenChange={setOppDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva oportunidad</DialogTitle>
          </DialogHeader>
          <form onSubmit={createOpportunity} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="od-name">Nombre</Label>
              <Input
                id="od-name"
                required
                autoFocus
                value={oppForm.name}
                onChange={(e) => setOppForm({ ...oppForm, name: e.target.value })}
                placeholder="Ej: Contrato anual 2025"
              />
            </div>
            <div className="space-y-1">
              <Label>Etapa</Label>
              <Select value={oppForm.commercialStageId} onValueChange={(v) => setOppForm({ ...oppForm, commercialStageId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MARKETING_COMMERCIAL_STAGE_SEED.filter((s) => !s.isLost).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="od-value">Valor estimado (USD)</Label>
              <Input
                id="od-value"
                type="number"
                value={oppForm.estimatedValue}
                onChange={(e) => setOppForm({ ...oppForm, estimatedValue: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="od-next">Próximo paso</Label>
              <Input
                id="od-next"
                value={oppForm.nextStep}
                onChange={(e) => setOppForm({ ...oppForm, nextStep: e.target.value })}
                placeholder="Enviar propuesta..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOppDialog(false)}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={savingOpp || !oppForm.name.trim()}>
                {savingOpp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Crear oportunidad"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
