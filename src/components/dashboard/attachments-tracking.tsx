"use client";

import React from 'react';
import { FileText, Eye, Clock, MapPin, Smartphone, CheckCircle, AlertCircle, Shield, Hash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

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

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getDeviceType = (userAgent: string): string => {
    if (userAgent.includes('Mobile')) return 'Móvil';
    if (userAgent.includes('Tablet')) return 'Tablet';
    return 'Desktop';
  };

  const getSignatureStatusIcon = (status?: string) => {
    switch (status) {
      case 'signed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'declined':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getSignatureStatusText = (status?: string) => {
    switch (status) {
      case 'signed':
        return 'Firmado';
      case 'declined':
        return 'Declinado';
      default:
        return 'Pendiente';
    }
  };

  const getSignatureStatusColor = (status?: string) => {
    switch (status) {
      case 'signed':
        return 'bg-green-100 text-green-800';
      case 'declined':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <FileText className="h-6 w-6 text-red-500" />
          Documentos Adjuntos ({attachments.length})
        </h2>
        <Badge variant="outline" className="text-sm">
          Tracking Activo
        </Badge>
      </div>

      <div className="grid gap-4">
        {attachments.map((attachment, index) => {
          const tracking = attachment.tracking;
          const hasTracking = tracking && tracking.opened;

          return (
            <Card key={attachment.id || index} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                      <FileText className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{attachment.name || 'Archivo sin nombre'}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(attachment.size || 0)} • {attachment.name?.split('.').pop()?.toUpperCase() || 'DOC'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {attachment.url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewPDF?.(attachment.id || index.toString(), attachment.url!)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Ver Documento
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              {hasTracking && (
                <CardContent className="pt-0">
                  <Separator className="mb-4" />
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-muted-foreground flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        Estado
                      </p>
                      <p className="font-semibold">
                        {tracking.opened ? 'Abierto' : 'No abierto'}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Tiempo de vista
                      </p>
                      <p className="font-semibold">
                        {formatDuration(tracking.duration)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        Clics
                      </p>
                      <p className="font-semibold">
                        {(tracking as any).clickCount || 1}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        IP
                      </p>
                      <p className="font-semibold font-mono text-xs">
                        {tracking.ipAddress || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground flex items-center gap-1">
                        <Smartphone className="h-3 w-3" />
                        Dispositivo
                      </p>
                      <p className="font-semibold text-xs">
                        {getDeviceType(tracking.deviceInfo.userAgent)}
                      </p>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-muted-foreground">Resolución</p>
                      <p className="font-semibold">{tracking.deviceInfo.screenResolution}</p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Zona horaria</p>
                      <p className="font-semibold">{tracking.deviceInfo.timezone}</p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Progreso de lectura</p>
                      <p className="font-semibold">{tracking.scrollDepth}%</p>
                    </div>
                  </div>

                  {/* Sección de Integridad del Archivo */}
                  {attachment.hash && (
                    <>
                      <Separator className="my-4" />
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Shield className="h-5 w-5 text-green-600" />
                          <h4 className="font-medium">Constancia de Integridad</h4>
                          <Badge variant="outline" className="bg-green-100 text-green-800">
                            Verificado
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4 text-sm">
                          <div>
                            <p className="font-medium text-muted-foreground flex items-center gap-1">
                              <Hash className="h-3 w-3" />
                              Hash SHA-256
                            </p>
                            <p className="font-mono text-xs bg-gray-100 p-2 rounded break-all">
                              {attachment.hash}
                            </p>
                          </div>
                          
                          {attachment.integrityCertificate && (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="font-medium text-muted-foreground">Algoritmo</p>
                                <p className="font-semibold">{attachment.integrityCertificate.algorithm}</p>
                              </div>
                              <div>
                                <p className="font-medium text-muted-foreground">Certificado</p>
                                <p className="font-semibold text-green-600">
                                  {attachment.integrityCertificate.verified ? 'Válido' : 'Inválido'}
                                </p>
                              </div>
                            </div>
                          )}
                          
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <p className="text-xs text-blue-800">
                              <strong>💡 Verificación:</strong> Este hash permite verificar que el archivo no ha sido modificado desde su creación. 
                              Cualquier cambio en el archivo resultará en un hash completamente diferente.
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <Separator className="my-4" />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-muted-foreground mb-2">Estado de Firma</p>
                      <div className="flex items-center gap-2">
                        {getSignatureStatusIcon(tracking.signatureStatus)}
                        <Badge className={getSignatureStatusColor(tracking.signatureStatus)}>
                          {getSignatureStatusText(tracking.signatureStatus)}
                        </Badge>
                      </div>
                    </div>
                    {tracking.signatureTimestamp && (
                      <div className="text-right">
                        <p className="font-medium text-muted-foreground text-xs">Firmado el</p>
                        <p className="font-semibold text-xs">
                          {tracking.signatureTimestamp.toLocaleString('es-ES')}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}

              {!hasTracking && (
                <CardContent className="pt-0">
                  <Separator className="mb-4" />
                  <div className="text-center py-4">
                    <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No se ha abierto este archivo aún
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
