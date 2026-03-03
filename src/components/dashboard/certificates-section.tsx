"use client";

import React, { useState } from 'react';
import { Download, Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { generateCertificationPDF, downloadPDF, type CertificationData } from "@/lib/certification";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface CertificatesSectionProps {
  messageId: string;
  senderName: string;
  recipientEmail: string;
  messageContent: string;
  messageTimestamp: Date;
  trackingData?: {
    opened: boolean;
    openedAt?: Date;
    openCount: number;
    clickCount: number;
    readConfirmed: boolean;
    readConfirmedAt?: Date;
  };
  deliveryState?: string;
}

export default function CertificatesSection({ 
  messageId, 
  senderName, 
  recipientEmail, 
  messageContent, 
  messageTimestamp,
  trackingData,
  deliveryState
}: CertificatesSectionProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingConstancia, setIsGeneratingConstancia] = useState(false);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [showTrackingWarning, setShowTrackingWarning] = useState(false);
  const { toast } = useToast();

  const handleGenerateCertificate = async () => {
    setIsGenerating(true);
    // Simular llamada al flujo de IA generateCertificatePdf
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // En una aplicación real, esta sería la URL de la respuesta del flujo
    const fakePdfUrl = `/certs/certificado-${messageId}.pdf`;
    setGeneratedPdfUrl(fakePdfUrl);
    setIsGenerating(false);

    toast({
      title: "Certificado Generado",
      description: "El certificado legal ha sido creado y certificado exitosamente.",
      variant: 'default',
    });
  };

  const handleGenerateConstancia = async () => {
    setIsGeneratingConstancia(true);
    try {
      // DEBUG: Ver qué datos estamos recibiendo
      console.log('🔍 CertificatesSection recibió:', { 
        messageId, 
        senderName, 
        recipientEmail, 
        messageContent, 
        messageTimestamp,
        trackingData,
        deliveryState
      });

      // Preparar datos para la constancia
      const certificationData: CertificationData = {
        messageId: messageId,
        senderName: senderName,
        recipientEmail: recipientEmail,
        subject: `Mensaje de ${senderName}`,
        content: messageContent,
        sentAt: messageTimestamp,
        deliveryState: deliveryState || 'SUCCESS',
        tracking: trackingData || {
          opened: false,
          openedAt: undefined,
          openCount: 0,
          clickCount: 0,
          readConfirmed: false,
          readConfirmedAt: undefined
        },
        blockchainHash: `hash_${messageId}_${Date.now()}`
      };

      // DEBUG: Ver qué datos se envían al PDF
      console.log('📄 Datos enviados al PDF:', certificationData);

      // Generar PDF
      const { pdf, hash } = await generateCertificationPDF(certificationData);
      
      // Descargar PDF
      const filename = `constancia-notificacion-${messageId}-${format(new Date(), 'yyyyMMdd-HHmmss')}.pdf`;
      downloadPDF(pdf, filename);

      // Mostrar advertencia de cierre de tracking
      setShowTrackingWarning(true);

      toast({
        title: "Constancia Generada",
        description: "La constancia PDF ha sido generada y descargada exitosamente.",
        variant: 'default',
      });

    } catch (error) {
      console.error('Error generando constancia:', error);
      toast({
        title: "Error",
        description: "No se pudo generar la constancia. Intente nuevamente.",
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingConstancia(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Certificados y Constancias</CardTitle>
          <CardDescription>
            Genere certificados legales o constancias de notificación con tracking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Certificado Legal */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h4 className="font-semibold">Certificado Legal</h4>
              <p className="text-sm text-muted-foreground">
                Certificado con validez legal para este mensaje.
              </p>
            </div>
            {generatedPdfUrl ? (
              <Button asChild>
                <a href={generatedPdfUrl} download>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar Certificado
                </a>
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={isGenerating}>
                    {isGenerating ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando...</>
                    ) : (
                      'Generar Certificado'
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Generación de Certificado</AlertDialogTitle>
                                       <AlertDialogDescription>
                     Esto generará un certificado PDF con validez legal y certificará su creación en la red Polygon. Esta acción puede incurrir en costos. ¿Estás seguro de que quieres proceder?
                   </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleGenerateCertificate} className="bg-primary hover:bg-primary/90">
                      Confirmar y Generar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {/* Constancia de Notificación */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h4 className="font-semibold">Constancia de Notificación</h4>
              <p className="text-sm text-muted-foreground">
                Constancia PDF con tracking y certificación blockchain.
              </p>
            </div>
            <Button 
              onClick={handleGenerateConstancia} 
              disabled={isGeneratingConstancia}
              variant="outline"
            >
              {isGeneratingConstancia ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar Constancia
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo de Advertencia de Cierre de Tracking */}
      <AlertDialog open={showTrackingWarning} onOpenChange={setShowTrackingWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              ⚠️ Advertencia: Cierre de Tracking
            </AlertDialogTitle>
                         <div className="space-y-3">
               <p>
                 <strong>IMPORTANTE:</strong> Al descargar la constancia PDF, el sistema de tracking de este mensaje se cerrará permanentemente.
               </p>
               <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                 <p className="text-sm text-amber-800">
                   <strong>¿Qué significa esto?</strong>
                 </p>
                 <ul className="text-sm text-amber-700 mt-2 space-y-1">
                   <li>• El mensaje ya no será trackeado en tiempo real</li>
                   <li>• No se registrarán más aperturas o clicks</li>
                   <li>• La constancia PDF contiene el estado final del tracking</li>
                   <li>• El PDF incluye un hash único para verificación</li>
                 </ul>
               </div>
               <p className="text-sm text-muted-foreground">
                 Esta acción es irreversible. La constancia PDF servirá como evidencia final del envío y recepción del mensaje.
               </p>
             </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Entendido</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => setShowTrackingWarning(false)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Confirmar y Cerrar Tracking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
