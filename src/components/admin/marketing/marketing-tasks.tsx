"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, CheckSquare, AlertCircle } from "lucide-react";
import { formatDistanceToNow, isAfter, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { MarketingSubnav } from "./marketing-subnav";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Task = {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  companyId?: string | null;
  contactId?: string | null;
  opportunityId?: string | null;
  assignedTo?: string | null;
  dueAt?: string | null;
  createdAt?: string | null;
};

type TaskTab = "today" | "week" | "overdue" | "all";

const TASK_TYPE_LABELS: Record<string, string> = {
  call: "Llamada",
  email: "Email",
  research: "Investigación",
  meeting: "Reunión",
  demo: "Demo",
  follow_up: "Follow-up",
  proposal: "Propuesta",
  data_completion: "Datos",
  other: "Otro",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  normal: "bg-secondary text-secondary-foreground",
  low: "bg-muted text-muted-foreground",
};

function filterByTab(tasks: Task[], tab: TaskTab): Task[] {
  const now = new Date();
  if (tab === "today") {
    const start = startOfDay(now).toISOString();
    const end = endOfDay(now).toISOString();
    return tasks.filter((t) => t.dueAt && t.dueAt >= start && t.dueAt <= end);
  }
  if (tab === "week") {
    const start = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
    const end = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
    return tasks.filter((t) => t.dueAt && t.dueAt >= start && t.dueAt <= end);
  }
  if (tab === "overdue") {
    const nowStr = now.toISOString();
    return tasks.filter((t) => t.dueAt && t.dueAt < nowStr);
  }
  return tasks;
}

function relativeTime(ts: string | null | undefined): string {
  if (!ts) return "-";
  try {
    const d = new Date(ts);
    const now = new Date();
    const past = isAfter(now, d);
    const label = formatDistanceToNow(d, { addSuffix: true, locale: es });
    return label;
  } catch {
    return ts;
  }
}

function isDueOverdue(dueAt: string | null | undefined): boolean {
  if (!dueAt) return false;
  return isAfter(new Date(), new Date(dueAt));
}

export function MarketingTasks() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<TaskTab>("today");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    type: "follow_up",
    priority: "normal",
    dueAt: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/marketing/tasks?status=open&limit=500");
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks ?? []);
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
    } catch {
      toast({ title: "Error al completar tarea", variant: "destructive" });
    } finally {
      setCompleting((prev) => { const n = new Set(prev); n.delete(taskId); return n; });
    }
  }

  async function createTask() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title,
        type: form.type,
        priority: form.priority,
        description: form.description,
      };
      if (form.dueAt) body.dueAt = new Date(form.dueAt).toISOString();
      const res = await fetch("/api/admin/marketing/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setShowForm(false);
      setForm({ title: "", type: "follow_up", priority: "normal", dueAt: "", description: "" });
      await load();
      toast({ title: "Tarea creada" });
    } catch {
      toast({ title: "Error al crear tarea", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const todayCount = filterByTab(tasks, "today").length;
  const weekCount = filterByTab(tasks, "week").length;
  const overdueCount = filterByTab(tasks, "overdue").length;
  const visible = filterByTab(tasks, tab);

  return (
    <div className="space-y-6">
      <MarketingSubnav />

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">Tareas</h1>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          + Tarea
        </Button>
      </div>

      {showForm && (
        <div className="grid gap-3 rounded-lg border bg-background p-4 md:grid-cols-6">
          <div className="space-y-1 md:col-span-3">
            <Label className="text-xs text-muted-foreground">Título *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Descripción de la tarea"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TASK_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Prioridad</Label>
            <Select value={form.priority} onValueChange={(v) => setForm((p) => ({ ...p, priority: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baja</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Vencimiento</Label>
            <Input type="datetime-local" value={form.dueAt} onChange={(e) => setForm((p) => ({ ...p, dueAt: e.target.value }))} />
          </div>
          <div className="space-y-1 md:col-span-6">
            <Label className="text-xs text-muted-foreground">Descripción</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="resize-none" />
          </div>
          <div className="flex gap-2 md:col-span-6">
            <Button size="sm" onClick={createTask} disabled={saving || !form.title.trim()}>
              {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Crear
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as TaskTab)}>
        <TabsList>
          <TabsTrigger value="today">
            Hoy {todayCount > 0 && <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-xs">{todayCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="week">
            Esta semana {weekCount > 0 && <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-xs">{weekCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="overdue">
            Vencidas {overdueCount > 0 && (
              <span className="ml-1 rounded-full bg-destructive/20 text-destructive px-1.5 text-xs">{overdueCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">Todas ({tasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <CheckSquare className="h-8 w-8 opacity-40" />
              <p className="text-sm">Sin tareas pendientes en esta vista.</p>
            </div>
          ) : (
            <div className="rounded-lg border bg-background overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Tarea</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Empresa / Contacto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((task) => (
                    <TableRow key={task.id} className={cn(isDueOverdue(task.dueAt) && "bg-red-50/30 dark:bg-red-950/20")}>
                      <TableCell>
                        <Checkbox
                          checked={completing.has(task.id)}
                          onCheckedChange={() => completeTask(task.id)}
                          aria-label="Completar tarea"
                        />
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{task.title}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs font-normal">
                          {TASK_TYPE_LABELS[task.type] ?? task.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-xs font-normal border-0", PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.normal)}>
                          {task.priority === "high" ? "Alta" : task.priority === "low" ? "Baja" : "Normal"}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn("text-sm tabular-nums", isDueOverdue(task.dueAt) && "text-destructive font-medium")}>
                        {isDueOverdue(task.dueAt) && <AlertCircle className="inline mr-1 h-3 w-3" />}
                        {relativeTime(task.dueAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {task.companyId ? (
                          <Link href={`/admin/marketing/empresas/${task.companyId}`} className="hover:underline">
                            ver empresa
                          </Link>
                        ) : task.contactId ? (
                          <Link href={`/admin/marketing/contactos/${task.contactId}`} className="hover:underline">
                            ver contacto
                          </Link>
                        ) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
