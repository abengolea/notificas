"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Mail, MousePointer, Eye } from "lucide-react";
import { MovementsTracking } from "./movements-tracking";

function formatDate(d: any): string {
  const date = d?.toDate?.() ? d.toDate() : d instanceof Date ? d : null;
  return date ? date.toLocaleString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : "—";
}

function getStatusColor(state: string) {
  switch (state) {
    case 'SUCCESS':
    case 'DELIVERED':
      return 'bg-green-100 text-green-800';
    case 'ERROR':
      return 'bg-red-100 text-red-800';
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export default function MailTraceability({ mail }: { mail: any }) {
  const movements = mail.tracking?.movements || [];
  
  // Calcular métricas desde los movimientos
  const emailSentCount = movements.filter((m: any) => m.type === 'email_sent').length;
  const emailOpenedCount = movements.filter((m: any) => m.type === 'email_opened').length;
  const readConfirmedCount = movements.filter((m: any) => m.type === 'read_confirmed').length;
  const attachmentOpenedCount = movements.filter((m: any) => m.type === 'attachment_opened').length;
  
  // Obtener el último estado
  const lastMovement = movements.length > 0 ? movements[movements.length - 1] : null;
  const isOpened = emailOpenedCount > 0;
  const isReadConfirmed = readConfirmedCount > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Estado del Tracking en Tiempo Real
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Sección de Movimientos Detallados */}
        {movements.length > 0 ? (
          <MovementsTracking movements={movements} />
        ) : (
          <div className="text-center py-4">
            <p className="text-muted-foreground">
              No hay movimientos registrados para este mensaje.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}