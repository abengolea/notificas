"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  deleteField,
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
import { Loader2, Mail, MessageCircle, Layers, HelpCircle, Copy, Check, Upload, X, FileText, FlaskConical } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { maxRecipientsForPlan } from "@/lib/org-limits-client";
import { assignFilesToRecipientsGreedy, scoreFileForRecipient } from "@/lib/campaign-attachment-match";
import { uploadCampaignCsvInChunks, uploadCampaignRecipients } from "@/lib/upload-campaign-recipients";
import { csvCamposRequeridos, csvPlaceholder, inspectCampaignCsv, parseCsvQuickResult, phoneDigits } from "@/lib/parse-campaign-csv";
import { WIZARD_INLINE_LIST_MAX } from "@/lib/campaign-recipients";
import { DEFAULT_TANDA_SIZE } from "@/lib/campaign-tanda";
import { DailyQuotaField } from "@/components/empresa/daily-quota-field";
import {
  SIM_RECIPIENT_DEFAULT,
  SIM_RECIPIENT_MAX,
  SIM_RECIPIENT_MIN,
} from "@/lib/campaign-fake-recipients";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { CsvInspectResult } from "@/lib/parse-campaign-csv";
import { isUnsentCampaign, toDatetimeLocalValue, UNSENT_EDIT_ERROR } from "@/lib/campaign-edit";
import { WA_TEMPLATE_DEFAULT_VARS, usesNotificasDefaultTemplate } from "@/lib/wa-template-fields";
import { WaTemplateFields } from "@/components/empresa/wa-template-fields";

function cleanRecipientForUpload(r: RecipientEntry): RecipientEntry {
  const clean: RecipientEntry = { nombre: r.nombre || "", email: r.email || "" };
  if (r.telefono) clean.telefono = r.telefono;
  if (r.dni) clean.dni = r.dni;
  if (r.legajo) clean.legajo = r.legajo;
  if (r.dias) clean.dias = r.dias;
  if (r.area) clean.area = r.area;
  return clean;
}

function parseEmailsBlock(text: string): RecipientEntry[] {
  const parts = text.split(/[\s,;\n]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const uniq = [...new Set(parts)];
  return uniq
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    .map((email) => ({ email, nombre: email.split("@")[0] }));
}

function recipientMergeKey(r: RecipientEntry, canal: CanalCampaign): string {
  if (canal === "whatsapp" || canal === "ambos") {
    const digits = phoneDigits(r.telefono);
    if (digits) return `wa:${digits}`;
  }
  return r.email.trim().toLowerCase();
}

function mergeRecipientList(
  current: RecipientEntry[],
  incoming: RecipientEntry[],
  canal: CanalCampaign
): RecipientEntry[] {
  const map = new Map<string, RecipientEntry>();
  current.forEach((r) => map.set(recipientMergeKey(r, canal), r));
  incoming.forEach((r) => map.set(recipientMergeKey(r, canal), r));
  return [...map.values()];
}

export function CampaignWizard({
  orgId: orgIdProp,
  orgPlan: orgPlanProp = "starter",
  mode = "empresa",
  campaignId: editCampaignId,
}: {
  orgId?: string;
  orgPlan?: string;
  mode?: "empresa" | "admin";
  campaignId?: string;
}) {
  const isAdmin = mode === "admin";
  const isEdit = Boolean(editCampaignId);
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
  const [waTemplateVariables, setWaTemplateVariables] = useState<string[]>([...WA_TEMPLATE_DEFAULT_VARS]);
  const [waUrlButton, setWaUrlButton] = useState(false);
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
  const [simulated, setSimulated] = useState(false);
  const [simRecipientCount, setSimRecipientCount] = useState(SIM_RECIPIENT_DEFAULT);
  const [adminBillingEmail, setAdminBillingEmail] = useState("");
  const [adminOrgPlan, setAdminOrgPlan] = useState("starter");
  const [existingRecipientCount, setExistingRecipientCount] = useState(0);
  const [existingAttachments, setExistingAttachments] = useState<CampaignAttachment[]>([]);
  const [existingPaired, setExistingPaired] = useState<Record<string, CampaignAttachment[]> | null>(null);
  const [loadingCampaign, setLoadingCampaign] = useState(Boolean(editCampaignId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const orgPlan = isAdmin ? adminOrgPlan : orgPlanProp;
  const maxR = isAdmin ? 1_000_000 : maxRecipientsForPlan(orgPlan);
  const recipientTotal =
    csvInspect?.count ||
    recipients.length ||
    existingRecipientCount ||
    (isAdmin && simulated ? simRecipientCount : 0);
  const csvListInline = !csvInspect || csvInspect.count <= WIZARD_INLINE_LIST_MAX;
  const usesDailyTanda = !simulated && (canal === "whatsapp" || canal === "ambos");
  const creditNeed =
    usesDailyTanda && tandaSize > 0 ? Math.min(tandaSize, recipientTotal) : recipientTotal;

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

  useEffect(() => {
    if (!editCampaignId) return;
    let cancelled = false;
    (async () => {
      try {
        if (isAdmin) {
          const res = await fetch(`/api/admin/campaigns/${editCampaignId}`, { credentials: "include" });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "No se pudo cargar la campaña");
          const c = json.campaign as {
            orgId?: string;
            estado?: string;
            stats?: { enviados?: number };
            nombre?: string;
            asunto?: string;
            cuerpo?: string;
            canal?: CanalCampaign;
            recipientCount?: number;
            tandaSize?: number;
            simulated?: boolean;
            waTemplateName?: string;
            waTemplateLang?: string;
            waTemplateVariables?: string[];
            waUrlButton?: boolean;
          };
          if (!isUnsentCampaign(c)) throw new Error(UNSENT_EDIT_ERROR);
          if (cancelled) return;
          if (c.orgId) setAdminOrgId(c.orgId);
          setCampaniaNombre(String(c.nombre || ""));
          setAsunto(String(c.asunto || ""));
          setCuerpo(String(c.cuerpo || ""));
          setCanal((c.canal as CanalCampaign) || "email");
          setExistingRecipientCount(typeof c.recipientCount === "number" ? c.recipientCount : 0);
          if (typeof c.tandaSize === "number") setTandaSize(c.tandaSize);
          setSimulated(c.simulated === true);
          if (c.simulated === true && typeof c.recipientCount === "number" && c.recipientCount > 0) {
            setSimRecipientCount(c.recipientCount);
          }
          setWaTemplateName(String(c.waTemplateName || ""));
          setWaTemplateLang(String(c.waTemplateLang || "es_AR"));
          if (Array.isArray(c.waTemplateVariables) && c.waTemplateVariables.length) {
            setWaTemplateVariables(c.waTemplateVariables);
          }
          setWaUrlButton(c.waUrlButton === true);
        } else {
          const snap = await getDoc(doc(db, "campaigns", editCampaignId));
          if (!snap.exists()) throw new Error("Campaña no encontrada");
          const x = snap.data();
          if (orgIdProp && String(x.orgId) !== orgIdProp) throw new Error("Campaña no encontrada");
          if (!isUnsentCampaign(x)) throw new Error(UNSENT_EDIT_ERROR);
          if (cancelled) return;
          setCampaniaNombre(String(x.nombre || ""));
          setAsunto(String(x.asunto || ""));
          setCuerpo(String(x.cuerpo || ""));
          setCanal((x.canal as CanalCampaign) || "email");
          const inline = Array.isArray(x.recipientData) ? (x.recipientData as RecipientEntry[]) : [];
          if (inline.length > 0) setRecipients(inline);
          setExistingRecipientCount(typeof x.recipientCount === "number" ? x.recipientCount : inline.length);
          if (typeof x.tandaSize === "number") setTandaSize(x.tandaSize);
          setWaTemplateName(String(x.waTemplateName || ""));
          setWaTemplateLang(String(x.waTemplateLang || "es_AR"));
          if (Array.isArray(x.waTemplateVariables) && x.waTemplateVariables.length) {
            setWaTemplateVariables(x.waTemplateVariables);
          }
          setWaUrlButton(x.waUrlButton === true);
          setExistingAttachments(Array.isArray(x.adjuntos) ? x.adjuntos : []);
          const paired = x.adjuntosPorDestinatario;
          if (paired && typeof paired === "object" && !Array.isArray(paired)) {
            setExistingPaired(paired as Record<string, CampaignAttachment[]>);
            setPairByRecipient(true);
          }
          setScheduleIso(toDatetimeLocalValue(x.scheduledAt));
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "No se pudo cargar la campaña");
      } finally {
        if (!cancelled) setLoadingCampaign(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editCampaignId, isAdmin, orgIdProp]);

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
    const nombre = r0?.nombre || csvInspect?.sample?.[0] || "Destinatario";
    const body = campaignBodyToHtmlFragment(
      personalizeCampaignText(cuerpo, {
        nombre,
        dni: r0?.dni,
        legajo: r0?.legajo,
      })
    );
    return buildCampaignMailHtml({
      recipientEmail: r0?.email || "destinatario@ejemplo.com",
      recipientName: nombre,
      sender: auth.currentUser?.email || "remitente",
      bodyHtml: body,
      attachments: [],
    });
  }, [recipients, cuerpo, csvInspect]);

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

  function handleCsvFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setCsvFileError("El archivo debe ser .csv");
      setCsvFileName(null);
      csvFileRef.current = null;
      setCsvInspect(null);
      return;
    }

    void inspectCampaignCsv(file, canal).then((inspected) => {
      if (inspected.error) {
        setCsvFileError(inspected.error);
        setCsvFileName(null);
        csvFileRef.current = null;
        setCsvInspect(null);
        return;
      }
      if (inspected.count > maxR) {
        setCsvFileError(`Máximo ${maxR.toLocaleString("es-AR")} destinatarios en este plan`);
        setCsvFileName(null);
        csvFileRef.current = null;
        setCsvInspect(null);
        setRecipients([]);
        return;
      }
      setCsvFileError(null);
      setCsvFileName(file.name);
      csvFileRef.current = file;
      setCsvInspect(inspected);
      if (isAdmin || inspected.count > WIZARD_INLINE_LIST_MAX) {
        setRecipients([]);
        if (pairByRecipient) setPairByRecipient(false);
      } else {
        void file.text().then((text) => {
          const parsed = parseCsvQuickResult(text, canal);
          if (parsed.error || parsed.rows.length === 0) {
            setRecipients([]);
            return;
          }
          setRecipients(parsed.rows);
        });
      }
      toast({
        title: `${inspected.count.toLocaleString("es-AR")} destinatarios`,
        description: `Desde ${file.name}${inspected.skipped ? ` · ${inspected.skipped} filas salteadas` : ""}${
          inspected.count > WIZARD_INLINE_LIST_MAX ? " · no se lista fila por fila" : ""
        }`,
      });
    });
  }

  function mergeRecipientsFromInputs(mode: "paste" | "csv") {
    if (mode === "csv") {
      const parsed = parseCsvQuickResult(csvChunk, canal);
      if (parsed.error) {
        toast({ title: "CSV inválido", description: parsed.error, variant: "destructive" });
        return;
      }
      if (parsed.rows.length === 0) {
        toast({ title: "No se encontraron destinatarios válidos", description: `El CSV debe tener columnas: ${csvCamposRequeridos(canal)}`, variant: "destructive" });
        return;
      }
      if (parsed.rows.length > WIZARD_INLINE_LIST_MAX) {
        toast({
          title: "Pegá un CSV chico o subí el archivo",
          description: `Hasta ${WIZARD_INLINE_LIST_MAX} filas en pantalla. Para listas más grandes, arrastrá el .csv.`,
          variant: "destructive",
        });
        return;
      }
      setRecipients(mergeRecipientList(recipients, parsed.rows, canal));
      toast({
        title: `${parsed.rows.length} destinatarios`,
        description: parsed.phoneDuplicates
          ? `Combinados con la lista actual · ${parsed.phoneDuplicates} teléfonos duplicados omitidos`
          : "Combinados con la lista actual",
      });
      return;
    }
    const next = parseEmailsBlock(pasteEmails);
    if (next.length === 0) {
      toast({ title: "No se encontraron destinatarios válidos", description: `El CSV debe tener columnas: ${csvCamposRequeridos(canal)}`, variant: "destructive" });
      return;
    }
    if (next.length > WIZARD_INLINE_LIST_MAX) {
      toast({
        title: "Demasiados emails pegados",
        description: `Hasta ${WIZARD_INLINE_LIST_MAX} en pantalla. Para más, subí un archivo CSV.`,
        variant: "destructive",
      });
      return;
    }
    setRecipients(mergeRecipientList(recipients, next, canal));
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
    const hasRecipients =
      Boolean(file) ||
      recipients.length > 0 ||
      existingRecipientCount > 0 ||
      (simulated && simRecipientCount >= SIM_RECIPIENT_MIN);
    if (!hasRecipients) {
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
      let campaignId = editCampaignId || "";
      if (isEdit && editCampaignId) {
        const patchRes = await fetch(`/api/admin/campaigns/${editCampaignId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: campaniaNombre.trim(),
            asunto: asunto.trim(),
            cuerpo: cuerpo.trim(),
            canal,
            waTemplateName: waTemplateName.trim() || "",
            waTemplateLang,
            waTemplateVariables: waTemplateVariables.filter(Boolean),
            waUrlButton,
            tandaSize: simulated ? 0 : tandaSize,
          }),
        });
        const patched = await patchRes.json();
        if (!patchRes.ok) throw new Error(patched.error || "No se pudo guardar la campaña");
      } else {
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
            waUrlButton,
            tandaSize: simulated ? 0 : tandaSize,
            simulated,
          }),
        });
        const created = await createRes.json();
        if (!createRes.ok) throw new Error(created.error || "No se pudo crear la campaña");
        campaignId = String(created.id);
      }

      const shouldUploadFile = Boolean(file);
      const shouldUploadList = !file && recipients.length > 0;
      const shouldGenerate =
        simulated &&
        !shouldUploadFile &&
        !shouldUploadList &&
        (existingRecipientCount === 0 || simRecipientCount !== existingRecipientCount);

      if (shouldUploadFile && file) {
        await uploadCampaignCsvInChunks({
          campaignId,
          orgId,
          file,
          canal,
          endpoint: "/api/admin/campaigns/upload-recipients",
          onProgress: (p) =>
            setUploadProgress({ uploadedChunks: p.uploadedChunks, chunkCount: p.chunkCount }),
        });
      } else if (shouldGenerate) {
        const genRes = await fetch("/api/admin/campaigns/generate-recipients", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignId,
            count: Math.min(SIM_RECIPIENT_MAX, Math.max(SIM_RECIPIENT_MIN, simRecipientCount)),
          }),
        });
        const genData = await genRes.json();
        if (!genRes.ok) throw new Error(genData.error || "No se pudieron generar destinatarios");
      } else if (shouldUploadList) {
        const cleanRecipients = recipients.map(cleanRecipientForUpload);
        await uploadCampaignRecipients({
          campaignId,
          orgId,
          recipients: cleanRecipients,
          endpoint: "/api/admin/campaigns/upload-recipients",
          onProgress: setUploadProgress,
        });
      }

      if (sendNow) {
        const sendRes = await fetch("/api/admin/campaigns/send", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId, tandaSize: simulated ? 0 : tandaSize }),
        });
        const sendData = await sendRes.json();
        if (!sendRes.ok) throw new Error(sendData.error || "Falló el envío");
        toast({
          title: simulated ? "Simulación iniciada" : "Envío iniciado",
          description: simulated
            ? `${(sendData.pendingThisTanda ?? sendData.pending ?? simRecipientCount).toLocaleString("es-AR")} mensajes simulados encolados`
            : `${(sendData.pendingThisTanda ?? sendData.pending ?? 0).toLocaleString("es-AR")} mensajes encolados`,
        });
      } else {
        toast({ title: isEdit ? "Campaña actualizada" : "Borrador guardado" });
      }

      router.push(`/admin/campanas/${campaignId}`);
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : isEdit ? "No se pudo guardar la campaña" : "No se pudo crear la campaña",
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
    const file = csvFileRef.current;
    if (!file && recipients.length === 0 && existingRecipientCount === 0) {
      toast({ title: "Agregá destinatarios", variant: "destructive" });
      return;
    }
    const recipientSaveCount = csvInspect?.count || recipients.length || existingRecipientCount;
    if (recipientSaveCount > maxR) {
      toast({
        title: "Límite de plan",
        description: `Máximo ${maxR} destinatarios`,
        variant: "destructive",
      });
      return;
    }

    const scheduleFutureEarly = Boolean(scheduleIso && new Date(scheduleIso) > new Date());
    if (sendNow && !scheduleFutureEarly && creditos < creditNeed) {
      toast({
        title: "Envíos insuficientes",
        description: usesDailyTanda
          ? `El lote de hoy necesita ${creditNeed.toLocaleString("es-AR")}`
          : undefined,
        variant: "destructive",
      });
      return;
    }

    const pairingActive = pairByRecipient && files.length > 0;
    if (pairingActive && recipients.length === 0) {
      toast({
        title: "No se pueden reasignar adjuntos",
        description: "Para un adjunto distinto por destinatario, volvé a cargar la lista en Destinatarios.",
        variant: "destructive",
      });
      return;
    }
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
      const draftKey = `${isEdit ? editCampaignId : "draft"}_${Date.now()}`;
      const uploadedNew: CampaignAttachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const up = await uploadPDF(f.file, `${draftKey}`, user.uid);
        uploadedNew.push({
          nombre: up.name,
          url: up.url,
          hash: up.hash || "",
          size: up.size,
        });
      }
      const uploaded = [...existingAttachments, ...uploadedNew];

      const pairingActiveSubmit = pairByRecipient && uploadedNew.length > 0;
      const keepExistingPairing = Boolean(existingPaired) && files.length === 0 && pairByRecipient;
      const adjuntosGlobales = pairingActiveSubmit || keepExistingPairing ? [] : uploaded;
      let adjuntosPorDestinatario: Record<string, CampaignAttachment[]> | undefined;
      if (pairingActiveSubmit) {
        adjuntosPorDestinatario = {};
        recipients.forEach((r) => {
          const k = r.email.trim().toLowerCase();
          const idx = pairingSelections[k];
          const one = typeof idx === "number" ? uploadedNew[idx] : undefined;
          adjuntosPorDestinatario![k] = one
            ? [{ nombre: one.nombre, url: one.url, hash: one.hash || "", size: one.size }]
            : [];
        });
      } else if (keepExistingPairing && existingPaired) {
        adjuntosPorDestinatario = existingPaired;
      }

      const scheduleFuture = Boolean(scheduleIso && new Date(scheduleIso) > new Date());

      // Firestore rechaza campos undefined — limpiar antes de guardar.
      const cleanRecipients = recipients.map(cleanRecipientForUpload);
      const replaceRecipients = Boolean(file) || cleanRecipients.length > 0;

      const customWa = canal !== "email" && !usesNotificasDefaultTemplate(waTemplateName);
      const waFields = canal === "email"
        ? {}
        : customWa
          ? {
              waTemplateName: waTemplateName.trim(),
              waTemplateLang: waTemplateLang.trim() || "es_AR",
              waTemplateVariables: waTemplateVariables.filter(Boolean),
              waUrlButton: waUrlButton === true,
            }
          : {
              waTemplateLang: waTemplateLang.trim() || "es_AR",
              waUrlButton: false,
            };
      const content = {
        canal,
        tandaSize,
        ...waFields,
        nombre: campaniaNombre.trim(),
        asunto: asunto.trim(),
        cuerpo: cuerpo.trim(),
        adjuntos: adjuntosGlobales,
        recipientListId: listId || null,
      };

      const token = await user.getIdToken();
      let campaignId = editCampaignId || "";

      if (isEdit && editCampaignId) {
        const refDoc = doc(db, "campaigns", editCampaignId);
        const current = await getDoc(refDoc);
        if (!current.exists()) throw new Error("Campaña no encontrada");
        if (!isUnsentCampaign(current.data() || {})) throw new Error(UNSENT_EDIT_ERROR);
        if (String(current.data()?.estado) === "cancelada") {
          await updateDoc(refDoc, { estado: "borrador", updatedAt: serverTimestamp() });
        }
        await updateDoc(refDoc, {
          ...content,
          ...(canal !== "email" && !customWa
            ? { waTemplateName: deleteField(), waTemplateVariables: deleteField() }
            : {}),
          ...(adjuntosPorDestinatario
            ? { adjuntosPorDestinatario }
            : existingPaired
              ? { adjuntosPorDestinatario: deleteField() }
              : {}),
          estado: "borrador",
          updatedAt: serverTimestamp(),
          ...(scheduleFuture && scheduleIso
            ? { scheduledAt: new Date(scheduleIso) }
            : { scheduledAt: deleteField() }),
        });
        campaignId = editCampaignId;
        if (replaceRecipients) {
          if (file) {
            await uploadCampaignCsvInChunks({
              campaignId,
              orgId,
              file,
              canal,
              token,
              endpoint: "/api/campaigns/upload-recipients",
              onProgress: (p) =>
                setUploadProgress({ uploadedChunks: p.uploadedChunks, chunkCount: p.chunkCount }),
            });
          } else {
            await uploadCampaignRecipients({
              campaignId,
              orgId,
              recipients: cleanRecipients,
              token,
              onProgress: setUploadProgress,
            });
            await updateDoc(refDoc, {
              "stats.total": cleanRecipients.length,
              "stats.pendientes": cleanRecipients.length,
              "stats.enviados": 0,
              "stats.leidos": 0,
              "stats.errores": 0,
            });
          }
        }
      } else {
        const refDoc = await addDoc(collection(db, "campaigns"), {
          ...content,
          orgId,
          createdBy: user.uid,
          ...(adjuntosPorDestinatario ? { adjuntosPorDestinatario } : {}),
          recipientCount: recipientSaveCount,
          stats: {
            total: recipientSaveCount,
            enviados: 0,
            leidos: 0,
            pendientes: recipientSaveCount,
            errores: 0,
          },
          createdAt: serverTimestamp(),
          estado: "borrador",
          ...(scheduleFuture && scheduleIso ? { scheduledAt: new Date(scheduleIso) } : {}),
          startedAt: null,
        });
        campaignId = refDoc.id;
        try {
          if (file) {
            await uploadCampaignCsvInChunks({
              campaignId,
              orgId,
              file,
              canal,
              token,
              endpoint: "/api/campaigns/upload-recipients",
              onProgress: (p) =>
                setUploadProgress({ uploadedChunks: p.uploadedChunks, chunkCount: p.chunkCount }),
            });
          } else {
            await uploadCampaignRecipients({
              campaignId,
              orgId,
              recipients: cleanRecipients,
              token,
              onProgress: setUploadProgress,
            });
          }
        } catch (uploadErr) {
          await updateDoc(refDoc, { estado: "borrador" });
          throw uploadErr;
        }
      }

      if (scheduleFuture && scheduleIso) {
        toast({
          title: "Campaña programada (borrador)",
          description: "Desde el detalle podrás iniciar el envío cuando corresponda.",
        });
        router.push(`/empresa/${orgId}/campanas/${campaignId}`);
        return;
      }

      if (sendNow) {
        const sendRes = await fetch("/api/campaigns/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ campaignId, orgId }),
        });
        const sendData = await sendRes.json();
        if (!sendRes.ok) {
          throw new Error(sendData.error || "Falló el envío");
        }
        toast({ title: "Envío iniciado", description: `${sendData.pending ?? sendData.total ?? 0} mensajes encolados` });
      } else {
        toast({ title: isEdit ? "Campaña actualizada" : "Borrador guardado" });
      }

      router.push(`/empresa/${orgId}/campanas/${campaignId}`);
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : isEdit ? "No se pudo guardar la campaña" : "No se pudo crear la campaña",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  const STEPS = ["Canal", "Destinatarios", "Mensaje", "Confirmación"];

  if (loadingCampaign) {
    return (
      <div className="max-w-3xl flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl rounded-lg border p-6 space-y-2">
        <p className="font-medium">No se puede editar</p>
        <p className="text-sm text-muted-foreground">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      {isEdit && (
        <div>
          <h1 className="text-2xl font-bold">Editar campaña</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Los cambios se guardan sobre este borrador. Si la campaña ya se envió, no se puede modificar.
          </p>
        </div>
      )}
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
            <Select value={adminOrgId} onValueChange={setAdminOrgId} disabled={isEdit}>
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
                Plan {adminOrgPlan}
                {simulated
                  ? " · simulación (no se factura)"
                  : ` · cobra ${adminBillingEmail || "el admin de la empresa"} · ${creditos.toLocaleString("es-AR")} envíos`}
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Modo de envío</CardTitle>
            <CardDescription>
              La simulación recorre la misma cola, workers y dashboard. No llama a Mailgun ni a WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={simulated ? "simulated" : "real"}
              onValueChange={(v) => {
                if (isEdit) return;
                const next = v === "simulated";
                setSimulated(next);
                setTandaSize(next ? 0 : DEFAULT_TANDA_SIZE);
                if (next && !campaniaNombre.trim()) {
                  setCampaniaNombre(`[SIM] Prueba ${new Date().toLocaleString("es-AR")}`);
                }
              }}
              className={`grid gap-3 sm:grid-cols-2${isEdit ? " opacity-70 pointer-events-none" : ""}`}
            >
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 ${
                  !simulated ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
                }`}
              >
                <RadioGroupItem value="real" className="mt-1" />
                <span>
                  <span className="block font-medium">Envío real</span>
                  <span className="block text-xs text-muted-foreground mt-1">
                    Sale por correo y/o WhatsApp de verdad. No se puede deshacer.
                  </span>
                </span>
              </label>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 ${
                  simulated ? "border-amber-500 bg-amber-500/5 ring-1 ring-amber-500" : "border-border"
                }`}
              >
                <RadioGroupItem value="simulated" className="mt-1" />
                <span>
                  <span className="font-medium inline-flex items-center gap-1.5">
                    <FlaskConical className="h-4 w-4" />
                    Simulación
                  </span>
                  <span className="block text-xs text-muted-foreground mt-1">
                    Destinatarios ficticios, entregas y aperturas al azar. No se factura ni se envía nada.
                  Cada 500 envíos (y cada 500 hechos) se ancla una tanda real en Polygon.
                  </span>
                </span>
              </label>
            </RadioGroup>
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
              {(canal === "whatsapp" || canal === "ambos") && !simulated && (
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
                        <p className="text-amber-700 dark:text-amber-400">Debe incluir código de país. Formatos aceptados (se normalizan a E.164):</p>
                        <ul className="font-mono space-y-0.5 text-amber-800 dark:text-amber-300">
                          <li>+5491112345678 ✓</li>
                          <li>5491112345678 ✓</li>
                          <li>1112345678 ✓ (se asume Argentina +549)</li>
                          <li>011-1234-5678 ✓ (guiones y 0 inicial se normalizan)</li>
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
            {isEdit && existingRecipientCount > 0 && recipients.length === 0 && !csvFileName && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                Esta campaña ya tiene <strong>{existingRecipientCount.toLocaleString("es-AR")}</strong> destinatarios.
                Dejalos así o cargá una lista nueva para reemplazarlos.
              </div>
            )}
            {isAdmin && simulated && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
                <p className="font-medium inline-flex items-center gap-2">
                  <FlaskConical className="h-4 w-4" />
                  Destinatarios ficticios
                </p>
                <p className="text-sm text-muted-foreground">
                  Se generan al enviar. Teléfonos y mails de prueba (no existen). Podés subir un CSV en su lugar.
                </p>
                <div className="space-y-1 max-w-xs">
                  <Label className="text-xs">Cantidad</Label>
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
                  <p className="text-xs text-muted-foreground">
                    Entre {SIM_RECIPIENT_MIN.toLocaleString("es-AR")} y {SIM_RECIPIENT_MAX.toLocaleString("es-AR")}. Default 10.000.
                  </p>
                </div>
                {csvFileName ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Hay un CSV cargado: se usa ese archivo en lugar de la lista ficticia.
                  </p>
                ) : (
                  <p className="text-sm">
                    Al enviar se crean <strong>{simRecipientCount.toLocaleString("es-AR")}</strong> destinatarios de prueba.
                  </p>
                )}
              </div>
            )}
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
                          setRecipients([]);
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
              Total cargados: <strong>{preview.n.toLocaleString("es-AR")}</strong>
              {preview.sample.length > 0 && <> — {preview.sample.join(", ")}{preview.n > 3 ? "…" : ""}</>}
            </div>
            {!csvListInline && csvInspect && (
              <p className="text-sm text-muted-foreground rounded-md border bg-muted/40 p-3">
                Lista grande: no se muestra fila por fila. Al guardar se sube de a {WIZARD_INLINE_LIST_MAX}.
                El adjunto distinto por destinatario no está disponible.
              </p>
            )}
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
            {(canal === "whatsapp" || canal === "ambos") && !simulated && (
              <div className="rounded-md border p-4 space-y-4">
                <div>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    Template de WhatsApp
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Si lo dejás vacío se usa notificaciones_notificas (3 variables). Si ponés otro
                    nombre aprobado en Meta, mapeá cada {"{{N}}"} — podés agregar las que haga falta.
                  </p>
                </div>
                <WaTemplateFields
                  idPrefix="wizard-wa"
                  value={{
                    name: waTemplateName,
                    lang: waTemplateLang,
                    variables: waTemplateVariables,
                    urlButton: waUrlButton,
                  }}
                  onChange={(next) => {
                    setWaTemplateName(next.name);
                    setWaTemplateLang(next.lang);
                    setWaTemplateVariables(next.variables);
                    setWaUrlButton(next.urlButton);
                  }}
                />
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
                  disabled={!csvListInline}
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
                    {!csvListInline ? " No aplica con CSV de más de 500 filas." : ""}
                  </p>
                </div>
              </div>
            </div>
            {existingAttachments.length > 0 && (
              <div className="space-y-2">
                <Label>Adjuntos ya guardados</Label>
                <ul className="space-y-1.5">
                  {existingAttachments.map((a) => (
                    <li key={a.url} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                      <span className="truncate">{a.nombre}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive h-8 px-2 shrink-0"
                        onClick={() => setExistingAttachments((prev) => prev.filter((x) => x.url !== a.url))}
                      >
                        Quitar
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
            {pairByRecipient && files.length > 0 && !isAdmin && csvListInline && (
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
              {simulated ? (
                <p>
                  <strong>Simulación:</strong> no se envía a teléfonos ni correos reales y no se factura.
                  Sí se lacran tandas Merkle de 500 en Polygon (envíos y hechos: entregado, leído, apertura).
                </p>
              ) : (
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
              )}
              {isAdmin && !simulated ? (
                <DailyQuotaField
                  value={tandaSize}
                  onChange={setTandaSize}
                  hint="Hoy sale como máximo este lote. Mañana a las 9:00 (y un cron a las 9:15 por si falló) arranca el siguiente. Si Meta sube el cupo del número, cambiá este valor: rige mañana."
                />
              ) : !simulated && (canal === "whatsapp" || canal === "ambos") ? (
                <>
                  <DailyQuotaField
                    value={tandaSize}
                    onChange={setTandaSize}
                    hint="Tope de destinatarios nuevos por día, según el cupo de WhatsApp. Cuando Meta lo suba, cambialo acá. El lote de hoy no se mueve; rige mañana a las 9:00."
                  />
                  {creditos < creditNeed && (
                    <p className="text-destructive">Saldo insuficiente para el lote de hoy.</p>
                  )}
                  <div className="space-y-1 pt-1">
                    <Label className="text-xs">Programar envío (opcional)</Label>
                    <Input type="datetime-local" value={scheduleIso} onChange={(e) => setScheduleIso(e.target.value)} className="max-w-xs" />
                    <p className="text-xs text-muted-foreground">Sin fecha → envío inmediato. Con fecha futura → queda en borrador.</p>
                  </div>
                </>
              ) : !isAdmin ? (
                <>
              {creditos < creditNeed && (
                <p className="text-destructive">
                  Saldo insuficiente — necesitás {(creditNeed - creditos).toLocaleString("es-AR")} envíos más.
                </p>
              )}
              <div className="space-y-1 pt-1">
                <Label className="text-xs">Programar envío (opcional)</Label>
                <Input type="datetime-local" value={scheduleIso} onChange={(e) => setScheduleIso(e.target.value)} className="max-w-xs" />
                <p className="text-xs text-muted-foreground">Sin fecha → envío inmediato. Con fecha futura → queda en borrador.</p>
              </div>
                </>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>Atrás</Button>
              <Button variant="secondary" disabled={submitting} onClick={() => setConfirmOpen(true)}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {simulated ? "Simular ahora" : "Enviar ahora"}
              </Button>
              <Button variant="outline" disabled={submitting} onClick={() => runSubmit(false)}>
                {isEdit ? "Guardar cambios" : "Guardar borrador"}
              </Button>
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
            <AlertDialogTitle>{simulated ? "¿Confirmar simulación?" : "¿Confirmar envío masivo?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {simulated ? (
                <>
                  Se van a simular {recipientTotal.toLocaleString("es-AR")} envíos (cola, workers y dashboard).
                  No sale nada a Mailgun ni a WhatsApp. Cada 500 mensajes se ancla una tanda en Polygon.
                </>
              ) : (
                <>
              Estás por enviar {creditNeed.toLocaleString("es-AR")} notificaciones certificadas{usesDailyTanda ? " (lote de hoy)" : ""}. Esta acción no se puede deshacer.
                </>
              )}
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
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : simulated ? "Simular" : "Confirmar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
