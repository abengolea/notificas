"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { MarketingEmailPreview } from "./marketing-email-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  benefitsToText,
  blankCampaignEmailContent,
  OILFIELD_USE_CASES,
  paragraphsToText,
  textToBenefits,
  textToParagraphs,
  type CampaignEmailContent,
} from "@/lib/marketing/campaign-email";
import { MARKETING_TEST_EMAIL_DEFAULT } from "@/lib/marketing/types";
import { MERGE_FIELD_HINT } from "@/lib/marketing/merge-fields";

export function MarketingEmailEditor({
  value,
  onChange,
  subject,
  onSubjectChange,
  campaignId,
  onTestResult,
}: {
  value: CampaignEmailContent;
  onChange: (next: CampaignEmailContent) => void;
  subject: string;
  onSubjectChange: (value: string) => void;
  campaignId?: string;
  onTestResult?: (ok: boolean, message: string) => void;
}) {
  const [testTo, setTestTo] = useState(MARKETING_TEST_EMAIL_DEFAULT);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/marketing/preview-send", { credentials: "include" });
        const data = await res.json();
        if (!cancelled && res.ok && typeof data.to === "string") setTestTo(data.to);
      } catch {
        /* keep default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function sendTest() {
    if (!value.title.trim() || paragraphsToText(value.paragraphs).trim().length < 8) {
      onTestResult?.(false, "Completá título y párrafos antes de enviar una prueba");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/admin/marketing/preview-send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: testTo,
          subject: subject.trim(),
          campaignId,
          emailContent: value,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "No se pudo enviar la prueba");
      onTestResult?.(true, `Prueba enviada a ${data.to}. La campaña no se envió.`);
    } catch (e) {
      onTestResult?.(false, e instanceof Error ? e.message : "No se pudo enviar la prueba");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="camp-subj">Asunto</Label>
          <Input id="camp-subj" required value={subject} onChange={(e) => onSubjectChange(e.target.value)} placeholder="Notificas para {{empresa}}" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="camp-preheader">Preheader</Label>
          <Input id="camp-preheader" value={value.preheader || ""} onChange={(e) => onChange({ ...value, preheader: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="camp-eyebrow">Categoría</Label>
          <Input id="camp-eyebrow" value={value.eyebrow || ""} onChange={(e) => onChange({ ...value, eyebrow: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="camp-title">Título</Label>
          <Input id="camp-title" required value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="camp-intro">Bajada / saludo</Label>
          <Input id="camp-intro" value={value.introduction || ""} onChange={(e) => onChange({ ...value, introduction: e.target.value })} placeholder="Hola {{firstName}}," />
          <p className="text-sm text-muted-foreground">
            Si falta el nombre, {"Hola {{firstName}},"} queda {"Hola,"}.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="camp-paragraphs">Párrafos</Label>
          <Textarea
            id="camp-paragraphs"
            required
            rows={10}
            value={paragraphsToText(value.paragraphs)}
            onChange={(e) => onChange({ ...value, paragraphs: textToParagraphs(e.target.value) })}
            className="font-sans text-sm"
          />
          <p className="text-sm text-muted-foreground">
            Separá párrafos con una línea vacía. Variables: {MERGE_FIELD_HINT}
          </p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="camp-benefits">Casos de uso</Label>
            <Button
              type="button"
              variant="ghost"
              className="h-auto px-2 py-1 text-sm"
              onClick={() => onChange({ ...value, benefits: OILFIELD_USE_CASES })}
            >
              Usar casos Vaca Muerta
            </Button>
          </div>
          <Textarea
            id="camp-benefits"
            rows={7}
            value={benefitsToText(value.benefits)}
            onChange={(e) => onChange({ ...value, benefits: textToBenefits(e.target.value) })}
            className="font-sans text-sm"
          />
          <p className="text-sm text-muted-foreground">Un caso por línea.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="camp-cta">Botón</Label>
            <Input id="camp-cta" value={value.callToActionLabel || ""} onChange={(e) => onChange({ ...value, callToActionLabel: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="camp-cta-url">URL del botón</Label>
            <Input id="camp-cta-url" value={value.callToActionUrl || ""} onChange={(e) => onChange({ ...value, callToActionUrl: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="camp-why">Por qué recibió este correo</Label>
          <Textarea id="camp-why" rows={2} value={value.receivedWhy || ""} onChange={(e) => onChange({ ...value, receivedWhy: e.target.value })} className="font-sans text-sm" />
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-sm font-medium">Enviar prueba</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Esto no envía la campaña. El correo de prueba usa el mismo HTML institucional y llega a la dirección indicada.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label="Dirección de prueba"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              type="email"
            />
            <Button type="button" variant="outline" onClick={() => void sendTest()} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar prueba"}
            </Button>
          </div>
        </div>
      </div>
      <MarketingEmailPreview content={value.title.trim() ? value : { ...blankCampaignEmailContent(), ...value, title: value.title || "Notificas" }} />
    </div>
  );
}
