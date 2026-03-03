"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Search, CheckCircle, XCircle, FileText, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generatePDFHash } from "@/lib/storage";

interface VerificationResult {
  isValid: boolean;
  messageId?: string;
  senderName?: string;
  recipientEmail?: string;
  sentAt?: string;
  hash?: string;
  blockchainVerified?: boolean;
  fileName?: string;
  attachmentUrl?: string;
}

export default function VerifyPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const handleFileVerification = async () => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Por favor seleccione un archivo PDF",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    try {
      const hash = await generatePDFHash(selectedFile);
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hash,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const verification: VerificationResult = {
          isValid: true,
          messageId: data?.data?.messageId || data?.data?.docId,
          senderName: data?.data?.senderName,
          recipientEmail: data?.data?.recipientEmail,
          sentAt: data?.data?.sentAt
            ? new Date(data.data.sentAt).toLocaleString("es-ES")
            : undefined,
          hash,
          blockchainVerified: data?.data?.blockchainVerified ?? true,
          fileName: data?.data?.fileName || selectedFile.name,
          attachmentUrl: data?.data?.attachmentUrl,
        };
        setResult(verification);
        toast({
          title: "Documento válido",
          description: "El PDF coincide con un registro certificado.",
        });
      } else if (response.status === 404) {
        setResult({
          isValid: false,
          hash,
          fileName: selectedFile.name,
        });
        toast({
          title: "Documento no encontrado",
          description: "No existe coincidencia para este PDF en nuestros registros.",
          variant: "destructive",
        });
      } else {
        throw new Error("Respuesta inválida del verificador");
      }
    } catch (error) {
      console.error("Error verificando PDF:", error);
      setResult({
        isValid: false,
        fileName: selectedFile.name,
      });
      toast({
        title: "Error",
        description: "No se pudo verificar el archivo. Intenta nuevamente más tarde.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
      setSelectedFile(file);
    } else {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setSelectedFile(null);
      toast({
        title: "Error",
        description: "Por favor seleccione un archivo PDF válido",
        variant: "destructive",
      });
    }
  };

  const handleFileButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    fileInputRef.current?.click();
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        setSelectedFile(file);
        if (fileInputRef.current) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          fileInputRef.current.files = dataTransfer.files;
        }
      } else {
        toast({
          title: "Error",
          description: "Por favor seleccione un archivo PDF válido",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Verificar Autenticidad de Documentos
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Verifique que un PDF de constancia fue emitido oficialmente por Notificas.com
          </p>
        </div>

        {/* Subida del PDF */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Verificar PDF
            </CardTitle>
          </CardHeader>
          <CardContent>
            <input
              id="file"
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleFileButtonClick}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleFileButtonClick();
                }
              }}
            >
              <div className="flex flex-col items-center gap-3 pointer-events-none">
                <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center">
                  <Upload className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-800">
                    {selectedFile ? selectedFile.name : "Subir o arrastrar PDF"}
                  </p>
                  <p className="text-sm text-gray-500">
                    Formato soportado: PDF (máx. 10MB)
                  </p>
                </div>
                <Button type="button" variant="outline" className="pointer-events-auto">
                  Seleccionar PDF
                </Button>
              </div>
            </div>
            {selectedFile && (
              <p className="text-sm text-green-600 mt-2">
                ✓ Archivo listo para verificación
              </p>
            )}
            <div className="flex justify-end mt-6">
              <Button 
                onClick={handleFileVerification}
                disabled={isVerifying || !selectedFile}
              >
                {isVerifying ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Verificar
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resultado de la verificación */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.isValid ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                Resultado de la Verificación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Estado de verificación */}
                <div className="flex items-center gap-2">
                  <Badge variant={result.isValid ? "default" : "destructive"}>
                    {result.isValid ? "DOCUMENTO VÁLIDO" : "DOCUMENTO INVÁLIDO"}
                  </Badge>
                  {result.blockchainVerified && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <Shield className="mr-1 h-3 w-3" />
                      VERIFICADO EN BLOCKCHAIN
                    </Badge>
                  )}
                </div>

                {result.isValid ? (
                  <>
                    {/* Detalles del documento */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Archivo:</span>
                          <span className="text-sm font-medium truncate max-w-[180px]" title={result.fileName}>
                            {result.fileName}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">ID del Mensaje:</span>
                          <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                            {result.messageId}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Remitente:</span>
                          <span className="text-sm font-medium">{result.senderName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Destinatario:</span>
                          <span className="text-sm font-medium">{result.recipientEmail}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Fecha de Envío:</span>
                          <span className="text-sm font-medium">{result.sentAt}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Hash:</span>
                          <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded text-xs" title={result.hash}>
                            {result.hash?.substring(0, 16)}...
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Información adicional */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        ¿Qué significa este resultado?
                      </h4>
                      <p className="text-sm text-blue-700">
                        Este documento fue emitido oficialmente por Notificas.com y está certificado en la red Blockchain. Puede ser utilizado como evidencia legal.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Archivo:</span>
                      <span className="text-sm font-medium truncate max-w-[200px]" title={result.fileName}>
                        {result.fileName}
                      </span>
                    </div>
                    {result.hash && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Hash calculado:</span>
                        <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded text-xs" title={result.hash}>
                          {result.hash.substring(0, 16)}...
                        </span>
                      </div>
                    )}
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <h4 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        Documento no certificado
                      </h4>
                      <p className="text-sm text-red-600">
                        Este PDF no coincide con ningún registro emitido por Notificas.com. Asegúrate de utilizar el documento original recibido o contacta al emisor para confirmar su autenticidad.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Información sobre el sistema */}
        <Card>
          <CardHeader>
            <CardTitle>¿Cómo funciona la verificación?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-semibold mb-2">1. Documento Original</h3>
                <p className="text-sm text-gray-600">
                  Notificas.com genera un PDF único con hash criptográfico
                </p>
              </div>
              <div className="text-center">
                <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Shield className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-semibold mb-2">2. Certificación Blockchain</h3>
                <p className="text-sm text-gray-600">
                  El hash se registra en la red Blockchain para inmutabilidad
                </p>
              </div>
              <div className="text-center">
                <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-semibold mb-2">3. Verificación</h3>
                <p className="text-sm text-gray-600">
                  Cualquiera puede verificar la autenticidad usando el hash o subiendo el PDF
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
