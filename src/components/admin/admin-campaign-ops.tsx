"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Mail, MessageCircle, Pause, Pencil, Play, RefreshCw, Save, Upload, XCircle, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { DEFAULT_TANDA_SIZE, campaignDayKey, planDailySend } from "@/lib/campaign-tanda";
import {
  SIM_RECIPIENT_DEFAULT,
  SIM_RECIPIENT_MAX,
  SIM_RECIPIENT_MIN,
} from "@/lib/campaign-fake-recipients";
import type { CanalCampaign } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CampaignDashboard } from "@/components/empresa/campaign-dashboard";
import { canEditWhatsAppTemplate, isUnsentCampaign } from "@/lib/campaign-edit";
import { WA_TEMPLATE_DEFAULT_VARS, csvColumnsFromWaVariables, usesNotificasDefaultTemplate } from "@/lib/wa-template-fields";
import { WaTemplateFields } from "@/components/empresa/wa-template-fields";
import { WaSavedTemplates } from "@/components/empresa/wa-saved-templates";
import { DailyQuotaField } from "@/components/empresa/daily-quota-field";

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
  tandaDayKey?: string;
  tandaDayQuota?: number;
  tandaDaySentStart?: number;
  nextDailyAt?: string | null;
  nextDailyDayKey?: string;
  simulated?: boolean;
  waTemplateName: string;
  waTemplateLang: string;
  waTemplateVariables: string[];
  waUrlButton?: boolean;
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
    case "pausada":
      return <Badge className="bg-amber-600 hover:bg-amber-600">pausada</Badge>;
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
  const [templateVars, setTemplateVars] = useState<string[]>([...WA_TEMPLATE_DEFAULT_VARS]);
  const [templateUrlButton, setTemplateUrlButton] = useState(false);
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
      setTemplateVars(
        Array.isArray(c.waTemplateVariables) && c.waTemplateVariables.length
          ? c.waTemplateVariables
          : [...WA_TEMPLATE_DEFAULT_VARS]
      );
      setTemplateUrlButton(c.waUrlButton === true);
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
          tandaSize,
          ...(data && canEditWhatsAppTemplate(data.campaign)
            ? {
                waTemplateName: templateName.trim(),
                waTemplateLang: templateLang,
                waTemplateVariables: templateVars.filter(Boolean),
                waUrlButton: templateUrlButton,
              }
            : {}),
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
        toast({
          title: "Cupo de hoy completo",
          description: "El lote de hoy ya salió. Podés cambiar el cupo; rige mañana.",
        });
      } else {
        toast({
          title: "Tanda encolada",
          description: `${json.pendingThisTanda?.toLocaleString("es-AR")} envíos nuevos (ya había ${json.alreadySent?.toLocaleString("es-AR")}). El lote de mañana arranca solo a las 9:00.`,
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

  async function pauseCampaign() {
    const res = await fetch("/api/admin/campaigns/pause", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast({ title: "Error", description: json.error || "No se pudo pausar", variant: "destructive" });
      return;
    }
    toast({ title: "Campaña pausada", description: "No arranca el lote de mañana hasta que la reanudés." });
    await load();
  }

  async function resumeCampaign() {
    const res = await fetch("/api/admin/campaigns/resume", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast({ title: "Error", description: json.error || "No se pudo reanudar", variant: "destructive" });
      return;
    }
    toast({
      title: "Campaña reanudada",
      description: json.queued
        ? `${Number(json.pendingThisTanda || 0).toLocaleString("es-AR")} envíos encolados`
        : "Sigue mañana a las 9:00, o cuando haya cupo de hoy.",
    });
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
  const plan = planDailySend({
    campaign: {
      tandaSize: c.simulated ? 0 : tandaSize,
      tandaDayKey: c.tandaDayKey,
      tandaDayQuota: c.tandaDayQuota,
      tandaDaySentStart: c.tandaDaySentStart,
    },
    alreadySent: already,
    totalRecipients: c.recipientCount,
  });
  const thisTanda = c.simulated ? remaining : plan.thisRun;
  const todayLocked = Boolean(c.tandaDayKey && c.tandaDayKey === campaignDayKey());
  const upcomingChanged = todayLocked && tandaSize !== (c.tandaSize || 0);
  const stats = c.stats;
  const leidoPct = stats.enviados > 0 ? Math.round((stats.leidos / stats.enviados) * 100) : 0;
  const enviadoPct = stats.total > 0 ? Math.round((stats.enviados / stats.total) * 100) : 0;
  const canSend = c.recipientCount > 0 && c.estado !== "cancelada" && c.estado !== "pausada" && thisTanda > 0;
  const canReplaceCsv = canEditWhatsAppTemplate(c);
  const canEditTpl = canEditWhatsAppTemplate(c);
  const csvExtra = usesNotificasDefaultTemplate(c.waTemplateName)
    ? []
    : csvColumnsFromWaVariables(c.waTemplateVariables);
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
          {isUnsentCampaign(c) && (
            <Button variant="outline" asChild className="gap-2">
              <Link href={`/admin/campanas/${campaignId}/editar`}>
                <Pencil className="h-4 w-4" />
                Editar
              </Link>
            </Button>
          )}
          {c.estado !== "cancelada" && c.estado !== "pausada" && (
            <Button disabled={!canSend || sending} onClick={() => setConfirmSend(true)} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {c.estado === "borrador" ? (c.simulated ? "Iniciar simulación" : "Iniciar envío de hoy") : "Enviar lote de hoy"}
            </Button>
          )}
          {c.estado === "enviando" && (
            <Button variant="outline" onClick={() => void pauseCampaign()} className="gap-2">
              <Pause className="h-4 w-4" />
              Pausar campaña
            </Button>
          )}
          {c.estado === "pausada" && (
            <Button onClick={() => void resumeCampaign()} className="gap-2">
              <Play className="h-4 w-4" />
              Reanudar
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

      {c.estado === "pausada" ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Campaña pausada. No sale el lote de mañana hasta que la reanudés. El cupo que guardes rige al día siguiente de reanudar.
        </div>
      ) : c.estado === "enviando" && thisTanda === 0 && remaining > 0 ? (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          El lote de hoy está completo ({plan.sentToday.toLocaleString("es-AR")} de {plan.dailyQuota.toLocaleString("es-AR")}).
          Quedan {remaining.toLocaleString("es-AR")} destinatarios.
          {" "}El próximo lote arranca solo {c.nextDailyAt
            ? new Date(c.nextDailyAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })
            : "mañana a las 9:00"}
          {tandaSize !== plan.dailyQuota
            ? ` (próximos días: ${tandaSize.toLocaleString("es-AR")})`
            : ""}.
        </div>
      ) : c.estado === "enviando" ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Enviando… {enviadoPct}% completado — {stats.enviados.toLocaleString("es-AR")} de {stats.total.toLocaleString("es-AR")}
          </div>
          <Progress value={enviadoPct} className="h-2" />
        </div>
      ) : null}

      {!c.simulated && (
      <Card>
        <CardHeader>
          <CardTitle>Lote diario</CardTitle>
          <CardDescription>
            Cada día sale como máximo este número de destinatarios nuevos. El lote del día siguiente arranca solo a las 9:00 (Argentina). Si lo cambiás a mitad de campaña, el nuevo cupo rige mañana. Pausá para que no siga.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DailyQuotaField
            value={tandaSize}
            onChange={setTandaSize}
            hint="Cuando Meta suba el cupo Unique Users del número (1.000 → 10.000 → 100.000), cambiá este valor. El lote de hoy queda; rige mañana a las 9:00."
          />
          <p className="text-sm">
            Hoy: cupo <strong>{plan.dailyQuota > 0 ? plan.dailyQuota.toLocaleString("es-AR") : "sin tope"}</strong>
            {plan.dailyQuota > 0 ? (
              <>
                {" "}· ya van {plan.sentToday.toLocaleString("es-AR")} · quedan{" "}
                {plan.remainingToday.toLocaleString("es-AR")}
              </>
            ) : null}
            . Próximos días: <strong>{tandaSize.toLocaleString("es-AR")}</strong>.
          </p>
          {todayLocked && tandaSize !== (c.tandaDayQuota || 0) ? (
            <p className="text-xs text-muted-foreground">
              El cambio a {tandaSize.toLocaleString("es-AR")} no mueve el lote de hoy
              {upcomingChanged ? "; guardalo y mañana se usa ese número." : "."}
            </p>
          ) : null}
          <p className="text-sm">
            Este disparo mandaría <strong>{thisTanda.toLocaleString("es-AR")}</strong> nuevos
            {already > 0 ? ` (ya van ${already.toLocaleString("es-AR")} en total)` : null}.
          </p>
          <Button variant="secondary" disabled={saving} onClick={() => void saveTemplate()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar cupo de los próximos días
          </Button>
        </CardContent>
      </Card>
      )}

      {canReplaceCsv && (
        <Card>
          <CardHeader>
            <CardTitle>{c.simulated ? "Destinatarios de prueba" : "Destinatarios (CSV)"}</CardTitle>
            <CardDescription>
              {c.simulated
                ? `Generá una lista ficticia o subí un CSV. Ahora hay ${c.recipientCount.toLocaleString("es-AR")}.`
                : `Columnas: ${csvCamposRequeridos(c.canal, csvExtra)}. Se sube de a 500. Ahora hay ${c.recipientCount.toLocaleString("es-AR")}.`}
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
            <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">{csvPlaceholder(c.canal, csvExtra)}</p>
            <p className="text-xs text-muted-foreground">
              <code>telefono</code> es el destino del WhatsApp, no una variable del texto.
              {csvExtra.length > 0 ? ` El mensaje usa: ${csvExtra.join(", ")}.` : ""}
            </p>
            {csvExtra.length > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Subí el CSV de nuevo y después reintentá los errores.
              </p>
            )}
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
            <WaSavedTemplates
              orgId={c.orgId}
              mode="admin"
              disabled={!canEditTpl}
              current={{
                name: templateName,
                lang: templateLang,
                variables: templateVars,
                urlButton: templateUrlButton,
              }}
              onApply={(next) => {
                setTemplateName(next.name);
                setTemplateLang(next.lang);
                setTemplateVars(next.variables);
                setTemplateUrlButton(next.urlButton);
              }}
            />
            <WaTemplateFields
              idPrefix="admin-wa"
              disabled={!canEditTpl}
              namePlaceholder="Vacío = template por defecto de Notificas"
              value={{
                name: templateName,
                lang: templateLang,
                variables: templateVars,
                urlButton: templateUrlButton,
              }}
              onChange={(next) => {
                setTemplateName(next.name);
                setTemplateLang(next.lang);
                setTemplateVars(next.variables);
                setTemplateUrlButton(next.urlButton);
              }}
            />
            <Button variant="secondary" disabled={saving || !canEditTpl} onClick={() => void saveTemplate()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar template
            </Button>
            {!canEditTpl && (
              <p className="text-xs text-muted-foreground">
                El template se puede editar solo si todavía no hubo envíos exitosos.
              </p>
            )}
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
              Estás por encolar hasta {thisTanda.toLocaleString("es-AR")} notificaciones para {data.org.nombre} (lote de hoy).
              El cupo de los próximos días es {tandaSize.toLocaleString("es-AR")}; si lo cambiás, rige mañana.
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
