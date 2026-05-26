"use client";

import type { ComponentProps } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye } from "lucide-react";
import { MovementsTracking } from "./movements-tracking";

type MailTraceabilityMail = {
  tracking?: {
    movements?: ComponentProps<typeof MovementsTracking>["movements"];
  };
  recipientEmail?: string | null;
  to?: string | string[] | null;
};

export default function MailTraceability({ mail }: { mail: MailTraceabilityMail }) {
  const movements = mail.tracking?.movements || [];
  const destinatarioTracking =
    mail.recipientEmail ||
    (Array.isArray(mail?.to) && mail.to.length === 1 ? mail.to[0] : null) ||
    (typeof mail?.to === "string" ? mail.to : null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Estado del seguimiento en tiempo real
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Estos movimientos son el registro en tiempo real guardado en la aplicación (aperturas,
          clics, etc.).{" "}
          <strong className="font-medium text-foreground">No cada fila va a la blockchain</strong>
          : allí solo se certifican hitos concretos (envío, recepción, primera lectura). Las
          transacciones de Polygon se muestran debajo como certificaciones técnicas.
        </p>
        {destinatarioTracking && (
          <p className="text-sm rounded-md border border-border bg-muted/40 px-3 py-2 mb-4">
            <span className="text-muted-foreground">Tracking correspondiente únicamente a </span>
            <strong className="font-mono text-foreground">{destinatarioTracking}</strong>
          </p>
        )}
        {movements.length > 0 ? (
          <MovementsTracking movements={movements} recipientEmail={destinatarioTracking} />
        ) : (
          <div className="text-center py-4">
            <p className="text-muted-foreground">No hay movimientos registrados para este mensaje.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
