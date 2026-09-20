"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Circle, CheckCircle2, Building2, CheckSquare, RefreshCw } from "lucide-react";
import { formatDistanceToNow, isAfter } from "date-fns";
import { es } from "date-fns/locale";
import { MarketingSubnav } from "./marketing-subnav";
import { CommercialStageBadge } from "./commercial-stage-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type Task = {
  id: string;
  title?: string;
  taskType?: string;
  priority?: string;
  companyId?: string | null;
  contactId?: string | null;
  dueAt?: string | null;
  status?: string;
};

type Company = {
  id: string;
  name?: string;
  countryCode?: string;
  commercialStageId?: string;
  nextFollowUpAt?: string | null;
  website?: string;
};

function relTime(ts: string | null | undefined) {
  if (!ts) return "";
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: es });
  } catch { return ""; }
}

function isOverdue(ts: string | null | undefined) {
  if (!ts) return false;
  try { return isAfter(new Date(), new Date(ts)); } catch { return false; }
}

const TASK_TYPE_LABELS: Record<string, string> = {
  call: "Llamada", email: "Email", meeting: "Reunión", demo: "Demo",
  follow_up: "Follow-up", proposal: "Propuesta", other: "Otro",
};

export function MarketingFollowup() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/marketing/followup");
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks ?? []);
        setCompanies(data.companies ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function completeTask(taskId: string) {
    setCompleting((prev) => new Set([...prev, taskId]));
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
      setCompleting((prev) => { const n = new Set(prev); n.delete(taskId); return n; });
    }
  }

  const isEmpty = tasks.length === 0 && companies.length === 0;

  return (
    <div className="space-y-6">
      <MarketingSubnav />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Seguimiento hoy</h1>
          {!loading && (
            <p className="text-sm text-muted-foreground">
              {tasks.length > 0 && `${tasks.length} ${tasks.length === 1 ? "tarea" : "tareas"}`}
              {tasks.length > 0 && companies.length > 0 && " · "}
              {companies.length > 0 && `${companies.length} ${companies.length === 1 ? "empresa con follow-up vencido" : "empresas con follow-up vencido"}`}
            </p>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-background py-16 text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 opacity-70" />
          <p className="text-base font-medium text-foreground">Todo al día</p>
          <p className="text-sm">No hay tareas vencidas ni follow-ups pendientes para hoy.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tasks section */}
          {tasks.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-medium">Tareas para hoy</h2>
                <Badge variant="secondary">{tasks.length}</Badge>
              </div>
              <ul className="divide-y rounded-lg border bg-background">
                {tasks.map((task) => {
                  const overdue = isOverdue(task.dueAt);
                  const completing_ = completing.has(task.id);
                  return (
                    <li key={task.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${overdue ? "bg-destructive/5" : ""}`}>
                      <button
                        type="button"
                        onClick={() => completeTask(task.id)}
                        disabled={completing_}
                        className="shrink-0 text-muted-foreground hover:text-emerald-600 transition-colors"
                        title="Marcar completada"
                      >
                        {completing_
                          ? <Loader2 className="h-5 w-5 animate-spin" />
                          : <Circle className="h-5 w-5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{task.title || "Tarea"}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          {task.taskType && (
                            <span className="text-xs text-muted-foreground">
                              {TASK_TYPE_LABELS[task.taskType] || task.taskType}
                            </span>
                          )}
                          {task.priority === "high" && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Alta prioridad</Badge>
                          )}
                          {task.companyId && (
                            <Link href={`/admin/marketing/empresas/${task.companyId}`} className="text-xs text-muted-foreground hover:underline hover:text-foreground">
                              ver empresa
                            </Link>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={`text-xs ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                          {task.dueAt ? relTime(task.dueAt) : "Sin fecha"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Companies with overdue follow-up */}
          {companies.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-medium">Empresas con follow-up vencido</h2>
                <Badge variant="secondary">{companies.length}</Badge>
              </div>
              <ul className="divide-y rounded-lg border bg-background">
                {companies.map((co) => (
                  <li key={co.id} className="flex items-center gap-3 px-4 py-3 bg-destructive/5 hover:bg-destructive/10 transition-colors">
                    <div className="flex-1 min-w-0">
                      <Link href={`/admin/marketing/empresas/${co.id}`} className="text-sm font-medium hover:underline">
                        {co.name || "Sin nombre"}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        {co.commercialStageId && <CommercialStageBadge stageId={co.commercialStageId} />}
                        {co.countryCode && (
                          <span className="text-xs text-muted-foreground">{co.countryCode}</span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-destructive font-medium">
                      {relTime(co.nextFollowUpAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
