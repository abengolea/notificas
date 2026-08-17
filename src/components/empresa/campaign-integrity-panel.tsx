"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Download, ExternalLink, Loader2, Search, ShieldCheck, XCircle } from "lucide-react";

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

type SearchHit = {
  id: string;
  recipientNombre?: string;
  recipientEmail?: string;
  recipientDni?: string;
  recipientTelefono?: string;
};
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

function formatDayKey(dayKey: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!m) return dayKey;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
}

function sendBatchTitle(b: Batch, totalSend: number): string {
  const raw = b.tandaIndex ?? Number(String(b.id).replace(/^send-/, ""));
  const n = Number.isFinite(raw) ? raw + 1 : 1;
  return totalSend <= 1 ? "Lote de envío" : `Lote de envío ${n}`;
}

function eventBatchTitle(b: Batch): string {
  const day = b.dayKey || String(b.id).replace(/^events-/, "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return `Lecturas y entregas del ${formatDayKey(day)}`;
  return "Lecturas y entregas";
}

function sendBatchHint(b: Batch): string {
  const n = b.leafCount;
  const dest = `${n.toLocaleString("es-AR")} destinatario${n === 1 ? "" : "s"}`;
  if (typeof b.expectedCount === "number" && (b.sealedCount ?? 0) < b.expectedCount) {
    return `${dest} · ${b.sealedCount ?? 0} de ${b.expectedCount} con respuesta`;
  }
  return dest;
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
  initialMessageId,
}: {
  orgId: string;
  campaignId: string;
  initialMessageId?: string;
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
  const [verifyQuery, setVerifyQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [noHits, setNoHits] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const skipSearchRef = useRef(false);

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

  const runVerify = useCallback(async (messageId: string) => {
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
  }, [campaignId, orgId, toast, token]);

  useEffect(() => {
    if (!initialMessageId) return;
    void runVerify(initialMessageId);
  }, [initialMessageId, runVerify]);

  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      setHits([]);
      setSearching(false);
      setNoHits(false);
      return;
    }
    const term = verifyQuery.trim();
    if (term.length < 2) {
      setHits([]);
      setSearching(false);
      setNoHits(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const t = await token();
        const params = new URLSearchParams({
          campaignId,
          search: term,
          limit: "8",
        });
        const res = await fetch(`/api/campaigns/messages?${params}`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        const data = await res.json();
        if (cancelled) return;
        const list = (data.messages || []) as SearchHit[];
        setHits(list.map((m) => ({
          id: m.id,
          recipientNombre: m.recipientNombre,
          recipientEmail: m.recipientEmail,
          recipientDni: m.recipientDni,
          recipientTelefono: m.recipientTelefono,
        })));
        setNoHits(list.length === 0);
      } catch {
        if (!cancelled) {
          setHits([]);
          setNoHits(true);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [verifyQuery, campaignId, token]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!searchBoxRef.current?.contains(e.target as Node)) setHits([]);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  async function pickRecipient(hit: SearchHit) {
    skipSearchRef.current = true;
    setVerifyQuery(hit.recipientNombre || hit.recipientEmail || "");
    setHits([]);
    await runVerify(hit.id);
  }

  const sendBatches = batches.filter((b) => b.kind === "send");
  const eventBatches = batches.filter((b) => b.kind === "event");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-teal-600" />
          Certificación
        </CardTitle>
        <p className="text-sm text-muted-foreground font-normal">
          El envío se certifica en Polygon. Las lecturas y entregas se certifican aparte, aunque
          lleguen otro día. Acá podés cerrar lotes o verificar a una persona.
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
                  <p className="text-muted-foreground">Qué se envió</p>
                  <p className="text-lg font-semibold">
                    {summary.sendAnchored} lote{summary.sendAnchored === 1 ? "" : "s"} certificado{summary.sendAnchored === 1 ? "" : "s"}
                    {" · "}
                    {summary.leavesSend.toLocaleString("es-AR")} destinatario{summary.leavesSend === 1 ? "" : "s"}
                  </p>
                  {summary.sendOpen > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{summary.sendOpen} lote(s) todavía abierto(s)</p>
                  )}
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">Qué se entregó o se leyó</p>
                  <p className="text-lg font-semibold">
                    {summary.eventAnchored} lote{summary.eventAnchored === 1 ? "" : "s"} certificado{summary.eventAnchored === 1 ? "" : "s"}
                    {" · "}
                    {summary.leavesEvent.toLocaleString("es-AR")} hecho{summary.leavesEvent === 1 ? "" : "s"}
                  </p>
                  {summary.eventOpen > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{summary.eventOpen} lote(s) de lecturas todavía abierto(s)</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => closeBatches(undefined, true)}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Cerrar lotes abiertos ahora
              </Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void load()}>
                Actualizar
              </Button>
            </div>

            {sendBatches.length === 0 && eventBatches.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Todavía no hay lotes certificados. Aparecen cuando arranca el envío.
              </p>
            )}

            {sendBatches.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Qué se envió</p>
                <div className="rounded-md border divide-y">
                  {sendBatches.map((b) => (
                    <div key={b.id} className="p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{sendBatchTitle(b, sendBatches.length)}</span>
                          {statusBadge(b.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">{sendBatchHint(b)}</p>
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
                            Cerrar este lote
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
                <p className="text-sm font-medium">Qué se entregó o se leyó</p>
                <div className="rounded-md border divide-y">
                  {eventBatches.map((b) => (
                    <div key={b.id} className="p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{eventBatchTitle(b)}</span>
                          {statusBadge(b.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {b.leafCount.toLocaleString("es-AR")} hecho{b.leafCount === 1 ? "" : "s"} (entrega o lectura)
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
                            Cerrar este lote
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium">Verificar un destinatario</p>
              <p className="text-xs text-muted-foreground">
                Buscá por nombre. Con 150 mil envíos no hace falta listarlos: con unas letras alcanza.
                También podés tocar Verificar en la pestaña Destinatarios.
              </p>
              <div ref={searchBoxRef} className="relative">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Escribí el nombre…"
                    value={verifyQuery}
                    onChange={(e) => setVerifyQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" || busy) return;
                      e.preventDefault();
                      if (hits[0]) void pickRecipient(hits[0]);
                    }}
                    className="pl-9"
                    autoComplete="off"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                </div>
                {hits.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
                    {hits.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => void pickRecipient(h)}
                      >
                        <span className="font-medium">{h.recipientNombre || "Sin nombre"}</span>
                        <span className="text-xs text-muted-foreground">
                          {[h.recipientDni, h.recipientEmail, h.recipientTelefono].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {noHits && (
                  <p className="text-xs text-muted-foreground mt-1">Ningún destinatario con ese nombre.</p>
                )}
              </div>

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
