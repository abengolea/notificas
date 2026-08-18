"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, AlertTriangle, FileText, Shield } from 'lucide-react';
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
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface DownloadCertificateProps {
  messageId: string;
  onDownload: () => Promise<void>;
  disabled?: boolean;
  /** Ya existe el PDF emitido: misma copia, no se recertifica. */
  alreadyIssued?: boolean;
}

export function DownloadCertificate({
  onDownload,
  disabled = false,
  alreadyIssued = false,
}: DownloadCertificateProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await onDownload();
      toast({
        title: alreadyIssued ? "Certificado descargado" : "Certificado emitido",
        description: alreadyIssued
          ? "Es la misma copia lacrada. No se volvió a certificar."
          : "Este PDF quedó emitido. No se vuelve a generar con eventos posteriores.",
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: "Error al descargar certificado",
        description: error.message || "No se pudo generar el certificado.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button 
          variant="outline" 
          className="w-full"
          disabled={disabled || isDownloading}
        >
          {isDownloading ? (
            <>
              <FileText className="mr-2 h-4 w-4 animate-pulse" />
              {alreadyIssued ? "Descargando…" : "Emitiendo certificado…"}
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              {alreadyIssued ? "Descargar certificado" : "Emitir certificado de lectura"}
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {alreadyIssued ? "Descargar certificado de lectura" : "Emitir certificado de lectura"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {alreadyIssued ? (
                <div className="flex items-start gap-2 p-3 bg-muted/60 border rounded-lg">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-foreground">
                    <p>
                      Este PDF ya fue emitido. Vas a bajar la misma foto de esa fecha.
                      No se arma de nuevo: lecturas o rebotes posteriores no entran.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/50 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-warning-foreground">
                    <p className="font-medium mb-1">Se emite una sola vez</p>
                    <p>
                      Es como una foto: quedan los hechos de ahora. Después no se saca otra con lecturas o rebotes nuevos.
                      Podés volver a bajar esta misma copia. Si todavía esperás que alguien lea o que llegue un rebote, cancelá y esperá.
                    </p>
                  </div>
                </div>
              )}
              
              <div className="space-y-2 text-sm">
                <p><strong>Incluye lo registrado hasta la emisión:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Texto, destinatario y hashes SHA-256</li>
                  <li>Eventos de correo y WhatsApp de ese momento</li>
                  <li>Adjuntos con su hash</li>
                  <li>TX en Polygon, si ya existen</li>
                </ul>
              </div>
              
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-sm text-foreground">
                Constancia técnica verificable. No reemplaza una carta documento ni otra forma que la ley pida.
                Un juez decide qué valor le da.
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{alreadyIssued ? "Cerrar" : "Esperar más eventos"}</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDownload}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Download className="mr-2 h-4 w-4" />
            {alreadyIssued ? "Descargar copia" : "Emitir y descargar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
