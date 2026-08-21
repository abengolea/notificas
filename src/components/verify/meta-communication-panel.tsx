"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { MetaCommunicationReport } from "@/lib/meta-communication-types";
import type { MetaVerifyStatus } from "@/lib/meta-verify-status";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Circle,
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
  if (status === "PENDING") {
    return <Loader2 className="h-4 w-4 text-amber-600" aria-hidden />;
  }
  if (status === "API_UNAVAILABLE") {
    return <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />;
  }
  return <Circle className="h-4 w-4 text-muted-foreground" aria-hidden />;
}

function statusLabel(status: MetaVerifyStatus): string {
  switch (status) {
    case "VERIFIED":
      return "Verificado";
    case "HISTORICAL_VERIFIED":
      return "Evidencia histórica preservada y autenticación criptográfica verificada";
    case "HISTORICAL_PRESERVED":
      return "Evidencia histórica preservada";
    case "NOT_AVAILABLE":
      return "Comprobación no disponible";
    case "PENDING":
      return "Pendiente";
    case "FAILED":
      return "No coincide / validación fallida";
    case "API_UNAVAILABLE":
      return "Meta no disponible temporalmente";
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
  return (
    <code className="font-mono text-xs break-all bg-muted px-1.5 py-0.5 rounded">{children}</code>
  );
}

function TechnicalBlock({
  report,
  event,
}: {
  report: MetaCommunicationReport;
  event?: MetaCommunicationReport["chronology"][number];
}) {
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="px-0 text-muted-foreground">
          Ver evidencia técnica
          <ChevronDown className="ml-1 h-4 w-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-3 text-sm border rounded-md p-3 bg-muted/40">
        <div>
          <p className="font-medium mb-1">Identificación</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>Notification ID: <Mono>{report.identification.notificationId}</Mono></li>
            <li>Campaign ID: <Mono>{report.identification.campaignId}</Mono></li>
            <li>WAMID: <Mono>{report.identification.wamid}</Mono></li>
            <li>WABA ID: <Mono>{report.identification.wabaId}</Mono></li>
            <li>Phone Number ID: <Mono>{report.identification.phoneNumberId}</Mono></li>
            <li>Template ID: <Mono>{report.identification.templateId}</Mono></li>
          </ul>
        </div>
        {event && (
          <div>
            <p className="font-medium mb-1">Evento Meta</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>status: {event.kind}</li>
              <li>timestamp Meta: {formatWhen(event.metaTimestamp)}</li>
              <li>timestamp recepción Notificas: {formatWhen(event.receivedAt)}</li>
              <li>recipient_id: <Mono>{event.recipientId}</Mono></li>
              <li>X-Hub-Signature-256: {event.signatureHeaderPresent ? "presente" : "no disponible"}</li>
              <li>Resultado autenticación: {event.signatureValidation}</li>
              <li>SHA-256 payload: <Mono>{event.payloadSha256}</Mono></li>
            </ul>
          </div>
        )}
        {event?.polygon && (
          <div>
            <p className="font-medium mb-1">Integridad</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>SHA-256 payload RAW: {event.payloadSha256 ? <Mono>{event.payloadSha256}</Mono> : "—"}</li>
              <li>Merkle leaf: {event.polygon.leafHash ? <Mono>{event.polygon.leafHash}</Mono> : "—"}</li>
              <li>
                Merkle proof:{" "}
                {event.polygon.proof?.length
                  ? `${event.polygon.proof.length} hermanos · índice ${event.polygon.leafIndex ?? "—"}`
                  : "—"}
              </li>
              <li>Merkle root: {event.polygon.merkleRoot ? <Mono>{event.polygon.merkleRoot}</Mono> : "—"}</li>
              <li>
                Transaction Hash:{" "}
                {event.polygon.txHash ? (
                  <a
                    className="text-primary underline"
                    href={`https://polygonscan.com/tx/${event.polygon.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {event.polygon.txHash.slice(0, 18)}…
                  </a>
                ) : (
                  "—"
                )}
              </li>
              <li>
                Prueba Merkle (servidor):{" "}
                {event.polygon.merkleValid === true
                  ? "válida"
                  : event.polygon.merkleValid === false
                    ? "no válida"
                    : "no disponible"}
              </li>
            </ul>
            {event.polygon.leafHash && event.polygon.proof && event.polygon.merkleRoot != null && typeof event.polygon.leafIndex === "number" && (
              <MerkleCheckButton
                leafHash={event.polygon.leafHash}
                proof={event.polygon.proof}
                merkleRoot={event.polygon.merkleRoot}
                leafIndex={event.polygon.leafIndex}
              />
            )}
          </div>
        )}
        <div>
          <p className="font-medium mb-1">RAW DATA</p>
          <p className="text-muted-foreground">
            {event?.rawPublic === "none"
              ? "Payload original no conservado para este evento."
              : event?.rawPublic === "omitted_sensitive"
                ? "Payload original preservado por Notificas. El contenido completo no se exhibe en esta pantalla."
                : event?.payloadSha256
                  ? "Payload original preservado por Notificas. Se exhibe únicamente su SHA-256."
                  : "Sin payload RAW."}
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function MerkleCheckButton({
  leafHash,
  proof,
  merkleRoot,
  leafIndex,
}: {
  leafHash: string;
  proof: string[];
  merkleRoot: string;
  leafIndex: number;
}) {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "fail">("idle");
  return (
    <div className="mt-2 space-y-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={state === "loading"}
        onClick={() => {
          void (async () => {
            setState("loading");
            const { verifyMerkleProof } = await import("@/lib/merkle");
            const ok = await verifyMerkleProof(leafHash, proof, merkleRoot, leafIndex);
            setState(ok ? "ok" : "fail");
          })();
        }}
      >
        Verificar prueba Merkle
      </Button>
      {state === "ok" && (
        <p className="text-sm text-emerald-700">La hoja pertenece a la raíz Merkle indicada.</p>
      )}
      {state === "fail" && (
        <p className="text-sm text-destructive">La prueba Merkle no reconstruye la raíz.</p>
      )}
    </div>
  );
}

export function MetaCommunicationPanel({
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
  const [report, setReport] = useState<MetaCommunicationReport | null>(null);

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
        const res = await fetch("/api/verify/meta", fetchInit);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(res.status === 404 ? "No hay comunicación WhatsApp accesible para esta cuenta." : "No se pudo cargar la validación Meta.");
          setReport(null);
          return;
        }
        setReport(json.data as MetaCommunicationReport);
      } catch {
        setError("No se pudo cargar la validación Meta.");
      } finally {
        setLoading(false);
      }
    },
    [adminSession, campaignId, enabled, messageId]
  );

  useEffect(() => {
    if (authed && enabled && messageId) void load(false);
  }, [authed, enabled, messageId, load]);

  if (!enabled || !messageId) return null;

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="text-xl">Validación de la comunicación con Meta</CardTitle>
        <p className="text-sm text-muted-foreground max-w-prose">
          Distingue lo que se puede consultar ahora contra Meta Graph API de los eventos históricos
          que Meta informó por webhook y Notificas conservó.
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
              Iniciá sesión para verificar identificadores de infraestructura contra Meta y ver la
              cronología histórica de webhooks.
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
          <p className="text-sm text-muted-foreground">Esta constancia no corresponde a una comunicación WhatsApp.</p>
        )}

        {report && report.channel === "whatsapp" && (
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

            <section className="space-y-3">
              <h3 className="font-semibold">Identificación en Meta</h3>
              <p className="text-xs text-muted-foreground">Fuente: Meta Graph API — consulta actual</p>
              <IdentityRow
                label="WABA ID"
                value={report.identification.wabaId}
                check={report.live.waba}
              />
              <IdentityRow
                label="Phone Number ID"
                value={report.identification.phoneNumberId}
                check={report.live.phone}
              />
              <div className="text-sm space-y-1">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-muted-foreground">Template</span>
                  <span>{report.identification.templateName || "—"}</span>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-muted-foreground">Template ID</span>
                  <Mono>{report.identification.templateId}</Mono>
                </div>
                {report.live.template && (
                  <p className="flex items-start gap-2 text-sm">
                    <StatusMark status={report.live.template.status} />
                    <span>
                      {report.live.template.message}
                      {report.live.templateNameMatchesSnapshot && report.live.templateLangMatchesSnapshot
                        ? " Nombre e idioma coinciden con la evidencia conservada."
                        : ""}
                    </span>
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{report.live.templateContentHistoricalNote}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Última comprobación directa con Meta: {report.live.lastLiveCheckAt ? formatWhen(report.live.lastLiveCheckAt) : "—"}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void load(true)} disabled={loading}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Actualizar validación
              </Button>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">Identificador del mensaje</h3>
              <p className="text-xs text-muted-foreground">Fuente: evidence_snapshot / respuesta de envío</p>
              <p className="text-sm">
                WAMID: <Mono>{report.message.wamid}</Mono>
              </p>
              <p className="text-sm text-muted-foreground">{report.message.explanation}</p>
              {report.message.wamidSource === "graph_http_raw" && (
                <p className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Respuesta HTTP RAW de Meta al POST /messages preservada. El WAMID extraído coincide.
                </p>
              )}
              {report.message.wamidSource === "parsed_graph_json" && (
                <p className="text-sm text-muted-foreground">
                  El WAMID registrado por Notificas corresponde al identificador devuelto por Meta al procesar el envío.
                  Para esta comunicación histórica se conservó el identificador extraído, pero no el cuerpo HTTP RAW completo de la respuesta.
                </p>
              )}
              {report.message.wamidSource === "extracted_id_only" && (
                <p className="text-sm text-muted-foreground">
                  Se conservó el WAMID extraído. No hay cuerpo HTTP RAW de la respuesta de envío para esta comunicación.
                </p>
              )}
            </section>

            {report.inconsistencies.length > 0 && (
              <section className="space-y-2">
                {report.inconsistencies.map((inc) => (
                  <p key={inc.code} className="flex items-start gap-2 text-sm text-destructive">
                    <XCircle className="h-4 w-4 mt-0.5" />
                    {inc.message}
                  </p>
                ))}
              </section>
            )}

            <section className="space-y-4">
              <h3 className="font-semibold">Cronología informada por Meta</h3>
              <p className="text-xs text-muted-foreground">Fuente: webhook histórico de Meta conservado por Notificas</p>
              {report.chronology.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay eventos Meta conservados para este mensaje.</p>
              )}
              {report.chronology.map((ev, i) => (
                <div key={`${ev.kind}-${i}`} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <StatusMark status={ev.status} />
                    <h4 className="font-medium">{ev.title}</h4>
                    <Badge variant="outline">{statusLabel(ev.status)}</Badge>
                  </div>
                  <p className="text-sm">{ev.claim}</p>
                  <p className="text-sm text-muted-foreground">
                    Timestamp informado por Meta: {formatWhen(ev.metaTimestamp)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Recibido por Notificas: {formatWhen(ev.receivedAt)}
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>WAMID: <Mono>{ev.wamid}</Mono></li>
                    {ev.kind !== "sent" && (
                      <>
                        <li>
                          Payload original:{" "}
                          {ev.rawPreserved ? "preservado" : "no conservado para este evento"}
                        </li>
                        <li>
                          X-Hub-Signature-256: {ev.signatureHeaderPresent ? "preservada" : "no disponible"}
                        </li>
                        <li>{ev.webhookAuthLabel}</li>
                        <li>
                          SHA-256:{" "}
                          {ev.integrityMatchesStoredHash === false
                            ? "no coincidente"
                            : ev.payloadSha256
                              ? "coincidente / registrado"
                              : "no disponible"}
                        </li>
                        <li>
                          Merkle:{" "}
                          {ev.polygon?.leafHash
                            ? ev.polygon.merkleValid === true
                              ? "hoja incluida y prueba verificada en servidor"
                              : "hoja registrada"
                            : "sin hoja Merkle de tanda (puede haber anclaje individual)"}
                        </li>
                        <li>
                          Blockchain:{" "}
                          {ev.polygon?.txHash ? "Anclado" : "Sin anclaje asociado a este evento"}
                        </li>
                      </>
                    )}
                  </ul>
                  {!ev.rawPreserved && ev.kind !== "sent" && (
                    <p className="text-sm">Evidencia histórica registrada — payload RAW no disponible.</p>
                  )}
                  <TechnicalBlock report={report} event={ev} />
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

function IdentityRow({
  label,
  value,
  check,
}: {
  label: string;
  value: string | null;
  check: MetaCommunicationReport["live"]["waba"];
}) {
  return (
    <div className="text-sm space-y-1">
      <div className="flex flex-wrap justify-between gap-2">
        <span className="text-muted-foreground">{label}</span>
        <Mono>{value}</Mono>
      </div>
      {check && (
        <p className="flex items-start gap-2">
          <StatusMark status={check.status} />
          <span>
            {check.message}
            {check.fields.displayPhoneNumber ? ` · ${check.fields.displayPhoneNumber}` : ""}
            {check.fields.verifiedName ? ` · ${check.fields.verifiedName}` : ""}
            {check.fields.name && label === "WABA ID" ? ` · ${check.fields.name}` : ""}
          </span>
        </p>
      )}
    </div>
  );
}
