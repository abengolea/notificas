"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { MarketingSubnav } from "./marketing-subnav";
import { MarketingRecipientPreview, type PreviewContact } from "./marketing-recipient-preview";
import { PIPELINE_STAGES, STAGE_LABEL } from "@/lib/marketing/stages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const SAMPLE = `<p>Hola {{nombre}},</p>
<p>Te escribo desde Notificas. Ayudamos a empresas en {{pais}} a dejar constancia fehaciente de correos y WhatsApp.</p>
<p>¿Tenés 15 minutos esta semana para ver si les sirve?</p>
<p>Adrian Bengolea</p>`;

type ListOption = {
  id: string;
  name: string;
  contactCount: number;
  virtual?: boolean;
};

type Audience = {
  total: number;
  eligible: number;
  skipped: number;
  contacts: PreviewContact[];
};

export function MarketingCampaignForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [include, setInclude] = useState<string[]>(["new"]);
  const [listId, setListId] = useState("");
  const [lists, setLists] = useState<ListOption[] | null>(null);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [form, setForm] = useState({
    name: "",
    subject: "",
    htmlBody: SAMPLE,
  });

  const namedLists = useMemo(() => (lists || []).filter((l) => !l.virtual), [lists]);
  const virtualLists = useMemo(() => (lists || []).filter((l) => l.virtual), [lists]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/marketing/lists", { credentials: "include" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudieron cargar las listas");
        if (!cancelled) setLists(data.lists || []);
      } catch (e) {
        if (!cancelled) {
          setLists([]);
          toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    if (!listId) {
      setAudience(null);
      return;
    }
    const controller = new AbortController();
    const stages = include.join(",");
    const timer = window.setTimeout(() => {
      setLoadingAudience(true);
      void (async () => {
        try {
          const res = await fetch(
            `/api/admin/marketing/recipients?listId=${encodeURIComponent(listId)}&stages=${encodeURIComponent(stages)}`,
            { credentials: "include", signal: controller.signal },
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "No se pudo armar la lista");
          setAudience(data);
        } catch (e) {
          if (controller.signal.aborted) return;
          toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
        } finally {
          if (!controller.signal.aborted) setLoadingAudience(false);
        }
      })();
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [listId, include, toast]);

  function toggleStage(stage: string) {
    setInclude((prev) => (prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!listId) {
      toast({ title: "Elegí a quién se lo mandamos", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/marketing/campaigns", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, listId, includeStages: include }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "No se pudo crear");
      router.push(`/admin/marketing/campanas/${data.campaign.id}`);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Error", variant: "destructive" });
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <MarketingSubnav />
      <form onSubmit={onSubmit} className="max-w-3xl space-y-4 rounded-lg border bg-background p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="camp-name">Nombre interno</Label>
            <Input id="camp-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Chile — intro marzo" />
          </div>
          <div className="space-y-1">
            <Label>Lista de destinatarios</Label>
            <Select value={listId || undefined} onValueChange={setListId}>
              <SelectTrigger><SelectValue placeholder="Elegí una lista precargada" /></SelectTrigger>
              <SelectContent>
                {namedLists.length ? (
                  <SelectGroup>
                    <SelectLabel>Listas cargadas</SelectLabel>
                    {namedLists.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name} ({l.contactCount})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
                {virtualLists.length ? (
                  <SelectGroup>
                    <SelectLabel>Por país</SelectLabel>
                    {virtualLists.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name} ({l.contactCount})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
              </SelectContent>
            </Select>
            {lists && lists.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay contactos.{" "}
                <Link href="/admin/marketing/contactos" className="underline underline-offset-2">
                  Cargá un CSV y nombrá la lista
                </Link>
                .
              </p>
            ) : null}
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="camp-subj">Asunto</Label>
          <Input id="camp-subj" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="{{empresa}} y las notificaciones fehacientes" />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">A quién incluir de esa lista</legend>
          <div className="flex flex-wrap gap-3">
            {PIPELINE_STAGES.filter((s) => s !== "queued").map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={include.includes(s)}
                  onChange={() => toggleStage(s)}
                />
                {STAGE_LABEL[s]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-2">
          <p className="text-sm font-medium">Destinatarios de este envío</p>
          {loadingAudience ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Armando la lista…
            </p>
          ) : listId && audience ? (
            <MarketingRecipientPreview
              contacts={audience.contacts}
              total={audience.total}
              eligible={audience.eligible}
              skipped={audience.skipped}
              emptyHint="Esa lista no tiene contactos enviables con las etapas elegidas."
            />
          ) : (
            <p className="text-sm text-muted-foreground">Elegí una lista para ver a quién le va a llegar.</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="camp-body">Cuerpo (HTML o texto). Variables: {"{{nombre}} {{empresa}} {{pais}} {{cargo}} {{email}}"}</Label>
          <Textarea id="camp-body" required rows={14} value={form.htmlBody} onChange={(e) => setForm({ ...form, htmlBody: e.target.value })} className="font-mono text-sm" />
        </div>
        <Button type="submit" disabled={saving || !listId}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar borrador"}
        </Button>
      </form>
    </div>
  );
}
