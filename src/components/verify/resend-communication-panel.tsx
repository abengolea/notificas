"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ResendCommunicationReport } from "@/lib/resend-communication-types";
import type { MetaVerifyStatus } from "@/lib/meta-verify-status";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Circle,
  Download,
  Loader2,
  Lock,
  RefreshCw,
  XCircle,
} from "lucide-react";

function StatusMark({ status }: { status: MetaVerifyStatus }) {
  if (status === "VERIFIED" || status === "HISTORICAL_VERIFIED") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />;
  }
  if (status === "HISTORICAL_PRESERVED") {
    return <Circle className="h-4 w-4 text-muted-foreground" aria-hidden />;
  }
  if (status === "FAILED") {
    return <XCircle className="h-4 w-4 text-destructive" aria-hidden />;
  }
  if (status === "API_UNAVAILABLE") {
    return <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />;
  }
  return <Circle className="h-4 w-4 text-muted-foreground" aria-hidden />;
}

function statusLabel(status: MetaVerifyStatus): string {
  switch (status) {
    case "VERIFIED":
      return "Verificado ahora";
    case "HISTORICAL_VERIFIED":
      return "Evidencia histórica con HMAC verificado";
    case "HISTORICAL_PRESERVED":
      return "Evidencia histórica preservada";
    case "NOT_AVAILABLE":
      return "Comprobación no disponible";
    case "PENDING":
      return "Pendiente";
    case "FAILED":
      return "Validación fallida";
    case "API_UNAVAILABLE":
      return "Resend no disponible temporalmente";
  }
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })} ART`;
}

function Mono({ children }: { children: string | null | undefined }) {
  if (!children) return <span className="text-muted-foreground">—</span>;
  return <code className="font-mono text-xs break-all bg-muted px-1.5 py-0.5 rounded">{children}</code>;
}

export function ResendCommunicationPanel({
  messageId,
  campaignId,
  enabled,
  adminSession = false,
  requireAuthPrompt = true,
}: {
  messageId?: string;
  campaignId?: string;
  enabled: boolean;
  adminSession?: boolean;
  requireAuthPrompt?: boolean;
}) {
  const [authed, setAuthed] = useState<boolean | null>(adminSession ? true : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ResendCommunicationReport | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    if (adminSession) {
      setAuthed(true);
      return;
    }
    const unsub = auth.onAuthStateChanged((u) => setAuthed(Boolean(u)));
    return () => unsub();
  }, [adminSession]);

  const load = useCallback(
    async (refresh = false) => {
      if (!messageId || !enabled) return;
      setLoading(true);
      setError(null);
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        const fetchInit: RequestInit = {
          method: "POST",
          headers,
          body: JSON.stringify({ messageId, campaignId, refresh }),
        };
        if (adminSession) {
          fetchInit.credentials = "include";
        } else {
          const user = auth.currentUser;
          if (!user) return;
          headers.Authorization = `Bearer ${await user.getIdToken()}`;
        }
        const res = await fetch("/api/verify/resend", fetchInit);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(
            res.status === 404
              ? "No hay comunicación email accesible para esta cuenta."
              : "No se pudo cargar la validación Resend."
          );
          setReport(null);
          return;
        }
        setReport(json.data as ResendCommunicationReport);
      } catch {
        setError("No se pudo cargar la validación Resend.");
      } finally {
        setLoading(false);
      }
    },
    [adminSession, campaignId, enabled, messageId]
  );

  const downloadPdf = useCallback(async () => {
    if (!messageId || !enabled) return;
    setPdfBusy(true);
    setError(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const fetchInit: RequestInit = {
        method: "POST",
        headers,
        body: JSON.stringify({ messageId, campaignId, format: "pdf" }),
      };
      if (adminSession) {
        fetchInit.credentials = "include";
      } else {
        const user = auth.currentUser;
        if (!user) return;
        headers.Authorization = `Bearer ${await user.getIdToken()}`;
      }
      const res = await fetch("/api/verify/resend", fetchInit);
      if (!res.ok) {
        setError("No se pudo generar la constancia PDF de verificación Resend.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `constancia-resend-${messageId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo generar la constancia PDF de verificación Resend.");
    } finally {
      setPdfBusy(false);
    }
  }, [adminSession, campaignId, enabled, messageId]);

  useEffect(() => {
    if (authed && enabled && messageId) void load(false);
  }, [authed, enabled, messageId, load]);

  if (!enabled || !messageId) return null;

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="text-xl">Validación de la comunicación con Resend</CardTitle>
        <p className="text-sm text-muted-foreground max-w-prose">
          Distingue lo que se puede consultar ahora contra la API de Resend de los webhooks
          históricos que Notificas conservó. delivered no es bandeja de entrada; open/click no es
          lectura fehaciente.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {requireAuthPrompt && authed === false && (
          <div className="rounded-md border bg-muted/40 p-4 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Lock className="h-4 w-4" />
              Esta comprobación es solo para usuarios registrados.
            </p>
            <p className="text-muted-foreground mt-2">
              Iniciá sesión para verificar el email_id contra Resend y ver la cronología de webhooks.
            </p>
            <Button asChild className="mt-3" variant="outline">
              <Link href="/login">Iniciar sesión</Link>
            </Button>
          </div>
        )}

        {authed && loading && !report && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Consultando evidencia…
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {report && report.channel === "none" && (
          <p className="text-sm text-muted-foreground">
            Esta constancia no corresponde a una comunicación email vía Resend.
          </p>
        )}

        {report && report.channel === "email" && (
          <>
            {report.liveUnavailable && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
                <p className="font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Consulta en vivo temporalmente no disponible
                </p>
                <p className="mt-1 text-muted-foreground">{report.liveUnavailable.message}</p>
              </div>
            )}

            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div>
                <h3 className="font-semibold text-base">Consulta actual a Resend</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Fuente: GET /emails/{"{id}"} — last_event no afirma bandeja de entrada ni lectura.
                </p>
              </div>
              <div className="text-sm space-y-1">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-muted-foreground">email_id</span>
                  <Mono>{report.identification.emailId}</Mono>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-muted-foreground">SMTP Message-ID</span>
                  <Mono>{report.identification.smtpMessageId}</Mono>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-muted-foreground">Destinatario</span>
                  <Mono>{report.identification.recipientEmail}</Mono>
                </div>
                {report.live.email && (
                  <>
                    <p className="flex items-start gap-2 pt-2">
                      <StatusMark status={report.live.email.status} />
                      <span>{report.live.email.message}</span>
                    </p>
                    {report.live.email.lastEvent && (
                      <p className="text-muted-foreground">
                        last_event: <Mono>{report.live.email.lastEvent}</Mono>
                      </p>
                    )}
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Última comprobación directa:{" "}
                {report.live.lastLiveCheckAt ? formatWhen(report.live.lastLiveCheckAt) : "—"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void load(true)} disabled={loading || pdfBusy}>
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Actualizar validación
                </Button>
                <Button type="button" size="sm" onClick={() => void downloadPdf()} disabled={loading || pdfBusy}>
                  {pdfBusy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-2 h-3.5 w-3.5" />}
                  Descargar constancia Resend (PDF)
                </Button>
              </div>
            </div>

            <section className="space-y-4">
              <h3 className="font-semibold">Cronología informada por Resend</h3>
              <p className="text-xs text-muted-foreground">
                Fuente: webhook histórico Svix conservado por Notificas
              </p>
              {report.chronology.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay eventos Resend conservados para este mensaje.</p>
              )}
              {report.chronology.map((ev, i) => (
                <div key={`${ev.kind}-${i}`} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusMark status={ev.status} />
                    <h4 className="font-medium">{ev.title}</h4>
                    <Badge variant="outline">{statusLabel(ev.status)}</Badge>
                  </div>
                  <p className="text-sm">{ev.claim}</p>
                  <p className="text-sm text-muted-foreground">
                    Timestamp informado por Resend: {formatWhen(ev.providerTimestamp)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Recibido por Notificas: {formatWhen(ev.receivedAt)}
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>
                      Payload original: {ev.rawPreserved ? "preservado" : "no conservado para este evento"}
                    </li>
                    <li>Firma Svix: {ev.signatureHeaderPresent ? "preservada" : "no disponible"}</li>
                    <li>{ev.webhookAuthLabel}</li>
                  </ul>
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="px-0 text-muted-foreground">
                        Ver evidencia técnica
                        <ChevronDown className="ml-1 h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3 space-y-2 text-sm border rounded-md p-3 bg-muted/40">
                      <p>
                        Notification ID: <Mono>{report.identification.notificationId}</Mono>
                      </p>
                      <p>
                        email_id: <Mono>{ev.emailId}</Mono>
                      </p>
                      <p>
                        SHA-256: <Mono>{ev.payloadSha256}</Mono>
                      </p>
                      <p>Autenticación: {ev.signatureValidation}</p>
                      <p className="text-muted-foreground">
                        {ev.rawPublic === "none"
                          ? "Payload original no conservado."
                          : "Payload original preservado. Se exhibe únicamente su SHA-256."}
                      </p>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              ))}
            </section>

            <p className="text-sm text-muted-foreground max-w-prose">{report.disclaimer}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
