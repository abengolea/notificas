"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  archivedAt?: string | null;
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
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [orgNames, setOrgNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [archivedView, setArchivedView] = useState<"hide" | "only">("hide");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = archivedView === "only" ? "?archived=only" : "";
      const [cRes, oRes] = await Promise.all([
        fetch(`/api/admin/campaigns${qs}`, { credentials: "include" }),
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
  }, [toast, archivedView]);

  useEffect(() => {
    void load();
  }, [load]);

  async function copyCampaign(row: CampaignRow) {
    setBusyId(row.id);
    try {
      const res = await fetch("/api/campaigns/copy", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: row.id, orgId: row.orgId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo copiar");
      toast({ title: "Campaña copiada como borrador" });
      router.push(`/admin/campanas/${data.newCampaignId}`);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function retryFailed(row: CampaignRow) {
    setBusyId(row.id);
    try {
      const res = await fetch("/api/admin/campaigns/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: row.id, retryErrors: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo reenviar");
      toast({ title: "Reintento", description: `${data.pending ?? data.pendingThisTanda ?? 0} mensajes encolados` });
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function toggleArchive(row: CampaignRow) {
    setBusyId(row.id);
    try {
      const archived = !row.archivedAt;
      const res = await fetch(`/api/admin/campaigns/${row.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo archivar");
      toast({ title: archived ? "Campaña archivada" : "Campaña restaurada" });
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

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
      <div className="flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Copiá para reusar el envío, reenviá los mensajes que fallaron, o archivá las que ya no querés ver.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={archivedView === "only" ? "secondary" : "outline"}
            onClick={() => setArchivedView((v) => (v === "only" ? "hide" : "only"))}
          >
            {archivedView === "only" ? "Ver activas" : "Ver archivadas"}
          </Button>
          <Button asChild>
            <Link href="/admin/campanas/nueva">Nueva campaña</Link>
          </Button>
        </div>
      </div>
      {campaigns.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {archivedView === "only" ? "No hay campañas archivadas." : "Todavía no hay campañas masivas."}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-background">
          {campaigns.map((c) => (
            <li key={c.id} className="px-4 py-4">
              <Link href={`/admin/campanas/${c.id}`} className="block hover:opacity-80">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{c.nombre}</div>
                  <div className="flex items-center gap-2">
                    {c.archivedAt ? <Badge variant="outline">archivada</Badge> : null}
                    {c.simulated ? <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">simulada</Badge> : null}
                    {estadoLabel(c.estado)}
                  </div>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {orgNames[c.orgId] || c.orgId} · {c.canal} · {c.recipientCount.toLocaleString("es-AR")} dest.
                  {c.stats.enviados > 0 ? ` · ${c.stats.enviados.toLocaleString("es-AR")} enviados` : ""}
                  {c.stats.errores > 0 ? ` · ${c.stats.errores.toLocaleString("es-AR")} fallidos` : ""}
                </div>
              </Link>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" disabled={busyId !== null} onClick={() => void copyCampaign(c)}>
                  Copiar campaña
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyId !== null || !(c.stats.errores > 0)}
                  onClick={() => void retryFailed(c)}
                >
                  Reenviar fallidos{c.stats.errores > 0 ? ` (${c.stats.errores})` : ""}
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={busyId !== null} onClick={() => void toggleArchive(c)}>
                  {c.archivedAt ? "Restaurar" : "Archivar"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
