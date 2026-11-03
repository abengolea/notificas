"use client";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { usesNotificasDefaultTemplate } from "@/lib/wa-template-fields";

export function MixedChannelOptions({
  templateName,
  urlButton,
  onUrlButtonChange,
  forceChoices = false,
}: {
  templateName?: string;
  urlButton: boolean;
  onUrlButtonChange: (next: boolean) => void;
  /** En el paso Canal todavía no hay plantilla: igual hay que elegir el enlace de WhatsApp. */
  forceChoices?: boolean;
}) {
  const usingDefault = !forceChoices && usesNotificasDefaultTemplate(templateName);

  return (
    <div className="rounded-md border bg-muted/40 p-3 space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">Campaña mixta</p>
        <p className="text-xs text-muted-foreground">
          El correo siempre es un aviso con enlace al lector (la carta certificada). WhatsApp lleva la
          plantilla de la empresa.
        </p>
      </div>
      {usingDefault ? (
        <p className="text-xs text-muted-foreground">
          Con el sobre de Notificas, WhatsApp también lleva el enlace al lector.
        </p>
      ) : (
        <RadioGroup
          value={urlButton ? "reader" : "template"}
          onValueChange={(v) => onUrlButtonChange(v === "reader")}
          className="grid gap-3 sm:grid-cols-2"
        >
          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border bg-background p-3",
              !urlButton ? "border-primary ring-1 ring-primary" : "border-border"
            )}
          >
            <RadioGroupItem value="template" className="mt-1" />
            <span>
              <span className="block text-sm font-medium">Enlace de la plantilla</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Pago, portal o web de la empresa. Meta informa si llegó y si se leyó el globo. No abre el
                lector.
              </span>
            </span>
          </label>
          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border bg-background p-3",
              urlButton ? "border-primary ring-1 ring-primary" : "border-border"
            )}
          >
            <RadioGroupItem value="reader" className="mt-1" />
            <span>
              <span className="block text-sm font-medium">Mismo lector que el correo</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Solo si el botón URL de Meta apunta a Notificas. Si va a otra web, no elijas esto.
              </span>
            </span>
          </label>
        </RadioGroup>
      )}
    </div>
  );
}
