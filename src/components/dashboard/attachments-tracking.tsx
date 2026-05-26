"use client";

import { FileText, Eye, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface AttachmentTrackingProps {
  attachments: Array<{
    id: string;
    name: string;
    size: number;
    url?: string;
    hash?: string;
    integrityCertificate?: {
      hash: string;
      algorithm: string;
      timestamp: Date;
      verified: boolean;
    };
    tracking?: {
      opened: boolean;
      openedAt?: Date;
      duration: number;
      scrollDepth: number;
      deviceInfo: {
        userAgent: string;
        screenResolution: string;
        timezone: string;
      };
      clickCount?: number;
      ipAddress?: string;
      signatureStatus?: 'pending' | 'signed' | 'declined';
      signatureTimestamp?: Date;
    };
  }>;
  onViewPDF?: (attachmentId: string, url: string) => void;
}

export function AttachmentsTracking({ attachments, onViewPDF }: AttachmentTrackingProps) {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <FileText className="h-5 w-5 text-red-500" />
          Documentos Adjuntos ({attachments.length})
        </h2>
      </div>

      <div className="grid gap-3">
        {attachments.map((attachment, index) => (
          <Card key={attachment.id || index} className="overflow-hidden">
            <CardHeader className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100">
                    <FileText className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base leading-snug">{attachment.name || 'Archivo sin nombre'}</CardTitle>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {formatFileSize(attachment.size || 0)} • {attachment.name?.split('.').pop()?.toUpperCase() || 'DOC'}
                      {attachment.hash && (
                        <Badge variant="outline" className="bg-green-100 px-2 py-0.5 text-green-700">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Integridad verificada
                        </Badge>
                      )}
                    </p>
                  </div>
                </div>
                {attachment.url && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full shrink-0 sm:w-auto"
                    onClick={() => onViewPDF?.(attachment.id || index.toString(), attachment.url!)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Ver Documento
                  </Button>
                )}
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
