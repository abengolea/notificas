"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Clipboard,
  ExternalLink,
  Info,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { MarketingSubnav } from "./marketing-subnav";
import { MarketingCampaignChannelTabs } from "./marketing-campaign-channel-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { MARKETING_COUNTRIES, countryName } from "@/lib/marketing/countries";
import {
  latestLinkedInActionAt,
  LINKEDIN_ACTION_LABEL,
  LINKEDIN_CAMPAIGN_STATUS_LABEL,
  LINKEDIN_MEMBER_STATUS_LABEL,
  LINKEDIN_MESSAGE_TYPE_LABEL,
  toIsoDateTime,
  toLocalDateTime,
} from "@/lib/marketing/linkedin-ui";
import type {
  MarketingLinkedInAction,
  MarketingLinkedInCampaign,
  MarketingLinkedInCampaignMember,
  MarketingLinkedInCampaignStatus,
  MarketingLinkedInMemberStatus,
  MarketingLinkedInMessageType,
} from "@/lib/marketing/domain/types";
import { useToast } from "@/hooks/use-toast";
import {
  buildLinkedInPreparePayload,
  linkedInActionKindForStatus,
  linkedInCompleteActionForMember,
  linkedInPrimaryOutreachField,
  linkedInResolveOutreachMessage,
  linkedInWorkBucket,
  LINKEDIN_OUTREACH_FIELD_LABEL,
  sortLinkedInCampaignMembersForWork,
  type LinkedInOutreachFieldKey,
  type LinkedInWorkBucket,
} from "@/lib/marketing/linkedin-campaign-workflow";
import { requestLinkedInExtensionPrepare } from "@/lib/marketing/linkedin-extension-bridge";

type CampaignDetail = {
  campaign: MarketingLinkedInCampaign;
  members: MarketingLinkedInCampaignMember[];
  summary: {
    total: number;
    pending: number;
    connectionSent: number;
    connected: number;
    messageSent: number;
    replied: number;
    interested: number;
  };
};

type ContactResult = {
  id: string;
  name?: string;
  email?: string;
  company?: string;
  title?: string;
  linkedinUrl?: string | null;
};

const CAMPAIGN_STATUSES = Object.keys(LINKEDIN_CAMPAIGN_STATUS_LABEL) as MarketingLinkedInCampaignStatus[];
const MEMBER_STATUSES = Object.keys(LINKEDIN_MEMBER_STATUS_LABEL) as MarketingLinkedInMemberStatus[];
const MESSAGE_TYPES = Object.keys(LINKEDIN_MESSAGE_TYPE_LABEL) as MarketingLinkedInMessageType[];
const ACTIONS = Object.keys(LINKEDIN_ACTION_LABEL) as MarketingLinkedInAction[];

function keysToText(value?: string[]): string {
  return (value ?? []).join(", ");
}

function textToKeys(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function memberCopyText(
  member: MarketingLinkedInCampaignMember,
  campaign: MarketingLinkedInCampaign,
): string {
  const kind = linkedInActionKindForStatus(member.status);
  if (kind) {
    return (linkedInResolveOutreachMessage(member, campaign, kind) ?? "").trim();
  }
  return (member.message || member.connectionMessage || member.followUpMessage || "").trim();
}

const OUTREACH_FIELDS: { key: LinkedInOutreachFieldKey; rows: number }[] = [
  { key: "connectionMessage", rows: 4 },
  { key: "message", rows: 10 },
  { key: "followUpMessage", rows: 8 },
];

const WORK_BUCKET_LABEL: Record<LinkedInWorkBucket, string> = {
  todo: "Por enviar ahora",
  pending: "Sin preparar",
  waiting: "Enviado — en espera",
  closed: "Cerrados",
};

function memberRowClass(bucket: LinkedInWorkBucket): string {
  if (bucket === "todo") return "border-l-4 border-l-primary/70";
  if (bucket === "waiting") return "opacity-80 bg-muted/15 border-l-4 border-l-transparent";
  if (bucket === "closed") return "opacity-55 bg-muted/25 border-l-4 border-l-transparent";
  return "opacity-90 border-l-4 border-l-muted";
}

function MemberStatusBadge({ status }: { status: MarketingLinkedInMemberStatus }) {
  const className =
    status === "interested"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
      : status === "replied"
        ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"
        : status === "do_not_contact" || status === "not_interested"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "";
  return <Badge variant="outline" className={className}>{LINKEDIN_MEMBER_STATUS_LABEL[status]}</Badge>;
}

async function patchLinkedInMember(
  campaignId: string,
  memberId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(
    `/api/admin/marketing/linkedin/campaigns/${campaignId}/members/${memberId}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const result = await response.json();
  if (!response.ok) {
    throw new Error(typeof result.error === "string" ? result.error : "No se pudo guardar");
  }
}

function MemberOutreachMessages({
  campaignId,
  member,
  busy,
  onChanged,
}: {
  campaignId: string;
  member: MarketingLinkedInCampaignMember;
  busy: boolean;
  onChanged: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showAllSteps, setShowAllSteps] = useState(false);
  const primaryField = linkedInPrimaryOutreachField(member.status);
  const [messages, setMessages] = useState({
    connectionMessage: member.connectionMessage ?? "",
    message: member.message ?? "",
    followUpMessage: member.followUpMessage ?? "",
  });

  useEffect(() => {
    setMessages({
      connectionMessage: member.connectionMessage ?? "",
      message: member.message ?? "",
      followUpMessage: member.followUpMessage ?? "",
    });
  }, [
    member.id,
    member.updatedAt,
    member.connectionMessage,
    member.message,
    member.followUpMessage,
  ]);

  async function copyMessage(label: string, value: string) {
    if (!value.trim()) {
      toast({ title: `${label}: no hay texto para copiar`, variant: "destructive" });
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copiado` });
    } catch {
      toast({ title: "No se pudo copiar. Revisá el permiso del navegador.", variant: "destructive" });
    }
  }

  async function saveMessages() {
    setSaving(true);
    try {
      await patchLinkedInMember(campaignId, member.id, messages);
      toast({ title: "Mensaje guardado" });
      await onChanged();
    } catch (reason) {
      toast({
        title: reason instanceof Error ? reason.message : "No se pudo guardar",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function renderField(key: LinkedInOutreachFieldKey, rows: number, emphasized: boolean) {
    const label = LINKEDIN_OUTREACH_FIELD_LABEL[key];
    const value = messages[key];
    return (
      <div
        key={key}
        className={
          emphasized
            ? "space-y-2 rounded-md border border-primary/25 bg-background p-3 shadow-sm"
            : "space-y-2 rounded-md border bg-muted/10 p-3"
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor={`${member.id}-${key}`} className="text-sm font-medium">
              {label}
            </Label>
            {emphasized ? (
              <Badge variant="secondary" className="text-xs font-normal">
                Paso actual para LinkedIn
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{value.length} caracteres</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void copyMessage(label, value)}
            >
              <Clipboard className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Copiar
            </Button>
          </div>
        </div>
        <Textarea
          id={`${member.id}-${key}`}
          rows={rows}
          value={value}
          disabled={busy || saving}
          className="min-h-[8rem] w-full resize-y font-mono text-sm leading-relaxed"
          onChange={(event) => setMessages({ ...messages, [key]: event.target.value })}
        />
      </div>
    );
  }

  const secondaryFields = OUTREACH_FIELDS.filter((field) => field.key !== primaryField);

  return (
    <div className="space-y-3">
      {renderField(
        primaryField,
        OUTREACH_FIELDS.find((field) => field.key === primaryField)?.rows ?? 10,
        true,
      )}
      {secondaryFields.length > 0 ? (
        <div className="space-y-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground"
            onClick={() => setShowAllSteps((open) => !open)}
          >
            {showAllSteps ? "Ocultar otros pasos de la secuencia" : "Ver y editar conexión / seguimiento"}
          </Button>
          {showAllSteps
            ? secondaryFields.map((field) => renderField(field.key, field.rows, false))
            : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy || saving} onClick={() => void saveMessages()}>
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          Guardar mensaje
        </Button>
      </div>
    </div>
  );
}

function MemberManualPanel({
  campaignId,
  member,
  busy,
  onChanged,
}: {
  campaignId: string;
  member: MarketingLinkedInCampaignMember;
  busy: boolean;
  onChanged: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [recording, setRecording] = useState(false);
  const [action, setAction] = useState<MarketingLinkedInAction>("connection_sent");
  const [form, setForm] = useState({
    notes: member.notes ?? "",
    nextActionAt: toLocalDateTime(member.nextActionAt),
  });

  useEffect(() => {
    setForm({
      notes: member.notes ?? "",
      nextActionAt: toLocalDateTime(member.nextActionAt),
    });
  }, [member.id, member.updatedAt, member.notes, member.nextActionAt]);

  async function recordAction() {
    setRecording(true);
    try {
      const response = await fetch(
        `/api/admin/marketing/linkedin/campaigns/${campaignId}/members/${member.id}/actions`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            nextActionAt: toIsoDateTime(form.nextActionAt),
            notes: form.notes,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(typeof result.error === "string" ? result.error : "No se pudo registrar");
      }
      toast({ title: LINKEDIN_ACTION_LABEL[action].replace("Registrar ", "") });
      await onChanged();
    } catch (reason) {
      toast({ title: reason instanceof Error ? reason.message : "No se pudo registrar", variant: "destructive" });
    } finally {
      setRecording(false);
    }
  }

  async function saveMeta() {
    try {
      await patchLinkedInMember(campaignId, member.id, {
        notes: form.notes,
        nextActionAt: toIsoDateTime(form.nextActionAt),
      });
      toast({ title: "Notas y fecha guardadas" });
      await onChanged();
    } catch (reason) {
      toast({ title: reason instanceof Error ? reason.message : "No se pudo guardar", variant: "destructive" });
    }
  }

  return (
    <details className="rounded-md border border-dashed bg-muted/10">
      <summary className="cursor-pointer px-3 py-2 text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Notas, próxima acción y registro manual
      </summary>
      <div className="space-y-4 border-t p-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`${member.id}-next-action`}>Próxima acción</Label>
            <Input
              id={`${member.id}-next-action`}
              type="datetime-local"
              value={form.nextActionAt}
              onChange={(event) => setForm({ ...form, nextActionAt: event.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Acción realizada</Label>
            <Select value={action} onValueChange={(value) => setAction(value as MarketingLinkedInAction)}>
              <SelectTrigger aria-label={`Acción para ${member.firstName || "contacto"}`}><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIONS.map((value) => (
                  <SelectItem key={value} value={value}>{LINKEDIN_ACTION_LABEL[value]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${member.id}-notes`}>Notas</Label>
          <Textarea
            id={`${member.id}-notes`}
            rows={3}
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void saveMeta()} disabled={busy || recording}>
            Guardar notas
          </Button>
          <Button type="button" size="sm" onClick={() => void recordAction()} disabled={busy || recording}>
            {recording && <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />}
            Registrar acción
          </Button>
        </div>
      </div>
    </details>
  );
}

export function LinkedInCampaignDetail({ campaignId }: { campaignId: string }) {
  const { toast } = useToast();
  async function copyOutreach(label: string, value: string) {
    if (!value.trim()) {
      toast({ title: `${label}: no hay texto para copiar`, variant: "destructive" });
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copiado` });
    } catch {
      toast({ title: "No se pudo copiar. Revisá el permiso del navegador.", variant: "destructive" });
    }
  }
  const [data, setData] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyMember, setBusyMember] = useState<string | null>(null);
  const [contactQuery, setContactQuery] = useState("");
  const [contactResults, setContactResults] = useState<ContactResult[]>([]);
  const [searchingContacts, setSearchingContacts] = useState(false);

  const sortedMembers = useMemo(
    () => (data ? sortLinkedInCampaignMembersForWork(data.members) : []),
    [data],
  );

  const workSummary = useMemo(() => {
    const counts = { todo: 0, pending: 0, waiting: 0, closed: 0 };
    for (const member of sortedMembers) {
      counts[linkedInWorkBucket(member.status)] += 1;
    }
    return counts;
  }, [sortedMembers]);

  const [form, setForm] = useState({
    name: "",
    description: "",
    status: "draft" as MarketingLinkedInCampaignStatus,
    countryCode: "",
    industryIds: "",
    useCaseIds: "",
    messageType: "multistep" as MarketingLinkedInMessageType,
    connectionMessage: "",
    message: "",
    followUpMessage: "",
    notes: "",
  });

  async function prepareMemberOnLinkedIn(member: MarketingLinkedInCampaignMember) {
    if (!data) return;
    const payload = buildLinkedInPreparePayload(member, data.campaign);
    if (!payload) {
      toast({
        title: "Sin acción para preparar",
        description: "Solo se puede cargar desde estados listos (invitación, mensaje o follow-up).",
        variant: "destructive",
      });
      return;
    }
    requestLinkedInExtensionPrepare(payload);
    toast({
      title: "Cargando en LinkedIn",
      description:
        "Si tenés la extensión Notificas activa, se abrirá el perfil con el mensaje. Vos hacés el envío final.",
    });
  }

  async function markMemberSent(member: MarketingLinkedInCampaignMember) {
    const action = linkedInCompleteActionForMember(member.status);
    if (!action) return;
    setBusyMember(member.id);
    try {
      const response = await fetch(
        `/api/admin/marketing/linkedin/campaigns/${campaignId}/members/${member.id}/actions`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "No se pudo registrar");
      toast({ title: "Acción registrada en el CRM" });
      await load();
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Error al registrar",
        variant: "destructive",
      });
    } finally {
      setBusyMember(null);
    }
  }

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/marketing/linkedin/campaigns/${campaignId}`, { credentials: "include" });
    const body = await response.json();
    if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "No se pudo cargar la campaña");
    setData(body);
    const campaign = body.campaign as MarketingLinkedInCampaign;
    setForm({
      name: campaign.name,
      description: campaign.description ?? "",
      status: campaign.status,
      countryCode: campaign.countryCode ?? "",
      industryIds: keysToText(campaign.industryIds),
      useCaseIds: keysToText(campaign.useCaseIds),
      messageType: campaign.messageType ?? "multistep",
      connectionMessage: campaign.connectionMessage ?? "",
      message: campaign.message ?? "",
      followUpMessage: campaign.followUpMessage ?? "",
      notes: campaign.notes ?? "",
    });
  }, [campaignId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void load()
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar la campaña");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [load]);

  useEffect(() => {
    if (contactQuery.trim().length < 2) {
      setContactResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearchingContacts(true);
      void fetch(`/api/admin/marketing/contacts?q=${encodeURIComponent(contactQuery.trim())}&limit=20`, {
        credentials: "include",
        signal: controller.signal,
      })
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok) throw new Error();
          setContactResults(body.contacts ?? []);
        })
        .catch(() => {
          if (!controller.signal.aborted) setContactResults([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchingContacts(false);
        });
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [contactQuery]);

  const existingContactIds = useMemo(
    () => new Set(data?.members.map((member) => member.contactId) ?? []),
    [data?.members],
  );

  async function saveCampaign() {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/marketing/linkedin/campaigns/${campaignId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          countryCode: form.countryCode || null,
          industryIds: textToKeys(form.industryIds),
          useCaseIds: textToKeys(form.useCaseIds),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "No se pudo guardar");
      toast({ title: "Campaña LinkedIn guardada" });
      await load();
    } catch (reason) {
      toast({ title: reason instanceof Error ? reason.message : "No se pudo guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function addContact(contactId: string) {
    setBusyMember(contactId);
    try {
      const response = await fetch(`/api/admin/marketing/linkedin/campaigns/${campaignId}/members`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "No se pudo agregar");
      toast({ title: "Prospecto agregado" });
      await load();
    } catch (reason) {
      toast({ title: reason instanceof Error ? reason.message : "No se pudo agregar", variant: "destructive" });
    } finally {
      setBusyMember(null);
    }
  }

  async function patchMember(memberId: string, body: Record<string, unknown>) {
    setBusyMember(memberId);
    try {
      const response = await fetch(`/api/admin/marketing/linkedin/campaigns/${campaignId}/members/${memberId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "No se pudo actualizar");
      await load();
    } catch (reason) {
      toast({ title: reason instanceof Error ? reason.message : "No se pudo actualizar", variant: "destructive" });
    } finally {
      setBusyMember(null);
    }
  }

  async function removeMember(memberId: string) {
    if (!window.confirm("¿Quitar este contacto de la campaña LinkedIn?")) return;
    setBusyMember(memberId);
    try {
      const response = await fetch(`/api/admin/marketing/linkedin/campaigns/${campaignId}/members/${memberId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "No se pudo quitar");
      toast({ title: "Contacto quitado de la campaña" });
      await load();
    } catch (reason) {
      toast({ title: reason instanceof Error ? reason.message : "No se pudo quitar", variant: "destructive" });
    } finally {
      setBusyMember(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <MarketingSubnav />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <MarketingSubnav />
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium text-destructive">No se pudo cargar la campaña LinkedIn</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const summaryTiles = [
    { label: "Prospectos", value: data.summary.total },
    { label: "Pendientes", value: data.summary.pending },
    { label: "Conexión enviada", value: data.summary.connectionSent },
    { label: "Conectados", value: data.summary.connected },
    { label: "Mensaje enviado", value: data.summary.messageSent },
    { label: "Respondieron", value: data.summary.replied },
    { label: "Interesados", value: data.summary.interested },
  ];

  return (
    <div className="space-y-6">
      <MarketingSubnav />
      <MarketingCampaignChannelTabs channel="linkedin" />
      <p className="text-sm">
        <Link href="/admin/marketing/linkedin/campanas" className="text-muted-foreground hover:text-foreground">
          ← Campañas LinkedIn
        </Link>
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold">{data.campaign.name}</h3>
            <Badge variant="outline">{LINKEDIN_CAMPAIGN_STATUS_LABEL[data.campaign.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {data.campaign.countryCode ? countryName(data.campaign.countryCode) : "Sin país definido"}
            {" · "}
            {LINKEDIN_MESSAGE_TYPE_LABEL[data.campaign.messageType ?? "multistep"]}
          </p>
        </div>
        <Button onClick={() => void saveCampaign()} disabled={saving}>
          {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
          Guardar campaña
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4 lg:grid-cols-7">
        {summaryTiles.map((item) => (
          <div key={item.label} className="bg-background px-3 py-3">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-4 rounded-lg border bg-background p-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="campaign-name">Nombre</Label>
          <Input id="campaign-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Estado</Label>
          <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as MarketingLinkedInCampaignStatus })}>
            <SelectTrigger aria-label="Estado de la campaña"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CAMPAIGN_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>{LINKEDIN_CAMPAIGN_STATUS_LABEL[value]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="campaign-description">Descripción</Label>
          <Textarea id="campaign-description" rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>País</Label>
          <Select value={form.countryCode || "none"} onValueChange={(value) => setForm({ ...form, countryCode: value === "none" ? "" : value })}>
            <SelectTrigger aria-label="País de la campaña"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin país definido</SelectItem>
              {MARKETING_COUNTRIES.map((country) => (
                <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Tipo de mensaje</Label>
          <Select value={form.messageType} onValueChange={(value) => setForm({ ...form, messageType: value as MarketingLinkedInMessageType })}>
            <SelectTrigger aria-label="Tipo de mensaje"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESSAGE_TYPES.map((value) => (
                <SelectItem key={value} value={value}>{LINKEDIN_MESSAGE_TYPE_LABEL[value]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="campaign-industries">Claves de industria</Label>
          <Input id="campaign-industries" value={form.industryIds} onChange={(event) => setForm({ ...form, industryIds: event.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="campaign-use-cases">Claves de caso de uso</Label>
          <Input id="campaign-use-cases" value={form.useCaseIds} onChange={(event) => setForm({ ...form, useCaseIds: event.target.value })} />
        </div>
        <div className="space-y-1 md:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="campaign-connection">Solicitud de conexión base</Label>
            <Button type="button" size="sm" variant="outline" onClick={() => void copyOutreach("Solicitud de conexión", form.connectionMessage)}>
              <Clipboard className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Copiar mensaje
            </Button>
          </div>
          <Textarea
            id="campaign-connection"
            rows={5}
            className="min-h-[6rem] w-full resize-y font-mono text-sm leading-relaxed"
            value={form.connectionMessage}
            onChange={(event) => setForm({ ...form, connectionMessage: event.target.value })}
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="campaign-message">Mensaje principal base</Label>
            <Button type="button" size="sm" variant="outline" onClick={() => void copyOutreach("Mensaje principal", form.message)}>
              <Clipboard className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Copiar mensaje
            </Button>
          </div>
          <Textarea
            id="campaign-message"
            rows={12}
            className="min-h-[12rem] w-full resize-y font-mono text-sm leading-relaxed"
            value={form.message}
            onChange={(event) => setForm({ ...form, message: event.target.value })}
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="campaign-follow-up">Seguimiento base</Label>
            <Button type="button" size="sm" variant="outline" onClick={() => void copyOutreach("Seguimiento", form.followUpMessage)}>
              <Clipboard className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Copiar mensaje
            </Button>
          </div>
          <Textarea
            id="campaign-follow-up"
            rows={8}
            className="min-h-[8rem] w-full resize-y font-mono text-sm leading-relaxed"
            value={form.followUpMessage}
            onChange={(event) => setForm({ ...form, followUpMessage: event.target.value })}
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="campaign-notes">Notas internas</Label>
          <Textarea id="campaign-notes" rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          <strong>Activa</strong> significa que la campaña está lista para trabajo manual. No envía mensajes ni solicitudes,
          y no ejecuta automatizaciones en LinkedIn.
        </p>
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Agregar contactos</h3>
          <p className="text-sm text-muted-foreground">Buscá contactos del CRM que tengan una URL de LinkedIn cargada.</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <Label htmlFor="contact-search">Buscar contacto</Label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="contact-search"
              value={contactQuery}
              onChange={(event) => setContactQuery(event.target.value)}
              className="pl-9"
              placeholder="Nombre, empresa, cargo o email"
            />
          </div>
          {searchingContacts && <p className="mt-2 text-sm text-muted-foreground">Buscando contactos…</p>}
          {!searchingContacts && contactQuery.trim().length >= 2 && contactResults.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">No hay contactos que coincidan.</p>
          )}
          {contactResults.length > 0 && (
            <ul className="mt-3 divide-y rounded-md border">
              {contactResults.map((contact) => {
                const added = existingContactIds.has(contact.id);
                const hasLinkedIn = Boolean(contact.linkedinUrl);
                return (
                  <li key={contact.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <Link href={`/admin/marketing/contactos/${contact.id}`} className="font-medium hover:underline">
                        {contact.name || contact.email || "Contacto sin nombre"}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {[contact.company, contact.title].filter(Boolean).join(" · ") || "Sin empresa ni cargo"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={added || !hasLinkedIn || busyMember !== null}
                      onClick={() => void addContact(contact.id)}
                    >
                      {busyMember === contact.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
                      {added ? "Agregado" : hasLinkedIn ? "Agregar" : "Sin LinkedIn"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Prospectos</h3>
          <p className="text-sm text-muted-foreground">
            {data.members.length} contactos ·{" "}
            <span className="font-medium text-foreground">{workSummary.todo} por enviar ahora</span>
            {workSummary.waiting ? ` · ${workSummary.waiting} en espera` : ""}
            {workSummary.pending ? ` · ${workSummary.pending} sin preparar` : ""}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Usá <strong>Cargar en LinkedIn</strong> desde esta campaña; la extensión prepara el mensaje. Registrá el
            envío acá o desde la extensión cuando lo hayas hecho manualmente en LinkedIn.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border bg-background">
          <Table className="min-w-[1280px]">
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>LinkedIn</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Última acción</TableHead>
                <TableHead>Próxima acción</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    Todavía no hay prospectos. Buscá un contacto arriba para agregarlo.
                  </TableCell>
                </TableRow>
              ) : sortedMembers.map((member, index) => {
                const bucket = linkedInWorkBucket(member.status);
                const prevBucket = index > 0 ? linkedInWorkBucket(sortedMembers[index - 1].status) : null;
                const canPrepare = Boolean(linkedInActionKindForStatus(member.status));
                const canMarkSent = Boolean(linkedInCompleteActionForMember(member.status));
                return (
                <Fragment key={member.id}>
                  {bucket !== prevBucket ? (
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={8} className="py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {WORK_BUCKET_LABEL[bucket]}
                      </TableCell>
                    </TableRow>
                  ) : null}
                  <TableRow className={memberRowClass(bucket)}>
                    <TableCell className="font-medium">{member.companyName || "—"}</TableCell>
                    <TableCell>
                      <Link href={`/admin/marketing/contactos/${member.contactId}`} className="hover:underline">
                        {member.firstName || "Ver contacto"}
                      </Link>
                    </TableCell>
                    <TableCell>{member.jobTitle || "—"}</TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <a href={member.linkedinUrl} target="_blank" rel="noopener noreferrer">
                          Abrir <ExternalLink className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <MemberStatusBadge status={member.status} />
                        <Select
                          value={member.status}
                          disabled={busyMember !== null}
                          onValueChange={(value) => void patchMember(member.id, { status: value })}
                        >
                          <SelectTrigger className="h-8 w-[190px]" aria-label={`Cambiar estado de ${member.firstName || "contacto"}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MEMBER_STATUSES.map((value) => (
                              <SelectItem key={value} value={value}>{LINKEDIN_MEMBER_STATUS_LABEL[value]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(latestLinkedInActionAt(member))}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(member.nextActionAt)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        {canPrepare ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={busyMember !== null}
                            onClick={() => void prepareMemberOnLinkedIn(member)}
                          >
                            Cargar en LinkedIn
                          </Button>
                        ) : null}
                        {canMarkSent ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={busyMember !== null}
                            onClick={() => void markMemberSent(member)}
                          >
                            Marcar enviado
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          aria-label={`Copiar mensaje de ${member.firstName || "contacto"}`}
                          onClick={() => void copyOutreach(
                            `Mensaje de ${member.firstName || "contacto"}`,
                            memberCopyText(member, data.campaign),
                          )}
                        >
                          <Clipboard className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                          Copiar
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Quitar a ${member.firstName || "contacto"}`}
                          disabled={busyMember !== null}
                          onClick={() => void removeMember(member.id)}
                        >
                          {busyMember === member.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Trash2 className="h-4 w-4 text-destructive" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow className="hover:bg-muted/5">
                    <TableCell colSpan={8} className="bg-muted/5 p-4">
                      <MemberOutreachMessages
                        campaignId={campaignId}
                        member={member}
                        busy={busyMember !== null}
                        onChanged={load}
                      />
                      <div className="mt-3">
                        <MemberManualPanel
                          campaignId={campaignId}
                          member={member}
                          busy={busyMember !== null}
                          onChanged={load}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
              })}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
