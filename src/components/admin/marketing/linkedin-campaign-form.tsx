"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info, Loader2 } from "lucide-react";
import { MarketingSubnav } from "./marketing-subnav";
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
import { Textarea } from "@/components/ui/textarea";
import { MARKETING_COUNTRIES } from "@/lib/marketing/countries";
import { LINKEDIN_MESSAGE_TYPE_LABEL } from "@/lib/marketing/linkedin-ui";
import type { MarketingLinkedInMessageType } from "@/lib/marketing/domain/types";
import { useToast } from "@/hooks/use-toast";

const MESSAGE_TYPES = Object.keys(LINKEDIN_MESSAGE_TYPE_LABEL) as MarketingLinkedInMessageType[];

function keysFromText(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

export function LinkedInCampaignForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    countryCode: "",
    industryIds: "",
    useCaseIds: "",
    messageType: "multistep" as MarketingLinkedInMessageType,
    connectionMessage: "",
    message: "",
    followUpMessage: "",
    notes: "",
  });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/admin/marketing/linkedin/campaigns", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          countryCode: form.countryCode || undefined,
          industryIds: keysFromText(form.industryIds),
          useCaseIds: keysFromText(form.useCaseIds),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "No se pudo crear la campaña");
      }
      toast({ title: "Campaña LinkedIn creada como borrador" });
      router.push(`/admin/marketing/linkedin/campanas/${body.campaign.id}`);
    } catch (reason) {
      toast({
        title: reason instanceof Error ? reason.message : "No se pudo crear la campaña",
        variant: "destructive",
      });
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <MarketingSubnav />
      <p className="text-sm">
        <Link href="/admin/marketing/linkedin/campanas" className="text-muted-foreground hover:text-foreground">
          ← Campañas LinkedIn
        </Link>
      </p>
      <form onSubmit={submit} className="max-w-5xl space-y-6">
        <div className="rounded-lg border bg-background p-4">
          <h3 className="font-semibold">Nueva campaña LinkedIn</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Definí el segmento y los textos de referencia. La campaña se guarda como borrador.
          </p>
        </div>

        <div className="grid gap-4 rounded-lg border bg-background p-4 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="linkedin-name">Nombre *</Label>
            <Input
              id="linkedin-name"
              required
              minLength={2}
              maxLength={160}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Argentina — estudios jurídicos"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="linkedin-description">Descripción</Label>
            <Textarea
              id="linkedin-description"
              rows={3}
              maxLength={4000}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Objetivo y criterio de esta campaña"
            />
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
            <Label htmlFor="linkedin-industries">Claves de industria</Label>
            <Input
              id="linkedin-industries"
              value={form.industryIds}
              onChange={(event) => setForm({ ...form, industryIds: event.target.value })}
              placeholder="legal, seguros"
            />
            <p className="text-xs text-muted-foreground">Separadas por coma.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="linkedin-use-cases">Claves de caso de uso</Label>
            <Input
              id="linkedin-use-cases"
              value={form.useCaseIds}
              onChange={(event) => setForm({ ...form, useCaseIds: event.target.value })}
              placeholder="intimaciones, cobranzas"
            />
            <p className="text-xs text-muted-foreground">Separadas por coma.</p>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border bg-background p-4">
          <div>
            <h3 className="font-semibold">Mensajes base</h3>
            <p className="text-sm text-muted-foreground">
              Se copian como referencia al agregar prospectos y luego se pueden personalizar por contacto.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="linkedin-connection-message">Solicitud de conexión</Label>
            <Textarea
              id="linkedin-connection-message"
              rows={4}
              maxLength={3000}
              value={form.connectionMessage}
              onChange={(event) => setForm({ ...form, connectionMessage: event.target.value })}
              placeholder="Hola {{nombre}}, me gustaría sumar tu contacto…"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="linkedin-message">Mensaje principal</Label>
            <Textarea
              id="linkedin-message"
              rows={5}
              maxLength={8000}
              value={form.message}
              onChange={(event) => setForm({ ...form, message: event.target.value })}
              placeholder="Gracias por conectar…"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="linkedin-follow-up">Seguimiento</Label>
            <Textarea
              id="linkedin-follow-up"
              rows={5}
              maxLength={8000}
              value={form.followUpMessage}
              onChange={(event) => setForm({ ...form, followUpMessage: event.target.value })}
              placeholder="Retomo el mensaje anterior…"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="linkedin-notes">Notas internas</Label>
            <Textarea
              id="linkedin-notes"
              rows={3}
              maxLength={8000}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Al cambiarla a <strong>Activa</strong>, la campaña solo habilita el trabajo manual y el registro de acciones.
            No se envía ningún mensaje ni solicitud de conexión.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving || form.name.trim().length < 2}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
            Guardar borrador
          </Button>
          <Button type="button" variant="outline" asChild disabled={saving}>
            <Link href="/admin/marketing/linkedin/campanas">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
