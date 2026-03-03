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
}

export function DownloadCertificate({ messageId, onDownload, disabled = false }: DownloadCertificateProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await onDownload();
      toast({
        title: "Certificado descargado",
        description: "El certificado PDF ha sido generado y descargado exitosamente.",
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
              Generando Certificado...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Descargar Certificado
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Descargar Certificado de Lectura
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">⚠️ Importante:</p>
                  <p>Al descargar el certificado, el sistema <strong>detendrá automáticamente</strong> la captura de nuevos movimientos de tracking para este mensaje.</p>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <p><strong>El certificado incluirá:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Información completa del mensaje</li>
                  <li>Historial completo de movimientos</li>
                  <li>Documentos adjuntos con hashes de integridad</li>
                  <li>Enlaces verificables a todos los archivos</li>
                  <li>Certificación blockchain de autenticidad</li>
                </ul>
              </div>
              
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>💡 Uso legal:</strong> Este certificado puede ser presentado ante autoridades judiciales como prueba de notificación fehaciente.
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDownload}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Download className="mr-2 h-4 w-4" />
            Generar y Descargar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


