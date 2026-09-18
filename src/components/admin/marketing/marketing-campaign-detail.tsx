"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { MarketingSubnav } from "./marketing-subnav";
import { StageBadge } from "./stage-badge";
import { MarketingListUpload } from "./marketing-list-upload";
import { MarketingRecipientPreview, type PreviewContact } from "./marketing-recipient-preview";
import { countryName } from "@/lib/marketing/countries";
import { CAMPAIGN_OUTCOME_LABEL, CAMPAIGN_OUTCOMES, sendMatchesOutcome } from "@/lib/marketing/admin-filters";
import { MarketingCampaignActions } from "./marketing-campaign-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type Send = {
  id: string;
  contactId: string;
  email: string;
  name: string;
  company: string;
  status: string;
  sentAt: string | null;
  deliveredAt: string | null;
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
  listId?: string | null;
  listName?: string;
  status: string;
  subject: string;
  htmlBody: string;
  fromEmail?: string;
  archivedAt?: string | null;
  stats?: Record<string, number>;
  contactCount?: number;
};

type Audience = {
  total: number;
  eligible: number;
  skipped: number;
  contacts: PreviewContact[];
};

export function MarketingCampaignDetail({ campaignId }: { campaignId: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [sends, setSends] = useState<Send[]>([]);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"send" | "tick" | "pause" | "save" | "copy" | "retry" | "archive" | null>(null);
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [sendOutcome, setSendOutcome] = useState("all");

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/marketing/campaigns/${campaignId}`, { credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error");
    setCampaign(data.campaign);
    setSends(data.sends || []);
    setAudience(data.audience || null);
    setSubject(String(data.campaign?.subject || ""));
    setHtmlBody(String(data.campaign?.htmlBody || ""));
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

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/marketing/campaigns/${campaignId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudo actualizar");
    return data;
  }

  async function saveCopy() {
    setBusy("save");
    try {
      if (!subject.trim() || htmlBody.trim().length < 8) {
        throw new Error("Completá asunto y texto del correo");
      }
      await patch({ subject: subject.trim(), htmlBody });
      toast({ title: "Texto guardado" });
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function attachList(listId: string) {
    setBusy("save");
    try {
      await patch({ listId });
      toast({ title: "Lista asociada a esta campaña" });
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function startSend() {
    setBusy("send");
    try {
      if (subject !== campaign?.subject || htmlBody !== campaign?.htmlBody) {
        await patch({ subject: subject.trim(), htmlBody });
      }
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
      await patch({ status: campaign?.status === "paused" ? "sending" : "paused" });
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function copyCampaign() {
    setBusy("copy");
    try {
      const res = await fetch(`/api/admin/marketing/campaigns/${campaignId}/copy`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo copiar");
      toast({ title: "Campaña copiada como borrador" });
      router.push(`/admin/marketing/campanas/${data.campaign.id}`);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
      setBusy(null);
    }
  }

  async function retryFailed() {
    setBusy("retry");
    try {
      const res = await fetch(`/api/admin/marketing/campaigns/${campaignId}/retry`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo reenviar");
      toast({
        title: data.retried
          ? `${data.retried} fallidos en cola`
          : data.skipped
            ? "Nada para reenviar (bajas o sin email)"
            : "No hay envíos fallidos",
      });
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function toggleArchive() {
    setBusy("archive");
    try {
      await patch({ archived: !campaign?.archivedAt });
      toast({ title: campaign?.archivedAt ? "Campaña restaurada" : "Campaña archivada" });
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
  const isDraft = campaign.status === "draft";
  const archived = Boolean(campaign.archivedAt);
  const failedCount = sends.filter((row) => row.status === "failed").length || stats.failed || 0;
  const hasNamedList = Boolean(audience && audience.total > 0);
  const canSend = isDraft && !archived && hasNamedList && (audience?.eligible || 0) > 0 && htmlBody.trim().length >= 8 && subject.trim().length >= 2;
  const filteredSends = sendOutcome === "all" ? sends : sends.filter((row) => sendMatchesOutcome(row, sendOutcome));
  const statTiles: Array<{ label: string; value: number; outcome: string }> = [
    { label: "En cola", value: stats.queued || 0, outcome: "unsent" },
    { label: "Enviados", value: stats.sent || 0, outcome: "sent" },
    { label: "Recibidos", value: stats.delivered || 0, outcome: "delivered" },
    { label: "Abiertos", value: stats.opened || 0, outcome: "opened" },
    { label: "Clics", value: stats.clicked || 0, outcome: "clicked" },
    { label: "Respuestas", value: stats.replied || 0, outcome: "replied" },
    { label: "Rebotes", value: stats.bounced || 0, outcome: "bounced" },
    { label: "Fallidos", value: stats.failed || 0, outcome: "failed" },
    { label: "Bajas", value: stats.unsubscribed || 0, outcome: "unsubscribed" },
  ];

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
            {campaign.listName || (campaign.country === "all" ? "Sin lista nominada" : countryName(campaign.country))} · {campaign.subject}
            {archived ? " · Archivada" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft ? (
            <Button onClick={() => void startSend()} disabled={busy !== null || !canSend}>
              {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar ahora"}
            </Button>
          ) : null}
          {campaign.status === "sending" || campaign.status === "paused" ? (
            <Button variant="outline" onClick={() => void pause()} disabled={busy !== null || archived}>
              {campaign.status === "paused" ? "Reanudar" : "Pausar"}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="space-y-2 rounded-lg border bg-background p-4">
        <h4 className="text-sm font-medium">Acciones</h4>
        <MarketingCampaignActions
          archived={archived}
          failedCount={failedCount}
          canRetry={!isDraft && failedCount > 0}
          busy={busy !== null}
          onCopy={() => void copyCampaign()}
          onRetry={() => void retryFailed()}
          onArchive={() => void toggleArchive()}
        />
      </div>
      {archived ? (
        <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Esta campaña está archivada. No aparece en la lista activa. Restaurala para reanudar o enviar.
        </p>
      ) : null}

      {isDraft ? (
        <div className="space-y-3 rounded-lg border bg-background p-4">
          <div>
            <h4 className="text-sm font-medium">Destinatarios de este envío</h4>
            <p className="text-sm text-muted-foreground">
              Subí un CSV. No se usan contactos viejos del CRM salvo que estén en esta lista.
            </p>
          </div>
          <MarketingListUpload requireTaxonomy defaultName={campaign.name} onImported={(list) => void attachList(list.listId)} />
          {audience && audience.total > 0 ? (
            <MarketingRecipientPreview
              contacts={audience.contacts}
              total={audience.total}
              eligible={audience.eligible}
              skipped={audience.skipped}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Todavía no hay destinatarios cargados en esta campaña.</p>
          )}
        </div>
      ) : null}

      {isDraft ? (
        <div className="space-y-3 rounded-lg border bg-background p-4">
          <h4 className="text-sm font-medium">Texto del correo</h4>
          <div className="space-y-1">
            <Label htmlFor="camp-subj">Asunto</Label>
            <Input id="camp-subj" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="camp-body">Cuerpo</Label>
            <Textarea id="camp-body" rows={12} value={htmlBody} onChange={(e) => setHtmlBody(e.target.value)} className="font-sans text-sm" />
            <p className="text-sm text-muted-foreground">Variables: {"{{nombre}} {{empresa}} {{pais}} {{cargo}} {{email}}"}</p>
          </div>
          <Button type="button" variant="outline" onClick={() => void saveCopy()} disabled={busy !== null}>
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar texto"}
          </Button>
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border bg-background p-4">
          <h4 className="text-sm font-medium">Texto enviado</h4>
          <p className="text-sm font-medium">{campaign.subject}</p>
          <div className="whitespace-pre-wrap text-sm text-muted-foreground">{campaign.htmlBody}</div>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
        {statTiles.map((tile) => (
          <button
            key={tile.label}
            type="button"
            className={`bg-background px-4 py-3 text-left ${sendOutcome === tile.outcome ? "ring-1 ring-inset ring-foreground/20" : ""}`}
            onClick={() => setSendOutcome(sendOutcome === tile.outcome ? "all" : tile.outcome)}
          >
            <dt className="text-sm text-muted-foreground">{tile.label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{tile.value}</dd>
          </button>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">
        Marketing no se certifica en Polygon. Solo se registra si el correo llegó y si se abrió.
      </p>

      {campaign.status === "sending" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Enviando por Resend desde {campaign.fromEmail || "contacto@notificas.com"}…
        </p>
      ) : null}

      {isDraft && sends.length === 0 ? null : (
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {filteredSends.length} de {sends.length} destinatarios
          </p>
          <div className="w-56 space-y-1">
            <Label>Filtrar envíos</Label>
            <Select value={sendOutcome} onValueChange={setSendOutcome}>
              <SelectTrigger><SelectValue placeholder="Resultado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {CAMPAIGN_OUTCOMES.map((row) => (
                  <SelectItem key={row} value={row}>{CAMPAIGN_OUTCOME_LABEL[row]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="rounded-lg border bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destinatario</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Recibido / abierto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSends.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-sm text-muted-foreground">
                  {sends.length === 0 ? "Todavía no hay envíos." : "Nada coincide con ese resultado."}
                </TableCell>
              </TableRow>
            ) : (
              filteredSends.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={`/admin/marketing/contactos/${s.contactId}`} className="font-medium hover:underline">
                      {s.company || s.email}
                    </Link>
                    <div className="text-sm text-muted-foreground">{s.name} · {s.email}</div>
                  </TableCell>
                  <TableCell><StageBadge stage={s.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.deliveredAt ? "Recibido" : s.sentAt ? "Enviado" : "—"}
                    {s.openedAt ? ` · Abierto${s.openCount && s.openCount > 1 ? ` ×${s.openCount}` : ""}` : ""}
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
      )}
    </div>
  );
}
