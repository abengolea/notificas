"use client";

import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import type { Mensaje, User } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import BfaTraceability from './bfa-traceability';
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
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState(message.bfaCertificado?.certificadoPDF);
  const { toast } = useToast();

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
              Enviado el: {new Date(message.timestamp).toLocaleString('es-AR')}
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
          <CardTitle>Certificado Legal</CardTitle>
          <CardDescription>
            Genere o descargue el certificado PDF con validez legal para este mensaje.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}

    