"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PDFViewer } from '@/components/dashboard/pdf-viewer';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Logo } from '@/components/logo';

interface TrackingData {
  opened: boolean;
  openedAt: Date;
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
}

export default function PDFViewerPage() {
  const params = useParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<{
    url: string;
    fileName: string;
    messageId: string;
    fileId: string;
  } | null>(null);

  const messageId = params?.messageId as string;
  const fileId = params?.fileId as string;

  useEffect(() => {
    if (!messageId || !fileId) {
      setError('Parámetros de URL inválidos');
      setIsLoading(false);
      return;
    }

    // Simular obtención de datos del PDF
    // En producción, esto vendría de Firestore
    setTimeout(() => {
      setPdfData({
        url: `https://example.com/pdfs/${messageId}/${fileId}`,
        fileName: `Documento_${fileId}.pdf`,
        messageId,
        fileId
      });
      setIsLoading(false);
    }, 1000);
  }, [messageId, fileId]);

  const handleTrackingUpdate = async (trackingData: TrackingData) => {
    if (!messageId || !fileId) return;

    try {
      // Actualizar tracking en Firestore
      const messageRef = doc(db, 'mail', messageId);
      await updateDoc(messageRef, {
        [`attachments.${fileId}.tracking`]: {
          ...trackingData,
          lastUpdated: serverTimestamp()
        }
      });

      console.log('Tracking actualizado:', trackingData);
    } catch (error) {
      console.error('Error actualizando tracking:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Cargando PDF...</p>
        </div>
      </div>
    );
  }

  if (error || !pdfData) {
    return (
      <div className="flex flex-col min-h-screen bg-muted/30">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-6">
          <div className='hidden lg:flex items-center gap-2'>
            <Logo className="h-10 w-auto" />
            <span className="font-bold text-xl">Notificas</span>
          </div>
        </header>
        
        <main className="flex-1 p-4 md:p-8 lg:p-12">
          <div className="mx-auto max-w-4xl">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-6 w-6" />
                  Error al cargar el PDF
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  {error || 'No se pudo cargar el archivo PDF solicitado.'}
                </p>
                <Button onClick={() => router.back()}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-6">
        <div className='hidden lg:flex items-center gap-2'>
          <Logo className="h-10 w-auto" />
          <span className="font-bold text-xl">Notificas</span>
        </div>
        <div className="flex-1">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Volver</span>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-red-500" />
          <span className="text-sm font-medium">Visor de PDF</span>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 lg:p-12">
        <div className="mx-auto max-w-6xl">
          <PDFViewer
            messageId={pdfData.messageId}
            attachmentId={pdfData.fileId}
            fileName={pdfData.fileName}
            fileUrl={pdfData.url}
            fileSize={0}
          />
        </div>
      </main>
    </div>
  );
}
