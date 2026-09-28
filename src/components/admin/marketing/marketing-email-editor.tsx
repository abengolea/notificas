"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { MarketingEmailPreview } from "./marketing-email-preview";
import type { PreviewContact } from "./marketing-recipient-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  audienceRecipient,
  audienceContacts,
  selectedContactId,
  onSelectContact,
  unsavedCopy,
}: {
  value: CampaignEmailContent;
  onChange: (next: CampaignEmailContent) => void;
  subject: string;
  onSubjectChange: (value: string) => void;
  campaignId?: string;
  onTestResult?: (ok: boolean, message: string) => void;
  audienceRecipient?: PreviewContact | null;
  audienceContacts?: PreviewContact[];
  selectedContactId?: string | null;
  onSelectContact?: (id: string) => void;
  unsavedCopy?: boolean;
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
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.95fr)] xl:items-start">
      <div className="space-y-2.5">
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
          <p className="text-[11px] text-muted-foreground">Sin nombre queda {"Hola,"}.</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="camp-paragraphs">Párrafos</Label>
          <Textarea
            id="camp-paragraphs"
            required
            rows={7}
            value={paragraphsToText(value.paragraphs)}
            onChange={(e) => onChange({ ...value, paragraphs: textToParagraphs(e.target.value) })}
            className="font-sans text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Párrafos: línea vacía entre bloques. {MERGE_FIELD_HINT}
          </p>
        </div>
        <Collapsible>
          <CollapsibleTrigger className="flex w-full items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted/40">
            <ChevronDown className="size-3.5" />
            Casos de uso, botón y pie legal
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="camp-benefits" className="text-xs">
                  Casos de uso
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto px-2 py-0.5 text-xs"
                  onClick={() => onChange({ ...value, benefits: OILFIELD_USE_CASES })}
                >
                  Vaca Muerta
                </Button>
              </div>
              <Textarea
                id="camp-benefits"
                rows={4}
                value={benefitsToText(value.benefits)}
                onChange={(e) => onChange({ ...value, benefits: textToBenefits(e.target.value) })}
                className="font-sans text-sm"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="camp-cta" className="text-xs">
                  Botón
                </Label>
                <Input id="camp-cta" value={value.callToActionLabel || ""} onChange={(e) => onChange({ ...value, callToActionLabel: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="camp-cta-url" className="text-xs">
                  URL del botón
                </Label>
                <Input id="camp-cta-url" value={value.callToActionUrl || ""} onChange={(e) => onChange({ ...value, callToActionUrl: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="camp-why" className="text-xs">
                Por qué recibió este correo
              </Label>
              <Textarea id="camp-why" rows={2} value={value.receivedWhy || ""} onChange={(e) => onChange({ ...value, receivedWhy: e.target.value })} className="font-sans text-sm" />
            </div>
          </CollapsibleContent>
        </Collapsible>
        <Collapsible>
          <CollapsibleTrigger className="flex w-full items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted/40">
            <ChevronDown className="size-3.5" />
            Enviar prueba a mi correo
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label="Dirección de prueba"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              type="email"
              className="h-8 text-sm"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => void sendTest()} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar prueba"}
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </div>
      <div className="xl:sticky xl:top-3 xl:max-h-[calc(100vh-1.5rem)] xl:overflow-y-auto">
        <MarketingEmailPreview
          content={value.title.trim() ? value : { ...blankCampaignEmailContent(), ...value, title: value.title || "Notificas" }}
          subject={subject}
          audienceRecipient={audienceRecipient}
          audienceContacts={audienceContacts}
          selectedContactId={selectedContactId}
          onSelectContact={onSelectContact}
          unsavedCopy={unsavedCopy}
        />
      </div>
    </div>
  );
}
