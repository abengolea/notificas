"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MarketingSubnav } from "./marketing-subnav";
import { StageBadge } from "./stage-badge";
import { countryName } from "@/lib/marketing/countries";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type Campaign = {
  id: string;
  name: string;
  country: string;
  status: string;
  subject: string;
  contactCount?: number;
  stats?: { sent?: number; opened?: number; clicked?: number; replied?: number; bounced?: number; failed?: number };
  createdAt?: string | null;
};

export function MarketingCampaigns() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/marketing/campaigns", { credentials: "include" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error");
        if (!cancelled) setRows(data.campaigns || []);
      } catch (e) {
        if (!cancelled) toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  return (
    <div className="space-y-6">
      <MarketingSubnav />
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/admin/marketing/campanas/nueva">Nueva campaña</Link>
        </Button>
      </div>
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay campañas. Elegí un país, escribí el correo y mandalo a quienes estén en esa lista.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-background">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/marketing/campanas/${c.id}`} className="block px-4 py-4 hover:bg-muted/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{c.name}</span>
                  <StageBadge stage={c.status === "draft" ? "new" : c.status === "sending" ? "queued" : c.status === "sent" ? "sent" : "new"} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {c.country === "all" ? "Todos los países" : countryName(c.country)} · {c.subject}
                  {c.stats?.sent ? ` · ${c.stats.sent} enviados` : ""}
                  {c.stats?.opened ? ` · ${c.stats.opened} abiertos` : ""}
                  {c.stats?.replied ? ` · ${c.stats.replied} respuestas` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
