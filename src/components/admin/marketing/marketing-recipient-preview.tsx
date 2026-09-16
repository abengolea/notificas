"use client";

import { StageBadge } from "./stage-badge";
import { countryName } from "@/lib/marketing/countries";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type PreviewContact = {
  id: string;
  email: string;
  name: string;
  company: string;
  country: string;
  stage: string;
  eligible: boolean;
  skipReason: string | null;
};

export function MarketingRecipientPreview({
  contacts,
  total,
  eligible,
  skipped,
  emptyHint,
}: {
  contacts: PreviewContact[];
  total: number;
  eligible: number;
  skipped: number;
  emptyHint?: string;
}) {
  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyHint || "Esta lista no tiene contactos todavía."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {eligible} {eligible === 1 ? "destinatario" : "destinatarios"} van a recibir este correo
        {skipped ? ` · ${skipped} quedan afuera (baja, rebote o etapa no incluida)` : ""}
        {contacts.length < total ? ` · mostrando ${contacts.length} de ${total}` : ""}.
      </p>
      <div className="rounded-lg border bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destinatario</TableHead>
              <TableHead>País</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((c) => (
              <TableRow key={c.id} className={c.eligible ? undefined : "opacity-60"}>
                <TableCell>
                  <div className="font-medium">{c.company || c.email}</div>
                  <div className="text-sm text-muted-foreground">{c.name ? `${c.name} · ${c.email}` : c.email}</div>
                </TableCell>
                <TableCell>{countryName(c.country) || c.country || "—"}</TableCell>
                <TableCell>
                  {c.eligible ? <StageBadge stage={c.stage} /> : (
                    <span className="text-sm text-muted-foreground">{c.skipReason || "No se envía"}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
