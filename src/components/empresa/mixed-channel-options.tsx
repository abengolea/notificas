"use client";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import {
  effectiveMixedDeliveryMode,
  type MixedDeliveryMode,
} from "@/lib/campaign-mixed-message";
import { usesNotificasDefaultTemplate } from "@/lib/wa-template-fields";

type OptionCopy = {
  value: MixedDeliveryMode;
  title: string;
  badge?: string;
  email: string;
  whatsapp: string;
  note: string;
};

/** Textos de las tres opciones. Una sola fuente: el selector y los resúmenes dicen lo mismo. */
export const MIXED_MODE_OPTIONS: OptionCopy[] = [
  {
    value: "reader_both",
    title: "Los dos llevan el enlace al lector",
    badge: "Recomendada",
    email: "Aviso con botón que abre el lector, donde está la carta certificada.",
    whatsapp: "La plantilla de Meta con el enlace al mismo lector.",
    note: "Queda registrado quién abrió y leyó, entre el correo y WhatsApp.",
  },
  {
    value: "same_text",
    title: "Mismo texto en los dos, sin lector",
    email: "El texto completo de la plantilla de Meta, igual al de WhatsApp. Sin enlace al lector.",
    whatsapp: "La plantilla de Meta con su propio enlace (pago, portal o web de la empresa).",
    note: "No hay lector: de la lectura solo informa Meta en WhatsApp. No admite adjuntos.",
  },
  {
    value: "email_text_wa_reader",
    title: "Correo con el texto, WhatsApp con el lector",
    email: "El texto completo en el cuerpo del correo. Sin enlace al lector.",
    whatsapp: "La plantilla de Meta con el enlace al lector.",
    note: "El lector solo se abre desde WhatsApp. El correo no registra lectura.",
  },
];

export function MixedChannelOptions({
  templateName,
  mode,
  onModeChange,
  forceChoices = false,
}: {
  templateName?: string;
  mode: MixedDeliveryMode;
  onModeChange: (next: MixedDeliveryMode) => void;
  /** En el paso Canal todavía no hay plantilla: igual hay que elegir cómo viaja cada canal. */
  forceChoices?: boolean;
}) {
  const usingDefault = !forceChoices && usesNotificasDefaultTemplate(templateName);
  const selected = effectiveMixedDeliveryMode(mode, usingDefault);

  return (
    <div className="rounded-md border bg-muted/40 p-3 space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">Campaña mixta: ¿qué recibe cada canal?</p>
        <p className="text-xs text-muted-foreground">
          Elegí cómo llega el mensaje por correo y por WhatsApp. El lector es la página donde la persona abre la
          carta certificada.
        </p>
      </div>
      <RadioGroup
        value={selected}
        onValueChange={(v) => onModeChange(v as MixedDeliveryMode)}
        className="grid gap-3"
      >
        {MIXED_MODE_OPTIONS.map((opt) => {
          const disabled = usingDefault && opt.value === "same_text";
          const checked = selected === opt.value;
          return (
            <label
              key={opt.value}
              className={cn(
                "flex items-start gap-3 rounded-md border bg-background p-3",
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                checked ? "border-primary ring-1 ring-primary" : "border-border"
              )}
            >
              <RadioGroupItem value={opt.value} disabled={disabled} className="mt-1" />
              <span className="space-y-1.5">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {opt.title}
                  {opt.badge ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      {opt.badge}
                    </span>
                  ) : null}
                </span>
                <span className="block text-xs text-muted-foreground">
                  <strong className="text-foreground">Correo:</strong> {opt.email}
                </span>
                <span className="block text-xs text-muted-foreground">
                  <strong className="text-foreground">WhatsApp:</strong> {opt.whatsapp}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {disabled ? "Necesita una plantilla propia de la empresa; con el sobre de Notificas no está disponible." : opt.note}
                </span>
              </span>
            </label>
          );
        })}
      </RadioGroup>
      {usingDefault ? (
        <p className="text-xs text-muted-foreground">
          Con el sobre de Notificas, WhatsApp siempre lleva el enlace al lector.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Si el botón de la plantilla de Meta apunta a otra web y no a Notificas, elegí la segunda opción.
        </p>
      )}
    </div>
  );
}
