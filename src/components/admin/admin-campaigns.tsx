"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { CanalCampaign } from "@/lib/types";

type CampaignRow = {
  id: string;
  orgId: string;
  nombre: string;
  canal: CanalCampaign;
  estado: string;
  recipientCount: number;
  simulated?: boolean;
  stats: { enviados: number; errores: number; pendientes: number };
};

function estadoLabel(estado: string) {
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

export function AdminCampaigns() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [orgNames, setOrgNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, oRes] = await Promise.all([
        fetch("/api/admin/campaigns", { credentials: "include" }),
        fetch("/api/admin/organizations", { credentials: "include" }),
      ]);
      const cData = await cRes.json();
      const oData = await oRes.json();
      setCampaigns(Array.isArray(cData.campaigns) ? cData.campaigns : []);
      const names: Record<string, string> = {};
      for (const o of Array.isArray(oData.organizations) ? oData.organizations : []) {
        names[o.id] = String(o.nombre || o.id);
      }
      setOrgNames(names);
    } catch {
      toast({ title: "No se pudieron cargar las campañas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="max-w-4xl space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Operadas desde admin. Los créditos se descuentan de la empresa.</p>
        <Button asChild>
          <Link href="/admin/campanas/nueva">Nueva campaña</Link>
        </Button>
      </div>
      {campaigns.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay campañas masivas.</p>
      ) : (
        <ul className="space-y-2">
          {campaigns.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/campanas/${c.id}`}
                className="block rounded-lg border p-4 hover:bg-muted/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{c.nombre}</div>
                  <div className="flex items-center gap-2">
                    {c.simulated ? <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">simulada</Badge> : null}
                    {estadoLabel(c.estado)}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {orgNames[c.orgId] || c.orgId} · {c.canal} · {c.recipientCount.toLocaleString("es-AR")} dest.
                  {c.stats.enviados > 0 ? ` · ${c.stats.enviados.toLocaleString("es-AR")} enviados` : ""}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {loading && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
