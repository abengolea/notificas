"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  Download,
  Loader2,
  RefreshCw,
  Play,
  ExternalLink,
  Mail,
  MessageCircle,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAGE_SIZE = 100;

function campaignEstadoBadge(estado: string) {
  switch (estado) {
    case "borrador":   return <Badge variant="secondary">borrador</Badge>;
    case "enviando":   return <Badge className="bg-blue-600 hover:bg-blue-600">enviando</Badge>;
    case "completada": return <Badge className="bg-emerald-600 hover:bg-emerald-600">completada</Badge>;
    case "cancelada":  return <Badge variant="destructive">cancelada</Badge>;
    default:           return <Badge variant="outline">{estado}</Badge>;
  }
}

function msgEstadoBadge(estado: string) {
  switch (estado) {
    case "pendiente": return <Badge variant="secondary">pendiente</Badge>;
    case "enviado":   return <Badge className="bg-blue-600 hover:bg-blue-600">enviado</Badge>;
    case "entregado": return <Badge className="bg-sky-600 hover:bg-sky-600">entregado</Badge>;
    case "leido":     return <Badge className="bg-emerald-600 hover:bg-emerald-600">leído</Badge>;
    case "error":     return <Badge variant="destructive">error</Badge>;
    default:          return <Badge variant="outline">{estado}</Badge>;
  }
}

/** Hook de paginación server-side para campaign_messages. */
function useMessages(campaignId: string, estado: string, search: string) {
  const [messages, setMessages]   = useState<CampaignMessage[]>([]);
  const [loading, setLoading]     = useState(true);
  const [hasMore, setHasMore]     = useState(false);
  // Stack de cursores: posición 0 = inicio, cada push = nueva página
  const cursorStack               = useRef<string[]>(['']);
  const [stackLen, setStackLen]   = useState(1);
  const currentPage               = stackLen - 1;

  const load = useCallback(async (cursor: string) => {
    // Esperar hasta que Firebase Auth esté listo
    const user = await new Promise<typeof auth.currentUser>((resolve) => {
      if (auth.currentUser !== undefined) { resolve(auth.currentUser); return; }
      const unsub = auth.onAuthStateChanged((u) => { unsub(); resolve(u); });
    });
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams({ campaignId, limit: String(PAGE_SIZE) });
      if (estado !== 'all') params.set('estado', estado);
      if (search)           params.set('search', search);
      if (cursor)           params.set('cursor', cursor);
      const res = await fetch(`/api/campaigns/messages?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json() as { messages: CampaignMessage[]; nextCursor: string | null; hasMore: boolean };
      setMessages(data.messages);
      setHasMore(data.hasMore);
      // Guardar el nextCursor en la posición siguiente del stack (si no existe ya)
      if (data.nextCursor && cursorStack.current.length === stackLen) {
        cursorStack.current.push(data.nextCursor);
      }
    } finally {
      setLoading(false);
    }
  }, [campaignId, estado, search, stackLen]);

  // Reset al cambiar filtros
  useEffect(() => {
    cursorStack.current = [''];
    setStackLen(1);
  }, [campaignId, estado, search]);

  // Cargar cuando cambia la página actual (stackLen) o los filtros
  useEffect(() => {
    const cursor = cursorStack.current[currentPage] ?? '';
    load(cursor);
  }, [load, currentPage]);

  function nextPage() {
    if (!hasMore) return;
    setStackLen((n) => n + 1);
  }

  function prevPage() {
    if (currentPage === 0) return;
    setStackLen((n) => n - 1);
  }

  return { messages, loading, hasMore, currentPage, nextPage, prevPage };
}

export function CampaignDashboard() {
  const params     = useParams();
  const orgId      = params.orgId as string;
  const campaignId = params.campaignId as string;
  const { campaign, stats, loading: campLoading } = useCampaignProgress(campaignId);
  const { toast }  = useToast();

  const [filter, setFilter] = useState("all");
  const [q, setQ]           = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [busy, setBusy]             = useState(false);

  // Debounce de búsqueda para no lanzar una query por cada keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 400);
    return () => clearTimeout(t);
  }, [q]);

  const { messages, loading: msgLoading, hasMore, currentPage, nextPage, prevPage } =
    useMessages(campaignId, filter, debouncedQ);

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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ campaignId, orgId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      toast({ title: "Envío reanudado", description: `${data.pending ?? data.total ?? 0} mensajes encolados` });
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Falló", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function descargarReporte() {
    const user = auth.currentUser;
    if (!user) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const p = new URLSearchParams({
        campaignId, orgId,
        estado: filter === "all" ? "todos" : filter,
        ...(q.trim() ? { nombre: q.trim() } : {}),
      });
      const res = await fetch(`/api/campaigns/report?${p}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { toast({ title: "No se pudo generar el PDF", variant: "destructive" }); return; }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const suffix = [filter !== "all" ? filter : "", q.trim() ? "filtrado" : ""].filter(Boolean).join("-");
      a.download = `reporte-${suffix ? suffix + "-" : ""}${campaignId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setBusy(false);
    }
  }

  async function descargarCsv() {
    const user = auth.currentUser;
    if (!user) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const url = `/api/campaigns/export?campaignId=${encodeURIComponent(campaignId)}&orgId=${encodeURIComponent(orgId)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { toast({ title: "No se pudo generar el CSV", variant: "destructive" }); return; }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `evidencia-${campaignId.slice(0, 8)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setBusy(false);
    }
  }

  const iniciarEnvio = useCallback(async () => {
    const user = auth.currentUser;
    if (!user || !campaign) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "campaigns", campaignId), { estado: "enviando", startedAt: serverTimestamp() });
      const token = await user.getIdToken();
      const res = await fetch("/api/campaigns/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ campaignId, orgId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      toast({ title: "Envío", description: `${data.pending ?? data.total ?? 0} mensajes encolados` });
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Falló el envío", variant: "destructive" });
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ campaignId, orgId, messageIds: [...selected] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Reenvío fallido");
      toast({ title: "Reenvío", description: `${data.sent ?? 0} enviados, ${data.errors ?? 0} errores` });
      setSelected(new Set());
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "No se pudo reenviar", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  function toggleRow(id: string, m: CampaignMessage, checked: boolean) {
    if (m.estado !== "error") return;
    setSelected((prev) => {
      const n = new Set(prev);
      if (checked) n.add(id); else n.delete(id);
      return n;
    });
  }

  if (campLoading || !campaign) {
    return (
      <div className="p-8 space-y-4 max-w-6xl">
        {campLoading ? (
          <><Skeleton className="h-10 w-64" /><Skeleton className="h-24" /></>
        ) : (
          <p className="text-muted-foreground">Campaña no encontrada.</p>
        )}
      </div>
    );
  }

  const showEmail = campaign.canal === "email" || campaign.canal === "ambos" || !campaign.canal;
  const showWa    = campaign.canal === "whatsapp" || campaign.canal === "ambos";

  return (
    <div className="p-6 md:p-8 max-w-6xl space-y-8">
      {/* Header */}
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
          {campaign.estado === "enviando" && stats && stats.pendientes > 0 && (
            <Button variant="secondary" onClick={continuarEnvio} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Continuar envío
            </Button>
          )}
          {campaign.estado === "borrador" && (
            <Button onClick={iniciarEnvio} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Iniciar envío
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={busy} className="gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Descargar <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                PDF — imprime el filtro activo (máx 500 filas)
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={descargarReporte} className="gap-2">
                <Download className="h-4 w-4" />
                <span>
                  PDF
                  {(filter !== "all" || q.trim()) && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({[filter !== "all" ? filter : "", q.trim() ? `"${q.trim()}"` : ""].filter(Boolean).join(" · ")})
                    </span>
                  )}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                CSV — evidencia completa sin límite
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={descargarCsv} className="gap-2">
                <Download className="h-4 w-4" /> CSV con TX hashes y WAMID
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats — vienen del campaign doc (FieldValue.increment, nunca recalculados en cliente) */}
      {stats && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Enviados</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.enviados.toLocaleString('es-AR')}</div>
                <p className="text-xs text-muted-foreground">de {stats.total.toLocaleString('es-AR')} destinatarios</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Leídos</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.leidos.toLocaleString('es-AR')}</div>
                <div className="mt-2 space-y-1">
                  <Progress value={leidoPct} className="h-2" />
                  <p className="text-xs text-muted-foreground">{leidoPct}% del envío</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.pendientes.toLocaleString('es-AR')}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Errores</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.errores.toLocaleString('es-AR')}</div></CardContent>
            </Card>
          </div>
          {campaign.estado === "enviando" && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Enviando… los datos se actualizan en vivo.
            </p>
          )}
        </>
      )}

      {/* Filtros */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Tabs value={filter} onValueChange={(v) => { setFilter(v); setSelected(new Set()); }}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="pendiente">Pendiente</TabsTrigger>
            <TabsTrigger value="enviado">Enviado</TabsTrigger>
            <TabsTrigger value="leido">Leído</TabsTrigger>
            <TabsTrigger value="error">Error</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          placeholder="Buscar nombre…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="flex items-center gap-4">
        <Button variant="secondary" disabled={busy || selected.size === 0} onClick={reenviarSeleccion} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Reenviar seleccionados ({selected.size})
        </Button>
        <p className="text-xs text-muted-foreground">Solo filas en error pueden seleccionarse.</p>
      </div>

      {/* Tabla */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Nombre</TableHead>
              <TableHead>DNI / Legajo</TableHead>
              {showEmail && (
                <>
                  <TableHead><span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />Estado email</span></TableHead>
                  <TableHead><span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />TX envío</span></TableHead>
                  <TableHead><span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />TX lectura</span></TableHead>
                </>
              )}
              {showWa && (
                <>
                  <TableHead><span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />Estado WA</span></TableHead>
                  <TableHead><span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />Entregado</span></TableHead>
                  <TableHead><span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />Leído WA</span></TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {msgLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: showWa && showEmail ? 8 : 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : messages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showWa && showEmail ? 8 : 6} className="text-center text-muted-foreground py-8">
                  No hay mensajes con el filtro seleccionado.
                </TableCell>
              </TableRow>
            ) : (
              messages.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Checkbox
                      disabled={m.estado !== "error"}
                      checked={selected.has(m.id)}
                      onCheckedChange={(c) => toggleRow(m.id, m, c === true)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{m.recipientNombre}</div>
                    {m.recipientEmail && !m.recipientEmail.endsWith('@notificas.internal') && (
                      <div className="text-xs text-muted-foreground truncate max-w-[160px]">{m.recipientEmail}</div>
                    )}
                    {m.recipientTelefono && (
                      <div className="text-xs text-muted-foreground">{m.recipientTelefono}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {m.recipientDni || "—"} / {m.recipientLegajo || "—"}
                  </TableCell>
                  {showEmail && (
                    <>
                      <TableCell>{msgEstadoBadge(m.emailEstado || m.estado)}</TableCell>
                      <TableCell>
                        {(m.emailTxEnvio || m.txHashEnvio) ? (
                          <a href={`https://polygonscan.com/tx/${m.emailTxEnvio || m.txHashEnvio}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary text-xs">
                            Ver <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {(m.emailTxLectura || m.txHashLectura) ? (
                          <a href={`https://polygonscan.com/tx/${m.emailTxLectura || m.txHashLectura}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary text-xs">
                            Ver <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : "—"}
                      </TableCell>
                    </>
                  )}
                  {showWa && (
                    <>
                      <TableCell>{msgEstadoBadge(m.waEstado || m.estado)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.waEntregadoAt ? "✓" : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.waLeidoAt ? "✓" : "—"}</TableCell>
                    </>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Página {currentPage + 1}
          {stats ? ` · ${stats.total.toLocaleString('es-AR')} destinatarios en total` : ""}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={currentPage === 0 || msgLoading} onClick={prevPage}>
            Anterior
          </Button>
          <Button variant="outline" size="sm" disabled={!hasMore || msgLoading} onClick={nextPage}>
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
