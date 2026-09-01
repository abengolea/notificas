"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
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
  Pause,
  Pencil,
  Mail,
  MessageCircle,
  ChevronDown,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Users,
  FileText,
  Gauge,
  Save,
} from "lucide-react";
import { canEditWhatsAppTemplate, isAdminManagedCampaign, isUnsentCampaign } from "@/lib/campaign-edit";
import { DailyQuotaField } from "@/components/empresa/daily-quota-field";
import { DEFAULT_TANDA_SIZE } from "@/lib/campaign-tanda";
import { explainWhatsAppSendError, WA_TEMPLATE_DEFAULT_VARS } from "@/lib/wa-template-fields";
import { usesMetaTemplateAsEmailBody } from "@/lib/campaign-mixed-message";
import { WaTemplateFields } from "@/components/empresa/wa-template-fields";
import { WaSavedTemplates } from "@/components/empresa/wa-saved-templates";
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
    case "pausada":   return <Badge className="bg-amber-600 hover:bg-amber-600">pausada</Badge>;
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
  const [filteredTotal, setFilteredTotal] = useState<number | null>(null);
  // Stack de cursores: posición 0 = inicio, cada push = nueva página
  const cursorStack               = useRef<string[]>(['']);
  const [stackLen, setStackLen]   = useState(1);
  const currentPage               = stackLen - 1;

  const load = useCallback(async (cursor: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ campaignId, limit: String(PAGE_SIZE) });
      if (estado === 'waWmidMissing') params.set('flag', 'waWmidMissing');
      else if (estado !== 'all') params.set('estado', estado);
      if (search)           params.set('search', search);
      if (cursor)           params.set('cursor', cursor);
      const res = await campaignRequest(mode, `/api/campaigns/messages?${params}`);
      if (!res.ok) return;
      const data = await res.json() as {
        messages: CampaignMessage[];
        nextCursor: string | null;
        hasMore: boolean;
        filteredTotal?: number | null;
      };
      setMessages(data.messages);
      setHasMore(data.hasMore);
      setFilteredTotal(typeof data.filteredTotal === "number" ? data.filteredTotal : null);
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

  return { messages, loading, hasMore, currentPage, nextPage, prevPage, filteredTotal };
}

type CsvExportInfo = {
  version: number;
  status: string;
  fileName: string;
  sha256: string;
  rowCount: number;
  byteSize: number;
  generatedAt: string | null;
  error?: string;
};

function formatCsvSize(n: number) {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toLocaleString("es-AR", { maximumFractionDigits: 1 })} KB`;
  return `${(kb / 1024).toLocaleString("es-AR", { maximumFractionDigits: 1 })} MB`;
}

function CampaignExportActions({
  busy,
  csvBusy,
  errorCount,
  csvReady,
  csvInFlight,
  csvFailed,
  onCopy,
  hideCopy,
  onDownloadPdf,
  onDownloadFilteredCsv,
  onDownloadProblemasCsv,
  onGenerateCsv,
  onDownloadReadyCsv,
  onGenerateNewCsvVersion,
  onRetryCsv,
}: {
  busy: boolean;
  csvBusy: boolean;
  errorCount: number;
  csvReady: CsvExportInfo | null;
  csvInFlight: CsvExportInfo | null;
  csvFailed: CsvExportInfo | null;
  onCopy: () => void;
  hideCopy?: boolean;
  onDownloadPdf: () => void;
  onDownloadFilteredCsv: (kind: "vista" | "errores") => void;
  onDownloadProblemasCsv: () => void;
  onGenerateCsv: () => void;
  onDownloadReadyCsv: () => void;
  onGenerateNewCsvVersion: () => void;
  onRetryCsv: () => void;
}) {
  const generating = csvBusy || csvInFlight?.status === "pending" || csvInFlight?.status === "generating";
  const meta = csvReady && !generating ? csvReady : null;
  return (
    <>
      {!hideCopy && (
        <Button variant="outline" onClick={onCopy} disabled={busy} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
          Copiar envío masivo
        </Button>
      )}
      {csvReady && !generating ? (
        <Button variant="outline" onClick={onDownloadReadyCsv} disabled={busy} className="gap-2">
          <Download className="h-4 w-4" />
          Descargar CSV
        </Button>
      ) : generating ? (
        <Button variant="outline" disabled className="gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generando CSV…
        </Button>
      ) : csvFailed ? (
        <Button variant="outline" onClick={onRetryCsv} disabled={busy} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Reintentar CSV
        </Button>
      ) : (
        <Button variant="outline" onClick={onGenerateCsv} disabled={busy} className="gap-2">
          <Download className="h-4 w-4" />
          Generar CSV
        </Button>
      )}
      <Button
        variant="outline"
        onClick={onDownloadProblemasCsv}
        disabled={busy || csvBusy}
        className="gap-2"
        title="Mismo formato que el CSV de subida: errores y WhatsApp que no se entregó"
      >
        {csvBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
        CSV para la empresa
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-3 w-3 opacity-60" />}
            Más <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          {csvReady ? (
            <>
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground space-y-1">
                <div>CSV v{csvReady.version} · {csvReady.rowCount.toLocaleString("es-AR")} registros · {formatCsvSize(csvReady.byteSize)}</div>
                {csvReady.generatedAt ? <div>Generado {new Date(csvReady.generatedAt).toLocaleString("es-AR")}</div> : null}
                {csvReady.sha256 ? <div className="font-mono break-all">SHA-256 {csvReady.sha256}</div> : null}
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={onDownloadReadyCsv} className="gap-2">
                <Download className="h-4 w-4" />
                Descargar CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onGenerateNewCsvVersion} disabled={generating} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Generar nueva versión
              </DropdownMenuItem>
              {csvFailed ? (
                <DropdownMenuItem onClick={onRetryCsv} disabled={generating} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Reintentar v{csvFailed.version} fallida
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            PDF — para imprimir (máx. 500 filas)
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={onDownloadPdf} className="gap-2">
            <Download className="h-4 w-4" />
            PDF de esta vista
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Para enviar a la empresa (mismo formato de subida)
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={onDownloadProblemasCsv} className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Errores y no entregados
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            CSV filtrado (snapshot aparte, no pisa v1/v2)
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onDownloadFilteredCsv("vista")} className="gap-2">
            <Download className="h-4 w-4" />
            CSV de esta vista
          </DropdownMenuItem>
          {errorCount > 0 && (
            <DropdownMenuItem onClick={() => onDownloadFilteredCsv("errores")} className="gap-2">
              <Download className="h-4 w-4" />
              CSV solo errores ({errorCount.toLocaleString("es-AR")})
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {meta ? (
        <p className="basis-full text-xs text-muted-foreground leading-relaxed">
          v{meta.version} · {meta.rowCount.toLocaleString("es-AR")} registros · {formatCsvSize(meta.byteSize)}
          {meta.generatedAt ? ` · ${new Date(meta.generatedAt).toLocaleString("es-AR")}` : ""}
          {meta.sha256 ? ` · SHA-256 ${meta.sha256}` : ""}
        </p>
      ) : csvFailed && !generating ? (
        <p className="basis-full text-xs text-destructive">{csvFailed.error || "Falló la generación del CSV."}</p>
      ) : null}
    </>
  );
}

function maybePortal(host: HTMLElement | null | undefined, node: ReactNode, fallback: ReactNode) {
  if (host) return createPortal(node, host);
  if (host === undefined) return fallback;
  return null;
}

export type CampaignDashboardHandle = {
  openDestinatarios: (nextFilter: string) => void;
};

export const CampaignDashboard = forwardRef<
  CampaignDashboardHandle,
  {
    mode?: "empresa" | "admin";
    orgId?: string;
    campaignId?: string;
    listHref?: string;
    embedded?: boolean;
    exportActionsHost?: HTMLElement | null;
    quotaPanel?: ReactNode;
    recipientsPanel?: ReactNode;
    messagePanel?: ReactNode;
    onViewChange?: (view: { section: string; filter: string }) => void;
  }
>(function CampaignDashboard(
  {
    mode = "empresa",
    orgId: orgIdProp,
    campaignId: campaignIdProp,
    listHref,
    embedded = false,
    exportActionsHost,
    quotaPanel,
    recipientsPanel,
    messagePanel,
    onViewChange,
  },
  ref
) {
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
  const [csvBusy, setCsvBusy]       = useState(false);
  const [csvReady, setCsvReady]     = useState<CsvExportInfo | null>(null);
  const [csvInFlight, setCsvInFlight] = useState<CsvExportInfo | null>(null);
  const [csvFailed, setCsvFailed]   = useState<CsvExportInfo | null>(null);
  const [quotaDraft, setQuotaDraft] = useState(DEFAULT_TANDA_SIZE);
  const [refreshKey, setRefreshKey] = useState(0);
  const [verifyTarget, setVerifyTarget] = useState<string | undefined>();
  const [savingTpl, setSavingTpl] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplLang, setTplLang] = useState("es_AR");
  const [tplVars, setTplVars] = useState<string[]>([...WA_TEMPLATE_DEFAULT_VARS]);
  const [tplUrlButton, setTplUrlButton] = useState(false);
  const [tplBody, setTplBody] = useState("");

  const syncedTplId = useRef<string | null>(null);
  useEffect(() => {
    if (!campaign) return;
    if (syncedTplId.current === campaign.id) return;
    syncedTplId.current = campaign.id;
    setTplName(String(campaign.waTemplateName || ""));
    setTplLang(String(campaign.waTemplateLang || "es_AR"));
    setTplVars(
      Array.isArray(campaign.waTemplateVariables) && campaign.waTemplateVariables.length
        ? campaign.waTemplateVariables
        : [...WA_TEMPLATE_DEFAULT_VARS]
    );
    setTplUrlButton(campaign.waUrlButton === true);
    setTplBody(String(campaign.waTemplateBody || ""));
  }, [campaign]);
  useEffect(() => {
    if (typeof campaign?.tandaSize === "number" && campaign.tandaSize > 0) {
      setQuotaDraft(campaign.tandaSize);
    }
  }, [campaign?.id, campaign?.tandaSize]);
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

  const { messages, loading: msgLoading, hasMore, currentPage, nextPage, prevPage, filteredTotal } =
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

  async function guardarTopeDiario() {
    if (!campaign) return;
    setBusy(true);
    try {
      const res = await campaignRequest(mode, "/api/campaigns/quota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, orgId, tandaSize: quotaDraft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      toast({
        title: "Tope diario guardado",
        description: `Los próximos días salen de a ${quotaDraft.toLocaleString("es-AR")}. El lote de hoy no cambia.`,
      });
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Falló", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refreshCsvStatus().catch(() => undefined);
  }, [campaignId, orgId, mode]);

  useEffect(() => {
    if (!csvInFlight || (csvInFlight.status !== "pending" && csvInFlight.status !== "generating")) return;
    const t = setInterval(() => {
      void refreshCsvStatus().then((data) => {
        if (data?.latestReady?.sha256 && data.latestReady.version === csvInFlight.version) {
          toast({
            title: "CSV listo para descargar",
            description: `v${data.latestReady.version} · ${data.latestReady.rowCount.toLocaleString("es-AR")} registros`,
          });
        }
      }).catch(() => undefined);
    }, 2500);
    return () => clearInterval(t);
  }, [csvInFlight?.status, csvInFlight?.version, campaignId, orgId, mode]);

  function applyCsvStatus(data: {
    latestReady?: CsvExportInfo | null;
    inFlight?: CsvExportInfo | null;
    latestFailed?: CsvExportInfo | null;
  }) {
    setCsvReady(data.latestReady || null);
    setCsvInFlight(data.inFlight || null);
    setCsvFailed(data.latestFailed || null);
  }

  async function refreshCsvStatus() {
    const p = new URLSearchParams({ campaignId, orgId });
    const res = await campaignRequest(mode, `/api/campaigns/export?${p}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data;
    applyCsvStatus(data);
    return data;
  }

  async function openSignedCsv(params: { version?: number; exportDocId?: string }) {
    const p = new URLSearchParams({ campaignId, orgId });
    if (params.exportDocId) p.set("exportDocId", params.exportDocId);
    if (params.version) p.set("version", String(params.version));
    const res = await campaignRequest(mode, `/api/campaigns/export/download?${p}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.error || "No se pudo firmar la descarga");
    const a = document.createElement("a");
    a.href = data.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.click();
  }

  async function generarCsv(opts?: { newVersion?: boolean; retry?: boolean }) {
    setCsvBusy(true);
    try {
      const res = await campaignRequest(mode, "/api/campaigns/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          orgId,
          newVersion: opts?.newVersion === true,
          retry: opts?.retry === true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo iniciar el export");
      await refreshCsvStatus();
      if (data.started) {
        toast({ title: "Generando CSV…", description: "Te avisamos cuando esté listo. No hace falta dejar esta pantalla abierta." });
      } else if (data.export?.status === "ready") {
        toast({ title: "CSV ya disponible", description: "Usá Descargar CSV. No se regeneró el archivo." });
      }
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Falló el export", variant: "destructive" });
    } finally {
      setCsvBusy(false);
    }
  }

  async function descargarCsvListo() {
    if (!csvReady) return;
    try {
      await openSignedCsv({ version: csvReady.version });
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "No se pudo descargar", variant: "destructive" });
    }
  }

  async function descargarCsvFiltrado(kind: "vista" | "errores" | "problemas") {
    setCsvBusy(true);
    try {
      const body: Record<string, unknown> = { campaignId, orgId, kind };
      if (kind === "vista") {
        if (filter === "waWmidMissing") body.flag = "waWmidMissing";
        else if (filter !== "all") body.estado = filter;
      }
      const res = await campaignRequest(mode, "/api/campaigns/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo iniciar el CSV");
      const exportDocId = String(data.exportDocId || "");
      toast({ title: "Generando CSV…", description: "Snapshot filtrado en segundo plano." });
      for (let i = 0; i < 180; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const st = await campaignRequest(mode, `/api/campaigns/export?${new URLSearchParams({ campaignId, orgId, exportDocId })}`);
        const payload = await st.json().catch(() => ({}));
        const exp = payload.export as CsvExportInfo | undefined;
        if (exp?.status === "ready") {
          await openSignedCsv({ exportDocId });
          toast({
            title: "CSV listo",
            description:
              kind === "problemas"
                ? `${exp.rowCount.toLocaleString("es-AR")} filas · mismo formato que la subida`
                : exp.sha256
                  ? `SHA-256 ${exp.sha256.slice(0, 12)}…`
                  : undefined,
          });
          return;
        }
        if (exp?.status === "failed") throw new Error(exp.error || "Falló la generación");
      }
      throw new Error("Sigue generando. Reintentá en un momento.");
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Falló el CSV", variant: "destructive" });
    } finally {
      setCsvBusy(false);
    }
  }

  async function descargarReporte() {
    setBusy(true);
    try {
      const p = new URLSearchParams({ campaignId, orgId });
      if (filter === "waWmidMissing") p.set("flag", "waWmidMissing");
      else p.set("estado", filter === "all" ? "todos" : filter);
      if (q.trim()) p.set("nombre", q.trim());
      const res = await campaignRequest(mode, `/api/campaigns/report?${p}`);
      if (!res.ok) { toast({ title: "No se pudo generar el PDF", variant: "destructive" }); return; }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const suffix = [filter !== "all" ? filter : "", q.trim() ? "filtrado" : ""].filter(Boolean).join("-");
      a.download = `reporte-${suffix ? suffix + "-" : ""}${campaignId}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
      if (res.headers.get("X-Notificas-Truncated") === "1") {
        toast({
          title: "PDF recortado",
          description: `El PDF muestra como máximo 500 filas. Para el listado completo usá el CSV.`,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  const iniciarEnvio = useCallback(async () => {
    if (!campaign) return;
    setBusy(true);
    try {
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

  async function pausarCampana() {
    if (!campaign) return;
    setBusy(true);
    try {
      const url = isAdmin ? "/api/admin/campaigns/pause" : "/api/campaigns/pause";
      const res = await campaignRequest(mode, url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isAdmin ? { campaignId } : { campaignId, orgId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      toast({ title: "Campaña pausada", description: "El lote de mañana no arranca hasta que la reanudés." });
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Falló", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function reanudarCampana() {
    if (!campaign) return;
    setBusy(true);
    try {
      const url = isAdmin ? "/api/admin/campaigns/resume" : "/api/campaigns/resume";
      const res = await campaignRequest(mode, url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isAdmin ? { campaignId } : { campaignId, orgId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      toast({ title: "Campaña reanudada" });
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Falló", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function guardarTemplateWa() {
    if (!campaign) return;
    setSavingTpl(true);
    try {
      const res = await campaignRequest(mode, "/api/campaigns/wa-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          orgId,
          waTemplateName: tplName.trim(),
          waTemplateLang: tplLang,
          waTemplateVariables: tplVars.filter(Boolean),
          waUrlButton: tplUrlButton,
          waTemplateBody: tplBody,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar el template");
      toast({ title: "Template guardado", description: "Reintentá los errores para usar el mapping nuevo." });
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "No se pudo guardar", variant: "destructive" });
    } finally {
      setSavingTpl(false);
    }
  }

  async function reintentarErrores() {
    if (!campaign) return;
    setBusy(true);
    try {
      const sendUrl = isAdmin ? "/api/admin/campaigns/send" : "/api/campaigns/send";
      const res = await campaignRequest(mode, sendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isAdmin ? { campaignId, retryErrors: true } : { campaignId, orgId, retryErrors: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error");
      toast({
        title: "Reintento",
        description: `${data.pending ?? data.pendingThisTanda ?? data.total ?? 0} mensajes encolados`,
      });
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

  useImperativeHandle(ref, () => ({ openDestinatarios }), []);

  useEffect(() => {
    onViewChange?.({ section, filter });
  }, [section, filter, onViewChange]);

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
  const empresaReadOnly = !isAdmin && isAdminManagedCampaign(campaign);
  const canOperate = !empresaReadOnly;

  const tableCols = 4 + (showEmail ? 1 : 0) + (showWa ? 1 : 0);
  const canEditTpl = canOperate && showWa && canEditWhatsAppTemplate(campaign);
  const empresaQuota =
    mode === "empresa" &&
    !campaign.simulated &&
    showWa &&
    campaign.estado !== "cancelada" &&
    campaign.estado !== "completada";
  const showLoteTab = Boolean(quotaPanel) || empresaQuota;
  const showMessageTab = Boolean(messagePanel) || showEmail || showWa;
  const tabCount = 2 + (showLoteTab ? 1 : 0) + (showMessageTab ? 1 : 0);
  const loteContent = quotaPanel ?? (empresaQuota ? (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <DailyQuotaField
        value={quotaDraft}
        onChange={setQuotaDraft}
        disabled={empresaReadOnly}
        hint={
          empresaReadOnly
            ? "Esta campaña la gestiona el administrador. El tope diario es solo consulta."
            : fmtTs(campaign.nextDailyAt)
              ? `El lote de hoy ya está fijado. Próximo arranque: ${fmtTs(campaign.nextDailyAt)}.`
              : "Cuando Meta aumente el cupo del número, subí este valor y guardá. Rige mañana a las 9:00."
        }
      />
      {canOperate && (
        <Button variant="secondary" size="sm" disabled={busy || quotaDraft === (campaign.tandaSize || 0)} onClick={() => void guardarTopeDiario()} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar tope de los próximos días
        </Button>
      )}
    </div>
  ) : null);
  const waErrorHint =
    showWa && stats && stats.errores > 0
      ? messages.map((m) => explainWhatsAppSendError(m.waError || m.errorMsg)).find(Boolean) ||
        "Si WhatsApp falló, el template de Meta tiene que coincidir con las variables de esta campaña. Ajustalo en Template y reintentá."
      : null;

  const exportActions = (
    <CampaignExportActions
      busy={busy}
      csvBusy={csvBusy}
      errorCount={stats?.errores ?? 0}
      csvReady={csvReady}
      csvInFlight={csvInFlight}
      csvFailed={csvFailed}
      onCopy={() => void copiarCampana()}
      hideCopy={empresaReadOnly}
      onDownloadPdf={() => void descargarReporte()}
      onDownloadFilteredCsv={(kind) => void descargarCsvFiltrado(kind)}
      onDownloadProblemasCsv={() => void descargarCsvFiltrado("problemas")}
      onGenerateCsv={() => void generarCsv()}
      onDownloadReadyCsv={() => void descargarCsvListo()}
      onGenerateNewCsvVersion={() => void generarCsv({ newVersion: true })}
      onRetryCsv={() => void generarCsv({ retry: true })}
    />
  );

  return (
    <div className={embedded ? "space-y-6" : "p-6 md:p-8 max-w-6xl space-y-6"}>
      {!embedded && (
      <>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Link href={listHref || `/empresa/${orgId}/campanas`} className="text-sm text-muted-foreground hover:underline">
            ← Envíos masivos
          </Link>
          <h1 className="text-2xl font-bold mt-2">{campaign.nombre}</h1>
          {empresaReadOnly && (
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              Este envío masivo lo armó el administrador. Podés ver el avance y los destinatarios, pero no editarlo, enviarlo ni cancelarlo. Los envíos masivos que armes vos sí los podés editar y enviar.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
            {campaignEstadoBadge(campaign.estado)}
            {campaign.simulated ? <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">simulada</Badge> : null}
            {empresaReadOnly ? <Badge variant="secondary">solo consulta</Badge> : null}
            {showEmail && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />Email</span>}
            {showWa && <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5 text-emerald-600" />WhatsApp</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canOperate && campaign.estado === "enviando" && stats && stats.pendientes > 0 && !isAdmin && (
            <Button variant="secondary" onClick={continuarEnvio} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Continuar envío
            </Button>
          )}
          {canOperate && campaign.estado === "enviando" && (
            <Button variant="outline" onClick={pausarCampana} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
              Pausar envío masivo
            </Button>
          )}
          {canOperate && campaign.estado === "pausada" && (
            <Button onClick={reanudarCampana} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Reanudar
            </Button>
          )}
          {canOperate && (campaign.estado === "enviando" || campaign.estado === "pausada") && (
            <Button variant="destructive" onClick={cancelarCampana} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Cancelar envío masivo
            </Button>
          )}
          {canOperate && campaign.estado === "completada" && stats && stats.errores > 0 && !isAdmin && (
            <Button variant="outline" onClick={reintentarErrores} disabled={busy} className="gap-2 border-destructive text-destructive hover:bg-destructive/10">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
              Reintentar {stats.errores.toLocaleString("es-AR")} errores
            </Button>
          )}
          {canOperate && isUnsentCampaign(campaign) && (
            <Button variant="outline" asChild className="gap-2">
              <Link href={isAdmin ? `/admin/campanas/${campaignId}/editar` : `/empresa/${orgId}/campanas/${campaignId}/editar`}>
                <Pencil className="h-4 w-4" />
                Editar
              </Link>
            </Button>
          )}
          {canEditTpl && !isUnsentCampaign(campaign) && (
            <Button variant="outline" onClick={() => setSection("mensaje")} className="gap-2">
              <Pencil className="h-4 w-4" />
              Editar template WA
            </Button>
          )}
          {canOperate && campaign.estado === "borrador" && !isAdmin && (
            <Button onClick={iniciarEnvio} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Iniciar envío
            </Button>
          )}
          {exportActions}
        </div>
      </div>

      {campaign.estado === "pausada" && campaign.autoPauseReason ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium">Campaña pausada automáticamente</p>
          <p className="mt-1 text-muted-foreground">{campaign.autoPauseReason}</p>
          <p className="mt-2 text-muted-foreground">
            Los destinatarios que no se enviaron siguen pendientes. Reanudá cuando el límite se haya despejado.
          </p>
        </div>
      ) : null}

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

      {embedded && maybePortal(
        exportActionsHost,
        <div className="contents">{exportActions}</div>,
        <div className="flex flex-wrap justify-end gap-2">{exportActions}</div>
      )}

      <Tabs value={section} onValueChange={setSection} className="w-full">
        <div className="sticky top-14 z-10 -mx-2 border-b bg-background/95 px-2 py-2 backdrop-blur-sm lg:top-0">
          <TabsList
            className={cn(
              "grid h-auto w-full gap-1 sm:inline-flex sm:w-auto",
              tabCount >= 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"
            )}
          >
            <TabsTrigger value="destinatarios" className="gap-1.5">
              <Users className="h-4 w-4" />
              Destinatarios
            </TabsTrigger>
            {showMessageTab && (
              <TabsTrigger value="mensaje" className="gap-1.5">
                {showWa ? <MessageCircle className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                {showWa ? "Template" : "Mensaje"}
              </TabsTrigger>
            )}
            {showLoteTab && (
              <TabsTrigger value="lote" className="gap-1.5">
                <Gauge className="h-4 w-4" />
                Lote
              </TabsTrigger>
            )}
            <TabsTrigger value="integridad" className="gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              Integridad
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="destinatarios" className="mt-4 space-y-4 focus-visible:outline-none">
          {recipientsPanel}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <Tabs value={filter} onValueChange={(v) => { setFilter(v); setSelected(new Set()); }}>
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="pendiente">Pendiente</TabsTrigger>
                <TabsTrigger value="enviado">Enviado</TabsTrigger>
                <TabsTrigger value="leido">Leído</TabsTrigger>
                <TabsTrigger value="error">Error</TabsTrigger>
                <TabsTrigger value="waWmidMissing">WAMID faltante</TabsTrigger>
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

          {canOperate && (
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
            <Button
              variant="outline"
              disabled={busy || csvBusy}
              onClick={() => void descargarCsvFiltrado("problemas")}
              className="gap-2"
            >
              {csvBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Bajar errores y no entregados
            </Button>
            <p className="text-xs text-muted-foreground">Solo filas en error pueden seleccionarse individualmente.</p>
          </div>
          )}
          {waErrorHint && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
              {waErrorHint}{" "}
              {canEditTpl && (
                <button type="button" className="underline font-medium" onClick={() => setSection("mensaje")}>
                  Editar template
                </button>
              )}
            </div>
          )}

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
                          disabled={empresaReadOnly || m.estado !== "error"}
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
              {filteredTotal != null
                ? ` · ${filteredTotal.toLocaleString("es-AR")} en este filtro`
                : ""}
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
          {campaign.simulated ? (
            <p className="text-sm text-muted-foreground rounded-md border border-amber-500/40 bg-amber-500/5 p-4 mb-4">
              Simulación: no salió Mailgun ni WhatsApp. Las tandas de integridad sí se anclan en Polygon
              (Merkle de 500 envíos y 500 hechos: entregado, leído, apertura).
            </p>
          ) : null}
          <CampaignIntegrityPanel
            orgId={orgId}
            campaignId={campaignId}
            initialMessageId={verifyTarget}
            adminSession={isAdmin}
            readOnly={empresaReadOnly}
          />
        </TabsContent>

        {showLoteTab && loteContent ? (
          <TabsContent value="lote" className="mt-4 focus-visible:outline-none">
            {loteContent}
          </TabsContent>
        ) : null}

        <TabsContent value="mensaje" className="mt-4 space-y-4 focus-visible:outline-none">
          {messagePanel}
          {!messagePanel && showEmail && (
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
          {!messagePanel && showWa && (
            <div className="rounded-md border p-4 bg-muted/30 space-y-3 text-sm">
              <p className="font-medium flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-emerald-500" />
                WhatsApp
              </p>
              <p className="text-xs text-muted-foreground">
                {usesMetaTemplateAsEmailBody(campaign.canal, campaign.waTemplateName)
                  ? "Correo y WhatsApp usan el mismo texto: el BODY del template aprobado en Meta, con las variables de cada destinatario."
                  : "El aviso de WhatsApp no es el cuerpo de email: Meta solo acepta el template aprobado, con las mismas variables y en el mismo orden."}
              </p>
              {canEditTpl ? (
                <>
                  <WaSavedTemplates
                    orgId={orgId}
                    mode={mode}
                    current={{
                      name: tplName,
                      lang: tplLang,
                      variables: tplVars,
                      urlButton: tplUrlButton,
                      templateBody: tplBody,
                    }}
                    onApply={(next) => {
                      setTplName(next.name);
                      setTplLang(next.lang);
                      setTplVars(next.variables);
                      setTplUrlButton(next.urlButton);
                      if (typeof next.templateBody === "string") setTplBody(next.templateBody);
                    }}
                  />
                  <WaTemplateFields
                    idPrefix="dash-wa"
                    orgId={orgId}
                    authMode={mode}
                    value={{
                      name: tplName,
                      lang: tplLang,
                      variables: tplVars,
                      urlButton: tplUrlButton,
                      templateBody: tplBody,
                    }}
                    onChange={(next) => {
                      setTplName(next.name);
                      setTplLang(next.lang);
                      setTplVars(next.variables);
                      setTplUrlButton(next.urlButton);
                      setTplBody(next.templateBody || "");
                    }}
                  />
                  <Button onClick={() => void guardarTemplateWa()} disabled={savingTpl || busy} className="gap-2">
                    {savingTpl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Guardar template
                  </Button>
                </>
              ) : (
                <>
                  {campaign.waTemplateName ? (
                    <p className="text-muted-foreground">
                      Template: <span className="font-mono text-foreground">{campaign.waTemplateName}</span>
                      {campaign.waTemplateLang && <span className="ml-2 text-xs">({campaign.waTemplateLang})</span>}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">
                      Template: <span className="font-mono text-foreground">notificaciones_notificas</span>
                      <span className="ml-2 text-xs">(por defecto · nombre, remitente, lector)</span>
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
                  {campaign.waUrlButton ? (
                    <p className="text-muted-foreground">Botón URL: sí</p>
                  ) : null}
                  {campaign.waTemplateBody ? (
                    <p className="text-muted-foreground whitespace-pre-wrap border-t pt-2">{campaign.waTemplateBody}</p>
                  ) : null}
                </>
              )}
              {!canEditTpl && campaign.cuerpo && !campaign.waTemplateBody && (
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
          {!messagePanel && !showEmail && !showWa && (
            <p className="text-sm text-muted-foreground">No hay contenido de mensaje para mostrar.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
});

CampaignDashboard.displayName = "CampaignDashboard";
