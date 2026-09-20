"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ChevronLeft, Trophy, XCircle, Pause, Users, UserPlus, X, Plus, Circle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { MarketingSubnav } from "./marketing-subnav";
import { CommercialStageBadge, CommercialStageSelect } from "./commercial-stage-badge";
import { MarketingActivityTimeline } from "./marketing-activity-timeline";
import { MARKETING_COMMERCIAL_STAGE_SEED } from "@/lib/marketing/domain/commercial-stages";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type Opportunity = Record<string, unknown>;

function field(o: Opportunity, key: string): string {
  return typeof o[key] === "string" ? (o[key] as string) : "";
}

function numField(o: Opportunity, key: string): string {
  const v = o[key];
  return v != null ? String(v) : "";
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  won: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  lost: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  paused: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Abierta",
  won: "Ganada",
  lost: "Perdida",
  paused: "Pausada",
};

export function MarketingOpportunityDetail({ opportunityId }: { opportunityId: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState<Partial<Opportunity>>({});
  const [dirty, setDirty] = useState(false);
  const [closingAs, setClosingAs] = useState<"won" | "lost" | "paused" | null>(null);
  const [contacts, setContacts] = useState<{ id: string; name?: string; email?: string; title?: string }[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [contactResults, setContactResults] = useState<{ id: string; name?: string; email?: string }[]>([]);
  const [searchingContact, setSearchingContact] = useState(false);
  const [showContactSearch, setShowContactSearch] = useState(false);
  const contactSearchRef = useRef<HTMLDivElement>(null);
  const contactDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // tasks
  type Task = { id: string; title?: string; type?: string; priority?: string; dueAt?: string | null };
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completingTask, setCompletingTask] = useState<string | null>(null);
  const [taskDialog, setTaskDialog] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", taskType: "follow_up", priority: "normal", dueAt: "" });
  const [savingTask, setSavingTask] = useState(false);

  const loadContacts = useCallback(async (contactIds: string[]) => {
    if (!contactIds.length) { setContacts([]); return; }
    try {
      const res = await fetch(`/api/admin/marketing/contacts?ids=${contactIds.join(",")}`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts ?? []);
      }
    } catch { /* silent */ }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [oppRes, taskRes] = await Promise.all([
        fetch(`/api/admin/marketing/opportunities/${opportunityId}`),
        fetch(`/api/admin/marketing/tasks?opportunityId=${opportunityId}&status=open`),
      ]);
      if (oppRes.ok) {
        const data = await oppRes.json();
        setOpp(data.opportunity ?? null);
        const ids = Array.isArray(data.opportunity?.contactIds) ? (data.opportunity.contactIds as string[]) : [];
        const names: Record<string, string> = data.opportunity?.contactNames || {};
        if (ids.length > 0 && Object.keys(names).length > 0) {
          setContacts(ids.map((id: string) => ({ id, name: names[id] })));
        } else {
          void loadContacts(ids);
        }
        setEdited({});
        setDirty(false);
      }
      if (taskRes.ok) setTasks((await taskRes.json()).tasks ?? []);
    } finally {
      setLoading(false);
    }
  }, [opportunityId, loadContacts]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!contactSearch.trim()) { setContactResults([]); return; }
    if (contactDebounce.current) clearTimeout(contactDebounce.current);
    contactDebounce.current = setTimeout(async () => {
      setSearchingContact(true);
      try {
        const res = await fetch(`/api/admin/marketing/contacts?q=${encodeURIComponent(contactSearch.trim())}&limit=6`);
        if (res.ok) {
          const body = await res.json();
          setContactResults(body.contacts || []);
        }
      } finally { setSearchingContact(false); }
    }, 200);
  }, [contactSearch]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (contactSearchRef.current && !contactSearchRef.current.contains(e.target as Node)) {
        setShowContactSearch(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function linkContact(contact: { id: string; name?: string; email?: string }) {
    if (!opp) return;
    const current = Array.isArray(opp.contactIds) ? (opp.contactIds as string[]) : [];
    if (current.includes(contact.id)) return;
    const next = [...current, contact.id];
    try {
      const res = await fetch(`/api/admin/marketing/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: next }),
      });
      if (res.ok) {
        const data = await res.json();
        setOpp(data.opportunity);
        setContacts((prev) => [...prev, contact]);
      }
    } catch { /* silent */ }
    setShowContactSearch(false);
    setContactSearch("");
  }

  async function unlinkContact(contactId: string) {
    if (!opp) return;
    const current = Array.isArray(opp.contactIds) ? (opp.contactIds as string[]) : [];
    const next = current.filter((id) => id !== contactId);
    try {
      const res = await fetch(`/api/admin/marketing/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: next }),
      });
      if (res.ok) {
        const data = await res.json();
        setOpp(data.opportunity);
        setContacts((prev) => prev.filter((c) => c.id !== contactId));
      }
    } catch { /* silent */ }
  }

  function set(key: string, value: string | number | null) {
    setEdited((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function val(key: string): string {
    if (key in edited) return edited[key] as string ?? "";
    return opp ? field(opp, key) : "";
  }

  async function save() {
    if (!dirty) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { ...edited };
      if ("estimatedValue" in body) {
        body.estimatedValue = body.estimatedValue ? parseFloat(body.estimatedValue as string) : null;
      }
      const res = await fetch(`/api/admin/marketing/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOpp(data.opportunity);
      setEdited({});
      setDirty(false);
      toast({ title: "Oportunidad actualizada" });
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function changeStage(stageId: string) {
    try {
      const res = await fetch(`/api/admin/marketing/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commercialStageId: stageId }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOpp(data.opportunity);
      toast({ title: "Etapa actualizada" });
    } catch {
      toast({ title: "Error al cambiar etapa", variant: "destructive" });
    }
  }

  async function closeOpportunity(status: "won" | "lost" | "paused") {
    setClosingAs(status);
    try {
      const res = await fetch(`/api/admin/marketing/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOpp(data.opportunity);
      toast({ title: status === "won" ? "Oportunidad ganada" : "Oportunidad marcada como perdida" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setClosingAs(null);
    }
  }

  async function reopenOpportunity() {
    try {
      const res = await fetch(`/api/admin/marketing/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "open" }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOpp(data.opportunity);
      toast({ title: "Oportunidad reabierta" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    setSavingTask(true);
    try {
      const companyId = opp?.companyId ? String(opp.companyId) : undefined;
      const res = await fetch("/api/admin/marketing/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskForm.title,
          type: taskForm.taskType,
          priority: taskForm.priority,
          opportunityId,
          companyId,
          dueAt: taskForm.dueAt ? new Date(taskForm.dueAt).toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error();
      setTaskDialog(false);
      setTaskForm({ title: "", taskType: "follow_up", priority: "normal", dueAt: "" });
      const taskRes = await fetch(`/api/admin/marketing/tasks?opportunityId=${opportunityId}&status=open`);
      if (taskRes.ok) setTasks((await taskRes.json()).tasks ?? []);
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
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!opp) {
    return (
      <div className="space-y-6">
        <MarketingSubnav />
        <p className="text-sm text-destructive">Oportunidad no encontrada.</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/admin/marketing/oportunidades")}>
          ← Volver al pipeline
        </Button>
      </div>
    );
  }

  const status = field(opp, "status") || "open";
  const stageId = field(opp, "commercialStageId");
  const isClosed = status === "won" || status === "lost";
  const stage = MARKETING_COMMERCIAL_STAGE_SEED.find((s) => s.id === stageId);

  return (
    <div className="space-y-6">
      <MarketingSubnav />

      {/* breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/marketing/oportunidades" className="hover:text-foreground flex items-center gap-1">
          <ChevronLeft className="h-3.5 w-3.5" />
          Pipeline
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{field(opp, "name") || "Oportunidad"}</span>
      </div>

      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{field(opp, "name") || "Sin nombre"}</h1>
            <Badge className={`${STATUS_COLORS[status] || STATUS_COLORS.open} border-0`}>
              {STATUS_LABELS[status] || status}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <CommercialStageBadge stageId={stageId} />
            {opp.estimatedValue != null && (
              <span className="font-medium text-emerald-600">
                {new Intl.NumberFormat("es-AR", { style: "currency", currency: field(opp, "currency") || "USD", maximumFractionDigits: 0 }).format(opp.estimatedValue as number)}
              </span>
            )}
            {Boolean(opp.companyId) && (
              <Link href={`/admin/marketing/empresas/${String(opp.companyId)}`} className="hover:underline hover:text-foreground flex items-center gap-1">
                <span>{String(opp.companyName || "ver empresa")}</span>
                <span className="text-muted-foreground">→</span>
              </Link>
            )}
          </div>
        </div>

        {/* status actions */}
        <div className="flex flex-wrap gap-2">
          {isClosed ? (
            <Button variant="outline" size="sm" onClick={reopenOpportunity}>
              Reabrir oportunidad
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400"
                onClick={() => closeOpportunity("won")}
                disabled={!!closingAs}
              >
                {closingAs === "won" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Trophy className="mr-1 h-3.5 w-3.5" />}
                Ganada
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                onClick={() => closeOpportunity("lost")}
                disabled={!!closingAs}
              >
                {closingAs === "lost" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <XCircle className="mr-1 h-3.5 w-3.5" />}
                Perdida
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => closeOpportunity("paused")}
                disabled={!!closingAs}
              >
                {closingAs === "paused" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Pause className="mr-1 h-3.5 w-3.5" />}
                Pausar
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* left: edit form */}
        <div className="space-y-4">
          <div className="rounded-lg border bg-background p-4 space-y-4">
            <h2 className="text-sm font-medium">Detalles</h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="opp-name">Nombre</Label>
                <Input
                  id="opp-name"
                  value={val("name")}
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>Etapa</Label>
                <CommercialStageSelect
                  value={stageId}
                  onChange={changeStage}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="opp-value">Valor estimado (USD)</Label>
                <Input
                  id="opp-value"
                  type="number"
                  value={numField(edited, "estimatedValue") || (opp.estimatedValue != null ? String(opp.estimatedValue) : "")}
                  onChange={(e) => set("estimatedValue", e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="opp-next">Próximo paso</Label>
                <Input
                  id="opp-next"
                  value={val("nextStep")}
                  onChange={(e) => set("nextStep", e.target.value)}
                  placeholder="Enviar propuesta, agendar demo..."
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="opp-due">Fecha de próxima acción</Label>
                <Input
                  id="opp-due"
                  type="date"
                  value={val("nextActionAt") ? val("nextActionAt").slice(0, 10) : ""}
                  onChange={(e) => set("nextActionAt", e.target.value ? new Date(e.target.value).toISOString() : null)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="opp-notes">Notas</Label>
              <Textarea
                id="opp-notes"
                rows={4}
                value={val("notes")}
                onChange={(e) => set("notes", e.target.value)}
                className="resize-none"
                placeholder="Contexto, historial, condiciones especiales..."
              />
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
          </div>

          {/* pipeline stage selector */}
          {!isClosed && (
            <div className="rounded-lg border bg-background p-4 space-y-3">
              <h2 className="text-sm font-medium">Avanzar etapa</h2>
              <div className="flex flex-wrap gap-1.5">
                {MARKETING_COMMERCIAL_STAGE_SEED.filter((s) => !s.isLost).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => changeStage(s.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      s.id === stageId
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* tasks */}
          <div className="rounded-lg border bg-background p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Tareas</h2>
              <Button size="sm" variant="outline" onClick={() => setTaskDialog(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Nueva
              </Button>
            </div>
            {tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">No hay tareas pendientes.</p>
            ) : (
              <ul className="divide-y">
                {tasks.map((t) => (
                  <li key={t.id} className="py-2 flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => completeTask(t.id)}
                      disabled={completingTask === t.id}
                      className="mt-0.5 shrink-0 text-muted-foreground hover:text-green-600 transition-colors disabled:opacity-50"
                      title="Marcar como completada"
                    >
                      {completingTask === t.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Circle className="h-4 w-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.title || "Sin título"}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.dueAt
                          ? formatDistanceToNow(new Date(t.dueAt), { addSuffix: true, locale: es })
                          : t.priority === "high" ? "Alta prioridad" : "Sin fecha"}
                      </p>
                    </div>
                    {t.priority === "high" && <Badge variant="destructive" className="text-xs shrink-0">Urgente</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* right: contacts + activity */}
        <div className="space-y-4">
          {/* contactos vinculados */}
          <div className="rounded-lg border bg-background" ref={contactSearchRef}>
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <h2 className="text-sm font-medium">Contactos</h2>
              </div>
              <button
                type="button"
                onClick={() => { setShowContactSearch((v) => !v); setContactSearch(""); }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Agregar
              </button>
            </div>

            {showContactSearch && (
              <div className="border-b">
                <div className="flex items-center gap-2 px-3 py-2">
                  <input
                    autoFocus
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Buscar contacto..."
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  {searchingContact && <span className="h-3 w-3 animate-spin rounded-full border border-muted-foreground border-t-transparent" />}
                </div>
                {contactResults.length > 0 && (
                  <ul className="border-t max-h-36 overflow-y-auto py-1">
                    {contactResults
                      .filter((r) => !contacts.some((c) => c.id === r.id))
                      .map((r) => (
                        <li key={r.id}>
                          <button
                            type="button"
                            className="w-full text-left px-4 py-1.5 text-sm hover:bg-muted/60 transition-colors"
                            onClick={() => void linkContact(r)}
                          >
                            <span className="font-medium">{r.name || r.email}</span>
                            {r.name && r.email && <span className="ml-2 text-xs text-muted-foreground">{r.email}</span>}
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}

            {contacts.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">Sin contactos vinculados.</p>
            ) : (
              <ul className="divide-y">
                {contacts.map((c) => (
                  <li key={c.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <Link href={`/admin/marketing/contactos/${c.id}`} className="flex-1 min-w-0 hover:text-primary transition-colors">
                      <span className="font-medium truncate block">{c.name || c.email}</span>
                      {c.title && <span className="text-xs text-muted-foreground">{c.title}</span>}
                    </Link>
                    <button
                      type="button"
                      onClick={() => void unlinkContact(c.id)}
                      className="shrink-0 ml-2 text-muted-foreground hover:text-destructive transition-colors"
                      title="Desvincular contacto"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* activity timeline */}
          <div className="rounded-lg border bg-background p-4">
            <MarketingActivityTimeline opportunityId={opportunityId} />
          </div>
        </div>
      </div>

      {/* create task dialog */}
      <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva tarea</DialogTitle>
          </DialogHeader>
          <form onSubmit={createTask} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>Título *</Label>
              <Input
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                placeholder="Ej: Enviar propuesta"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={taskForm.taskType} onValueChange={(v) => setTaskForm({ ...taskForm, taskType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="follow_up">Seguimiento</SelectItem>
                  <SelectItem value="call">Llamada</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="meeting">Reunión</SelectItem>
                  <SelectItem value="demo">Demo</SelectItem>
                  <SelectItem value="proposal">Propuesta</SelectItem>
                  <SelectItem value="research">Investigación</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Prioridad</Label>
              <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fecha límite</Label>
              <Input
                type="datetime-local"
                value={taskForm.dueAt}
                onChange={(e) => setTaskForm({ ...taskForm, dueAt: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setTaskDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={savingTask || !taskForm.title.trim()}>
                {savingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear tarea"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
