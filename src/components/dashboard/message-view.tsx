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
    // Simulate calling the generateCertificatePdf AI flow
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // In a real app, this would be the URL from the flow's response
    const fakePdfUrl = `/certs/certificado-${message.id}.pdf`;
    setGeneratedPdfUrl(fakePdfUrl);
    setIsGenerating(false);

    toast({
      title: "Certificate Generated",
      description: "The legal certificate has been successfully created and certified.",
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
            <AvatarImage src={`https://placehold.co/100x100.png?text=${getInitials(otherParty.nombre)}`} alt={otherParty.nombre} data-ai-hint="profile picture" />
            <AvatarFallback>{getInitials(otherParty.nombre)}</AvatarFallback>
          </Avatar>
          <div className="grid gap-1">
            <CardTitle>{otherParty.nombre}</CardTitle>
            <CardDescription>{otherParty.email}</CardDescription>
            <p className="text-sm text-muted-foreground">
              Sent on: {new Date(message.timestamp).toLocaleString()}
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
          <CardTitle>Legal Certificate</CardTitle>
          <CardDescription>
            Generate or download the legally binding PDF certificate for this message.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {generatedPdfUrl ? (
             <Button asChild>
                <a href={generatedPdfUrl} download>
                  <Download className="mr-2 h-4 w-4" />
                  Download Certificate
                </a>
             </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={isGenerating}>
                  {isGenerating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                  ) : (
                    'Generate Certificate'
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Certificate Generation</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will generate a legally binding PDF certificate and certify its creation on the Blockchain Federal Argentina. This action may incur costs. Are you sure you want to proceed?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleGenerateCertificate} className="bg-primary hover:bg-primary/90">
                    Confirm & Generate
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
