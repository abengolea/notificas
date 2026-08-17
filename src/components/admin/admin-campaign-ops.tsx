"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Mail, MessageCircle, Play, RefreshCw, Save, Upload, XCircle, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { csvCamposRequeridos, csvPlaceholder } from "@/lib/parse-campaign-csv";
import { uploadCampaignCsvInChunks } from "@/lib/upload-campaign-recipients";
import { DEFAULT_TANDA_SIZE } from "@/lib/campaign-tanda";
import {
  SIM_RECIPIENT_DEFAULT,
  SIM_RECIPIENT_MAX,
  SIM_RECIPIENT_MIN,
} from "@/lib/campaign-fake-recipients";
import type { CanalCampaign } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CampaignDashboard } from "@/components/empresa/campaign-dashboard";

type CampaignPayload = {
  id: string;
  orgId: string;
  nombre: string;
  asunto: string;
  cuerpo: string;
  canal: CanalCampaign;
  estado: string;
  recipientCount: number;
  tandaSize: number;
  simulated?: boolean;
  waTemplateName: string;
  waTemplateLang: string;
  waTemplateVariables: string[];
  stats: { total: number; enviados: number; leidos: number; pendientes: number; errores: number };
};

type DetailResponse = {
  campaign: CampaignPayload;
  org: { id: string; nombre: string; plan: string; adminUserEmail: string };
  creditos: number;
  alreadySent: number;
};

function estadoBadge(estado: string) {
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

export function AdminCampaignOps({ campaignId }: { campaignId: string }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState<{ parsed: number; skipped: number; chunks: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [tandaSize, setTandaSize] = useState(DEFAULT_TANDA_SIZE);
  const [simRecipientCount, setSimRecipientCount] = useState(SIM_RECIPIENT_DEFAULT);
  const [generating, setGenerating] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateLang, setTemplateLang] = useState("es_AR");
  const formReady = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/campaigns/${campaignId}`, { credentials: "include" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "No se pudo cargar");
    setData(json as DetailResponse);
    if (!formReady.current) {
      const c = json.campaign as CampaignPayload;
      setTemplateName(c.waTemplateName || "");
      setTemplateLang(c.waTemplateLang || "es_AR");
      if (typeof c.tandaSize === "number" && c.tandaSize > 0) setTandaSize(c.tandaSize);
      formReady.current = true;
    }
    return json as DetailResponse;
  }, [campaignId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [load, toast]);

  useEffect(() => {
    if (data?.campaign.estado !== "enviando") return;
    const t = setInterval(() => {
      void load().catch(() => undefined);
    }, 4000);
    return () => clearInterval(t);
  }, [data?.campaign.estado, load]);

  async function saveTemplate() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waTemplateName: templateName.trim(),
          waTemplateLang: templateLang,
          tandaSize,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo guardar");
      toast({ title: "Guardado" });
      await load();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function onFile(file: File) {
    if (!data) return;
    setUploading(true);
    setUploadPct({ parsed: 0, skipped: 0, chunks: 0 });
    try {
      const result = await uploadCampaignCsvInChunks({
        campaignId,
        orgId: data.campaign.orgId,
        file,
        canal: data.campaign.canal,
        endpoint: "/api/admin/campaigns/upload-recipients",
        onProgress: (p) =>
          setUploadPct({
            parsed: p.parsed ?? 0,
            skipped: p.skipped ?? 0,
            chunks: p.uploadedChunks,
          }),
      });
      toast({
        title: "CSV cargado",
        description: `${result.recipientCount.toLocaleString("es-AR")} destinatarios (${result.skipped} filas salteadas)`,
      });
      await load();
    } catch (e) {
      toast({
        title: "Error al subir CSV",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  async function generateFakeRecipients() {
    if (!data) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/campaigns/generate-recipients", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, count: simRecipientCount }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudieron generar");
      toast({
        title: "Destinatarios de prueba",
        description: `${Number(json.recipientCount || 0).toLocaleString("es-AR")} ficticios cargados`,
      });
      await load();
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }

  async function sendTanda() {
    setSending(true);
    try {
      const res = await fetch("/api/admin/campaigns/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, tandaSize: data?.campaign.simulated ? 0 : tandaSize }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo enviar");
      if (json.reason === "tanda_completa") {
        toast({ title: "Esta tanda ya está completa", description: "Subí el tope (día 2 o 3) y volvé a disparar." });
      } else {
        toast({
          title: "Tanda encolada",
          description: `${json.pendingThisTanda?.toLocaleString("es-AR")} envíos nuevos (ya había ${json.alreadySent?.toLocaleString("es-AR")})`,
        });
      }
      setConfirmSend(false);
      await load();
    } catch (e) {
      toast({ title: "No se envió", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  async function cancelCampaign() {
    if (!confirm("¿Cancelar? Los workers en vuelo pueden terminar, pero no se encolan más.")) return;
    const res = await fetch("/api/admin/campaigns/cancel", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast({ title: "Error", description: json.error || "No se pudo cancelar", variant: "destructive" });
      return;
    }
    toast({ title: "Campaña cancelada" });
    await load();
  }

  if (loading || !data) {
    return (
      <div className="p-2 max-w-6xl space-y-4">
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const c = data.campaign;
  const already = data.alreadySent ?? c.stats.enviados;
  const remaining = Math.max(0, c.recipientCount - already);
  const thisTanda = tandaSize > 0 ? Math.min(tandaSize, remaining) : remaining;
  const stats = c.stats;
  const leidoPct = stats.enviados > 0 ? Math.round((stats.leidos / stats.enviados) * 100) : 0;
  const enviadoPct = stats.total > 0 ? Math.round((stats.enviados / stats.total) * 100) : 0;
  const canSend = c.recipientCount > 0 && c.estado !== "cancelada" && thisTanda > 0;
  const showEmail = c.canal === "email" || c.canal === "ambos";
  const showWa = c.canal === "whatsapp" || c.canal === "ambos";

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Link href="/admin/campanas" className="text-sm text-muted-foreground hover:underline">
            ← Campañas
          </Link>
          <h1 className="text-2xl font-bold mt-2">{c.nombre}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
            {estadoBadge(c.estado)}
            {c.simulated ? (
              <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400 gap-1">
                <FlaskConical className="h-3.5 w-3.5" />
                simulada
              </Badge>
            ) : null}
            {showEmail && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />Email</span>}
            {showWa && <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5 text-emerald-600" />WhatsApp</span>}
            <span>{data.org.nombre}{c.simulated ? " · no se factura" : ` · se factura a ${data.org.adminUserEmail || "la empresa"}`}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.estado !== "cancelada" && (
            <Button disabled={!canSend || sending} onClick={() => setConfirmSend(true)} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {c.estado === "borrador" ? (c.simulated ? "Iniciar simulación" : "Iniciar envío") : "Enviar esta tanda"}
            </Button>
          )}
          {c.estado !== "cancelada" && (
            <Button variant="destructive" onClick={() => void cancelCampaign()} className="gap-2">
              <XCircle className="h-4 w-4" />
              Cancelar campaña
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            { label: "Enviados", value: stats.enviados, hint: `de ${c.recipientCount.toLocaleString("es-AR")} destinatarios` },
            { label: "Leídos", value: stats.leidos, hint: `${leidoPct}% del envío` },
            { label: "Pendientes", value: stats.pendientes, hint: "aún en cola" },
            { label: "Errores", value: stats.errores, hint: stats.errores > 0 ? "revisá la tanda" : "sin errores" },
          ] as const
        ).map((s) => (
          <div key={s.label} className={cn("rounded-lg border bg-card p-4", s.label === "Errores" && s.value > 0 && "border-destructive/40")}>
            <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{s.value.toLocaleString("es-AR")}</p>
            {s.label === "Leídos" ? (
              <div className="mt-2 space-y-1">
                <Progress value={leidoPct} className="h-2" />
                <p className="text-xs text-muted-foreground">{s.hint}</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">{s.hint}</p>
            )}
          </div>
        ))}
      </div>

      {c.estado === "enviando" && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Enviando… {enviadoPct}% completado — {stats.enviados.toLocaleString("es-AR")} de {stats.total.toLocaleString("es-AR")}
          </div>
          <Progress value={enviadoPct} className="h-2" />
        </div>
      )}

      {!c.simulated && (
      <Card>
        <CardHeader>
          <CardTitle>Límite por envío</CardTitle>
          <CardDescription>
            Cada vez que apretás Enviar, salen como máximo este número de destinatarios nuevos. Cuando WhatsApp te suba el cupo, cambialo y volvé a disparar.
            Los envíos exitosos se facturan a {data.org.adminUserEmail || data.org.nombre}; no hace falta cargar saldo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 max-w-xs">
            <Label className="text-xs shrink-0">Máximo</Label>
            <Input
              type="number"
              min={1}
              value={tandaSize}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isInteger(n) && n >= 0) setTandaSize(n);
              }}
            />
          </div>
          <p className="text-sm">
            Este envío mandaría <strong>{thisTanda.toLocaleString("es-AR")}</strong> nuevos
            {already > 0 ? ` (ya van ${already.toLocaleString("es-AR")})` : null}.
          </p>
        </CardContent>
      </Card>
      )}

      {c.estado === "borrador" && (
        <Card>
          <CardHeader>
            <CardTitle>{c.simulated ? "Destinatarios de prueba" : "Destinatarios (CSV)"}</CardTitle>
            <CardDescription>
              {c.simulated
                ? `Generá una lista ficticia o subí un CSV. Ahora hay ${c.recipientCount.toLocaleString("es-AR")}.`
                : `Columnas: ${csvCamposRequeridos(c.canal)}. Se sube de a 500. Ahora hay ${c.recipientCount.toLocaleString("es-AR")}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {c.simulated && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1 max-w-[12rem]">
                  <Label className="text-xs">Cantidad ficticia</Label>
                  <Input
                    type="number"
                    min={SIM_RECIPIENT_MIN}
                    max={SIM_RECIPIENT_MAX}
                    value={simRecipientCount}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isInteger(n)) setSimRecipientCount(n);
                    }}
                  />
                </div>
                <Button variant="secondary" disabled={generating} onClick={() => void generateFakeRecipients()}>
                  {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FlaskConical className="h-4 w-4 mr-2" />}
                  Generar lista
                </Button>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />
            <Button variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              {c.recipientCount > 0 ? "Reemplazar CSV" : "Subir CSV"}
            </Button>
            {uploading && uploadPct && (
              <p className="text-sm text-muted-foreground">
                Procesados {uploadPct.parsed.toLocaleString("es-AR")} · archivos {uploadPct.chunks} · salteados {uploadPct.skipped}
              </p>
            )}
            <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">{csvPlaceholder(c.canal)}</p>
          </CardContent>
        </Card>
      )}

      <div className="rounded-md border p-4 bg-muted/30 space-y-2 text-sm">
        {showEmail && (
          <div className="space-y-1">
            <p className="font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Correo
            </p>
            <p className="text-muted-foreground">
              Asunto: <span className="font-medium text-foreground">{c.asunto || "—"}</span>
            </p>
          </div>
        )}
        {showWa && !c.simulated && (
          <div className="space-y-3">
            <p className="font-medium flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-emerald-500" />
              WhatsApp
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1 min-w-[220px] flex-1">
                <Label className="text-xs">Nombre del template</Label>
                <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Vacío = template por defecto de Notificas" />
                <p className="text-xs text-muted-foreground">Si lo dejás vacío, se usa el template registrado por defecto en el servidor.</p>
              </div>
              <div className="space-y-1 w-32">
                <Label className="text-xs">Idioma</Label>
                <Select value={templateLang} onValueChange={setTemplateLang}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es_AR">Español (Argentina)</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="es_MX">Español (México)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="secondary" disabled={saving} onClick={() => void saveTemplate()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar
              </Button>
            </div>
          </div>
        )}
        {c.cuerpo ? (
          <p className="text-muted-foreground whitespace-pre-wrap border-t pt-2">{c.cuerpo}</p>
        ) : null}
      </div>

      <CampaignDashboard
        mode="admin"
        orgId={c.orgId}
        campaignId={campaignId}
        listHref="/admin/campanas"
        embedded
      />

      <AlertDialog open={confirmSend} onOpenChange={setConfirmSend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{c.simulated ? "¿Confirmar simulación?" : "¿Confirmar envío masivo?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {c.simulated ? (
                <>
                  Se van a simular {remaining.toLocaleString("es-AR")} envíos para {data.org.nombre}.
                  No sale nada a Mailgun ni a WhatsApp; el dashboard muestra entregas y aperturas al azar.
                  Cada 500 envíos (y cada 500 hechos) se publica una tanda Merkle en Polygon.
                </>
              ) : (
                <>
              Estás por encolar hasta {thisTanda.toLocaleString("es-AR")} notificaciones para {data.org.nombre}.
              Se facturan los envíos exitosos; no se descuenta saldo. Si el día 1 falla mucho, no sigas.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button disabled={sending} onClick={() => void sendTanda()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : c.simulated ? "Simular" : "Confirmar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
