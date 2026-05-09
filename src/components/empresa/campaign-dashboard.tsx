"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useCampaignProgress } from "@/lib/campaign-sync";
import type { CampaignMessage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2, RefreshCw, Play, ExternalLink } from "lucide-react";

function campaignEstadoBadge(estado: string) {
  switch (estado) {
    case "borrador":
      return <Badge variant="secondary">borrador</Badge>;
    case "enviando":
      return <Badge className="bg-blue-600 hover:bg-blue-600">enviando</Badge>;
    case "completada":
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">completada</Badge>;
    case "cancelada":
      return <Badge variant="destructive">cancelada</Badge>;
    default:
      return <Badge variant="outline">{estado}</Badge>;
  }
}

function msgEstadoBadge(estado: string) {
  switch (estado) {
    case "pendiente":
      return <Badge variant="secondary">pendiente</Badge>;
    case "enviado":
      return <Badge className="bg-blue-600 hover:bg-blue-600">enviado</Badge>;
    case "leido":
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">leído</Badge>;
    case "error":
      return <Badge variant="destructive">error</Badge>;
    default:
      return <Badge variant="outline">{estado}</Badge>;
  }
}

const PAGE_SIZE = 25;

export function CampaignDashboard() {
  const params = useParams();
  const orgId = params.orgId as string;
  const campaignId = params.campaignId as string;
  const { campaign, messages, stats, loading } = useCampaignProgress(campaignId);
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPage(0);
  }, [filter, q]);

  const filtered = useMemo(() => {
    return messages.filter((m) => {
      if (filter !== "all" && m.estado !== filter) return false;
      if (q.trim()) {
        const t = q.trim().toLowerCase();
        if (!m.recipientEmail.toLowerCase().includes(t) && !m.recipientNombre.toLowerCase().includes(t)) {
          return false;
        }
      }
      return true;
    });
  }, [messages, filter, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSlice = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const leidoPct =
    stats && stats.enviados > 0 ? Math.round((stats.leidos / stats.enviados) * 100) : 0;

  async function continuarEnvio() {
    const user = auth.currentUser;
    if (!user) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/campaigns/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ campaignId, orgId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      toast({ title: "Envío reanudado", description: `Enviados: ${data.sent}, errores: ${data.errors}` });
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Falló",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function descargarReporte() {
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    const url = `/api/campaigns/report?campaignId=${encodeURIComponent(campaignId)}&orgId=${encodeURIComponent(orgId)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      toast({ title: "No se pudo generar el PDF", variant: "destructive" });
      return;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reporte-${campaignId.slice(0, 8)}.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const iniciarEnvio = useCallback(async () => {
    const user = auth.currentUser;
    if (!user || !campaign) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "campaigns", campaignId), {
        estado: "enviando",
        startedAt: serverTimestamp(),
      });
      const token = await user.getIdToken();
      const res = await fetch("/api/campaigns/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ campaignId, orgId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      toast({ title: "Envío", description: `Enviados: ${data.sent}, errores: ${data.errors}` });
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Falló el envío",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }, [campaign, campaignId, orgId, toast]);

  async function reenviarSeleccion() {
    const user = auth.currentUser;
    if (!user || selected.size === 0) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/campaigns/resend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          campaignId,
          orgId,
          messageIds: [...selected],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Reenvío fallido");
      toast({ title: "Reenvío", description: `Enviados: ${data.sent}, errores: ${data.errors}` });
      setSelected(new Set());
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo reenviar",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  function toggleRow(id: string, m: CampaignMessage, checked: boolean) {
    if (m.estado !== "error") return;
    setSelected((prev) => {
      const n = new Set(prev);
      if (checked) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  if (loading || !campaign) {
    return (
      <div className="p-8 space-y-4 max-w-6xl">
        {loading ? (
          <>
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-24" />
          </>
        ) : (
          <p className="text-muted-foreground">Campaña no encontrada.</p>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Link href={`/empresa/${orgId}/campanas`} className="text-sm text-muted-foreground hover:underline">
            ← Campañas
          </Link>
          <h1 className="text-2xl font-bold mt-2">{campaign.nombre}</h1>
          <div className="flex flex-wrap gap-2 mt-2 text-sm text-muted-foreground">
            <span>Estado: {campaignEstadoBadge(campaign.estado)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {campaign.estado === "enviando" && stats && stats.pendientes > 0 ? (
            <Button variant="secondary" onClick={continuarEnvio} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Continuar envío
            </Button>
          ) : null}
          {campaign.estado === "borrador" ? (
            <Button onClick={iniciarEnvio} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Iniciar envío
            </Button>
          ) : null}
          <Button variant="outline" onClick={descargarReporte} className="gap-2">
            <Download className="h-4 w-4" />
            Descargar reporte legal
          </Button>
        </div>
      </div>

      {stats ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Enviados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.enviados}</div>
                <p className="text-xs text-muted-foreground">de {stats.total} destinatarios</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Leídos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.leidos}</div>
                <div className="mt-2 space-y-1">
                  <Progress value={leidoPct} className="h-2" />
                  <p className="text-xs text-muted-foreground">{leidoPct}% del envío</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendientes}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Errores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.errores}</div>
              </CardContent>
            </Card>
          </div>

          {campaign.estado === "enviando" ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Enviando… los datos se actualizan en vivo.
            </p>
          ) : null}
        </>
      ) : null}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="pendiente">Pendiente</TabsTrigger>
            <TabsTrigger value="enviado">Enviado</TabsTrigger>
            <TabsTrigger value="leido">Leído</TabsTrigger>
            <TabsTrigger value="error">Error</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          placeholder="Buscar nombre o email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="flex items-center gap-4">
        <Button
          variant="secondary"
          disabled={busy || selected.size === 0}
          onClick={reenviarSeleccion}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Reenviar seleccionados ({selected.size})
        </Button>
        <p className="text-xs text-muted-foreground">Solo filas en error pueden seleccionarse.</p>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>DNI / Legajo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>TX envío</TableHead>
              <TableHead>TX lectura</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageSlice.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <Checkbox
                    disabled={m.estado !== "error"}
                    checked={selected.has(m.id)}
                    onCheckedChange={(c) => toggleRow(m.id, m, c === true)}
                  />
                </TableCell>
                <TableCell>{m.recipientNombre}</TableCell>
                <TableCell className="max-w-[140px] truncate">{m.recipientEmail}</TableCell>
                <TableCell className="text-xs">
                  {m.recipientDni || "—"} / {m.recipientLegajo || "—"}
                </TableCell>
                <TableCell>{msgEstadoBadge(m.estado)}</TableCell>
                <TableCell>
                  {m.txHashEnvio ? (
                    <a
                      href={`https://polygonscan.com/tx/${m.txHashEnvio}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary text-xs"
                    >
                      Ver <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {m.txHashLectura ? (
                    <a
                      href={`https://polygonscan.com/tx/${m.txHashLectura}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary text-xs"
                    >
                      Ver <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span>
          Página {page + 1} / {pageCount} ({filtered.length} filas)
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
