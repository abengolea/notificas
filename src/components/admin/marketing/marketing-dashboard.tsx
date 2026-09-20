"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, Building2, CheckSquare, AlertTriangle, BarChart3, Phone, Users, Monitor, Mail, MessageSquare, FileText, Star, GitBranch, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { MarketingSubnav } from "./marketing-subnav";
import { MarketingGmailBar } from "./marketing-gmail-bar";
import { StageBadge } from "./stage-badge";
import { PIPELINE_STAGES, STAGE_LABEL, type MarketingStage } from "@/lib/marketing/stages";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type CountryRow = {
  code: string;
  name: string;
  total: number;
  stages: Record<MarketingStage, number>;
};

type PipelineStage = {
  id: string;
  name: string;
  count: number;
  isWon: boolean;
  isLost: boolean;
};

type Overview = {
  fromEmail: string;
  replyTo: string;
  gmail: { connected: boolean };
  total: number;
  stages: Record<MarketingStage, number>;
  countries: CountryRow[];
  campaigns: Array<{
    id: string;
    name: string;
    country: string;
    status: string;
    stats?: { sent?: number; delivered?: number; opened?: number; replied?: number };
  }>;
  pipeline?: PipelineStage[];
  companies?: { total: number };
  tasks?: { open: number; overdue: number; dueToday: number };
  opportunities?: { open: number; pipelineValue: number };
  recentActivities?: Array<{
    id: string;
    type?: string;
    summary?: string;
    companyId?: string;
    contactId?: string;
    actorName?: string;
    createdAt?: string;
  }>;
};

function KpiCard({
  label,
  value,
  sub,
  href,
  icon: Icon,
  urgent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  href: string;
  icon: React.ElementType;
  urgent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col gap-1 rounded-lg border bg-background p-4 transition-colors hover:bg-muted/40",
        urgent && "border-destructive/40",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon className={cn("h-4 w-4", urgent ? "text-destructive" : "text-muted-foreground")} />
      </div>
      <span className={cn("text-2xl font-bold tabular-nums", urgent && "text-destructive")}>{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </Link>
  );
}

function PipelineFunnel({ stages }: { stages: PipelineStage[] }) {
  const active = stages.filter((s) => !s.isLost && !s.isWon);
  const won = stages.find((s) => s.isWon);
  const total = active.reduce((n, s) => n + s.count, 0);
  const max = Math.max(1, ...active.map((s) => s.count));

  return (
    <div className="rounded-lg border bg-background p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Pipeline comercial</h3>
        <Link href="/admin/marketing/oportunidades" className="text-xs text-muted-foreground hover:text-foreground">
          Ver oportunidades →
        </Link>
      </div>
      <div className="space-y-1">
        {active.map((s) => {
          const pct = total === 0 ? 0 : Math.max(4, Math.round((s.count / max) * 100));
          return (
            <div key={s.id} className="flex items-center gap-2 text-sm">
              <Link
                href={`/admin/marketing/empresas?commercialStageId=${s.id}`}
                className="w-36 shrink-0 truncate text-xs text-muted-foreground hover:text-foreground"
              >
                {s.name}
              </Link>
              <div className="flex-1 rounded-full bg-muted h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-primary/70 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 text-right tabular-nums text-xs font-medium">{s.count}</span>
            </div>
          );
        })}
      </div>
      {won && (
        <div className="flex items-center justify-between border-t pt-2 text-sm">
          <span className="text-xs font-medium text-emerald-600">Clientes</span>
          <span className="tabular-nums font-bold text-emerald-600">{won.count}</span>
        </div>
      )}
    </div>
  );
}

const ACTIVITY_ICON: Record<string, React.ElementType> = {
  call: Phone,
  meeting: Users,
  demo: Monitor,
  email_sent: Mail,
  email_replied: MessageSquare,
  note_added: FileText,
  won: Star,
  status_changed: GitBranch,
};

const ACTIVITY_COLOR: Record<string, string> = {
  call: "text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300",
  meeting: "text-violet-600 bg-violet-100 dark:bg-violet-900 dark:text-violet-300",
  demo: "text-indigo-600 bg-indigo-100 dark:bg-indigo-900 dark:text-indigo-300",
  email_sent: "text-sky-600 bg-sky-100 dark:bg-sky-900 dark:text-sky-300",
  email_replied: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-300",
  note_added: "text-muted-foreground bg-muted",
  won: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300",
  status_changed: "text-orange-600 bg-orange-100 dark:bg-orange-900 dark:text-orange-300",
};

function ActivityFeed({ activities }: {
  activities: NonNullable<Overview["recentActivities"]>
}) {
  if (activities.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Actividad reciente</h3>
        <Link href="/admin/marketing/empresas" className="text-xs text-muted-foreground hover:text-foreground">
          Ver empresas →
        </Link>
      </div>
      <ul className="space-y-1.5">
        {activities.map((a) => {
          const Icon = ACTIVITY_ICON[a.type ?? ""] ?? RefreshCw;
          const color = ACTIVITY_COLOR[a.type ?? ""] ?? "text-muted-foreground bg-muted";
          const href = a.companyId
            ? `/admin/marketing/empresas/${a.companyId}`
            : a.contactId
              ? `/admin/marketing/contactos/${a.contactId}`
              : "#";
          const rel = a.createdAt
            ? formatDistanceToNow(new Date(a.createdAt), { addSuffix: true, locale: es })
            : "";
          return (
            <li key={a.id} className="flex items-start gap-3 rounded-lg border bg-background px-3 py-2.5 text-sm">
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${color}`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug">
                  {a.summary || a.type || "Actividad"}
                </p>
                {a.actorName && (
                  <p className="text-xs text-muted-foreground">{a.actorName}</p>
                )}
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                <span className="text-xs text-muted-foreground">{rel}</span>
                {href !== "#" && (
                  <Link href={href} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                    ver →
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function MarketingDashboard() {
  const { toast } = useToast();
  const params = useSearchParams();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const gmail = params.get("gmail");
    if (gmail === "ok") toast({ title: "Gmail conectado" });
    if (gmail === "denied") toast({ title: "No se autorizó Gmail", variant: "destructive" });
    if (gmail === "error") toast({ title: params.get("reason") || "Error al conectar Gmail", variant: "destructive" });
  }, [params, toast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/marketing/overview", { credentials: "include" });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Error");
        if (!cancelled) setData(body);
      } catch (e) {
        if (!cancelled) {
          toast({ title: e instanceof Error ? e.message : "No se pudo cargar", variant: "destructive" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  const totals = useMemo(() => data?.stages, [data]);

  if (loading) {
    return (
      <div className="space-y-6">
        <MarketingSubnav />
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <MarketingSubnav />
        <p className="text-sm text-destructive">No se pudo cargar el CRM.</p>
      </div>
    );
  }

  const hasCompanies = (data.companies?.total ?? 0) > 0;

  return (
    <div className="space-y-6">
      <MarketingSubnav />
      <MarketingGmailBar fromEmail={data.fromEmail} replyTo={data.replyTo} />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Empresas"
          value={data.companies?.total ?? 0}
          href="/admin/marketing/empresas"
          icon={Building2}
          sub="en el CRM"
        />
        <KpiCard
          label="Contactos"
          value={data.total}
          href="/admin/marketing/contactos"
          icon={BarChart3}
          sub="de email marketing"
        />
        <KpiCard
          label="Pipeline"
          value={data.opportunities?.open ?? 0}
          href="/admin/marketing/oportunidades"
          icon={BarChart3}
          sub={
            data.opportunities?.pipelineValue
              ? `$${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(data.opportunities.pipelineValue)} en oportunidades`
              : "oportunidades abiertas"
          }
        />
        <KpiCard
          label="Tareas vencidas"
          value={data.tasks?.overdue ?? 0}
          href="/admin/marketing/seguimiento"
          icon={AlertTriangle}
          urgent={(data.tasks?.overdue ?? 0) > 0}
          sub={data.tasks?.dueToday ? `${data.tasks.dueToday} vencen hoy` : "sin tareas vencidas"}
        />
      </div>

      {/* pipeline funnel + contacts table */}
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {data.pipeline && data.pipeline.length > 0 && (
          <PipelineFunnel stages={data.pipeline} />
        )}

        <div>
          {data.total === 0 ? (
            <div className="rounded-lg border bg-background px-5 py-10">
              <h3 className="text-lg font-semibold">Todavía no hay contactos</h3>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Importá un CSV o agregá empresas al CRM para empezar a hacer seguimiento.
              </p>
              <div className="mt-5 flex gap-3">
                <Button asChild>
                  <Link href="/admin/marketing/empresas">Agregar empresas</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/admin/marketing/contactos">Cargar contactos</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-background overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[10rem]">País</TableHead>
                    <TableHead className="text-right tabular-nums">Total</TableHead>
                    {PIPELINE_STAGES.map((s) => (
                      <TableHead key={s} className="text-right tabular-nums">
                        {STAGE_LABEL[s]}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.countries.map((row) => (
                    <TableRow key={row.code}>
                      <TableCell>
                        <Link
                          href={`/admin/marketing/contactos?country=${row.code}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {row.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.total}</TableCell>
                      {PIPELINE_STAGES.map((s) => (
                        <TableCell key={s} className="text-right tabular-nums">
                          {row.stages[s] ? (
                            <Link
                              href={`/admin/marketing/contactos?country=${row.code}&stage=${s}`}
                              className="hover:underline"
                            >
                              {row.stages[s]}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {totals ? (
                    <TableRow className="bg-muted/40 font-medium">
                      <TableCell>Todos</TableCell>
                      <TableCell className="text-right tabular-nums">{data.total}</TableCell>
                      {PIPELINE_STAGES.map((s) => (
                        <TableCell key={s} className="text-right tabular-nums">
                          {totals[s] || 0}
                        </TableCell>
                      ))}
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* recent activity feed */}
      {data.recentActivities && data.recentActivities.length > 0 && (
        <ActivityFeed activities={data.recentActivities} />
      )}

      {/* recent campaigns */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Campañas recientes</h3>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/marketing/campanas?outcome=unsent">Sin envíos</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/marketing/campanas?outcome=replied">Con respuestas</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/marketing/campanas/nueva">Nueva campaña</Link>
            </Button>
          </div>
        </div>
        {data.campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay campañas de marketing.</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-background">
            {data.campaigns.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/marketing/campanas/${c.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-muted/40"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <StageBadge stage={c.status === "sent" ? "sent" : c.status === "sending" ? "queued" : "new"} />
                    {c.stats?.sent ? `${c.stats.sent} env.` : null}
                    {c.stats?.delivered ? ` · ${c.stats.delivered} rec.` : null}
                    {c.stats?.opened ? ` · ${c.stats.opened} ab.` : null}
                    {c.stats?.replied ? ` · ${c.stats.replied} resp.` : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function MarketingDashboardFallback() {
  return (
    <div className="flex items-center gap-2 py-12 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Cargando marketing…
    </div>
  );
}
