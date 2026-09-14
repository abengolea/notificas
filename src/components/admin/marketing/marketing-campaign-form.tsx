"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { MarketingSubnav } from "./marketing-subnav";
import { MARKETING_COUNTRIES } from "@/lib/marketing/countries";
import { PIPELINE_STAGES, STAGE_LABEL } from "@/lib/marketing/stages";
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

const SAMPLE = `<p>Hola {{nombre}},</p>
<p>Te escribo desde Notificas. Ayudamos a empresas en {{pais}} a dejar constancia fehaciente de correos y WhatsApp.</p>
<p>¿Tenés 15 minutos esta semana para ver si les sirve?</p>
<p>Adrian Bengolea</p>`;

export function MarketingCampaignForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [include, setInclude] = useState<string[]>(["new"]);
  const [form, setForm] = useState({
    name: "",
    country: "AR",
    subject: "",
    htmlBody: SAMPLE,
  });

  function toggleStage(stage: string) {
    setInclude((prev) => (prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/marketing/campaigns", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, includeStages: include }),
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
            <Label>País</Label>
            <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {MARKETING_COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="camp-subj">Asunto</Label>
          <Input id="camp-subj" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="{{empresa}} y las notificaciones fehacientes" />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">A quién incluir</legend>
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
        <div className="space-y-1">
          <Label htmlFor="camp-body">Cuerpo (HTML o texto). Variables: {"{{nombre}} {{empresa}} {{pais}} {{cargo}} {{email}}"}</Label>
          <Textarea id="camp-body" required rows={14} value={form.htmlBody} onChange={(e) => setForm({ ...form, htmlBody: e.target.value })} className="font-mono text-sm" />
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar borrador"}
        </Button>
      </form>
    </div>
  );
}
