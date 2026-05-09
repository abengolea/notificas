"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { CampaignAttachment, RecipientEntry, RecipientList as RecipientListType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { PDFUpload } from "@/components/dashboard/pdf-upload";
import { uploadPDF } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import {
  buildCampaignMailHtml,
  campaignBodyToHtmlFragment,
  personalizeCampaignText,
} from "@/lib/campaign-email-html";
import { Loader2 } from "lucide-react";
import { maxRecipientsForPlan } from "@/lib/org-limits-client";
import { assignFilesToRecipientsGreedy, scoreFileForRecipient } from "@/lib/campaign-attachment-match";

function parseEmailsBlock(text: string): RecipientEntry[] {
  const parts = text
    .split(/[\s,;\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const uniq = [...new Set(parts)];
  return uniq
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    .map((email) => ({ email, nombre: email.split("@")[0] }));
}

function parseCsvQuick(text: string): RecipientEntry[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const iEmail = headers.indexOf("email");
  const iNombre = headers.indexOf("nombre");
  if (iEmail < 0 || iNombre < 0) return [];
  const out: RecipientEntry[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = lines[r].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const email = (cells[iEmail] || "").toLowerCase();
    const nombre = cells[iNombre] || "";
    if (email && nombre) out.push({ email, nombre });
  }
  return out;
}

export function CampaignWizard({ orgId, orgPlan }: { orgId: string; orgPlan: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [lists, setLists] = useState<(RecipientListType & { id: string })[]>([]);
  const [listId, setListId] = useState<string>("");
  const [pasteEmails, setPasteEmails] = useState("");
  const [csvChunk, setCsvChunk] = useState("");
  const [recipients, setRecipients] = useState<RecipientEntry[]>([]);
  const [campaniaNombre, setCampaniaNombre] = useState("");
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [files, setFiles] = useState<{ file: File; name: string; size: number }[]>([]);
  const [pairByRecipient, setPairByRecipient] = useState(false);
  const [pairingSelections, setPairingSelections] = useState<Record<string, number | null>>({});
  const pairingSignatureRef = useRef("");
  const [creditos, setCreditos] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [scheduleIso, setScheduleIso] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const maxR = maxRecipientsForPlan(orgPlan);

  useEffect(() => {
    const q = query(collection(db, "recipient_lists"), where("orgId", "==", orgId));
    const unsub = onSnapshot(q, (snap) => {
      setLists(
        snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            orgId: String(x.orgId),
            nombre: String(x.nombre),
            recipients: Array.isArray(x.recipients) ? x.recipients : [],
            count: typeof x.count === "number" ? x.count : 0,
            createdAt: x.createdAt,
            updatedAt: x.updatedAt,
          };
        })
      );
    });
    return () => unsub();
  }, [orgId]);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;
    const unsub = onSnapshot(doc(db, "users", u.uid), (s) => {
      const c = s.data()?.creditos;
      setCreditos(typeof c === "number" ? c : 0);
    });
    return () => unsub();
  }, []);

  async function resolveListRecipients(id: string) {
    if (!id) {
      setRecipients([]);
      return;
    }
    const snap = await getDoc(doc(db, "recipient_lists", id));
    if (!snap.exists()) return;
    const data = snap.data();
    setRecipients(Array.isArray(data.recipients) ? data.recipients : []);
  }

  useEffect(() => {
    if (listId) resolveListRecipients(listId);
  }, [listId]);

  const preview = useMemo(() => {
    const n = recipients.length;
    const sample = recipients.slice(0, 3).map((r) => r.nombre);
    return { n, sample };
  }, [recipients]);

  const firstHtml = useMemo(() => {
    const r0 = recipients[0];
    if (!r0) return "";
    const body = campaignBodyToHtmlFragment(
      personalizeCampaignText(cuerpo, {
        nombre: r0.nombre,
        dni: r0.dni,
        legajo: r0.legajo,
      })
    );
    return buildCampaignMailHtml({
      recipientEmail: r0.email,
      recipientName: r0.nombre,
      sender: auth.currentUser?.email || "remitente",
      bodyHtml: body,
      attachments: [],
    });
  }, [recipients, cuerpo]);

  const recvSig = useMemo(
    () =>
      [...recipients]
        .map((r) => `${r.email.trim().toLowerCase()}:${r.nombre}`)
        .sort()
        .join('|'),
    [recipients]
  );
  const fileNamesSig = useMemo(() => files.map((f) => f.name).join('\0'), [files]);
  const pairingUploadCap = useMemo(
    () => Math.min(350, Math.max(12, recipients.length + 25)),
    [recipients.length]
  );

  useEffect(() => {
    if (!pairByRecipient) {
      pairingSignatureRef.current = '';
      setPairingSelections({});
    }
  }, [pairByRecipient]);

  useEffect(() => {
    if (step !== 3 || !pairByRecipient || files.length === 0 || recipients.length === 0) {
      return;
    }
    const sig = `${recvSig}|${fileNamesSig}`;
    if (pairingSignatureRef.current === sig) return;
    pairingSignatureRef.current = sig;
    const { emailToFileIndex } = assignFilesToRecipientsGreedy(
      files.map((f) => f.name),
      recipients
    );
    setPairingSelections(emailToFileIndex);
  }, [step, pairByRecipient, fileNamesSig, recvSig, files, recipients]);

  const suggestPairingAgain = useCallback(() => {
    if (!files.length || !recipients.length || !pairByRecipient) return;
    pairingSignatureRef.current = '';
    const { emailToFileIndex } = assignFilesToRecipientsGreedy(
      files.map((f) => f.name),
      recipients
    );
    pairingSignatureRef.current = `${recvSig}|${fileNamesSig}`;
    setPairingSelections(emailToFileIndex);
    toast({ title: 'Sugerencias de adjuntos actualizadas' });
  }, [files, recipients, pairByRecipient, recvSig, fileNamesSig, toast]);

  function mergeRecipientsFromInputs(mode: "paste" | "csv") {
    const next = mode === "paste" ? parseEmailsBlock(pasteEmails) : parseCsvQuick(csvChunk);
    const map = new Map<string, RecipientEntry>();
    recipients.forEach((r) => map.set(r.email.toLowerCase(), r));
    next.forEach((r) => map.set(r.email.toLowerCase(), r));
    setRecipients([...map.values()]);
    toast({ title: `${next.length} destinatarios`, description: "Combinados con la lista actual" });
  }

  async function runSubmit(sendNow: boolean) {
    const user = auth.currentUser;
    if (!user) return;
    if (!campaniaNombre.trim() || !asunto.trim() || !cuerpo.trim()) {
      toast({ title: "Completá nombre interno, asunto y cuerpo", variant: "destructive" });
      return;
    }
    if (recipients.length === 0) {
      toast({ title: "Agregá destinatarios", variant: "destructive" });
      return;
    }
    if (recipients.length > maxR) {
      toast({
        title: "Límite de plan",
        description: `Máximo ${maxR} destinatarios`,
        variant: "destructive",
      });
      return;
    }

    const scheduleFutureEarly = Boolean(scheduleIso && new Date(scheduleIso) > new Date());
    if (sendNow && !scheduleFutureEarly && creditos < recipients.length) {
      toast({ title: "Créditos insuficientes", variant: "destructive" });
      return;
    }

    const pairingActive = pairByRecipient && files.length > 0;
    if (pairingActive && sendNow) {
      const incomplete = recipients.some((r) => {
        const k = r.email.trim().toLowerCase();
        const idx = pairingSelections[k];
        return idx === undefined || idx === null;
      });
      if (incomplete) {
        toast({
          title: "Falta asignar adjuntos",
          description:
            "En Revisión, elegí un archivo por destinatario o desactivá el modo «distinto por destinatario».",
          variant: "destructive",
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const draftKey = `draft_${Date.now()}`;
      const uploaded: CampaignAttachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const up = await uploadPDF(f.file, `${draftKey}`, user.uid);
        uploaded.push({
          nombre: up.name,
          url: up.url,
          hash: up.hash || "",
          size: up.size,
        });
      }

      const pairingActiveSubmit = pairByRecipient && uploaded.length > 0;
      const adjuntosGlobales = pairingActiveSubmit ? [] : uploaded;
      let adjuntosPorDestinatario: Record<string, CampaignAttachment[]> | undefined;
      if (pairingActiveSubmit) {
        adjuntosPorDestinatario = {};
        recipients.forEach((r) => {
          const k = r.email.trim().toLowerCase();
          const idx = pairingSelections[k];
          const one = typeof idx === "number" ? uploaded[idx] : undefined;
          adjuntosPorDestinatario![k] = one
            ? [{ nombre: one.nombre, url: one.url, hash: one.hash || "", size: one.size }]
            : [];
        });
      }

      const recipientEmails = recipients.map((r) => r.email.toLowerCase());
      const scheduleFuture = Boolean(scheduleIso && new Date(scheduleIso) > new Date());

      const base = {
        orgId,
        createdBy: user.uid,
        nombre: campaniaNombre.trim(),
        asunto: asunto.trim(),
        cuerpo: cuerpo.trim(),
        adjuntos: adjuntosGlobales,
        ...(adjuntosPorDestinatario ? { adjuntosPorDestinatario } : {}),
        recipientListId: listId || null,
        recipientEmails,
        recipientData: recipients,
        recipientCount: recipients.length,
        stats: {
          total: recipients.length,
          enviados: 0,
          leidos: 0,
          pendientes: recipients.length,
          errores: 0,
        },
        createdAt: serverTimestamp(),
      };

      if (scheduleFuture && scheduleIso) {
        const refDoc = await addDoc(collection(db, "campaigns"), {
          ...base,
          estado: "borrador",
          scheduledAt: new Date(scheduleIso),
        });
        toast({
          title: "Campaña programada (borrador)",
          description: "Desde el detalle podrás iniciar el envío cuando corresponda.",
        });
        router.push(`/empresa/${orgId}/campanas/${refDoc.id}`);
        return;
      }

      const refDoc = await addDoc(collection(db, "campaigns"), {
        ...base,
        estado: sendNow ? "enviando" : "borrador",
        startedAt: sendNow ? serverTimestamp() : null,
      });

      if (sendNow) {
        const token = await user.getIdToken();
        const res = await fetch("/api/campaigns/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ campaignId: refDoc.id, orgId }),
        });
        const data = await res.json();
        if (!res.ok) {
          await updateDoc(refDoc, { estado: "borrador" });
          throw new Error(data.error || "Falló el envío");
        }
        toast({ title: "Envío procesado", description: `Enviados: ${data.sent}, errores: ${data.errors}` });
      } else {
        toast({ title: "Borrador guardado" });
      }

      router.push(`/empresa/${orgId}/campanas/${refDoc.id}`);
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo crear la campaña",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-2">
          <span>Paso {step} de 4</span>
        </div>
        <Progress value={(step / 4) * 100} className="h-2" />
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Destinatarios</CardTitle>
            <CardDescription>Elegí una lista guardada, pegá CSV o emails.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Lista guardada</Label>
              <Select value={listId || "__none__"} onValueChange={(v) => setListId(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Ninguna" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Ninguna —</SelectItem>
                  {lists.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nombre} ({l.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Tabs defaultValue="paste">
              <TabsList>
                <TabsTrigger value="paste">Emails pegados</TabsTrigger>
                <TabsTrigger value="csv">CSV en texto</TabsTrigger>
              </TabsList>
              <TabsContent value="paste" className="space-y-2">
                <Textarea
                  placeholder="email1@x.com, email2@y.com"
                  value={pasteEmails}
                  onChange={(e) => setPasteEmails(e.target.value)}
                  rows={4}
                />
                <Button type="button" variant="secondary" onClick={() => mergeRecipientsFromInputs("paste")}>
                  Agregar pegados
                </Button>
              </TabsContent>
              <TabsContent value="csv" className="space-y-2">
                <Textarea
                  placeholder={"nombre,email\nJuan,ejemplo@dominio.com"}
                  value={csvChunk}
                  onChange={(e) => setCsvChunk(e.target.value)}
                  rows={6}
                />
                <Button type="button" variant="secondary" onClick={() => mergeRecipientsFromInputs("csv")}>
                  Importar CSV
                </Button>
              </TabsContent>
            </Tabs>
            <div className="text-sm text-muted-foreground">
              Total: {preview.n} — Ej.: {preview.sample.join(", ") || "—"}
            </div>
            <Button onClick={() => setStep(2)} disabled={!recipients.length}>
              Siguiente
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Mensaje</CardTitle>
            <CardDescription>
              Variables: {"{{nombre}}"}, {"{{dni}}"}, {"{{legajo}}"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre interno de la campaña</Label>
              <Input value={campaniaNombre} onChange={(e) => setCampaniaNombre(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Asunto</Label>
              <Input value={asunto} onChange={(e) => setAsunto(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cuerpo (texto o HTML simple)</Label>
              <Textarea value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} rows={10} />
            </div>
            <div className="rounded-md border p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="adj-por-destinatario"
                  checked={pairByRecipient}
                  onCheckedChange={(v) => setPairByRecipient(v === true)}
                  className="mt-1"
                />
                <div className="space-y-1">
                  <label
                    htmlFor="adj-por-destinatario"
                    className="text-sm font-medium cursor-pointer leading-none"
                  >
                    Adjunto distinto por destinatario
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Subí un archivo por persona. El nombre del archivo debe contener su nombre o correo (como en el
                    CSV). En el paso «Revisión» podés corregir el emparejamiento.
                  </p>
                </div>
              </div>
            </div>
            <PDFUpload
              onFileSelect={(fs) => setFiles(fs)}
              maxFiles={pairByRecipient ? pairingUploadCap : 12}
              maxSizeMB={10}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Atrás
              </Button>
              <Button onClick={() => setStep(3)} disabled={!asunto.trim() || !cuerpo.trim() || !campaniaNombre.trim()}>
                Siguiente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Revisión</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              <strong>{recipients.length}</strong> destinatarios — Asunto: {asunto}
            </p>
            {pairByRecipient && files.length > 0 ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Emparejamiento de adjuntos</p>
                  <Button type="button" variant="outline" size="sm" onClick={suggestPairingAgain}>
                    Sugerir de nuevo
                  </Button>
                </div>
                {recipients.some((r) => {
                  const ix = pairingSelections[r.email.trim().toLowerCase()];
                  return ix === undefined || ix === null;
                }) ? (
                  <p className="text-sm text-destructive">
                    Hay destinatarios sin archivo asignado. Asignálos antes de enviar en modo personalizado.
                  </p>
                ) : null}
                <div className="max-h-72 overflow-auto rounded-md border text-sm">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 z-[1] bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                      <tr>
                        <th className="p-2 font-medium">Nombre</th>
                        <th className="p-2 font-medium">Correo</th>
                        <th className="p-2 font-medium">Adjunto</th>
                        <th className="p-2 font-medium w-24">Coincidencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipients.map((r) => {
                        const k = r.email.trim().toLowerCase();
                        const idx = pairingSelections[k];
                        const selStr = typeof idx === 'number' ? String(idx) : '__none__';
                        const coincide =
                          typeof idx === 'number' ? scoreFileForRecipient(files[idx].name, r).label : '—';
                        return (
                          <tr key={k} className="border-t border-border">
                            <td className="p-2 align-middle">{r.nombre}</td>
                            <td className="p-2 align-middle text-muted-foreground break-all">{r.email}</td>
                            <td className="p-2 align-middle min-w-[12rem]">
                              <Select
                                value={selStr}
                                onValueChange={(v) =>
                                  setPairingSelections((prev) => ({
                                    ...prev,
                                    [k]: v === '__none__' ? null : Number.parseInt(v, 10),
                                  }))
                                }
                              >
                                <SelectTrigger className="h-9 w-full max-w-[min(260px,100%)]">
                                  <SelectValue placeholder="Sin archivo" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                  <SelectItem value="__none__">— Sin archivo —</SelectItem>
                                  {files.map((f, i) => (
                                    <SelectItem key={`${i}-${f.name}`} value={String(i)}>
                                      <span className="truncate max-w-[220px]" title={f.name}>
                                        {f.name}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2 align-middle text-xs text-muted-foreground capitalize">{coincide}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            <div
              className="border rounded-md p-3 max-h-64 overflow-auto text-xs bg-muted/30 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: firstHtml }}
            />
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
              Cada destinatario recibirá una notificación individual certificada en Polygon. Consumo:{" "}
              <strong>1 crédito</strong> por envío exitoso. Tu saldo: <strong>{creditos}</strong>.
              {!scheduleIso && creditos < recipients.length ? (
                <span className="text-destructive block mt-1">Saldo insuficiente para enviar ahora.</span>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                Atrás
              </Button>
              <Button onClick={() => setStep(4)}>Siguiente</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Confirmación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Programar envío (opcional)</Label>
              <Input type="datetime-local" value={scheduleIso} onChange={(e) => setScheduleIso(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Si indicás fecha futura, la campaña queda en borrador hasta que inicies el envío desde el detalle.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>
                Atrás
              </Button>
              <Button variant="secondary" disabled={submitting} onClick={() => setConfirmOpen(true)}>
                Enviar ahora
              </Button>
              <Button variant="outline" disabled={submitting} onClick={() => runSubmit(false)}>
                Solo guardar borrador
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar envío masivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás por enviar {recipients.length} notificaciones certificadas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              disabled={submitting}
              onClick={async () => {
                await runSubmit(true);
              }}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
