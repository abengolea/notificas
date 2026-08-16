"use client";

import { useCallback, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import type { CampaignMessage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Download, ExternalLink, Loader2, ShieldCheck, XCircle } from "lucide-react";

type Batch = {
  id: string;
  kind: "send" | "event";
  status: string;
  leafCount: number;
  expectedCount?: number;
  sealedCount?: number;
  merkleRoot?: string;
  txHash?: string;
  errorMsg?: string;
  tandaIndex?: number;
  dayKey?: string;
};

type VerifyResult = {
  summary: string;
  intact: boolean;
  recipientNombre?: string;
  recipientEmail?: string;
  content: { currentHash: string; storedHash: string | null; match: boolean };
  send: {
    batchId: string | null;
    txHash: string | null;
    merkleRoot: string | null;
    merkleValid: boolean | null;
    onChainMatch: boolean | null;
    smtpMessageId: string | null;
    wamid: string | null;
  };
  events: Array<{
    type: string;
    present: boolean;
    occurredAt?: string;
    merkleValid?: boolean | null;
    txHash?: string;
  }>;
};

function statusBadge(status: string) {
  switch (status) {
    case "anchored":
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">Certificada</Badge>;
    case "open":
      return <Badge variant="secondary">Abierta</Badge>;
    case "sealing":
      return <Badge className="bg-blue-600 hover:bg-blue-600">Cerrando…</Badge>;
    case "failed":
      return <Badge variant="destructive">Error</Badge>;
    case "empty":
      return <Badge variant="outline">Vacía</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function shortHash(h?: string | null) {
  if (!h) return "—";
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

function YesNo({ ok, label }: { ok: boolean | null | undefined; label: string }) {
  if (ok === true) {
    return (
      <p className="flex items-center gap-2 text-sm text-emerald-700">
        <CheckCircle2 className="h-4 w-4" /> {label}
      </p>
    );
  }
  if (ok === false) {
    return (
      <p className="flex items-center gap-2 text-sm text-destructive">
        <XCircle className="h-4 w-4" /> {label}
      </p>
    );
  }
  return <p className="text-sm text-muted-foreground">{label} — pendiente</p>;
}

export function CampaignIntegrityPanel({
  orgId,
  campaignId,
  messages,
}: {
  orgId: string;
  campaignId: string;
  messages: CampaignMessage[];
}) {
  const { toast } = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [summary, setSummary] = useState<{
    sendOpen: number;
    sendAnchored: number;
    eventOpen: number;
    eventAnchored: number;
    leavesSend: number;
    leavesEvent: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [verifyId, setVerifyId] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);

  const token = useCallback(async () => {
    const user = await new Promise<typeof auth.currentUser>((resolve) => {
      const unsub = auth.onAuthStateChanged((u) => {
        unsub();
        resolve(u);
      });
    });
    if (!user) throw new Error("Sin sesión");
    return user.getIdToken();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const t = await token();
      const res = await fetch(
        `/api/campaigns/integrity?campaignId=${encodeURIComponent(campaignId)}&orgId=${encodeURIComponent(orgId)}`,
        { headers: { Authorization: `Bearer ${t}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cargar");
      setBatches(data.batches || []);
      setSummary(data.summary || null);
    } catch (e: unknown) {
      toast({
        title: "Integridad",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [campaignId, orgId, toast, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function closeBatches(batchId?: string, force = true) {
    setBusy(true);
    try {
      const t = await token();
      const res = await fetch("/api/campaigns/integrity/close", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ campaignId, orgId, batchId, force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cerrar");
      toast({
        title: "Tanda",
        description:
          data.status === "anchored"
            ? "Lacre publicado en Polygon."
            : data.closed
              ? `Cerradas: ${data.closed.length || 0}`
              : data.status === "open"
                ? "Todavía no hay hojas suficientes. Forzá el cierre si ya terminó el envío de esa tanda."
                : `Estado: ${data.status}`,
      });
      await load();
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Falló el cierre",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function descargarActa(batchId: string) {
    setBusy(true);
    try {
      const t = await token();
      const p = new URLSearchParams({ campaignId, orgId, batchId });
      const res = await fetch(`/api/campaigns/integrity/acta?${p}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "No se pudo generar el acta");
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `acta-tanda-${batchId}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: unknown) {
      toast({
        title: "Acta PDF",
        description: e instanceof Error ? e.message : "Falló la descarga",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function verify(messageId: string) {
    if (!messageId) return;
    setBusy(true);
    setResult(null);
    try {
      const t = await token();
      const res = await fetch("/api/campaigns/integrity/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ campaignId, orgId, messageId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo verificar");
      setResult(data);
    } catch (e: unknown) {
      toast({
        title: "Verificación",
        description: e instanceof Error ? e.message : "Falló",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  const sendBatches = batches.filter((b) => b.kind === "send");
  const eventBatches = batches.filter((b) => b.kind === "event");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-teal-600" />
          Integridad de la campaña
        </CardTitle>
        <p className="text-sm text-muted-foreground font-normal">
          Cada tanda de envío se lacra con una sola transacción en Polygon. Las lecturas y entregas
          (mail o WhatsApp), aunque lleguen días después, van a otra tanda de hechos. Acá podés
          cerrar tandas y probar un destinatario en un clic.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando tandas…
          </p>
        ) : (
          <>
            {summary && (
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">Envíos lacradados</p>
                  <p className="text-lg font-semibold">
                    {summary.sendAnchored} tandas · {summary.leavesSend.toLocaleString("es-AR")} destinatarios
                  </p>
                  {summary.sendOpen > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{summary.sendOpen} tanda(s) todavía abierta(s)</p>
                  )}
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">Hechos (lectura / entrega)</p>
                  <p className="text-lg font-semibold">
                    {summary.eventAnchored} tandas · {summary.leavesEvent.toLocaleString("es-AR")} hechos
                  </p>
                  {summary.eventOpen > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{summary.eventOpen} tanda(s) de hechos abierta(s)</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => closeBatches(undefined, true)}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Cerrar tandas abiertas ahora
              </Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void load()}>
                Actualizar
              </Button>
            </div>

            {sendBatches.length === 0 && eventBatches.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Todavía no hay tandas. Aparecen cuando el envío crea destinatarios (de a 500).
              </p>
            )}

            {sendBatches.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Tandas de envío (qué se mandó)</p>
                <div className="rounded-md border divide-y">
                  {sendBatches.map((b) => (
                    <div key={b.id} className="p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{b.id}</span>
                          {statusBadge(b.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {b.leafCount} hojas
                          {typeof b.expectedCount === "number" ? ` · ${b.sealedCount ?? 0}/${b.expectedCount} resueltos` : ""}
                          {b.merkleRoot ? ` · raíz ${shortHash(b.merkleRoot)}` : ""}
                        </p>
                        {b.errorMsg && <p className="text-xs text-destructive">{b.errorMsg}</p>}
                      </div>
                      <div className="flex gap-2">
                        {b.txHash && (
                          <a
                            href={`https://polygonscan.com/tx/${b.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary"
                          >
                            Ver en Polygon <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {b.leafCount > 0 && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => descargarActa(b.id)} className="gap-1">
                            <Download className="h-3 w-3" /> Acta PDF
                          </Button>
                        )}
                        {(b.status === "open" || b.status === "failed") && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => closeBatches(b.id, true)}>
                            Cerrar esta
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {eventBatches.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Tandas de hechos (llegó / se leyó)</p>
                <div className="rounded-md border divide-y">
                  {eventBatches.map((b) => (
                    <div key={b.id} className="p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{b.id}</span>
                          {statusBadge(b.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {b.leafCount} hechos{b.merkleRoot ? ` · raíz ${shortHash(b.merkleRoot)}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {b.txHash && (
                          <a
                            href={`https://polygonscan.com/tx/${b.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary"
                          >
                            Ver en Polygon <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {b.leafCount > 0 && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => descargarActa(b.id)} className="gap-1">
                            <Download className="h-3 w-3" /> Acta PDF
                          </Button>
                        )}
                        {(b.status === "open" || b.status === "failed") && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => closeBatches(b.id, true)}>
                            Cerrar esta
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium">Probar un destinatario</p>
              <p className="text-xs text-muted-foreground">
                Recalcula el hash del texto, verifica la prueba Merkle y la compara con la transacción
                pública. Elegí alguien de esta página o pegá el ID del mensaje.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="ID del campaign_message"
                  value={verifyId}
                  onChange={(e) => setVerifyId(e.target.value)}
                />
                <Button disabled={busy || !verifyId.trim()} onClick={() => verify(verifyId.trim())}>
                  Verificar
                </Button>
              </div>
              {messages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {messages.slice(0, 8).map((m) => (
                    <Button
                      key={m.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setVerifyId(m.id);
                        void verify(m.id);
                      }}
                    >
                      {m.recipientNombre || m.recipientEmail || m.id.slice(0, 6)}
                    </Button>
                  ))}
                </div>
              )}

              {result && (
                <div className={`rounded-md border p-4 space-y-2 ${result.intact ? "border-emerald-300 bg-emerald-50/50" : "bg-muted/30"}`}>
                  <p className="font-medium">{result.recipientNombre || result.recipientEmail}</p>
                  <p className="text-sm">{result.summary}</p>
                  <YesNo ok={result.content.match} label="El texto actual coincide con la huella guardada" />
                  <YesNo ok={result.send.merkleValid} label="La foja entra en el árbol de su tanda" />
                  <YesNo ok={result.send.onChainMatch} label="La raíz coincide con la transacción en Polygon" />
                  {result.send.txHash && (
                    <a
                      href={`https://polygonscan.com/tx/${result.send.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary"
                    >
                      Acta de envío {shortHash(result.send.txHash)} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <div className="pt-2 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Hechos posteriores</p>
                    {result.events.map((ev) => (
                      <YesNo
                        key={ev.type}
                        ok={ev.present ? ev.merkleValid ?? true : null}
                        label={
                          ev.type === "email_read"
                            ? "Mail abierto en el lector"
                            : ev.type === "wa_delivered"
                              ? "WhatsApp entregado al teléfono"
                              : "WhatsApp leído"
                        }
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground break-all">
                    Hash actual: {result.content.currentHash}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
