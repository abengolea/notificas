"use client";

import { CheckCircle2, ExternalLink, Link2, Timer, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function Row({ label, value, link }: { label: string; value: string; link?: boolean }) {
  const display = value && value !== "false" && value !== "true" ? value : value || "—";
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="w-40 text-muted-foreground">{label}</div>
      <div className="flex-1 font-mono text-xs bg-muted/50 px-2 py-1 rounded-md break-all">
        {link ? (
          <a href={display} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
            {display}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          display
        )}
      </div>
    </div>
  );
}

function BoolRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="w-40 text-muted-foreground">{label}</div>
      <div className="flex-1">
        {value ? (
          <Badge variant="default">Sí</Badge>
        ) : (
          <Badge variant="secondary">No</Badge>
        )}
      </div>
    </div>
  );
}

function formatDate(d: any): string {
  const date = d?.toDate?.() ? d.toDate() : d instanceof Date ? d : null;
  return date ? date.toLocaleString() : "—";
}

export default function MailTraceability({ mail }: { mail: any }) {
  const sentAt = formatDate(mail?.delivery?.time);
  const openedAt = formatDate(mail?.tracking?.openedAt);
  const lastClickAt = formatDate(mail?.tracking?.lastClickAt);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trazabilidad</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="flex items-center gap-2 font-semibold mb-2">
            <CheckCircle2 className="h-5 w-5 text-primary" /> Enviado
          </div>
          <div className="space-y-2">
            <Row label="Estado" value={mail?.delivery?.state || "PENDIENTE"} />
            <Row label="Fecha" value={sentAt} />
            <Row label="Message ID" value={mail?.delivery?.info || "—"} />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 font-semibold mb-2">
            {mail?.tracking?.opened ? (
              <CheckCircle2 className="h-5 w-5 text-accent" />
            ) : (
              <XCircle className="h-5 w-5 text-muted-foreground" />
            )}
            Apertura
          </div>
          <div className="space-y-2">
            <BoolRow label="Abierto" value={!!mail?.tracking?.opened} />
            <Row label="Aperturas" value={String(mail?.tracking?.openCount ?? 0)} />
            <Row label="Fecha" value={openedAt} />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 font-semibold mb-2">
            <Link2 className="h-5 w-5 text-muted-foreground" /> Clics
          </div>
          <div className="space-y-2">
            <Row label="Total" value={String(mail?.tracking?.clickCount ?? 0)} />
            <Row label="Último clic" value={lastClickAt} />
            {Array.isArray(mail?.tracking?.clicks) && mail.tracking.clicks.length > 0 && (
              <div className="space-y-1">
                {mail.tracking.clicks.map((c: any, idx: number) => (
                  <Row key={idx} label={`URL ${idx + 1}`} value={c.url} link />
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 font-semibold mb-2">
            {mail?.tracking?.readConfirmed ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : (
              <Timer className="h-5 w-5 text-muted-foreground" />
            )}
            Confirmación de lectura
          </div>
          <div className="space-y-2">
            <BoolRow label="Confirmado" value={!!mail?.tracking?.readConfirmed} />
            <Row label="Fecha" value={formatDate(mail?.tracking?.readConfirmedAt)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}