"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Building2, Circle, ExternalLink, Link2, Loader2, Plus, Unlink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { MarketingSubnav } from "./marketing-subnav";
import { MarketingActivityTimeline } from "./marketing-activity-timeline";
import { CommercialStageBadge } from "./commercial-stage-badge";
import { StageBadge } from "./stage-badge";
import { MARKETING_COUNTRIES } from "@/lib/marketing/countries";
import { MARKETING_STAGES, STAGE_LABEL } from "@/lib/marketing/stages";
import { MARKETING_COMMERCIAL_STAGE_SEED } from "@/lib/marketing/domain/commercial-stages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  LINKEDIN_MEMBER_STATUS_LABEL,
  toIsoDateTime,
  toLocalDateTime,
} from "@/lib/marketing/linkedin-ui";
import type { MarketingLinkedInMemberStatus } from "@/lib/marketing/domain/types";

type Detail = {
  contact: {
    id: string;
    email: string;
    name: string;
    company: string;
    companyId?: string;
    title: string;
    country: string;
    notes: string;
    stage: string;
    doNotContact?: boolean;
    unsubscribed?: boolean;
    lastRepliedAt?: string | null;
    linkedinUrl?: string | null;
    linkedinStatus?: MarketingLinkedInMemberStatus | "not_found";
    linkedinLastContactAt?: string | null;
    linkedinNextActionAt?: string | null;
    linkedinNotes?: string;
    prospectingSource?: "clay" | "linkedin" | "web" | "manual" | "association" | "other";
  };
  sends: Array<{
    id: string;
    campaignId: string;
    subject: string;
    status: string;
    sentAt: string | null;
    deliveredAt: string | null;
    openedAt: string | null;
    repliedAt: string | null;
    replySnippet: string | null;
    lastError: string | null;
  }>;
  events: Array<{ id: string; type: string; at: string }>;
};

type Opportunity = { id: string; name?: string; estimatedValue?: number; commercialStageId?: string; status?: string };
type Task = { id: string; title?: string; type?: string; priority?: string; status?: string; dueAt?: string | null };

const LINKEDIN_STATUSES = Object.keys(LINKEDIN_MEMBER_STATUS_LABEL) as MarketingLinkedInMemberStatus[];
const PROSPECTING_SOURCES = [
  ["manual", "Manual"],
  ["linkedin", "LinkedIn"],
  ["clay", "Clay"],
  ["web", "Web"],
  ["association", "Asociación"],
  ["other", "Otro"],
] as const;

export function MarketingContactDetail({ contactId }: { contactId: string }) {
  const { toast } = useToast();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // company linking state
  const [companySearch, setCompanySearch] = useState("");
  const [companyResults, setCompanyResults] = useState<{ id: string; name: string }[]>([]);
  const [searchingCompany, setSearchingCompany] = useState(false);
  const [showCompanySearch, setShowCompanySearch] = useState(false);
  const companySearchRef = useRef<HTMLDivElement>(null);
  const companyDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // opportunities + tasks
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completingTask, setCompletingTask] = useState<string | null>(null);

  // opportunity dialog
  const [oppDialog, setOppDialog] = useState(false);
  const [oppForm, setOppForm] = useState({ name: "", commercialStageId: "interesado", estimatedValue: "", nextStep: "" });
  const [savingOpp, setSavingOpp] = useState(false);

  // task dialog
  const [taskDialog, setTaskDialog] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", taskType: "follow_up", priority: "normal", dueAt: "" });
  const [savingTask, setSavingTask] = useState(false);

  useEffect(() => {
    if (!companySearch.trim()) { setCompanyResults([]); return; }
    if (companyDebounce.current) clearTimeout(companyDebounce.current);
    companyDebounce.current = setTimeout(async () => {
      setSearchingCompany(true);
      try {
        const res = await fetch(`/api/admin/marketing/companies?q=${encodeURIComponent(companySearch.trim())}&limit=6`);
        if (res.ok) {
          const body = await res.json();
          setCompanyResults((body.companies || []).map((c: { id: string; name?: string }) => ({ id: c.id, name: c.name || c.id })));
        }
      } finally { setSearchingCompany(false); }
    }, 200);
  }, [companySearch]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (companySearchRef.current && !companySearchRef.current.contains(e.target as Node)) {
        setShowCompanySearch(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [contactRes, oppRes, taskRes] = await Promise.all([
        fetch(`/api/admin/marketing/contacts/${contactId}`, { credentials: "include" }),
        fetch(`/api/admin/marketing/opportunities?contactId=${contactId}&status=open`),
        fetch(`/api/admin/marketing/tasks?contactId=${contactId}&status=open`),
      ]);
      const body = await contactRes.json();
      if (!contactRes.ok) throw new Error(body.error || "Error");
      setData(body);
      if (oppRes.ok) setOpportunities((await oppRes.json()).opportunities ?? []);
      if (taskRes.ok) setTasks((await taskRes.json()).tasks ?? []);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [contactId, toast]);

  useEffect(() => { void load(); }, [load]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/marketing/contacts/${contactId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.contact),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "No se pudo guardar");
      setData((prev) => (prev ? { ...prev, contact: body.contact } : prev));
      toast({ title: "Guardado" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function createOpp(e: React.FormEvent) {
    e.preventDefault();
    if (!oppForm.name.trim()) return;
    setSavingOpp(true);
    try {
      const body: Record<string, unknown> = {
        name: oppForm.name,
        commercialStageId: oppForm.commercialStageId,
        nextStep: oppForm.nextStep,
        contactIds: [contactId],
      };
      if (oppForm.estimatedValue) body.estimatedValue = parseFloat(oppForm.estimatedValue);
      const res = await fetch("/api/admin/marketing/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setOppDialog(false);
      setOppForm({ name: "", commercialStageId: "interesado", estimatedValue: "", nextStep: "" });
      const oppRes = await fetch(`/api/admin/marketing/opportunities?contactId=${contactId}&status=open`);
      if (oppRes.ok) setOpportunities((await oppRes.json()).opportunities ?? []);
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
      const res = await fetch("/api/admin/marketing/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskForm.title,
          type: taskForm.taskType,
          priority: taskForm.priority,
          contactId,
          dueAt: taskForm.dueAt ? new Date(taskForm.dueAt).toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error();
      setTaskDialog(false);
      setTaskForm({ title: "", taskType: "follow_up", priority: "normal", dueAt: "" });
      const taskRes = await fetch(`/api/admin/marketing/tasks?contactId=${contactId}&status=open`);
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

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <MarketingSubnav />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const c = data.contact;
  const warningMessages = [
    c.doNotContact || c.unsubscribed || c.linkedinStatus === "do_not_contact"
      ? "No contactar: el contacto tiene una restricción activa. Revisala antes de cualquier acción comercial."
      : null,
    c.stage === "replied" || c.lastRepliedAt
      ? "Respondió por email. Revisá el historial antes de iniciar otro contacto."
      : null,
    c.linkedinStatus === "replied" || c.linkedinStatus === "interested"
      ? `Respondió por LinkedIn${c.linkedinStatus === "interested" ? " y fue marcado como interesado" : ""}.`
      : null,
    ["connected", "message_sent", "follow_up_due", "follow_up_sent"].includes(c.linkedinStatus || "")
      ? "Hay una conversación activa en LinkedIn. Coordiná la próxima acción con el resto del seguimiento."
      : null,
  ].filter((message): message is string => Boolean(message));

  return (
    <div className="space-y-6">
      <MarketingSubnav />
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/marketing/contactos" className="hover:text-foreground">← Contactos</Link>
        {c.companyId && (
          <>
            <span>/</span>
            <Link href={`/admin/marketing/empresas/${c.companyId}`} className="hover:text-foreground font-medium text-foreground">
              {c.company || "Empresa"}
            </Link>
          </>
        )}
      </div>
      {warningMessages.length > 0 && (
        <div className="space-y-2" aria-label="Alertas comerciales">
          {warningMessages.map((message) => (
            <div
              key={message}
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{message}</span>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* left: form + opportunities + tasks */}
        <div className="space-y-4">
          <form onSubmit={save} className="grid gap-4 rounded-lg border bg-background p-4 md:grid-cols-2">
            <div className="space-y-1" ref={companySearchRef}>
              <Label>Empresa</Label>
              {c.companyId ? (
                <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <Link href={`/admin/marketing/empresas/${c.companyId}`} className="flex-1 text-sm font-medium hover:underline">
                    {c.company || "Empresa vinculada"}
                  </Link>
                  <button
                    type="button"
                    title="Desvincular empresa"
                    onClick={() => setData({ ...data, contact: { ...c, companyId: undefined, company: c.company } })}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="flex gap-1">
                    <Input
                      value={c.company}
                      onChange={(e) => setData({ ...data, contact: { ...c, company: e.target.value } })}
                      placeholder="Nombre de empresa"
                      className="flex-1"
                    />
                    <button
                      type="button"
                      title="Vincular empresa del CRM"
                      onClick={() => { setShowCompanySearch((v) => !v); setCompanySearch(""); }}
                      className="flex items-center gap-1 rounded-md border px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Vincular
                    </button>
                  </div>
                  {showCompanySearch && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border bg-background shadow-lg">
                      <div className="flex items-center gap-2 border-b px-3 py-2">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <input
                          autoFocus
                          value={companySearch}
                          onChange={(e) => setCompanySearch(e.target.value)}
                          placeholder="Buscar empresa..."
                          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                        {searchingCompany && <span className="h-3 w-3 animate-spin rounded-full border border-muted-foreground border-t-transparent" />}
                      </div>
                      {companyResults.length === 0 ? (
                        <p className="px-4 py-2.5 text-xs text-muted-foreground">
                          {companySearch.trim().length >= 1 && !searchingCompany ? "Sin resultados" : "Escribí para buscar..."}
                        </p>
                      ) : (
                        <ul className="py-1 max-h-40 overflow-y-auto">
                          {companyResults.map((co) => (
                            <li key={co.id}>
                              <button
                                type="button"
                                className="w-full text-left px-4 py-2 text-sm hover:bg-muted/60 transition-colors"
                                onClick={() => {
                                  setData({ ...data, contact: { ...c, companyId: co.id, company: co.name } });
                                  setShowCompanySearch(false);
                                  setCompanySearch("");
                                }}
                              >
                                {co.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input value={c.name} onChange={(e) => setData({ ...data, contact: { ...c, name: e.target.value } })} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={c.email} disabled />
            </div>
            <div className="space-y-1">
              <Label>Cargo</Label>
              <Input value={c.title} onChange={(e) => setData({ ...data, contact: { ...c, title: e.target.value } })} />
            </div>
            <div className="space-y-1">
              <Label>País</Label>
              <Select value={c.country} onValueChange={(v) => setData({ ...data, contact: { ...c, country: v } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MARKETING_COUNTRIES.map((co) => (
                    <SelectItem key={co.code} value={co.code}>{co.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Etapa</Label>
              <Select value={c.stage} onValueChange={(v) => setData({ ...data, contact: { ...c, stage: v } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MARKETING_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-4 border-t pt-4 md:col-span-2">
              <div>
                <h3 className="font-semibold">LinkedIn</h3>
                <p className="text-sm text-muted-foreground">
                  Datos opcionales para prospección y seguimiento manual.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="contact-linkedin-url">URL de LinkedIn</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="contact-linkedin-url"
                      type="url"
                      value={c.linkedinUrl || ""}
                      onChange={(e) => setData({ ...data, contact: { ...c, linkedinUrl: e.target.value || null } })}
                      placeholder="https://www.linkedin.com/in/..."
                    />
                    {c.linkedinUrl ? (
                      <Button asChild type="button" variant="outline" className="shrink-0">
                        <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer">
                          Abrir <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden="true" />
                        </a>
                      </Button>
                    ) : (
                      <Button type="button" variant="outline" disabled className="shrink-0">
                        Abrir
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Estado LinkedIn</Label>
                  <Select
                    value={c.linkedinStatus || "not_contacted"}
                    onValueChange={(value) => setData({ ...data, contact: { ...c, linkedinStatus: value as MarketingLinkedInMemberStatus | "not_found" } })}
                  >
                    <SelectTrigger aria-label="Estado de LinkedIn"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LINKEDIN_STATUSES.map((value) => (
                        <SelectItem key={value} value={value}>{LINKEDIN_MEMBER_STATUS_LABEL[value]}</SelectItem>
                      ))}
                      <SelectItem value="not_found">Perfil no encontrado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Fuente de prospección</Label>
                  <Select
                    value={c.prospectingSource || "manual"}
                    onValueChange={(value) => setData({
                      ...data,
                      contact: { ...c, prospectingSource: value as Detail["contact"]["prospectingSource"] },
                    })}
                  >
                    <SelectTrigger aria-label="Fuente de prospección"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROSPECTING_SOURCES.map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="linkedin-last-contact">Último contacto LinkedIn</Label>
                  <Input
                    id="linkedin-last-contact"
                    type="datetime-local"
                    value={toLocalDateTime(c.linkedinLastContactAt)}
                    onChange={(e) => setData({
                      ...data,
                      contact: { ...c, linkedinLastContactAt: toIsoDateTime(e.target.value) },
                    })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="linkedin-next-action">Próxima acción LinkedIn</Label>
                  <Input
                    id="linkedin-next-action"
                    type="datetime-local"
                    value={toLocalDateTime(c.linkedinNextActionAt)}
                    onChange={(e) => setData({
                      ...data,
                      contact: { ...c, linkedinNextActionAt: toIsoDateTime(e.target.value) },
                    })}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="linkedin-notes">Notas de LinkedIn</Label>
                  <Textarea
                    id="linkedin-notes"
                    rows={3}
                    value={c.linkedinNotes || ""}
                    onChange={(e) => setData({ ...data, contact: { ...c, linkedinNotes: e.target.value } })}
                  />
                </div>
              </div>
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label>Notas generales</Label>
              <Textarea rows={4} value={c.notes || ""} onChange={(e) => setData({ ...data, contact: { ...c, notes: e.target.value } })} />
            </div>
            <div>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar ficha"}
              </Button>
            </div>
          </form>

          {/* opportunities */}
          <div className="rounded-lg border bg-background p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Oportunidades</h3>
              <Button size="sm" variant="outline" onClick={() => setOppDialog(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Nueva
              </Button>
            </div>
            {opportunities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay oportunidades abiertas.</p>
            ) : (
              <ul className="divide-y">
                {opportunities.map((o) => (
                  <li key={o.id} className="py-2 flex items-center justify-between gap-2">
                    <Link href={`/admin/marketing/oportunidades/${o.id}`} className="text-sm font-medium hover:underline">
                      {o.name || "Sin nombre"}
                    </Link>
                    <div className="flex items-center gap-2 shrink-0">
                      {o.estimatedValue ? (
                        <span className="text-xs text-muted-foreground">${o.estimatedValue.toLocaleString()}</span>
                      ) : null}
                      {o.commercialStageId ? <CommercialStageBadge stageId={o.commercialStageId} /> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* tasks */}
          <div className="rounded-lg border bg-background p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Tareas</h3>
              <Button size="sm" variant="outline" onClick={() => setTaskDialog(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Nueva
              </Button>
            </div>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay tareas pendientes.</p>
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

        {/* right: email and LinkedIn activity */}
        <div className="rounded-lg border bg-background p-4">
          <MarketingActivityTimeline contactId={contactId} />
        </div>
      </div>

      {/* email sends — full width below */}
      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Historial de email</h3>
          <p className="text-sm text-muted-foreground">Envíos y respuestas de campañas email.</p>
        </div>
        {data.sends.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no recibió campañas de marketing.</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-background">
            {data.sends.map((s) => (
              <li key={s.id} className="px-4 py-3 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/admin/marketing/campanas/${s.campaignId}`} className="font-medium hover:underline">
                    {s.subject || "Campaña"}
                  </Link>
                  <StageBadge stage={s.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {s.sentAt ? `Enviado ${new Date(s.sentAt).toLocaleString("es-AR")}` : "En cola"}
                  {s.deliveredAt ? ` · recibido ${new Date(s.deliveredAt).toLocaleString("es-AR")}` : ""}
                  {s.openedAt ? ` · abierto ${new Date(s.openedAt).toLocaleString("es-AR")}` : ""}
                  {s.repliedAt ? ` · respondió ${new Date(s.repliedAt).toLocaleString("es-AR")}` : ""}
                </p>
                {s.replySnippet ? <p className="text-sm">{s.replySnippet}</p> : null}
                {s.lastError ? <p className="text-sm text-destructive">{s.lastError}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* create opportunity dialog */}
      <Dialog open={oppDialog} onOpenChange={setOppDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva oportunidad</DialogTitle>
          </DialogHeader>
          <form onSubmit={createOpp} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input
                value={oppForm.name}
                onChange={(e) => setOppForm({ ...oppForm, name: e.target.value })}
                placeholder="Ej: Contrato anual empresa X"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Etapa comercial</Label>
              <Select value={oppForm.commercialStageId} onValueChange={(v) => setOppForm({ ...oppForm, commercialStageId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MARKETING_COMMERCIAL_STAGE_SEED.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Valor estimado (USD)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={oppForm.estimatedValue}
                onChange={(e) => setOppForm({ ...oppForm, estimatedValue: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label>Próximo paso</Label>
              <Input
                value={oppForm.nextStep}
                onChange={(e) => setOppForm({ ...oppForm, nextStep: e.target.value })}
                placeholder="Ej: Enviar propuesta"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOppDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={savingOpp || !oppForm.name.trim()}>
                {savingOpp ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear oportunidad"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
                placeholder="Ej: Llamar al contacto"
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
