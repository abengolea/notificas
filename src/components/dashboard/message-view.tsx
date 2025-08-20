"use client";

import React, { useState, useEffect } from 'react';
import { Download, Loader2, AlertTriangle, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Mensaje, User } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import BfaTraceability from './bfa-traceability';
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

interface MessageViewProps {
  message: Mensaje;
  currentUser: User;
}

export default function MessageView({ message, currentUser }: MessageViewProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingConstancia, setIsGeneratingConstancia] = useState(false);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState(message.bfaCertificado?.certificadoPDF);
  const [formattedTimestamp, setFormattedTimestamp] = useState<string | null>(null);
  const [showTrackingWarning, setShowTrackingWarning] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Defer date formatting to the client to avoid hydration mismatch
    setFormattedTimestamp(format(new Date(message.timestamp), "dd/MM/yyyy, HH:mm:ss", { locale: es }));
  }, [message.timestamp]);


  const handleGenerateCertificate = async () => {
    setIsGenerating(true);
    // Simular llamada al flujo de IA generateCertificatePdf
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // En una aplicación real, esta sería la URL de la respuesta del flujo
    const fakePdfUrl = `/certs/certificado-${message.id}.pdf`;
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
      // Preparar datos para la constancia
      const certificationData: CertificationData = {
        messageId: message.id,
        senderName: currentUser.nombre,
        recipientEmail: otherParty.email,
        subject: `Mensaje de ${currentUser.nombre}`,
        content: message.contenido,
        sentAt: new Date(message.timestamp),
        deliveryState: 'SUCCESS', // Asumimos que si está en el dashboard, fue enviado exitosamente
        tracking: {
          opened: false, // Estos datos vendrían del tracking real
          openedAt: undefined,
          openCount: 0,
          clickCount: 0,
          readConfirmed: false,
          readConfirmedAt: undefined
        },
        blockchainHash: `hash_${message.id}_${Date.now()}` // Hash simulado
      };

      // Generar PDF
      const { pdf, hash } = await generateCertificationPDF(certificationData);
      
      // Descargar PDF
      const filename = `constancia-notificacion-${message.id}-${format(new Date(), 'yyyyMMdd-HHmmss')}.pdf`;
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

  const otherParty = message.remitente.uid === currentUser.uid ? message.destinatario : message.remitente;
  const getInitials = (name: string) => {
    const names = name.split(' ');
    return names.length > 1 ? `${names[0][0]}${names[1][0]}` : name.substring(0, 2);
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-start gap-4 space-y-0 bg-muted/20">
          <Avatar className="h-12 w-12 border">
            <AvatarImage src={`https://placehold.co/100x100.png?text=${getInitials(otherParty.nombre)}`} alt={otherParty.nombre} data-ai-hint="foto de perfil" />
            <AvatarFallback>{getInitials(otherParty.nombre)}</AvatarFallback>
          </Avatar>
          <div className="grid gap-1">
            <CardTitle>{otherParty.nombre}</CardTitle>
            <CardDescription>{otherParty.email}</CardDescription>
            <p className="text-sm text-muted-foreground">
              Enviado el: {formattedTimestamp || 'Cargando fecha...'}
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-6 text-base leading-relaxed">
          <p>{message.contenido}</p>
        </CardContent>
      </Card>

      <BfaTraceability message={message} />

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
                      Esto generará un certificado PDF con validez legal y certificará su creación en la Blockchain Federal Argentina. Esta acción puede incurrir en costos. ¿Estás seguro de que quieres proceder?
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
            <AlertDialogDescription className="space-y-3">
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
            </AlertDialogDescription>
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
    </div>
  );
}
