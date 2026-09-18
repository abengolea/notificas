"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MarketingSubnav } from "./marketing-subnav";
import { StageBadge } from "./stage-badge";
import {
  CAMPAIGN_FILTER_SHOW,
  EMPTY_MARKETING_FILTERS,
  MarketingFilterBar,
  filtersFromSearchParams,
  filtersToSearchParams,
  type MarketingFilterValues,
} from "./marketing-filter-bar";
import type { TaxonomyCatalog } from "./marketing-taxonomy-fields";
import { CAMPAIGN_STATUS_LABEL, isCampaignAdminStatus } from "@/lib/marketing/admin-filters";
import { countryName } from "@/lib/marketing/countries";
import { MarketingCampaignActions } from "./marketing-campaign-actions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type Campaign = {
  id: string;
  name: string;
  country: string;
  listName?: string;
  status: string;
  subject: string;
  industryId?: string | null;
  useCaseId?: string | null;
  useCaseIds?: string[] | null;
  audienceKind?: string | null;
  archivedAt?: string | null;
  contactCount?: number;
  stats?: { sent?: number; delivered?: number; opened?: number; clicked?: number; replied?: number; bounced?: number; failed?: number; unsubscribed?: number };
  createdAt?: string | null;
};

function statusBadge(status: string): string {
  if (status === "draft") return "new";
  if (status === "sending") return "queued";
  if (status === "sent") return "sent";
  if (status === "paused") return "queued";
  return "new";
}

type ListOption = {
  id: string;
  name: string;
  contactCount?: number;
  virtual?: boolean;
};

export function MarketingCampaigns() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [filters, setFilters] = useState<MarketingFilterValues>(() => ({
    ...EMPTY_MARKETING_FILTERS,
    ...filtersFromSearchParams(params),
  }));
  const [rows, setRows] = useState<Campaign[]>([]);
  const [catalog, setCatalog] = useState<TaxonomyCatalog | null>(null);
  const [lists, setLists] = useState<ListOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const industryName = useMemo(() => new Map((catalog?.industries || []).map((row) => [row.key, row.name])), [catalog]);
  const useCaseName = useMemo(() => new Map((catalog?.useCases || []).map((row) => [row.key, row.name])), [catalog]);

  function reload() {
    const sp = filtersToSearchParams(filters);
    return fetch(`/api/admin/marketing/campaigns?${sp}`, { credentials: "include" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error");
        setRows(data.campaigns || []);
      });
  }

  async function copyCampaign(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/marketing/campaigns/${id}/copy`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo copiar");
      toast({ title: "Campaña copiada como borrador" });
      router.push(`/admin/marketing/campanas/${data.campaign.id}`);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function retryFailed(row: Campaign) {
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/marketing/campaigns/${row.id}/retry`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo reenviar");
      toast({
        title: data.retried
          ? `${data.retried} fallidos en cola`
          : data.skipped
            ? "Nada para reenviar (bajas o sin email)"
            : "No hay envíos fallidos",
      });
      await reload();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function toggleArchive(row: Campaign) {
    setBusyId(row.id);
    try {
      const archived = !row.archivedAt;
      const res = await fetch(`/api/admin/marketing/campaigns/${row.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo archivar");
      toast({ title: archived ? "Campaña archivada" : "Campaña restaurada" });
      await reload();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [catalogRes, listsRes] = await Promise.all([
          fetch("/api/admin/marketing/catalog", { credentials: "include" }),
          fetch("/api/admin/marketing/lists", { credentials: "include" }),
        ]);
        const data = await catalogRes.json();
        const listsData = await listsRes.json().catch(() => ({}));
        if (!catalogRes.ok) throw new Error(data.error || "No se pudo cargar el catálogo");
        if (!cancelled) {
          setCatalog({
            countries: data.countries || [],
            industries: data.industries || [],
            useCases: data.useCases || [],
          });
          if (listsRes.ok) setLists(listsData.lists || []);
        }
      } catch (e) {
        if (!cancelled) toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    const sp = filtersToSearchParams(filters);
    const qs = sp.toString();
    router.replace(`/admin/marketing/campanas${qs ? `?${qs}` : ""}`);
  }, [filters, router]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void (async () => {
        try {
          const sp = filtersToSearchParams(filters);
          const res = await fetch(`/api/admin/marketing/campaigns?${sp}`, {
            credentials: "include",
            signal: controller.signal,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Error");
          setRows(data.campaigns || []);
        } catch (e) {
          if (controller.signal.aborted) return;
          toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      })();
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [filters, toast]);

  return (
    <div className="space-y-6">
      <MarketingSubnav />
      <div className="flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Acciones de campaña</h3>
          <p className="text-sm text-muted-foreground">
            Copiá para reusar el texto, reenviá los correos que fallaron, o archivá las que ya no querés ver.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={filters.archived === "only" ? "secondary" : "outline"}
            onClick={() => setFilters((prev) => ({ ...prev, archived: prev.archived === "only" ? "hide" : "only" }))}
          >
            {filters.archived === "only" ? "Ver activas" : "Ver archivadas"}
          </Button>
          <Button asChild>
            <Link href="/admin/marketing/campanas/nueva">Nueva campaña</Link>
          </Button>
        </div>
      </div>
      <MarketingFilterBar
        catalog={catalog}
        lists={lists}
        values={filters}
        onChange={setFilters}
        show={CAMPAIGN_FILTER_SHOW}
      />
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay campañas con esos filtros. Cargá una lista en Contactos o armá una audiencia desde el CRM.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-background">
          {rows.map((c) => {
            const failedCount = c.stats?.failed || 0;
            return (
            <li key={c.id} className="px-4 py-4">
              <Link href={`/admin/marketing/campanas/${c.id}`} className="block hover:opacity-80">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{c.name}</span>
                  <span className="flex items-center gap-2">
                    {c.archivedAt ? <span className="text-xs text-muted-foreground">Archivada</span> : null}
                    <StageBadge stage={statusBadge(c.status)} />
                    <span className="text-xs text-muted-foreground">
                      {isCampaignAdminStatus(c.status) ? CAMPAIGN_STATUS_LABEL[c.status] : c.status}
                    </span>
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {c.country && c.country !== "all" ? countryName(c.country) : "Varios países"}
                  {c.industryId ? ` · ${industryName.get(c.industryId) || c.industryId}` : ""}
                  {(() => {
                    const keys = c.useCaseIds?.length ? c.useCaseIds : c.useCaseId ? [c.useCaseId] : [];
                    const names = keys.map((key) => useCaseName.get(key) || key).filter(Boolean);
                    return names.length ? ` · ${names.join(" · ")}` : "";
                  })()}
                  {c.listName ? ` · ${c.listName}` : ""}
                  {` · ${c.subject}`}
                  {c.stats?.sent ? ` · ${c.stats.sent} enviados` : " · sin envíos"}
                  {c.stats?.delivered ? ` · ${c.stats.delivered} recibidos` : ""}
                  {c.stats?.opened ? ` · ${c.stats.opened} abiertos` : ""}
                  {c.stats?.clicked ? ` · ${c.stats.clicked} clics` : ""}
                  {c.stats?.replied ? ` · ${c.stats.replied} respuestas` : ""}
                  {c.stats?.bounced ? ` · ${c.stats.bounced} rebotes` : ""}
                  {failedCount ? ` · ${failedCount} fallidos` : ""}
                  {c.stats?.unsubscribed ? ` · ${c.stats.unsubscribed} bajas` : ""}
                </p>
              </Link>
              <div className="mt-3">
                <MarketingCampaignActions
                  archived={Boolean(c.archivedAt)}
                  failedCount={failedCount}
                  canRetry={c.status !== "draft" && failedCount > 0}
                  busy={busyId === c.id}
                  onCopy={() => void copyCampaign(c.id)}
                  onRetry={() => void retryFailed(c)}
                  onArchive={() => void toggleArchive(c)}
                />
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
