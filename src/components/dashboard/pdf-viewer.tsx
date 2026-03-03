"use client"

import { useState, useEffect } from 'react';
import { usePDFTracking } from '@/hooks/usePDFTracking';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Eye, Scroll, Monitor } from 'lucide-react';

interface PDFViewerProps {
  messageId: string;
  attachmentId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
}

export function PDFViewer({ messageId, attachmentId, fileName, fileUrl, fileSize }: PDFViewerProps) {
  console.log('📄 PDFViewer montado:', { messageId, attachmentId, fileName });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  
  const {
    isTracking,
    trackingData,
    startTracking,
    stopTracking,
    handleSignature
  } = usePDFTracking(messageId, attachmentId);

  // Iniciar tracking cuando se monta el componente
  useEffect(() => {
    console.log('📄 PDFViewer useEffect - iniciando tracking...');
    startTracking();
  }, [startTracking]);

  // Log cuando cambia el estado de tracking
  useEffect(() => {
    console.log('📊 Estado de tracking cambiado:', { isTracking, trackingData });
  }, [isTracking, trackingData]);

  // Manejar carga del PDF
  const handlePDFLoad = () => {
    setIsLoading(false);
    console.log('📄 PDF cargado correctamente');
  };

  const handlePDFError = () => {
    setError('Error al cargar el PDF');
    setIsLoading(false);
  };

  // Formatear duración
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Formatear fecha
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="space-y-6">
      {/* Header con información del archivo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Eye className="h-5 w-5 text-blue-600" />
            Visualizando: {fileName}
          </CardTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Tamaño: {(fileSize / 1024 / 1024).toFixed(2)} MB</span>
            <span>Tipo: PDF</span>
            {trackingData?.openedAt && (
              <span>Abierto: {formatDate(trackingData.openedAt)}</span>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Estadísticas de tracking en tiempo real */}
      {trackingData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Estadísticas de Visualización</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-2xl font-bold">
                  {formatDuration(trackingData.duration)}
                </div>
                <div className="text-sm text-muted-foreground">Duración</div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Scroll className="h-6 w-6 text-green-600" />
                </div>
                <div className="text-2xl font-bold">
                  {trackingData.scrollDepth}%
                </div>
                <div className="text-sm text-muted-foreground">Progreso</div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Monitor className="h-6 w-6 text-purple-600" />
                </div>
                <div className="text-sm font-medium">
                  {trackingData.deviceInfo.screenResolution}
                </div>
                <div className="text-sm text-muted-foreground">Resolución</div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  {trackingData.signatureStatus === 'signed' ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : trackingData.signatureStatus === 'declined' ? (
                    <XCircle className="h-6 w-6 text-red-600" />
                  ) : (
                    <Clock className="h-6 w-6 text-yellow-600" />
                  )}
                </div>
                <div className="text-sm font-medium">
                  {trackingData.signatureStatus === 'signed' ? 'Firmado' : 
                   trackingData.signatureStatus === 'declined' ? 'Rechazado' : 'Pendiente'}
                </div>
                <div className="text-sm text-muted-foreground">Estado</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Visor de PDF */}
      <Card>
        <CardHeader>
          <CardTitle>Documento PDF</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p>Cargando PDF...</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="text-center text-red-600 p-8">
              <p className="mb-4">{error}</p>
              <Button onClick={() => window.open(fileUrl, '_blank')}>
                Abrir en nueva pestaña
              </Button>
            </div>
          )}
          
          {!isLoading && !error && (
            <div className="border rounded-lg overflow-hidden">
              <iframe
                src={`${fileUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                className="w-full h-[600px]"
                onLoad={handlePDFLoad}
                onError={handlePDFError}
                title={fileName}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botones de firma/acuse de recibo */}
      <Card>
        <CardHeader>
          <CardTitle>Confirmar Recepción</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Por favor, confirma que has revisado el documento:
            </p>
            
            <div className="flex gap-4">
              <Button
                onClick={() => handleSignature('signed')}
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={trackingData?.signatureStatus === 'signed'}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirmar Recepción
              </Button>
              
              <Button
                onClick={() => handleSignature('declined')}
                variant="destructive"
                className="flex-1"
                disabled={trackingData?.signatureStatus === 'declined'}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Rechazar
              </Button>
            </div>
            
            {trackingData?.signatureStatus === 'signed' && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>Documento confirmado el {trackingData.signatureTimestamp && formatDate(trackingData.signatureTimestamp)}</span>
              </div>
            )}
            
            {trackingData?.signatureStatus === 'declined' && (
              <div className="flex items-center gap-2 text-red-600">
                <XCircle className="h-4 w-4" />
                <span>Documento rechazado el {trackingData.signatureTimestamp && formatDate(trackingData.signatureTimestamp)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Información del dispositivo */}
      {trackingData && (
        <Card>
          <CardHeader>
            <CardTitle>Información del Dispositivo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Navegador:</span>
                <p className="text-muted-foreground truncate">{trackingData.deviceInfo.userAgent}</p>
              </div>
              <div>
                <span className="font-medium">Resolución:</span>
                <p className="text-muted-foreground">{trackingData.deviceInfo.screenResolution}</p>
              </div>
              <div>
                <span className="font-medium">Zona horaria:</span>
                <p className="text-muted-foreground">{trackingData.deviceInfo.timezone}</p>
              </div>
              <div>
                <span className="font-medium">Idioma:</span>
                <p className="text-muted-foreground">{trackingData.deviceInfo.language}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
