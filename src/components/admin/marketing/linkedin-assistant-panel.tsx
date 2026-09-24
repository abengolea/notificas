"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { MarketingSubnav } from "./marketing-subnav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type AssistantAction = {
  memberId: string;
  campaignId: string;
  contactId: string;
  campaign: { id: string; name: string; countryCode?: string | null };
  contact: {
    name: string;
    title?: string | null;
    companyName?: string | null;
    linkedinUrl: string;
  };
  action: "connection" | "message" | "followup";
  message: string | null;
  status: string;
  statusLabel: string;
  nextActionAt: string | null;
};

type CampaignSummary = {
  id: string;
  name: string;
  countryCode?: string | null;
  pending: number;
  total: number;
};

function completeActionForKind(kind: AssistantAction["action"]) {
  if (kind === "connection") return "connection_sent";
  if (kind === "message") return "message_sent";
  return "followup_sent";
}

export function LinkedInAssistantPanel() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [actions, setActions] = useState<AssistantAction[]>([]);
  const [campaignId, setCampaignId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [messagePreview, setMessagePreview] = useState<AssistantAction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (campaignId !== "all") params.set("campaignId", campaignId);
      const [campaignRes, actionsRes] = await Promise.all([
        fetch("/api/linkedin-assistant/campaigns"),
        fetch(`/api/linkedin-assistant/actions?${params}`),
      ]);
      if (!campaignRes.ok || !actionsRes.ok) throw new Error("No se pudo cargar el asistente");
      const campaignData = await campaignRes.json();
      const actionsData = await actionsRes.json();
      setCampaigns(campaignData.campaigns || []);
      setActions(actionsData.actions || []);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [campaignId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const pendingCount = useMemo(() => actions.length, [actions]);

  const markSent = async (action: AssistantAction) => {
    const res = await fetch(`/api/linkedin-assistant/actions/${action.memberId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: completeActionForKind(action.action) }),
    });
    if (!res.ok) {
      toast({ title: "Error al registrar", variant: "destructive" });
      return;
    }
    toast({ title: "Acción registrada" });
    load();
  };

  const postpone = async (action: AssistantAction) => {
    const res = await fetch(`/api/linkedin-assistant/actions/${action.memberId}/audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "postponed" }),
    });
    if (!res.ok) {
      toast({ title: "Error al posponer", variant: "destructive" });
      return;
    }
    toast({ title: "Acción pospuesta" });
    load();
  };

  const skip = async (action: AssistantAction) => {
    await fetch(`/api/linkedin-assistant/actions/${action.memberId}/audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "skipped" }),
    });
    load();
  };

  return (
    <div className="space-y-6">
      <MarketingSubnav />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">LinkedIn Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Cola de prospección manual — {pendingCount} acciones accionables
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={campaignId} onValueChange={setCampaignId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Todas las campañas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las campañas</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.pending} pendientes)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Cargo</TableHead>
            <TableHead>Campaña</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Próxima acción</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {actions.length === 0 && !loading && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                No hay acciones pendientes.
              </TableCell>
            </TableRow>
          )}
          {actions.map((action) => (
            <TableRow key={action.memberId}>
              <TableCell className="font-medium">{action.contact.name}</TableCell>
              <TableCell>{action.contact.companyName || "—"}</TableCell>
              <TableCell>{action.contact.title || "—"}</TableCell>
              <TableCell className="max-w-[200px] truncate">{action.campaign.name}</TableCell>
              <TableCell>
                <Badge variant="secondary">{action.statusLabel}</Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {action.nextActionAt
                  ? new Date(action.nextActionAt).toLocaleString()
                  : action.action}
              </TableCell>
              <TableCell className="text-right space-x-1">
                <Button variant="ghost" size="sm" asChild>
                  <a href={action.contact.linkedinUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setMessagePreview(action)}>
                  Ver mensaje
                </Button>
                <Button variant="default" size="sm" onClick={() => markSent(action)}>
                  Marcar enviado
                </Button>
                <Button variant="outline" size="sm" onClick={() => postpone(action)}>
                  Posponer
                </Button>
                <Button variant="ghost" size="sm" onClick={() => skip(action)}>
                  Omitir
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {messagePreview && (
        <div className="rounded-lg border p-4 space-y-3 max-w-2xl">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">{messagePreview.contact.name}</h2>
            <Button variant="ghost" size="sm" onClick={() => setMessagePreview(null)}>
              Cerrar
            </Button>
          </div>
          <Textarea readOnly value={messagePreview.message || ""} rows={8} />
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={messagePreview.contact.linkedinUrl} target="_blank">
                Abrir LinkedIn
              </Link>
            </Button>
            <Button size="sm" onClick={() => markSent(messagePreview)}>
              Marcar enviado
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
