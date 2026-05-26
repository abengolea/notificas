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
  certificate?: string;
  contentHash?: string;
  updatedAt?: unknown;
};

const EVENT_LABELS: Record<string, { label: string; short: string }> = {
  send: { label: 'Envío certificado', short: 'Envío' },
  receive: { label: 'Recepción certificada', short: 'Recepción' },
  read: { label: 'Lectura certificada', short: 'Lectura' },
  certificate: { label: 'Certificado PDF anclado', short: 'PDF' },
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
  }, [messageId, certifications?.contentHash, certifications?.send]);

  if (!certifications || Object.keys(certifications).length === 0) {
    return null;
  }

  const NON_TX_KEYS = new Set(['contentHash', 'updatedAt']);
  const entries = (Object.entries(certifications) as [string, unknown][]).filter(
    ([key, value]) => !NON_TX_KEYS.has(key) && value && typeof value === 'string'
  ) as [string, string][];

  if (entries.length === 0 && !certifications.contentHash) return null;

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Certificaciones en Polygon
          </CardTitle>
          {integrityCheck && integrityCheck.integrityValid !== null && (
            <Badge
              variant="outline"
              className={
                integrityCheck.integrityValid
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-950/50 dark:text-emerald-200'
                  : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/60 dark:bg-amber-950/50 dark:text-amber-200'
              }
              title={integrityCheck.message}
            >
              {integrityCheck.integrityValid ? (
                <CheckCircle className="mr-1 h-3 w-3" />
              ) : (
                <AlertTriangle className="mr-1 h-3 w-3" />
              )}
              {integrityCheck.integrityValid ? 'Contenido verificado' : 'Revisar contenido'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="space-y-2">
          {entries.map(([event, txHash]) => {
            const { label } = EVENT_LABELS[event] || { label: event };
            const explorerUrl = `${POLYGON_EXPLORER}/tx/${txHash}`;
            return (
              <div
                key={event}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 dark:border-emerald-800/60 dark:bg-emerald-950/30"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Badge variant="secondary" className="shrink-0 bg-slate-900 text-white font-normal dark:bg-emerald-900/70 dark:text-emerald-100">
                    {label}
                  </Badge>
                  <code className="truncate rounded bg-white/80 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
                    {txHash.slice(0, 10)}...{txHash.slice(-8)}
                  </code>
                </div>
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:underline dark:text-emerald-300 dark:hover:text-emerald-200"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver en PolygonScan
                </a>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Cada transacción certifica un hito del mensaje en blockchain.
            {certifications.contentHash && ' El contenido del mensaje está vinculado criptográficamente.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
