"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";

type CountryRow = {
  code: string;
  name: string;
  total: number;
  stages: Record<MarketingStage, number>;
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
};

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
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const totals = useMemo(() => data?.stages, [data]);

  if (loading) {
    return (
      <div className="space-y-6">
        <MarketingSubnav />
        <Skeleton className="h-16 w-full" />
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

  return (
    <div className="space-y-6">
      <MarketingSubnav />
      <MarketingGmailBar fromEmail={data.fromEmail} replyTo={data.replyTo} />

      {data.total === 0 ? (
        <div className="rounded-lg border bg-background px-5 py-10">
          <h3 className="text-lg font-semibold">Todavía no hay empresas en el listado</h3>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Importá un CSV, nombrá la lista, y en Campañas elegí a quién se lo mandamos. El seguimiento se arma por país: envío, apertura, clic y respuesta.
          </p>
          <Button asChild className="mt-5">
            <Link href="/admin/marketing/contactos">Cargar contactos</Link>
          </Button>
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

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Campañas recientes</h3>
          <Button asChild size="sm">
            <Link href="/admin/marketing/campanas/nueva">Nueva campaña</Link>
          </Button>
        </div>
        {data.campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay campañas de marketing.</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-background">
            {data.campaigns.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/marketing/campanas/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-muted/40">
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
