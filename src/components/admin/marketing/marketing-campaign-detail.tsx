"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { MarketingSubnav } from "./marketing-subnav";
import { StageBadge } from "./stage-badge";
import { countryName } from "@/lib/marketing/countries";
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

type Send = {
  id: string;
  contactId: string;
  email: string;
  name: string;
  company: string;
  status: string;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  repliedAt: string | null;
  replySnippet: string | null;
  lastError: string | null;
  openCount?: number;
};

type Campaign = {
  id: string;
  name: string;
  country: string;
  status: string;
  subject: string;
  htmlBody: string;
  stats?: Record<string, number>;
  contactCount?: number;
};

export function MarketingCampaignDetail({ campaignId }: { campaignId: string }) {
  const { toast } = useToast();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [sends, setSends] = useState<Send[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"send" | "tick" | "pause" | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/marketing/campaigns/${campaignId}`, { credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error");
    setCampaign(data.campaign);
    setSends(data.sends || []);
  }, [campaignId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (e) {
        if (!cancelled) toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, toast]);

  useEffect(() => {
    if (campaign?.status !== "sending") return;
    const id = window.setInterval(() => {
      void (async () => {
        try {
          await fetch(`/api/admin/marketing/campaigns/${campaignId}/tick`, { method: "POST", credentials: "include" });
          await load();
        } catch {
          /* keep polling */
        }
      })();
    }, 2500);
    return () => window.clearInterval(id);
  }, [campaign?.status, campaignId, load]);

  async function startSend() {
    setBusy("send");
    try {
      const res = await fetch(`/api/admin/marketing/campaigns/${campaignId}/send`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo enviar");
      toast({ title: data.queued ? `${data.queued} correos en cola` : "Nada para enviar" });
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function pause() {
    setBusy("pause");
    try {
      const res = await fetch(`/api/admin/marketing/campaigns/${campaignId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: campaign?.status === "paused" ? "sending" : "paused" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo actualizar");
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  if (loading || !campaign) {
    return (
      <div className="space-y-6">
        <MarketingSubnav />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const stats = campaign.stats || {};

  return (
    <div className="space-y-6">
      <MarketingSubnav />
      <p className="text-sm">
        <Link href="/admin/marketing/campanas" className="text-muted-foreground hover:text-foreground">← Campañas</Link>
      </p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold">{campaign.name}</h3>
          <p className="text-sm text-muted-foreground">
            {campaign.country === "all" ? "Todos los países" : countryName(campaign.country)} · {campaign.subject}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {campaign.status === "draft" ? (
            <Button onClick={() => void startSend()} disabled={busy !== null}>
              {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar ahora"}
            </Button>
          ) : null}
          {campaign.status === "sending" || campaign.status === "paused" ? (
            <Button variant="outline" onClick={() => void pause()} disabled={busy !== null}>
              {campaign.status === "paused" ? "Reanudar" : "Pausar"}
            </Button>
          ) : null}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
        {[
          ["En cola", stats.queued],
          ["Enviados", stats.sent],
          ["Abiertos", stats.opened],
          ["Clics", stats.clicked],
          ["Respuestas", stats.replied],
          ["Rebotes", stats.bounced],
          ["Fallidos", stats.failed],
          ["Bajas", stats.unsubscribed],
        ].map(([label, value]) => (
          <div key={String(label)} className="bg-background px-4 py-3">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{value || 0}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">
        Abierto y clic son señales técnicas (pixel, proxy o Resend), no lectura certificada.
      </p>

      {campaign.status === "sending" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Enviando por Resend desde adrianbengolea@notificas.com…
        </p>
      ) : null}

      <div className="rounded-lg border bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destinatario</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Señales</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sends.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-sm text-muted-foreground">
                  Todavía no hay envíos. Enviá la campaña para armar la cola según el país y las etapas elegidas.
                </TableCell>
              </TableRow>
            ) : (
              sends.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={`/admin/marketing/contactos/${s.contactId}`} className="font-medium hover:underline">
                      {s.company || s.email}
                    </Link>
                    <div className="text-sm text-muted-foreground">{s.name} · {s.email}</div>
                  </TableCell>
                  <TableCell><StageBadge stage={s.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.openedAt ? `Abierto${s.openCount && s.openCount > 1 ? ` ×${s.openCount}` : ""}` : "—"}
                    {s.clickedAt ? " · clic" : ""}
                    {s.repliedAt ? " · respondió" : ""}
                    {s.replySnippet ? <div className="mt-1 text-foreground">{s.replySnippet}</div> : null}
                    {s.lastError ? <div className="text-destructive">{s.lastError}</div> : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
