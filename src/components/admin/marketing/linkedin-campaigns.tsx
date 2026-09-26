"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Linkedin, Plus, Search, Users } from "lucide-react";
import { MarketingSubnav } from "./marketing-subnav";
import { MarketingCampaignChannelTabs } from "./marketing-campaign-channel-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MARKETING_COUNTRIES, countryName } from "@/lib/marketing/countries";
import {
  LINKEDIN_CAMPAIGN_STATUS_LABEL,
  LINKEDIN_MESSAGE_TYPE_LABEL,
} from "@/lib/marketing/linkedin-ui";
import type {
  MarketingLinkedInCampaign,
  MarketingLinkedInCampaignStatus,
} from "@/lib/marketing/domain/types";

const STATUSES = Object.keys(LINKEDIN_CAMPAIGN_STATUS_LABEL) as MarketingLinkedInCampaignStatus[];

function CampaignStatusBadge({ status }: { status: MarketingLinkedInCampaignStatus }) {
  const className =
    status === "active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
      : status === "archived"
        ? "text-muted-foreground"
        : status === "paused"
          ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
          : "";
  return <Badge variant="outline" className={className}>{LINKEDIN_CAMPAIGN_STATUS_LABEL[status]}</Badge>;
}

export function LinkedInCampaigns() {
  const [campaigns, setCampaigns] = useState<MarketingLinkedInCampaign[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [country, setCountry] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ limit: "100" });
      if (query.trim()) params.set("q", query.trim());
      if (status !== "all") {
        params.set("status", status);
        if (status === "archived") params.set("archived", "only");
      }
      if (country !== "all") params.set("countryCode", country);
      void fetch(`/api/admin/marketing/linkedin/campaigns?${params}`, {
        credentials: "include",
        signal: controller.signal,
      })
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "No se pudieron cargar las campañas");
          setCampaigns(body.campaigns ?? []);
        })
        .catch((reason) => {
          if (!controller.signal.aborted) {
            setCampaigns([]);
            setError(reason instanceof Error ? reason.message : "No se pudieron cargar las campañas");
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [country, query, status]);

  const counts = useMemo(() => ({
    campaigns: campaigns.length,
    active: campaigns.filter((campaign) => campaign.status === "active").length,
    prospects: campaigns.reduce((sum, campaign) => sum + (campaign.memberCount || 0), 0),
  }), [campaigns]);

  const clearFilters = () => {
    setQuery("");
    setStatus("all");
    setCountry("all");
  };
  const filtered = Boolean(query || status !== "all" || country !== "all");

  return (
    <div className="space-y-6">
      <MarketingSubnav />
      <MarketingCampaignChannelTabs channel="linkedin" />
      <div className="flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Linkedin className="h-5 w-5" aria-hidden="true" />
            Campañas LinkedIn
          </h3>
          <p className="text-sm text-muted-foreground">
            Organizá el trabajo comercial manual. Este módulo no envía mensajes ni automatiza LinkedIn.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/marketing/linkedin/campanas/nueva">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Nueva campaña LinkedIn
          </Link>
        </Button>
      </div>

      <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
        {[
          { label: "Campañas visibles", value: counts.campaigns },
          { label: "Activas", value: counts.active },
          { label: "Prospectos", value: counts.prospects },
        ].map((item) => (
          <div key={item.label} className="bg-background px-4 py-3">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-3 rounded-lg border bg-background p-4 md:grid-cols-[minmax(220px,1fr)_220px_220px_auto] md:items-end">
        <div className="space-y-1">
          <Label htmlFor="linkedin-campaign-search">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="linkedin-campaign-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
              placeholder="Nombre de campaña o contacto"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Estado</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Filtrar por estado"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {STATUSES.map((value) => (
                <SelectItem key={value} value={value}>{LINKEDIN_CAMPAIGN_STATUS_LABEL[value]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>País</Label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger aria-label="Filtrar por país"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los países</SelectItem>
              {MARKETING_COUNTRIES.map((item) => (
                <SelectItem key={item.code} value={item.code}>{item.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="ghost" onClick={clearFilters} disabled={!filtered}>
          Limpiar filtros
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Cargando campañas LinkedIn">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-24 w-full" />)}
        </div>
      ) : error ? (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium text-destructive">No se pudieron cargar las campañas</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-lg border bg-background px-5 py-10">
          <h3 className="font-semibold">{filtered ? "No hay coincidencias" : "Todavía no hay campañas LinkedIn"}</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {filtered
              ? "Probá con otros filtros o limpiá la búsqueda."
              : "Creá una campaña para agrupar prospectos, preparar mensajes y registrar acciones realizadas manualmente."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {filtered && <Button variant="outline" onClick={clearFilters}>Limpiar filtros</Button>}
            <Button asChild>
              <Link href="/admin/marketing/linkedin/campanas/nueva">Crear campaña LinkedIn</Link>
            </Button>
          </div>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-background">
          {campaigns.map((campaign) => (
            <li key={campaign.id}>
              <Link
                href={`/admin/marketing/linkedin/campanas/${campaign.id}`}
                className="block px-4 py-4 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{campaign.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {campaign.countryCode ? countryName(campaign.countryCode) : "Sin país definido"}
                      {" · "}
                      {campaign.messageType ? LINKEDIN_MESSAGE_TYPE_LABEL[campaign.messageType] : "Secuencia sin definir"}
                    </p>
                    {campaign.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{campaign.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" aria-hidden="true" />
                      <span className="tabular-nums">{campaign.memberCount || 0}</span>
                    </span>
                    <CampaignStatusBadge status={campaign.status} />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
