"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { MarketingSubnav } from "./marketing-subnav";
import { StageBadge } from "./stage-badge";
import { MARKETING_COUNTRIES } from "@/lib/marketing/countries";
import { MARKETING_STAGES, STAGE_LABEL } from "@/lib/marketing/stages";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type Detail = {
  contact: {
    id: string;
    email: string;
    name: string;
    company: string;
    title: string;
    country: string;
    notes: string;
    stage: string;
  };
  sends: Array<{
    id: string;
    campaignId: string;
    subject: string;
    status: string;
    sentAt: string | null;
    openedAt: string | null;
    repliedAt: string | null;
    replySnippet: string | null;
    lastError: string | null;
  }>;
  events: Array<{ id: string; type: string; at: string }>;
};

export function MarketingContactDetail({ contactId }: { contactId: string }) {
  const { toast } = useToast();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/marketing/contacts/${contactId}`, { credentials: "include" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Error");
      setData(body);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/marketing/contacts/${contactId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.contact),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "No se pudo guardar");
      setData((prev) => (prev ? { ...prev, contact: body.contact } : prev));
      toast({ title: "Guardado" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <MarketingSubnav />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const c = data.contact;

  return (
    <div className="space-y-6">
      <MarketingSubnav />
      <p className="text-sm">
        <Link href="/admin/marketing/contactos" className="text-muted-foreground hover:text-foreground">
          ← Contactos
        </Link>
      </p>
      <form onSubmit={save} className="grid gap-4 rounded-lg border bg-background p-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Empresa</Label>
          <Input value={c.company} onChange={(e) => setData({ ...data, contact: { ...c, company: e.target.value } })} />
        </div>
        <div className="space-y-1">
          <Label>Nombre</Label>
          <Input value={c.name} onChange={(e) => setData({ ...data, contact: { ...c, name: e.target.value } })} />
        </div>
        <div className="space-y-1">
          <Label>Email</Label>
          <Input value={c.email} disabled />
        </div>
        <div className="space-y-1">
          <Label>Cargo</Label>
          <Input value={c.title} onChange={(e) => setData({ ...data, contact: { ...c, title: e.target.value } })} />
        </div>
        <div className="space-y-1">
          <Label>País</Label>
          <Select value={c.country} onValueChange={(v) => setData({ ...data, contact: { ...c, country: v } })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MARKETING_COUNTRIES.map((co) => (
                <SelectItem key={co.code} value={co.code}>{co.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Etapa</Label>
          <Select value={c.stage} onValueChange={(v) => setData({ ...data, contact: { ...c, stage: v } })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MARKETING_STAGES.map((s) => (
                <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 space-y-1">
          <Label>Notas</Label>
          <Textarea rows={4} value={c.notes || ""} onChange={(e) => setData({ ...data, contact: { ...c, notes: e.target.value } })} />
        </div>
        <div>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar ficha"}
          </Button>
        </div>
      </form>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Envíos</h3>
        {data.sends.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no recibió campañas de marketing.</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-background">
            {data.sends.map((s) => (
              <li key={s.id} className="px-4 py-3 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/admin/marketing/campanas/${s.campaignId}`} className="font-medium hover:underline">
                    {s.subject || "Campaña"}
                  </Link>
                  <StageBadge stage={s.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {s.sentAt ? `Enviado ${new Date(s.sentAt).toLocaleString("es-AR")}` : "En cola"}
                  {s.openedAt ? ` · abierto ${new Date(s.openedAt).toLocaleString("es-AR")}` : ""}
                  {s.repliedAt ? ` · respondió ${new Date(s.repliedAt).toLocaleString("es-AR")}` : ""}
                </p>
                {s.replySnippet ? <p className="text-sm">{s.replySnippet}</p> : null}
                {s.lastError ? <p className="text-sm text-destructive">{s.lastError}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
