"use client";

import { CheckCircle2, ExternalLink, Link2, MousePointerClick, Stamp, Timer, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Row({ label, value, link }: { label: string; value: string; link?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="w-32 text-muted-foreground">{label}</div>
      <div className="flex-1 font-mono text-xs bg-muted/50 px-2 py-1 rounded-md break-all">
        {link ? (
          <a href={value} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
            {value}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          value || "-"
        )}
      </div>
    </div>
  );
}

export default function MailTraceability({ mail }: { mail: any }) {
  const sentAt = mail?.delivery?.time?.toDate?.() ? mail.delivery.time.toDate() : null;
  const openedAt = mail?.tracking?.openedAt?.toDate?.() ? mail.tracking.openedAt.toDate() : null;
  const lastClickAt = mail?.tracking?.lastClickAt?.toDate?.() ? mail.tracking.lastClickAt.toDate() : null;

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
            <Row label="Fecha" value={sentAt ? sentAt.toLocaleString() : "-"} />
            <Row label="Message ID" value={mail?.delivery?.info || "-"} />
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
            <Row label="Abierto" value={String(!!mail?.tracking?.opened)} />
            <Row label="Aperturas" value={String(mail?.tracking?.openCount || 0)} />
            <Row label="Fecha" value={openedAt ? openedAt.toLocaleString() : "-"} />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 font-semibold mb-2">
            <Link2 className="h-5 w-5 text-muted-foreground" /> Clics
          </div>
          <div className="space-y-2">
            <Row label="Total" value={String(mail?.tracking?.clickCount || 0)} />
            <Row label="Último clic" value={lastClickAt ? lastClickAt.toLocaleString() : "-"} />
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
            <Row label="Confirmado" value={String(!!mail?.tracking?.readConfirmed)} />
            <Row
              label="Fecha"
              value={mail?.tracking?.readConfirmedAt?.toDate?.() ? mail.tracking.readConfirmedAt.toDate().toLocaleString() : "-"}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}