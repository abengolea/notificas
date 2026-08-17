"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useCampaignProgress } from "@/lib/campaign-sync";
import type { CampaignMessage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { cn } from "@/lib/utils";
import { CampaignIntegrityPanel } from "@/components/empresa/campaign-integrity-panel";
import {
  Copy,
  Download,
  Loader2,
  RefreshCw,
  Play,
  Mail,
  MessageCircle,
  ChevronDown,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Users,
  FileText,
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

async function waitFirebaseUser() {
  return new Promise<typeof auth.currentUser>((resolve) => {
    const unsub = auth.onAuthStateChanged((u) => {
      unsub();
      resolve(u);
    });
  });
}

async function campaignRequest(mode: "empresa" | "admin", url: string, init?: RequestInit) {
  if (mode === "admin") {
    return fetch(url, { ...init, credentials: "include" });
  }
  const user = auth.currentUser ?? (await waitFirebaseUser());
  if (!user) throw new Error("Sin sesión");
  const token = await user.getIdToken();
  return fetch(url, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
  });
}

function campaignEstadoBadge(estado: string) {
  switch (estado) {
    case "borrador":   return <Badge variant="secondary">borrador</Badge>;
    case "enviando":   return <Badge className="bg-blue-600 hover:bg-blue-600">enviando</Badge>;
    case "completada": return <Badge className="bg-emerald-600 hover:bg-emerald-600">completada</Badge>;
    case "cancelada":  return <Badge variant="destructive">cancelada</Badge>;
    default:           return <Badge variant="outline">{estado}</Badge>;
  }
}

/** Formatea un Timestamp de Firestore (obj con _seconds o string ISO) a hora legible. */
function fmtTs(ts: unknown): string | null {
  if (!ts) return null;
  try {
    if (typeof ts === 'string') {
      const d = new Date(ts);
      return isNaN(d.getTime()) ? null : d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
    }
    if (typeof ts === 'object') {
      const o = ts as Record<string, number>;
      const secs = o._seconds ?? o.seconds;
      if (secs != null) {
        return new Date(secs * 1000).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
      }
    }
  } catch { /* ignore */ }
  return null;
}

function isSyntheticEmail(email: string) {
  return email.endsWith('@notificas.internal') || email.endsWith('@wa.internal');
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

function ChannelCell({
  estado,
  error,
  rows,
}: {
  estado: string;
  error?: string;
  rows: { label: string; ts: string | null }[];
}) {
  const shown = rows.filter((r) => r.ts);
  return (
    <div className="space-y-1 min-w-[140px]">
      {msgEstadoBadge(estado)}
      {error ? <p className="text-xs text-destructive max-w-[220px] leading-snug">{error}</p> : null}
      {shown.map((r) => (
        <p key={r.label} className="text-xs text-muted-foreground">
          {r.label}: {r.ts}
        </p>
      ))}
    </div>
  );
}

/** Hook de paginación server-side para campaign_messages. */
function useMessages(
  campaignId: string,
  estado: string,
  search: string,
  refreshKey: number,
  mode: "empresa" | "admin",
) {
  const [messages, setMessages]   = useState<CampaignMessage[]>([]);
  const [loading, setLoading]     = useState(true);
  const [hasMore, setHasMore]     = useState(false);
  // Stack de cursores: posición 0 = inicio, cada push = nueva página
  const cursorStack               = useRef<string[]>(['']);
  const [stackLen, setStackLen]   = useState(1);
  const currentPage               = stackLen - 1;

  const load = useCallback(async (cursor: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ campaignId, limit: String(PAGE_SIZE) });
      if (estado !== 'all') params.set('estado', estado);
      if (search)           params.set('search', search);
      if (cursor)           params.set('cursor', cursor);
      const res = await campaignRequest(mode, `/api/campaigns/messages?${params}`);
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
  }, [campaignId, estado, search, stackLen, refreshKey, mode]);

  // Reset al cambiar filtros o refreshKey externo
  useEffect(() => {
    cursorStack.current = [''];
    setStackLen(1);
  }, [campaignId, estado, search, refreshKey]);

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

export function CampaignDashboard({
  mode = "empresa",
  orgId: orgIdProp,
  campaignId: campaignIdProp,
  listHref,
  embedded = false,
}: {
  mode?: "empresa" | "admin";
  orgId?: string;
  campaignId?: string;
  listHref?: string;
  embedded?: boolean;
} = {}) {
  const params     = useParams();
  const isAdmin    = mode === "admin";
  const orgId      = orgIdProp || (params.orgId as string);
  const campaignId = campaignIdProp || (params.campaignId as string);
  const { campaign, stats, loading: campLoading } = useCampaignProgress(campaignId, { admin: isAdmin });
  const { toast }  = useToast();
  const router     = useRouter();

  const [section, setSection] = useState("destinatarios");
  const [filter, setFilter] = useState("all");
  const [q, setQ]           = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [busy, setBusy]             = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [verifyTarget, setVerifyTarget] = useState<string | undefined>();

  // Debounce de búsqueda para no lanzar una query por cada keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 400);
    return () => clearTimeout(t);
  }, [q]);

  // Recargar tabla cuando cambian los stats (mensajes enviados/leídos)
  const prevStatsRef = useRef<string>('');
  useEffect(() => {
    if (!stats) return;
    const key = `${stats.enviados}-${stats.leidos}-${stats.errores}`;
    if (key !== prevStatsRef.current) {
      prevStatsRef.current = key;
      setRefreshKey((k) => k + 1);
    }
  }, [stats]);

  const { messages, loading: msgLoading, hasMore, currentPage, nextPage, prevPage } =
    useMessages(campaignId, filter, debouncedQ, refreshKey, mode);

  // Polling cada 15s solo mientras la campaña está enviando activamente
  useEffect(() => {
    if (campaign?.estado !== 'enviando') return;
    const t = setInterval(() => setRefreshKey((k) => k + 1), 15000);
    return () => clearInterval(t);
  }, [campaign?.estado]);

  const leidoPct =
    stats && stats.enviados > 0 ? Math.round((stats.leidos / stats.enviados) * 100) : 0;
  const enviadoPct =
    stats && stats.total > 0 ? Math.round((stats.enviados / stats.total) * 100) : 0;

  async function continuarEnvio() {
    setBusy(true);
    try {
      const res = await campaignRequest(mode, "/api/campaigns/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    setBusy(true);
    try {
      const p = new URLSearchParams({
        campaignId, orgId,
        estado: filter === "all" ? "todos" : filter,
        ...(q.trim() ? { nombre: q.trim() } : {}),
      });
      const res = await campaignRequest(mode, `/api/campaigns/report?${p}`);
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
    setBusy(true);
    try {
      const url = `/api/campaigns/export?campaignId=${encodeURIComponent(campaignId)}&orgId=${encodeURIComponent(orgId)}`;
      const res = await campaignRequest(mode, url);
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
    if (!campaign) return;
    setBusy(true);
    try {
      if (!isAdmin) {
        await updateDoc(doc(db, "campaigns", campaignId), { estado: "enviando", startedAt: serverTimestamp() });
      }
      const sendUrl = isAdmin ? "/api/admin/campaigns/send" : "/api/campaigns/send";
      const res = await campaignRequest(mode, sendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isAdmin ? { campaignId } : { campaignId, orgId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      toast({ title: "Envío", description: `${data.pending ?? data.pendingThisTanda ?? data.total ?? 0} mensajes encolados` });
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Falló el envío", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [campaign, campaignId, orgId, toast, isAdmin, mode]);

  async function copiarCampana() {
    if (!campaign) return;
    setBusy(true);
    try {
      const res = await campaignRequest(mode, "/api/campaigns/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, orgId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al copiar");
      toast({ title: "Campaña copiada", description: `"${data.nombre}" creada como borrador.` });
      router.push(isAdmin ? `/admin/campanas/${data.newCampaignId}` : `/empresa/${orgId}/campanas/${data.newCampaignId}`);
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "No se pudo copiar", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function cancelarCampana() {
    if (!campaign) return;
    setBusy(true);
    try {
      const url = isAdmin ? "/api/admin/campaigns/cancel" : "/api/campaigns/cancel";
      const res = await campaignRequest(mode, url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isAdmin ? { campaignId } : { campaignId, orgId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      toast({ title: "Campaña cancelada", description: "Los mensajes pendientes no se enviarán." });
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Falló", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function reintentarErrores() {
    if (!campaign) return;
    setBusy(true);
    try {
      if (!isAdmin) {
        await updateDoc(doc(db, "campaigns", campaignId), { estado: "enviando" });
      }
      const sendUrl = isAdmin ? "/api/admin/campaigns/send" : "/api/campaigns/send";
      const res = await campaignRequest(mode, sendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isAdmin ? { campaignId } : { campaignId, orgId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      toast({ title: "Reintento iniciado", description: `${data.pending ?? data.pendingThisTanda ?? 0} mensajes encolados` });
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Falló", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function reenviarSeleccion() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const res = await campaignRequest(mode, "/api/campaigns/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, orgId, messageIds: [...selected] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Reenvío fallido");
      toast({ title: "Reenvío", description: `${data.sent ?? data.pendingThisTanda ?? 0} enviados, ${data.errors ?? 0} errores` });
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

  function openDestinatarios(nextFilter: string) {
    setFilter(nextFilter);
    setSelected(new Set());
    setSection("destinatarios");
  }

  function openIntegrity(messageId: string) {
    setVerifyTarget(messageId);
    setSection("integridad");
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

  const tableCols = 4 + (showEmail ? 1 : 0) + (showWa ? 1 : 0);

  return (
    <div className={embedded ? "space-y-6" : "p-6 md:p-8 max-w-6xl space-y-6"}>
      {!embedded && (
      <>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Link href={listHref || `/empresa/${orgId}/campanas`} className="text-sm text-muted-foreground hover:underline">
            ← Campañas
          </Link>
          <h1 className="text-2xl font-bold mt-2">{campaign.nombre}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
            {campaignEstadoBadge(campaign.estado)}
            {showEmail && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />Email</span>}
            {showWa && <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5 text-emerald-600" />WhatsApp</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {campaign.estado === "enviando" && stats && stats.pendientes > 0 && !isAdmin && (
            <Button variant="secondary" onClick={continuarEnvio} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Continuar envío
            </Button>
          )}
          {campaign.estado === "enviando" && (
            <Button variant="destructive" onClick={cancelarCampana} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Cancelar campaña
            </Button>
          )}
          {campaign.estado === "completada" && stats && stats.errores > 0 && !isAdmin && (
            <Button variant="outline" onClick={reintentarErrores} disabled={busy} className="gap-2 border-destructive text-destructive hover:bg-destructive/10">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
              Reintentar {stats.errores.toLocaleString("es-AR")} errores
            </Button>
          )}
          {campaign.estado === "borrador" && !isAdmin && (
            <Button onClick={iniciarEnvio} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Iniciar envío
            </Button>
          )}
          <Button variant="outline" onClick={copiarCampana} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            Copiar campaña
          </Button>
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

      {stats && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                { key: "all", label: "Enviados", value: stats.enviados, hint: `de ${stats.total.toLocaleString("es-AR")} destinatarios` },
                { key: "leido", label: "Leídos", value: stats.leidos, hint: `${leidoPct}% del envío` },
                { key: "pendiente", label: "Pendientes", value: stats.pendientes, hint: "aún en cola" },
                { key: "error", label: "Errores", value: stats.errores, hint: stats.errores > 0 ? "tocá para verlos" : "sin errores" },
              ] as const
            ).map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => openDestinatarios(s.key)}
                className={cn(
                  "rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  section === "destinatarios" && filter === s.key && "ring-2 ring-primary",
                  s.key === "error" && s.value > 0 && "border-destructive/40"
                )}
              >
                <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold tabular-nums mt-1">{s.value.toLocaleString("es-AR")}</p>
                {s.key === "leido" ? (
                  <div className="mt-2 space-y-1">
                    <Progress value={leidoPct} className="h-2" />
                    <p className="text-xs text-muted-foreground">{s.hint}</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">{s.hint}</p>
                )}
              </button>
            ))}
          </div>
          {campaign.estado === "enviando" && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Enviando… {enviadoPct}% completado — {stats.enviados.toLocaleString("es-AR")} de {stats.total.toLocaleString("es-AR")}
              </div>
              <Progress value={enviadoPct} className="h-2" />
            </div>
          )}
        </>
      )}
      </>
      )}

      {embedded && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={copiarCampana} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            Copiar campaña
          </Button>
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
                PDF
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
      )}

      <Tabs value={section} onValueChange={setSection} className="w-full">
        <div className="sticky top-14 z-10 -mx-2 border-b bg-background/95 px-2 py-2 backdrop-blur-sm lg:top-0">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 sm:inline-flex sm:w-auto">
            <TabsTrigger value="destinatarios" className="gap-1.5">
              <Users className="h-4 w-4" />
              Destinatarios
            </TabsTrigger>
            <TabsTrigger value="integridad" className="gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              Integridad
            </TabsTrigger>
            <TabsTrigger value="mensaje" className="gap-1.5">
              <FileText className="h-4 w-4" />
              Mensaje
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="destinatarios" className="mt-4 space-y-4 focus-visible:outline-none">
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
            <div className="flex items-center gap-2 max-w-sm w-full">
              <Input
                placeholder="Buscar nombre…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="flex-1"
              />
              {campaign.estado === "completada" && (
                <Button
                  variant="outline"
                  size="icon"
                  title="Actualizar tabla"
                  onClick={() => setRefreshKey((k) => k + 1)}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" disabled={busy || selected.size === 0} onClick={reenviarSeleccion} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Reenviar seleccionados ({selected.size})
            </Button>
            {stats && stats.errores > 0 && campaign.estado !== "enviando" && (
              <Button variant="outline" disabled={busy} onClick={reintentarErrores} className="gap-2 border-destructive text-destructive hover:bg-destructive/10">
                <AlertTriangle className="h-4 w-4" />
                Reintentar todos los errores ({stats.errores.toLocaleString("es-AR")})
              </Button>
            )}
            <p className="text-xs text-muted-foreground">Solo filas en error pueden seleccionarse individualmente.</p>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Nombre</TableHead>
                  <TableHead>DNI / Legajo</TableHead>
                  {showEmail && (
                    <TableHead>
                      <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />Email</span>
                    </TableHead>
                  )}
                  {showWa && (
                    <TableHead>
                      <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />WhatsApp</span>
                    </TableHead>
                  )}
                  <TableHead className="w-28">Integridad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {msgLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: tableCols }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : messages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={tableCols} className="text-center text-muted-foreground py-8">
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
                        {m.recipientEmail && !isSyntheticEmail(m.recipientEmail) && (
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
                        <TableCell>
                          <ChannelCell
                            estado={m.emailEstado || m.estado}
                            error={m.emailError || (m.estado === "error" && !showWa ? m.errorMsg : undefined)}
                            rows={[{ label: "click", ts: fmtTs(m.emailClickAt) }]}
                          />
                        </TableCell>
                      )}
                      {showWa && (
                        <TableCell>
                          <ChannelCell
                            estado={m.waEstado || m.estado}
                            error={m.waError || (m.estado === "error" ? m.errorMsg : undefined)}
                            rows={[
                              { label: "entregado", ts: fmtTs(m.waEntregadoAt) },
                              { label: "leído", ts: fmtTs(m.waLeidoAt) },
                              { label: "click", ts: fmtTs(m.waClickAt) },
                            ]}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => openIntegrity(m.id)}
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Verificar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Página {currentPage + 1}
              {stats ? ` · ${stats.total.toLocaleString("es-AR")} destinatarios en total` : ""}
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
        </TabsContent>

        <TabsContent value="integridad" className="mt-4 focus-visible:outline-none">
          <CampaignIntegrityPanel
            orgId={orgId}
            campaignId={campaignId}
            initialMessageId={verifyTarget}
            adminSession={isAdmin}
          />
        </TabsContent>

        <TabsContent value="mensaje" className="mt-4 space-y-4 focus-visible:outline-none">
          {showEmail && (
            <div className="rounded-md border p-4 bg-muted/30 space-y-2 text-sm">
              <p className="font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Correo
              </p>
              {campaign.asunto ? (
                <p className="text-muted-foreground">
                  Asunto: <span className="font-medium text-foreground">{campaign.asunto}</span>
                </p>
              ) : (
                <p className="text-muted-foreground">Sin asunto cargado.</p>
              )}
              {campaign.cuerpo && !showWa && (
                <p className="text-muted-foreground whitespace-pre-wrap border-t pt-2">{campaign.cuerpo}</p>
              )}
            </div>
          )}
          {showWa && (
            <div className="rounded-md border p-4 bg-muted/30 space-y-2 text-sm">
              <p className="font-medium flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-emerald-500" />
                WhatsApp
              </p>
              {campaign.waTemplateName ? (
                <p className="text-muted-foreground">
                  Template: <span className="font-mono text-foreground">{campaign.waTemplateName}</span>
                  {campaign.waTemplateLang && <span className="ml-2 text-xs">({campaign.waTemplateLang})</span>}
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Template: <span className="font-medium text-foreground">el registrado por defecto de Notificas</span>
                </p>
              )}
              {campaign.waTemplateVariables && campaign.waTemplateVariables.length > 0 && (
                <p className="text-muted-foreground">
                  Variables: {campaign.waTemplateVariables.map((v, i) => (
                    <span key={i} className="inline-block mr-2">
                      <span className="text-xs text-muted-foreground">{`{{${i + 1}}}`} = </span>
                      <span className="font-medium text-foreground">{v}</span>
                    </span>
                  ))}
                </p>
              )}
              {campaign.cuerpo && (
                <p className="text-muted-foreground whitespace-pre-wrap border-t pt-2">{campaign.cuerpo}</p>
              )}
            </div>
          )}
          {campaign.adjuntos && campaign.adjuntos.length > 0 && (
            <div className="rounded-md border p-4 bg-muted/30 text-sm">
              <p className="font-medium">Adjuntos ({campaign.adjuntos.length})</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {campaign.adjuntos.map((a) => (
                  <li key={a.hash || a.url}>{a.nombre}</li>
                ))}
              </ul>
            </div>
          )}
          {!showEmail && !showWa && (
            <p className="text-sm text-muted-foreground">No hay contenido de mensaje para mostrar.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
