'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, ShieldCheck, AlertTriangle, CheckCircle } from 'lucide-react';

const POLYGON_EXPLORER = 'https://polygonscan.com';

type PolygonCertificationsData = {
  send?: string;
  receive?: string;
  read?: string;
  contentHash?: string;
};

const EVENT_LABELS: Record<string, { label: string; short: string }> = {
  send: { label: 'Envío certificado', short: 'Envío' },
  receive: { label: 'Recepción certificada', short: 'Recepción' },
  read: { label: 'Lectura certificada', short: 'Lectura' },
};

export default function PolygonCertifications({
  certifications,
  messageId,
}: {
  certifications: PolygonCertificationsData | null | undefined;
  messageId?: string;
}) {
  const [integrityCheck, setIntegrityCheck] = useState<{
    integrityValid: boolean | null;
    message: string;
  } | null>(null);

  useEffect(() => {
    // Verificar integridad si hay tx de envío (la API obtiene el hash desde blockchain)
    if (!messageId || !certifications?.send) return;
    fetch('/api/verify-content-integrity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.integrityValid === null) return;
        setIntegrityCheck({
          integrityValid: data.integrityValid,
          message: data.message,
        });
      })
      .catch(() => {});
  }, [messageId, certifications?.contentHash]);

  if (!certifications || Object.keys(certifications).length === 0) {
    return null;
  }

  const entries = Object.entries(certifications).filter(
    ([key, value]) => key !== 'contentHash' && value && typeof value === 'string'
  );

  if (entries.length === 0 && !certifications.contentHash) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          Certificaciones en Polygon
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {integrityCheck && integrityCheck.integrityValid !== null && (
            <div
              className={`flex items-start gap-2 p-3 rounded-lg border ${
                integrityCheck.integrityValid
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-amber-50 border-amber-200'
              }`}
            >
              {integrityCheck.integrityValid ? (
                <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="text-sm">
                <p className="font-medium">
                  {integrityCheck.integrityValid
                    ? 'Integridad del contenido verificada'
                    : 'Contenido posiblemente alterado'}
                </p>
                <p className="text-muted-foreground mt-0.5">{integrityCheck.message}</p>
              </div>
            </div>
          )}
          {entries.map(([event, txHash]) => {
            const { label } = EVENT_LABELS[event] || { label: event };
            const explorerUrl = `${POLYGON_EXPLORER}/tx/${txHash}`;
            return (
              <div
                key={event}
                className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200"
              >
                <Badge variant="secondary" className="font-normal">
                  {label}
                </Badge>
                <code className="text-xs bg-white/80 px-2 py-0.5 rounded truncate max-w-[180px]">
                  {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </code>
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver en PolygonScan
                </a>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Cada hash certifica el evento en la blockchain de Polygon y puede verificarse en PolygonScan.
            {certifications.contentHash && ' El contenido del mensaje está vinculado criptográficamente.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
