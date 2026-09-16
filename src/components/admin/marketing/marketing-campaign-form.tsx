"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { MarketingSubnav } from "./marketing-subnav";
import { MarketingListUpload } from "./marketing-list-upload";
import { MarketingRecipientPreview, type PreviewContact } from "./marketing-recipient-preview";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";

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
  const [listId, setListId] = useState("");
  const [lists, setLists] = useState<ListOption[] | null>(null);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [form, setForm] = useState({
    name: "",
    subject: "",
    htmlBody: "",
  });

  const namedLists = useMemo(() => (lists || []).filter((l) => !l.virtual), [lists]);

  async function refreshLists() {
    const res = await fetch("/api/admin/marketing/lists", { credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudieron cargar las listas");
    setLists(data.lists || []);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshLists();
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
    const timer = window.setTimeout(() => {
      setLoadingAudience(true);
      void (async () => {
        try {
          const res = await fetch(
            `/api/admin/marketing/recipients?listId=${encodeURIComponent(listId)}&stages=new,sent,opened,clicked,replied`,
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
  }, [listId, toast]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!listId) {
      toast({ title: "Cargá un CSV de destinatarios o elegí una lista", variant: "destructive" });
      return;
    }
    if (!form.htmlBody.trim()) {
      toast({ title: "Escribí el texto del correo", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/marketing/campaigns", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          listId,
          includeStages: ["new", "sent", "opened", "clicked", "replied"],
        }),
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
      <form onSubmit={onSubmit} className="max-w-3xl space-y-5 rounded-lg border bg-background p-4">
        <div className="space-y-1">
          <Label htmlFor="camp-name">Nombre interno</Label>
          <Input id="camp-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Chile — intro marzo" />
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Destinatarios</p>
            <p className="text-sm text-muted-foreground">Subí el CSV acá. No se mandan contactos viejos del CRM si no están en esta lista.</p>
          </div>
          <MarketingListUpload
            defaultName={form.name}
            onImported={(list) => {
              setListId(list.listId);
              void refreshLists().catch(() => undefined);
            }}
          />
          {namedLists.length ? (
            <div className="space-y-1">
              <Label>O usar una lista ya cargada</Label>
              <Select value={listId || undefined} onValueChange={setListId}>
                <SelectTrigger><SelectValue placeholder="Ninguna todavía" /></SelectTrigger>
                <SelectContent>
                  {namedLists.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} ({l.contactCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {loadingAudience ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Leyendo destinatarios…
            </p>
          ) : listId && audience ? (
            <MarketingRecipientPreview
              contacts={audience.contacts}
              total={audience.total}
              eligible={audience.eligible}
              skipped={audience.skipped}
              emptyHint="Esa lista no tiene contactos enviables."
            />
          ) : (
            <p className="text-sm text-muted-foreground">Todavía no hay destinatarios en esta campaña.</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="camp-subj">Asunto</Label>
          <Input id="camp-subj" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Notificas para {{empresa}}" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="camp-body">Texto del correo</Label>
          <Textarea
            id="camp-body"
            required
            rows={14}
            value={form.htmlBody}
            onChange={(e) => setForm({ ...form, htmlBody: e.target.value })}
            placeholder={"Hola {{nombre}},\n\nTe escribo desde Notificas…\n\nVariables: {{nombre}} {{empresa}} {{pais}} {{cargo}} {{email}}"}
            className="font-sans text-sm"
          />
          <p className="text-sm text-muted-foreground">Podés pegar HTML o texto. Variables: {"{{nombre}} {{empresa}} {{pais}} {{cargo}} {{email}}"}</p>
        </div>
        <Button type="submit" disabled={saving || !listId}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar borrador"}
        </Button>
      </form>
    </div>
  );
}
