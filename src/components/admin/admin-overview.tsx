"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import StatsCards from "@/components/admin/stats-cards";
import OverviewChart from "@/components/admin/overview-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AdminStatsPayload } from "@/lib/admin-stats-server";

export default function AdminOverview() {
  const [data, setData] = useState<AdminStatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/stats", { credentials: "include" });
        const body = (await res.json().catch(() => ({}))) as AdminStatsPayload & {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(body.error || `Error ${res.status}`);
        }
        if (!cancelled) setData(body);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "No se pudieron cargar las estadísticas");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando estadísticas…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-6 text-sm text-destructive">
        {error ?? "No se pudieron cargar las estadísticas"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StatsCards
        stats={data.stats}
        nuevosUsuariosMes={data.nuevosUsuariosMes}
        tasaActividad={data.tasaActividad}
        deltas={data.deltas}
      />
      <Card>
        <CardHeader>
          <CardTitle>Visión General</CardTitle>
          <CardDescription>
            Nuevos usuarios e ingresos por compras durante los últimos 12 meses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OverviewChart data={data.chart} />
        </CardContent>
      </Card>
    </div>
  );
}
