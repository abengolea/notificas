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
import { normalizeEnviosDisponibles } from "@/lib/envios";
import type { CampaignAttachment, CanalCampaign, RecipientEntry, RecipientList as RecipientListType } from "@/lib/types";
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
import { Loader2, Mail, MessageCircle, Layers, HelpCircle, Copy, Check, Upload, X, FileText } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { maxRecipientsForPlan } from "@/lib/org-limits-client";
import { assignFilesToRecipientsGreedy, scoreFileForRecipient } from "@/lib/campaign-attachment-match";
import { uploadCampaignCsvInChunks, uploadCampaignRecipients } from "@/lib/upload-campaign-recipients";
import { csvCamposRequeridos, csvPlaceholder, inspectCampaignCsv, parseCsvQuick } from "@/lib/parse-campaign-csv";
import { DEFAULT_TANDA_SIZE } from "@/lib/campaign-tanda";
import type { CsvInspectResult } from "@/lib/parse-campaign-csv";

function parseEmailsBlock(text: string): RecipientEntry[] {
  const parts = text.split(/[\s,;\n]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const uniq = [...new Set(parts)];
  return uniq
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    .map((email) => ({ email, nombre: email.split("@")[0] }));
}

export function CampaignWizard({
  orgId: orgIdProp,
  orgPlan: orgPlanProp = "starter",
  mode = "empresa",
}: {
  orgId?: string;
  orgPlan?: string;
  mode?: "empresa" | "admin";
}) {
  const isAdmin = mode === "admin";
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [adminOrgId, setAdminOrgId] = useState("");
  const [adminOrgs, setAdminOrgs] = useState<{ id: string; nombre?: string; plan?: string; adminUserEmail?: string }[]>([]);
  const orgId = isAdmin ? adminOrgId : String(orgIdProp || "");
  const [lists, setLists] = useState<(RecipientListType & { id: string })[]>([]);
  const [listId, setListId] = useState<string>("");
  const [pasteEmails, setPasteEmails] = useState("");
  const [csvChunk, setCsvChunk] = useState("");
  const [recipients, setRecipients] = useState<RecipientEntry[]>([]);
  const [canal, setCanal] = useState<CanalCampaign>("email");
  const [waTemplateName, setWaTemplateName] = useState("");
  const [waTemplateLang, setWaTemplateLang] = useState("es_AR");
  const [waTemplateVariables, setWaTemplateVariables] = useState<string[]>(["nombre", "dni", "legajo"]);
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
  const [uploadProgress, setUploadProgress] = useState<{ uploadedChunks: number; chunkCount: number } | null>(null);
  const [csvCopied, setCsvCopied] = useState(false);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvFileError, setCsvFileError] = useState<string | null>(null);
  const [csvFileDragging, setCsvFileDragging] = useState(false);
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const csvFileRef = useRef<File | null>(null);
  const [csvInspect, setCsvInspect] = useState<CsvInspectResult | null>(null);
  const [tandaSize, setTandaSize] = useState(DEFAULT_TANDA_SIZE);
  const [adminBillingEmail, setAdminBillingEmail] = useState("");
  const [adminOrgPlan, setAdminOrgPlan] = useState("starter");
  const orgPlan = isAdmin ? adminOrgPlan : orgPlanProp;
  const maxR = isAdmin ? 1_000_000 : maxRecipientsForPlan(orgPlan);
  const recipientTotal = csvInspect?.count || recipients.length;

  useEffect(() => {
    if (isAdmin) return;
    if (!orgId) return;
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
  }, [orgId, isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    const u = auth.currentUser;
    if (!u) return;
    const unsub = onSnapshot(doc(db, "users", u.uid), (s) => {
      setCreditos(normalizeEnviosDisponibles(s.data()?.creditos));
    });
    return () => unsub();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    void fetch("/api/admin/organizations", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setAdminOrgs(Array.isArray(d.organizations) ? d.organizations : []))
      .catch(() => setAdminOrgs([]));
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || !orgId) {
      if (isAdmin) {
        setCreditos(0);
        setAdminBillingEmail("");
        setAdminOrgPlan("starter");
      }
      return;
    }
    void fetch(`/api/admin/campaigns/billing?orgId=${encodeURIComponent(orgId)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setCreditos(typeof d.creditos === "number" ? d.creditos : 0);
        setAdminBillingEmail(String(d.adminUserEmail || ""));
        setAdminOrgPlan(String(d.plan || "starter"));
      })
      .catch(() => undefined);
  }, [isAdmin, orgId]);

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
    const n = recipientTotal;
    const sample = csvInspect?.sample?.length ? csvInspect.sample : recipients.slice(0, 3).map((r) => r.nombre);
    return { n, sample };
  }, [recipientTotal, csvInspect, recipients]);

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

  function validateCsvHeaders(text: string): string | null {
    const firstLine = text.split(/\r?\n/)[0] || "";
    const headers = firstLine.split(",").map((h) => h.trim().toLowerCase());
    const needEmail = canal === "email" || canal === "ambos";
    const needPhone = canal === "whatsapp" || canal === "ambos";
    if (!headers.includes("nombre")) return "Falta la columna obligatoria: nombre";
    if (needEmail && !headers.includes("email")) return "Falta la columna obligatoria: email";
    if (needPhone && !headers.includes("telefono")) return "Falta la columna obligatoria: telefono";
    if (!headers.includes("dni")) return "Falta la columna obligatoria: dni";
    return null;
  }

  function handleCsvFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setCsvFileError("El archivo debe ser .csv");
      setCsvFileName(null);
      csvFileRef.current = null;
      setCsvInspect(null);
      return;
    }

    const applyInspect = (inspected: CsvInspectResult, fromFile: File) => {
      if (inspected.error) {
        setCsvFileError(inspected.error);
        setCsvFileName(null);
        csvFileRef.current = null;
        setCsvInspect(null);
        return;
      }
      setCsvFileError(null);
      setCsvFileName(fromFile.name);
      csvFileRef.current = fromFile;
      setCsvInspect(inspected);
      if (!isAdmin) {
        void fromFile.text().then((text) => {
          const parsed = parseCsvQuick(text, canal);
          const map = new Map<string, RecipientEntry>();
          recipients.forEach((r) => map.set(r.email.toLowerCase(), r));
          parsed.forEach((r) => map.set(r.email.toLowerCase(), r));
          setRecipients([...map.values()]);
        });
      } else {
        setRecipients([]);
      }
      toast({
        title: `${inspected.count.toLocaleString("es-AR")} destinatarios`,
        description: `Desde ${fromFile.name}${inspected.skipped ? ` · ${inspected.skipped} filas salteadas` : ""}`,
      });
    };

    if (isAdmin) {
      void inspectCampaignCsv(file, canal).then((inspected) => applyInspect(inspected, file));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || "";
      const headerErr = validateCsvHeaders(text);
      if (headerErr) {
        setCsvFileError(`${headerErr}. Campos requeridos: ${csvCamposRequeridos(canal)}`);
        setCsvFileName(null);
        return;
      }
      const parsed = parseCsvQuick(text, canal);
      if (parsed.length === 0) {
        setCsvFileError("El archivo no contiene filas válidas. Revisá el formato y que los campos obligatorios tengan datos.");
        setCsvFileName(null);
        return;
      }
      setCsvFileError(null);
      setCsvFileName(file.name);
      csvFileRef.current = file;
      setCsvInspect({ error: null, count: parsed.length, skipped: 0, sample: parsed.slice(0, 3).map((r) => r.nombre) });
      const map = new Map<string, RecipientEntry>();
      recipients.forEach((r) => map.set(r.email.toLowerCase(), r));
      parsed.forEach((r) => map.set(r.email.toLowerCase(), r));
      setRecipients([...map.values()]);
      toast({ title: `${parsed.length} destinatarios importados`, description: `Desde ${file.name}` });
    };
    reader.onerror = () => {
      setCsvFileError("No se pudo leer el archivo. Intentá con otro.");
      setCsvFileName(null);
    };
    reader.readAsText(file, "UTF-8");
  }

  function mergeRecipientsFromInputs(mode: "paste" | "csv") {
    const next = mode === "paste" ? parseEmailsBlock(pasteEmails) : parseCsvQuick(csvChunk, canal);
    if (next.length === 0) {
      toast({ title: "No se encontraron destinatarios válidos", description: `El CSV debe tener columnas: ${csvCamposRequeridos(canal)}`, variant: "destructive" });
      return;
    }
    const map = new Map<string, RecipientEntry>();
    recipients.forEach((r) => map.set(r.email.toLowerCase(), r));
    next.forEach((r) => map.set(r.email.toLowerCase(), r));
    setRecipients([...map.values()]);
    toast({ title: `${next.length} destinatarios`, description: "Combinados con la lista actual" });
  }

  async function runSubmitAdmin(sendNow: boolean) {
    if (!orgId) {
      toast({ title: "Elegí la empresa", variant: "destructive" });
      return;
    }
    if (!campaniaNombre.trim() || !asunto.trim() || !cuerpo.trim()) {
      toast({ title: "Completá nombre interno, asunto y cuerpo", variant: "destructive" });
      return;
    }
    const file = csvFileRef.current;
    if (!file && recipients.length === 0) {
      toast({ title: "Agregá destinatarios", variant: "destructive" });
      return;
    }
    const tandaNew = tandaSize > 0 ? Math.min(tandaSize, recipientTotal) : recipientTotal;
    if (sendNow && !isAdmin && creditos < tandaNew) {
      toast({ title: "Envíos insuficientes", description: `Esta tanda necesita ${tandaNew.toLocaleString("es-AR")}` , variant: "destructive" });
      return;
    }

    setSubmitting(true);
    setUploadProgress(null);
    try {
      const createRes = await fetch("/api/admin/campaigns", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          nombre: campaniaNombre.trim(),
          asunto: asunto.trim(),
          cuerpo: cuerpo.trim(),
          canal,
          waTemplateName: waTemplateName.trim() || undefined,
          waTemplateLang,
          waTemplateVariables: waTemplateVariables.filter(Boolean),
          tandaSize: sendNow ? tandaSize : 0,
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(created.error || "No se pudo crear la campaña");
      const campaignId = String(created.id);

      if (file) {
        await uploadCampaignCsvInChunks({
          campaignId,
          orgId,
          file,
          canal,
          endpoint: "/api/admin/campaigns/upload-recipients",
          onProgress: (p) =>
            setUploadProgress({ uploadedChunks: p.uploadedChunks, chunkCount: p.chunkCount }),
        });
      } else {
        const cleanRecipients = recipients.map((r) => {
          const clean: Record<string, string> = { nombre: r.nombre || "", email: r.email || "" };
          if (r.telefono) clean.telefono = r.telefono;
          if (r.dni) clean.dni = r.dni;
          if (r.legajo) clean.legajo = r.legajo;
          return clean;
        });
        await uploadCampaignRecipients({
          campaignId,
          orgId,
          recipients: cleanRecipients as RecipientEntry[],
          endpoint: "/api/admin/campaigns/upload-recipients",
          onProgress: setUploadProgress,
        });
      }

      if (sendNow) {
        const sendRes = await fetch("/api/admin/campaigns/send", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId, tandaSize }),
        });
        const sendData = await sendRes.json();
        if (!sendRes.ok) throw new Error(sendData.error || "Falló el envío");
        toast({
          title: "Envío iniciado",
          description: `${(sendData.pendingThisTanda ?? sendData.pending ?? 0).toLocaleString("es-AR")} mensajes encolados`,
        });
      } else {
        toast({ title: "Borrador guardado" });
      }

      router.push(`/admin/campanas/${campaignId}`);
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

  async function runSubmit(sendNow: boolean) {
    if (isAdmin) {
      await runSubmitAdmin(sendNow);
      return;
    }
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
      toast({ title: "Envíos insuficientes", variant: "destructive" });
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
    setUploadProgress(null);
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

      const scheduleFuture = Boolean(scheduleIso && new Date(scheduleIso) > new Date());

      // Firestore rechaza campos undefined — limpiar antes de guardar.
      const cleanRecipients = recipients.map((r) => {
        const clean: Record<string, string> = { nombre: r.nombre || '', email: r.email || '' };
        if (r.telefono) clean.telefono = r.telefono;
        if (r.dni)      clean.dni      = r.dni;
        if (r.legajo)   clean.legajo   = r.legajo;
        if (r.area)     clean.area     = r.area;
        return clean;
      });

      // Base del doc: NO incluimos recipientData/recipientEmails para no superar 1MB.
      // Los destinatarios se suben a Storage y se referencia por path.
      const base = {
        orgId,
        createdBy: user.uid,
        canal,
        ...(canal !== "email" && waTemplateName.trim() ? {
          waTemplateName: waTemplateName.trim(),
          waTemplateLang: waTemplateLang.trim() || "es_AR",
          waTemplateVariables: waTemplateVariables.filter(Boolean),
        } : {}),
        nombre: campaniaNombre.trim(),
        asunto: asunto.trim(),
        cuerpo: cuerpo.trim(),
        adjuntos: adjuntosGlobales,
        ...(adjuntosPorDestinatario ? { adjuntosPorDestinatario } : {}),
        recipientListId: listId || null,
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

      // Crear campaña siempre en borrador primero; activar después de subir destinatarios.
      const refDoc = await addDoc(collection(db, "campaigns"), {
        ...base,
        estado: "borrador",
        ...(scheduleFuture && scheduleIso ? { scheduledAt: new Date(scheduleIso) } : {}),
        startedAt: null,
      });

      // Subir destinatarios de a 500 (un POST con 150k rompe el navegador / el servidor).
      const token = await user.getIdToken();
      try {
        await uploadCampaignRecipients({
          campaignId: refDoc.id,
          orgId,
          recipients: cleanRecipients as RecipientEntry[],
          token,
          onProgress: setUploadProgress,
        });
      } catch (uploadErr) {
        await updateDoc(refDoc, { estado: "borrador" });
        throw uploadErr;
      }

      if (scheduleFuture && scheduleIso) {
        toast({
          title: "Campaña programada (borrador)",
          description: "Desde el detalle podrás iniciar el envío cuando corresponda.",
        });
        router.push(`/empresa/${orgId}/campanas/${refDoc.id}`);
        return;
      }

      if (sendNow) {
        await updateDoc(refDoc, { estado: "enviando", startedAt: serverTimestamp() });
        const sendRes = await fetch("/api/campaigns/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ campaignId: refDoc.id, orgId }),
        });
        const sendData = await sendRes.json();
        if (!sendRes.ok) {
          await updateDoc(refDoc, { estado: "borrador" });
          throw new Error(sendData.error || "Falló el envío");
        }
        toast({ title: "Envío iniciado", description: `${sendData.pending ?? sendData.total ?? 0} mensajes encolados` });
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

  const STEPS = ["Canal", "Destinatarios", "Mensaje", "Confirmación"];

  return (
    <div className="max-w-3xl space-y-8">
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Empresa</CardTitle>
            <CardDescription>
              La campaña queda a nombre de esta organización. Los créditos se descuentan de su administrador.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label>Organización</Label>
            <Select value={adminOrgId} onValueChange={setAdminOrgId}>
              <SelectTrigger>
                <SelectValue placeholder="Elegí la empresa" />
              </SelectTrigger>
              <SelectContent>
                {adminOrgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nombre || o.id} ({o.plan || "starter"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {adminOrgId ? (
              <p className="text-xs text-muted-foreground">
                Plan {adminOrgPlan} · cobra {adminBillingEmail || "el admin de la empresa"} ·{" "}
                {creditos.toLocaleString("es-AR")} envíos
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-2">
          <span>Paso {step} de {STEPS.length} — {STEPS[step - 1]}</span>
        </div>
        <Progress value={(step / STEPS.length) * 100} className="h-2" />
      </div>

      {/* PASO 1: Canal */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>¿Por qué canal enviás?</CardTitle>
            <CardDescription>El canal determina qué campos son obligatorios en el CSV de destinatarios.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  { value: "email",     label: "Email",     icon: Mail,          desc: "Notificación por correo con certificación Polygon" },
                  { value: "whatsapp",  label: "WhatsApp",  icon: MessageCircle, desc: "Mensaje WA con registro blockchain" },
                  { value: "ambos",     label: "Ambos",     icon: Layers,        desc: "Email + WhatsApp simultáneo" },
                ] as const
              ).map(({ value, label, icon: Icon, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setCanal(value);
                    setRecipients([]);
                    setCsvFileName(null);
                    setCsvFileError(null);
                    csvFileRef.current = null;
                    setCsvInspect(null);
                  }}
                  className={`flex flex-col items-start gap-2 rounded-md border p-4 text-left transition-colors ${
                    canal === value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="font-medium">{label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-tight">{desc}</p>
                </button>
              ))}
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
              <p className="font-medium">Campos requeridos en el CSV:</p>
              <p className="text-muted-foreground font-mono text-xs">{csvCamposRequeridos(canal)}<span className="not-italic text-muted-foreground/70"> + legajo (opcional)</span></p>
              {(canal === "whatsapp" || canal === "ambos") && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  WhatsApp requiere un template aprobado por Meta. El campo <strong>telefono</strong> debe incluir código de país (+54…).
                </p>
              )}
            </div>
            <Button onClick={() => setStep(2)} disabled={isAdmin && !orgId}>Siguiente</Button>
          </CardContent>
        </Card>
      )}

      {/* PASO 2: Destinatarios */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>Destinatarios</CardTitle>
                <CardDescription className="mt-1">
                  Canal: <strong>{canal === "email" ? "Email" : canal === "whatsapp" ? "WhatsApp" : "Email + WhatsApp"}</strong>
                  {" · "}Campos requeridos: <code className="text-xs">{csvCamposRequeridos(canal)}</code>
                </CardDescription>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="mt-1 shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                    <HelpCircle className="h-5 w-5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-96 text-sm" align="end">
                  <div className="space-y-4">
                    <div>
                      <p className="font-semibold mb-1">Formato del CSV</p>
                      <p className="text-xs text-muted-foreground">
                        La primera fila debe ser el encabezado. Las columnas pueden estar en cualquier orden.
                        Separador: <strong>coma (,)</strong>. Codificación: <strong>UTF-8</strong>.
                      </p>
                    </div>

                    {/* Columnas requeridas */}
                    <div>
                      <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">Columnas requeridas</p>
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="text-left p-1.5 font-medium rounded-tl">Columna</th>
                            <th className="text-left p-1.5 font-medium">Ejemplo</th>
                            <th className="text-left p-1.5 font-medium rounded-tr">Notas</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t"><td className="p-1.5 font-mono">nombre</td><td className="p-1.5">Juan García</td><td className="p-1.5 text-muted-foreground">Nombre completo</td></tr>
                          {(canal === "email" || canal === "ambos") && (
                            <tr className="border-t"><td className="p-1.5 font-mono">email</td><td className="p-1.5">juan@ejemplo.com</td><td className="p-1.5 text-muted-foreground">Email válido</td></tr>
                          )}
                          {(canal === "whatsapp" || canal === "ambos") && (
                            <tr className="border-t bg-amber-50 dark:bg-amber-950/20">
                              <td className="p-1.5 font-mono">telefono</td>
                              <td className="p-1.5">+5491112345678</td>
                              <td className="p-1.5 text-muted-foreground">Con código de país</td>
                            </tr>
                          )}
                          <tr className="border-t"><td className="p-1.5 font-mono">dni</td><td className="p-1.5">30123456</td><td className="p-1.5 text-muted-foreground">Siempre requerido</td></tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Columnas opcionales */}
                    <div>
                      <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">Columna opcional</p>
                      <table className="w-full text-xs border-collapse">
                        <tbody>
                          <tr className="border-t"><td className="p-1.5 font-mono">legajo</td><td className="p-1.5">GCL-00001</td><td className="p-1.5 text-muted-foreground">Disponible como {"{{"+"legajo"+"}}"}</td></tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Teléfono para WA */}
                    {(canal === "whatsapp" || canal === "ambos") && (
                      <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-2 text-xs space-y-1">
                        <p className="font-medium text-amber-800 dark:text-amber-300">Formato de teléfono para WhatsApp</p>
                        <p className="text-amber-700 dark:text-amber-400">Debe incluir código de país. Formatos aceptados:</p>
                        <ul className="font-mono space-y-0.5 text-amber-800 dark:text-amber-300">
                          <li>+5491112345678 ✓</li>
                          <li>5491112345678 ✓</li>
                          <li>1112345678 ✓ (se asume Argentina +549)</li>
                          <li>011-1234-5678 ✗ (sin guiones)</li>
                        </ul>
                      </div>
                    )}

                    {/* Ejemplo copiable */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Ejemplo para copiar</p>
                        <button
                          type="button"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                          onClick={() => {
                            navigator.clipboard.writeText(csvPlaceholder(canal));
                            setCsvCopied(true);
                            setTimeout(() => setCsvCopied(false), 2000);
                          }}
                        >
                          {csvCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {csvCopied ? "Copiado" : "Copiar"}
                        </button>
                      </div>
                      <pre className="bg-muted rounded p-2 text-xs overflow-x-auto whitespace-pre">{csvPlaceholder(canal)}</pre>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {lists.length > 0 && !isAdmin && (
              <div className="space-y-2">
                <Label>Lista guardada</Label>
                <Select value={listId || "__none__"} onValueChange={(v) => setListId(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Ninguna" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Ninguna —</SelectItem>
                    {lists.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.nombre} ({l.count})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Tabs defaultValue={canal === "whatsapp" ? "csv" : "paste"}>
              <TabsList>
                {canal === "email" && <TabsTrigger value="paste">Emails pegados</TabsTrigger>}
                <TabsTrigger value="csv">CSV</TabsTrigger>
              </TabsList>
              {canal === "email" && (
                <TabsContent value="paste" className="space-y-2">
                  <Textarea
                    placeholder="email1@x.com, email2@y.com"
                    value={pasteEmails}
                    onChange={(e) => setPasteEmails(e.target.value)}
                    rows={4}
                  />
                  <Button type="button" variant="secondary" onClick={() => mergeRecipientsFromInputs("paste")}>
                    Agregar emails
                  </Button>
                </TabsContent>
              )}
              <TabsContent value="csv" className="space-y-3">
                {/* Drop zone de archivo */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Subir archivo CSV"
                  className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors select-none
                    ${csvFileDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
                  onClick={() => csvFileInputRef.current?.click()}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") csvFileInputRef.current?.click(); }}
                  onDragOver={(e) => { e.preventDefault(); setCsvFileDragging(true); }}
                  onDragLeave={() => setCsvFileDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setCsvFileDragging(false);
                    const f = e.dataTransfer.files[0];
                    if (f) handleCsvFile(f);
                  }}
                >
                  <input
                    ref={csvFileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); e.target.value = ""; }}
                  />
                  {csvFileName ? (
                    <>
                      <FileText className="h-8 w-8 text-primary" />
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-primary">{csvFileName}</p>
                        <p className="text-xs text-muted-foreground">Click para cambiar el archivo</p>
                      </div>
                      <button
                        type="button"
                        className="absolute top-2 right-2 rounded-sm text-muted-foreground hover:text-foreground p-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCsvFileName(null);
                          setCsvFileError(null);
                          csvFileRef.current = null;
                          setCsvInspect(null);
                        }}
                        aria-label="Quitar archivo"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">Arrastrá un CSV o hacé click para subir</p>
                        <p className="text-xs text-muted-foreground">Columnas requeridas: <code>{csvCamposRequeridos(canal)}</code></p>
                      </div>
                    </>
                  )}
                </div>

                {/* Error de validación del archivo */}
                {csvFileError && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                    <X className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Formato inválido</p>
                      <p className="text-xs mt-0.5">{csvFileError}</p>
                    </div>
                  </div>
                )}

                {/* Alternativa: pegar texto */}
                <details className="group">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground list-none flex items-center gap-1">
                    <span className="group-open:hidden">▶</span>
                    <span className="hidden group-open:inline">▼</span>
                    O pegá el CSV directamente como texto
                  </summary>
                  <div className="mt-2 space-y-2">
                    <Textarea
                      placeholder={csvPlaceholder(canal)}
                      value={csvChunk}
                      onChange={(e) => setCsvChunk(e.target.value)}
                      rows={6}
                    />
                    <Button type="button" variant="secondary" onClick={() => mergeRecipientsFromInputs("csv")}>
                      Importar CSV
                    </Button>
                  </div>
                </details>
              </TabsContent>
            </Tabs>
            <div className="text-sm text-muted-foreground">
              Total cargados: <strong>{preview.n}</strong>
              {preview.sample.length > 0 && <> — {preview.sample.join(", ")}{preview.n > 3 ? "…" : ""}</>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Atrás</Button>
              <Button onClick={() => setStep(3)} disabled={!recipientTotal}>Siguiente</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PASO 3: Mensaje */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Mensaje</CardTitle>
            <CardDescription>
              Variables disponibles: {"{{nombre}}"}, {"{{dni}}"}, {"{{legajo}}"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre interno de la campaña</Label>
              <Input value={campaniaNombre} onChange={(e) => setCampaniaNombre(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{canal === "whatsapp" ? "Asunto (referencia interna)" : "Asunto"}</Label>
              <Input value={asunto} onChange={(e) => setAsunto(e.target.value)} />
            </div>

            {/* Configuración de template WhatsApp */}
            {(canal === "whatsapp" || canal === "ambos") && (
              <div className="rounded-md border p-4 space-y-4">
                <div>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    Template de WhatsApp
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Meta solo permite mensajes con templates aprobados. Si lo dejás vacío, usamos el
                    template registrado por defecto de Notificas.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nombre del template (aprobado en Meta)</Label>
                    <Input
                      placeholder="Vacío = template por defecto de Notificas"
                      value={waTemplateName}
                      onChange={(e) => setWaTemplateName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Idioma</Label>
                    <Select value={waTemplateLang} onValueChange={setWaTemplateLang}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="es_AR">Español (Argentina)</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="es_MX">Español (México)</SelectItem>
                        <SelectItem value="en_US">English (US)</SelectItem>
                        <SelectItem value="pt_BR">Português (Brasil)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">
                    Variables del template — ¿qué campo va en cada <code>{"{{N}}"}</code>?
                  </Label>
                  <div className="space-y-2">
                    {waTemplateVariables.map((v, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-10 shrink-0 font-mono">{`{{${i + 1}}}`}</span>
                        <Select
                          value={v}
                          onValueChange={(val) => setWaTemplateVariables((prev) => prev.map((x, j) => j === i ? val : x))}
                        >
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nombre">nombre</SelectItem>
                            <SelectItem value="dni">dni</SelectItem>
                            <SelectItem value="legajo">legajo</SelectItem>
                            <SelectItem value="email">email</SelectItem>
                            <SelectItem value="telefono">telefono</SelectItem>
                            <SelectItem value="url_lectura">url de lectura (link al mensaje)</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button" variant="ghost" size="sm"
                          className="text-destructive h-8 px-2"
                          onClick={() => setWaTemplateVariables((prev) => prev.filter((_, j) => j !== i))}
                          disabled={waTemplateVariables.length <= 1}
                        >✕</Button>
                      </div>
                    ))}
                    {waTemplateVariables.length < 8 && (
                      <Button
                        type="button" variant="outline" size="sm"
                        onClick={() => setWaTemplateVariables((prev) => [...prev, "nombre"])}
                      >
                        + Agregar variable
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    El orden debe coincidir exactamente con las variables definidas en el template aprobado por Meta.
                  </p>
                </div>
                {waTemplateName.trim() && (
                  <div className="rounded-md bg-muted/50 p-2 text-xs font-mono text-muted-foreground">
                    Preview de llamada a Meta: template=<strong>{waTemplateName}</strong>, variables=[{waTemplateVariables.map((v, i) => `{{${i+1}}}→${v}`).join(", ")}]
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Cuerpo{canal !== "email" ? " (referencia interna / vista previa email)" : ""}</Label>
              <Textarea value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} rows={10} />
            </div>
            {!isAdmin && (
              <>
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
              </>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>Atrás</Button>
              <Button onClick={() => setStep(4)} disabled={!asunto.trim() || !cuerpo.trim() || !campaniaNombre.trim()}>
                Siguiente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PASO 4: Revisión + Confirmación */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Revisión y confirmación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Resumen */}
            <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
              <div className="flex gap-4 flex-wrap">
                <span><strong>Canal:</strong> {canal === "email" ? "Email" : canal === "whatsapp" ? "WhatsApp" : "Email + WhatsApp"}</span>
                <span><strong>Destinatarios:</strong> {recipientTotal.toLocaleString("es-AR")}</span>
                <span><strong>Asunto:</strong> {asunto}</span>
              </div>
            </div>

            {/* Emparejamiento de adjuntos */}
            {pairByRecipient && files.length > 0 && !isAdmin && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Emparejamiento de adjuntos</p>
                  <Button type="button" variant="outline" size="sm" onClick={suggestPairingAgain}>Sugerir de nuevo</Button>
                </div>
                {recipients.some((r) => { const ix = pairingSelections[r.email.trim().toLowerCase()]; return ix === undefined || ix === null; }) && (
                  <p className="text-sm text-destructive">Hay destinatarios sin archivo asignado.</p>
                )}
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
                        const coincide = typeof idx === 'number' ? scoreFileForRecipient(files[idx].name, r).label : '—';
                        return (
                          <tr key={k} className="border-t border-border">
                            <td className="p-2 align-middle">{r.nombre}</td>
                            <td className="p-2 align-middle text-muted-foreground break-all">{r.email}</td>
                            <td className="p-2 align-middle min-w-[12rem]">
                              <Select value={selStr} onValueChange={(v) => setPairingSelections((prev) => ({ ...prev, [k]: v === '__none__' ? null : Number.parseInt(v, 10) }))}>
                                <SelectTrigger className="h-9 w-full max-w-[min(260px,100%)]"><SelectValue placeholder="Sin archivo" /></SelectTrigger>
                                <SelectContent className="max-h-60">
                                  <SelectItem value="__none__">— Sin archivo —</SelectItem>
                                  {files.map((f, i) => <SelectItem key={`${i}-${f.name}`} value={String(i)}><span className="truncate max-w-[220px]" title={f.name}>{f.name}</span></SelectItem>)}
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
            )}

            {/* Preview del primer mensaje */}
            {(canal === "email" || canal === "ambos") && firstHtml && (
              <div className="border rounded-md p-3 max-h-64 overflow-auto text-xs bg-muted/30 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: firstHtml }} />
            )}

            {/* Créditos y programación */}
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm space-y-2">
              <p>
                Consumo: <strong>1 envío</strong> por destinatario exitoso.
                {isAdmin ? (
                  <>
                    {" "}Se factura a {adminBillingEmail || "la empresa"}; no hace falta cargar saldo.
                  </>
                ) : (
                  <> Tu saldo: <strong>{creditos}</strong>.</>
                )}
              </p>
              {isAdmin ? (
                <>
                  <div className="space-y-1 pt-1 max-w-xs">
                    <Label className="text-xs">Límite por envío</Label>
                    <Input
                      type="number"
                      min={1}
                      value={tandaSize}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isInteger(n) && n >= 0) setTandaSize(n);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Cada vez que dispares, salen como máximo este número de destinatarios nuevos. Hoy WhatsApp permite 2.000. Cuando te suban el cupo, cambialo (ej. 10.000) y volvé a enviar.
                    </p>
                  </div>
                </>
              ) : (
                <>
              {creditos < recipients.length && (
                <p className="text-destructive">Saldo insuficiente — necesitás {recipients.length - creditos} envíos más.</p>
              )}
              <div className="space-y-1 pt-1">
                <Label className="text-xs">Programar envío (opcional)</Label>
                <Input type="datetime-local" value={scheduleIso} onChange={(e) => setScheduleIso(e.target.value)} className="max-w-xs" />
                <p className="text-xs text-muted-foreground">Sin fecha → envío inmediato. Con fecha futura → queda en borrador.</p>
              </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>Atrás</Button>
              <Button variant="secondary" disabled={submitting} onClick={() => setConfirmOpen(true)}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enviar ahora
              </Button>
              <Button variant="outline" disabled={submitting} onClick={() => runSubmit(false)}>Guardar borrador</Button>
            </div>
            {submitting && uploadProgress && (
              <p className="text-sm text-muted-foreground">
                Subiendo destinatarios: {uploadProgress.uploadedChunks} / {uploadProgress.chunkCount}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar envío masivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás por enviar {isAdmin ? (tandaSize > 0 ? Math.min(tandaSize, recipientTotal) : recipientTotal).toLocaleString("es-AR") : recipients.length} notificaciones certificadas. Esta acción no se puede deshacer.
              {submitting && uploadProgress ? (
                <span className="mt-2 block">
                  Subiendo destinatarios: {uploadProgress.uploadedChunks} / {uploadProgress.chunkCount}
                </span>
              ) : null}
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
