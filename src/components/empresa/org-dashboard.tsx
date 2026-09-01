"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import type { Campaign } from "@/lib/types";
import { isAdminManagedCampaign } from "@/lib/campaign-edit";
import {
  buildOrgDashboardStats,
  campaignSubtitle,
  campaignTitle,
  canalLabel,
  canalOf,
  formatInt,
  parseCampaignInstant,
} from "@/lib/empresa-dashboard-stats";
import {
  buildIndividualDashboardStats,
  type IndividualSendStatus,
  type IndividualSendSummary,
} from "@/lib/empresa-individual-stats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const chartConfig = {
  email: { label: "Email", color: "hsl(var(--accent))" },
  whatsapp: { label: "WhatsApp", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

function estadoBadge(estado: Campaign["estado"]) {
  switch (estado) {
    case "borrador":
      return <Badge variant="secondary">borrador</Badge>;
    case "enviando":
      return <Badge className="bg-blue-600 hover:bg-blue-600">enviando</Badge>;
    case "completada":
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">completada</Badge>;
    case "pausada":
      return <Badge className="bg-amber-600 hover:bg-amber-600">pausada</Badge>;
    case "cancelada":
      return <Badge variant="destructive">cancelada</Badge>;
    default:
      return <Badge variant="outline">{estado}</Badge>;
  }
}

function fmtDate(ts: unknown): string {
  const d = parseCampaignInstant(ts);
  if (!d) return "—";
  return d.toLocaleDateString("es-AR", { dateStyle: "short" });
}

function deltaCopy(pct: number | null, prev: number, current: number): string {
  if (prev === 0 && current === 0) return "Sin envíos este mes ni el anterior";
  if (pct === null) return `${formatInt(current)} este mes · sin base el mes anterior`;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toLocaleString("es-AR")}% vs mes anterior (${formatInt(prev)})`;
}

export function OrgDashboardSkeleton() {
  return (
    <div className="space-y-6 p-4 sm:space-y-8 sm:p-8">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-36 w-full" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function OrgDashboard({
  orgId,
  campaigns,
  individualSends = [],
}: {
  orgId: string;
  campaigns: Campaign[];
  individualSends?: IndividualSendSummary[];
}) {
  const stats = useMemo(() => buildOrgDashboardStats(campaigns), [campaigns]);
  const individual = useMemo(() => buildIndividualDashboardStats(individualSends), [individualSends]);
  const nuevaHref = `/empresa/${orgId}/campanas/nueva`;
  const listHref = `/empresa/${orgId}/campanas`;
  const enviosHref = `/empresa/${orgId}/envios`;

  const header = (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {formatInt(stats.campanas)} envíos masivos
          {stats.omitidasSimuladas > 0
            ? ` (${formatInt(stats.omitidasSimuladas)} simulado${stats.omitidasSimuladas === 1 ? "" : "s"} excluido${stats.omitidasSimuladas === 1 ? "" : "s"})`
            : ""}
          {" · "}
          {formatInt(individual.total)} individuales.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link href={enviosHref}>Ver envíos individuales</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={listHref}>Ver envíos masivos</Link>
        </Button>
        <Button asChild>
          <Link href={nuevaHref}>Enviar nuevo envío masivo</Link>
        </Button>
      </div>
    </header>
  );

  const individualSection = (
    <IndividualSendsSection orgId={orgId} stats={individual} />
  );

  if (stats.campanas === 0) {
    return (
      <div className="space-y-8 p-4 sm:space-y-8 sm:p-8 max-w-[88rem]">
        {header}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-6">
            <p className="font-medium">Envíos masivos</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {stats.omitidasSimuladas > 0
                ? `Hay ${formatInt(stats.omitidasSimuladas)} simulado${stats.omitidasSimuladas === 1 ? "" : "s"} que no se cuenta${stats.omitidasSimuladas === 1 ? "" : "n"} acá.`
                : "Todavía no hay envíos masivos reales. El resumen de volumen aparece acá."}
            </p>
            <Button asChild className="mt-4">
              <Link href={nuevaHref}>Enviar nuevo envío masivo</Link>
            </Button>
          </div>
          {individualSection}
        </div>
      </div>
    );
  }

  const estadoRows: { key: Campaign["estado"]; label: string }[] = [
    { key: "enviando", label: "Enviando" },
    { key: "pausada", label: "Pausadas" },
    { key: "completada", label: "Completadas" },
    { key: "borrador", label: "Borradores" },
    { key: "cancelada", label: "Canceladas" },
  ];

  return (
    <div className="space-y-8 p-4 sm:p-8 max-w-[88rem]">
      {header}
      <p className="-mt-4 max-w-2xl text-sm text-muted-foreground">
        {formatInt(stats.destinatarios)} destinatarios en envíos masivos. Solo se cuentan envíos reales.
        Los masivos se agrupan por el mes en que arrancó cada uno.
      </p>

      <section
        aria-label="Indicadores de envío"
        className="overflow-hidden rounded-lg border bg-card"
      >
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          <Metric
            className="sm:col-span-2 lg:col-span-1"
            label="Mensajes enviados"
            value={formatInt(stats.enviados)}
            hint={deltaCopy(stats.deltaEnviadosMesPct, stats.enviadosMesAnterior, stats.enviadosMes)}
            emphasize
          />
          <Metric
            label="Este mes"
            value={formatInt(stats.enviadosMes)}
            hint={`Mes anterior: ${formatInt(stats.enviadosMesAnterior)}`}
          />
          <Metric
            label="Pendientes"
            value={formatInt(stats.pendientes)}
            hint={
              stats.pendientesWa > 0
                ? `${formatInt(stats.pendientesWa)} en envíos masivos con WhatsApp`
                : "En cola de envío"
            }
            warn={stats.pendientes > 0}
          />
          <Metric
            label="WhatsApp enviados"
            value={formatInt(stats.waEnviados)}
            hint={
              stats.mixtas > 0
                ? `Incluye ${formatInt(stats.mixtas)} envíos masivos mixtos (email + WhatsApp)`
                : `Email: ${formatInt(stats.emailEnviados)}`
            }
          />
          <Metric
            label="Leídos"
            value={`${formatInt(stats.leidos)}`}
            hint={stats.enviados > 0 ? `Tasa ${stats.tasaLectura.toLocaleString("es-AR")}% sobre enviados` : "Sin envíos todavía"}
          />
          <Metric
            label="Errores"
            value={formatInt(stats.errores)}
            hint={stats.errores > 0 ? "Revisá los envíos masivos con fallos" : "Sin errores acumulados"}
            warn={stats.errores > 0}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-lg border bg-card p-4 sm:p-5 lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Envíos por mes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Email y WhatsApp de los últimos 12 meses. En envíos mixtos el mismo destinatario cuenta en ambos canales.
            </p>
          </div>
          <ChartContainer config={chartConfig} className="aspect-[16/7] w-full min-h-[240px]">
            <BarChart data={stats.months} accessibilityLayer>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={12}
                width={48}
                tickFormatter={(v) => Number(v).toLocaleString("es-AR")}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="email" fill="var(--color-email)" radius={[0, 0, 0, 0]} stackId="a" />
              <Bar dataKey="whatsapp" fill="var(--color-whatsapp)" radius={[4, 4, 0, 0]} stackId="a" />
            </BarChart>
          </ChartContainer>
        </section>

        <section className="rounded-lg border bg-card p-4 sm:p-5">
          <h2 className="text-base font-semibold">Estado de envíos masivos</h2>
          <ul className="mt-4 space-y-3">
            {estadoRows.map(({ key, label }) => {
              const n = stats.porEstado[key];
              const pct = stats.campanas > 0 ? Math.round((n / stats.campanas) * 100) : 0;
              return (
                <li key={key}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span>{label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatInt(n)} · {pct}%
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </li>
              );
            })}
          </ul>
          <div className="mt-6 border-t pt-4 text-sm">
            <p className="font-medium">Canales</p>
            <p className="mt-1 text-muted-foreground">
              Email {formatInt(stats.emailEnviados)} · WhatsApp {formatInt(stats.waEnviados)}
            </p>
          </div>
        </section>
      </div>

      {stats.enCurso.length > 0 ? (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="text-base font-semibold">En curso y pendientes</h2>
            <p className="text-sm text-muted-foreground">{formatInt(stats.enCurso.length)}</p>
          </div>
          <CampaignTable orgId={orgId} rows={stats.enCurso} />
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-base font-semibold">Envíos masivos recientes</h2>
          <Link href={listHref} className="text-sm font-medium text-primary hover:underline">
            Ver todas
          </Link>
        </div>
        <CampaignTable orgId={orgId} rows={stats.recientes} />
      </section>

      {individualSection}
    </div>
  );
}

function individualStatusBadge(status: IndividualSendStatus) {
  const variant =
    status === "Leído"
      ? "default"
      : status === "Abierto"
        ? "secondary"
        : status === "Rebotó"
          ? "destructive"
          : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}

function IndividualSendsSection({
  orgId,
  stats,
}: {
  orgId: string;
  stats: ReturnType<typeof buildIndividualDashboardStats>;
}) {
  const enviosHref = `/empresa/${orgId}/envios`;
  return (
    <section className="rounded-lg border bg-card p-4 sm:p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Envíos individuales</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.total === 0
              ? "Los 1:1 de esta empresa aparecen acá, aparte de los envíos masivos."
              : `${formatInt(stats.total)} envíos · ${formatInt(stats.esteMes)} este mes · ${formatInt(stats.leidos)} leídos.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={enviosHref}>Ver todos</Link>
          </Button>
          <Button asChild>
            <Link href={enviosHref}>Nuevo envío 1:1</Link>
          </Button>
        </div>
      </div>

      {stats.total === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay envíos individuales desde esta cuenta.</p>
      ) : (
        <>
          <div className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-4">
            <Metric label="Individuales" value={formatInt(stats.total)} hint={`${formatInt(stats.esteMes)} este mes`} />
            <Metric label="Leídos" value={formatInt(stats.leidos)} hint={`${formatInt(stats.abiertos)} abiertos`} />
            <Metric label="Rebotes" value={formatInt(stats.rebotes)} hint="Correo que no llegó" warn={stats.rebotes > 0} />
            <Metric label="Pendientes" value={formatInt(stats.pendientes)} hint="Sin aceptación SMTP todavía" warn={stats.pendientes > 0} />
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Para</TableHead>
                  <TableHead>Asunto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recientes.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/40">
                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(row.sentAt)}</TableCell>
                    <TableCell>
                      <Link href={`/empresa/${orgId}/envios/${row.id}`} className="font-medium text-foreground hover:underline">
                        {row.to || "—"}
                      </Link>
                    </TableCell>
                    <TableCell>{row.subject}</TableCell>
                    <TableCell>{individualStatusBadge(row.lastStatus)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  hint,
  emphasize,
  warn,
  className,
}: {
  label: string;
  value: string;
  hint: string;
  emphasize?: boolean;
  warn?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("bg-card px-4 py-4 sm:px-5 sm:py-5", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-semibold tabular-nums tracking-tight",
          emphasize ? "text-3xl" : "text-2xl",
          warn && "text-amber-600 dark:text-amber-400",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs leading-snug text-muted-foreground">{hint}</p>
    </div>
  );
}

function CampaignTable({ orgId, rows }: { orgId: string; rows: Campaign[] }) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Envío masivo</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Dest.</TableHead>
            <TableHead className="text-right">Enviados</TableHead>
            <TableHead className="text-right">Leídos</TableHead>
            <TableHead className="text-right">Pendientes</TableHead>
            <TableHead>Fecha</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => {
            const canal = canalOf(c);
            const st = c.stats;
            return (
              <TableRow key={c.id} className="hover:bg-muted/40">
                <TableCell>
                  <Link href={`/empresa/${orgId}/campanas/${c.id}`} className="block min-w-[10rem]">
                    <span className="font-medium text-foreground hover:underline">{campaignTitle(c)}</span>
                    {campaignSubtitle(c) ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">{campaignSubtitle(c)}</span>
                    ) : null}
                    {isAdminManagedCampaign(c) ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">solo consulta</span>
                    ) : null}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{canalLabel(canal)}</TableCell>
                <TableCell>{estadoBadge(c.estado)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatInt(c.recipientCount || 0)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatInt(st.enviados || 0)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatInt(st.leidos || 0)}
                  {st.enviados > 0 ? (
                    <span className="ml-1 text-xs text-muted-foreground">
                      {Math.round((st.leidos / st.enviados) * 100)}%
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatInt(st.pendientes || 0)}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {fmtDate(c.startedAt ?? c.createdAt)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
