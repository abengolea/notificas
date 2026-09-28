"use client";

import { useMemo } from "react";
import {
  applyCampaignMergeFields,
  mergeFieldsForCampaignRecipient,
  previewCampaignEmail,
  type CampaignEmailContent,
} from "@/lib/marketing/campaign-email";
import { countryName } from "@/lib/marketing/countries";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PreviewContact } from "./marketing-recipient-preview";

function recipientLabel(c: PreviewContact): string {
  const parts = [c.name || "Sin nombre", c.company, c.email].filter(Boolean);
  return parts.join(" · ");
}

export function MarketingExactRecipientMessage({
  subject,
  emailContent,
  contacts,
  selectedContactId,
  onSelectedContactIdChange,
}: {
  subject: string;
  emailContent: CampaignEmailContent;
  contacts: PreviewContact[];
  selectedContactId: string | null;
  onSelectedContactIdChange: (id: string) => void;
}) {
  const eligible = useMemo(() => contacts.filter((c) => c.eligible), [contacts]);
  const selected =
    eligible.find((c) => c.id === selectedContactId) ?? eligible[0] ?? null;

  const fields = useMemo(
    () => (selected ? mergeFieldsForCampaignRecipient(selected) : null),
    [selected],
  );

  const mergedSubject = useMemo(
    () => (fields ? applyCampaignMergeFields(subject, fields) : ""),
    [subject, fields],
  );

  const preview = useMemo(
    () => (fields ? previewCampaignEmail(emailContent, fields) : null),
    [emailContent, fields],
  );

  if (eligible.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border bg-background p-4">
      <div>
        <h4 className="text-sm font-medium">Mensaje exacto por destinatario</h4>
        <p className="text-sm text-muted-foreground">
          Seleccioná un contacto real de la campaña para ver el asunto y el correo tal como se
          personalizarán al enviar.
        </p>
      </div>

      <div className="space-y-1">
        <Label>Destinatario</Label>
        <Select
          value={selected?.id || ""}
          onValueChange={onSelectedContactIdChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Elegí un destinatario" />
          </SelectTrigger>
          <SelectContent>
            {eligible.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {recipientLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected && fields && preview ? (
        <>
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
            <p className="font-medium">Para:</p>
            <p>
              {selected.name || "—"} · {selected.email}
            </p>
            <p className="text-muted-foreground">
              {selected.company || "—"}
              {selected.title ? ` · ${selected.title}` : ""}
            </p>
            {(selected.country && (
              <p className="text-muted-foreground">{countryName(selected.country) || selected.country}</p>
            )) || null}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Asunto exacto</p>
            <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{mergedSubject || "—"}</p>
          </div>

          <div className="overflow-auto rounded-lg border bg-[#F4F8FD] p-3">
            <iframe
              title={`Correo personalizado para ${selected.name || selected.email}`}
              srcDoc={preview.html}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              className="mx-auto block w-full max-w-[600px] border-0 bg-white"
              style={{ height: 820 }}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Igual al envío real salvo baja individual, pixel de apertura, enlaces con seguimiento e
            identificadores de envío generados al mandar.
          </p>
        </>
      ) : null}
    </div>
  );
}
