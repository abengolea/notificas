'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, ShieldCheck } from 'lucide-react';

const POLYGON_EXPLORER = 'https://polygonscan.com';

type PolygonCertificationsData = {
  send?: string;
  receive?: string;
  read?: string;
};

const EVENT_LABELS: Record<string, { label: string; short: string }> = {
  send: { label: 'Envío certificado', short: 'Envío' },
  receive: { label: 'Recepción certificada', short: 'Recepción' },
  read: { label: 'Lectura certificada', short: 'Lectura' },
};

export default function PolygonCertifications({
  certifications,
}: {
  certifications: PolygonCertificationsData | null | undefined;
}) {
  if (!certifications || Object.keys(certifications).length === 0) {
    return null;
  }

  const entries = Object.entries(certifications).filter(
    ([, txHash]) => txHash && typeof txHash === 'string'
  );

  if (entries.length === 0) return null;

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
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
