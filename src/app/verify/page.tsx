"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, Search, CheckCircle, XCircle, FileText, Shield, Hash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VerificationResult {
  isValid: boolean;
  messageId?: string;
  senderName?: string;
  recipientEmail?: string;
  sentAt?: string;
  hash?: string;
  blockchainVerified?: boolean;
}

export default function VerifyPage() {
  const [verificationMethod, setVerificationMethod] = useState<'hash' | 'file'>('hash');
  const [hashInput, setHashInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const { toast } = useToast();

  const handleHashVerification = async () => {
    if (!hashInput.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingrese un hash válido",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    try {
      // Simular verificación (en producción esto sería una llamada a la API)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Resultado simulado
      const mockResult: VerificationResult = {
        isValid: true,
        messageId: "MSG_" + Math.random().toString(36).substr(2, 9),
        senderName: "Usuario Ejemplo",
        recipientEmail: "destinatario@ejemplo.com",
        sentAt: new Date().toLocaleString('es-ES'),
        hash: hashInput,
        blockchainVerified: true
      };
      
      setResult(mockResult);
      
      toast({
        title: "Verificación Exitosa",
        description: "El documento ha sido verificado como auténtico",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo verificar el hash",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

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
      // Simular verificación del archivo
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Resultado simulado
      const mockResult: VerificationResult = {
        isValid: true,
        messageId: "MSG_" + Math.random().toString(36).substr(2, 9),
        senderName: "Usuario Ejemplo",
        recipientEmail: "destinatario@ejemplo.com",
        sentAt: new Date().toLocaleString('es-ES'),
        hash: "hash_" + Math.random().toString(36).substr(2, 16),
        blockchainVerified: true
      };
      
      setResult(mockResult);
      
      toast({
        title: "Verificación Exitosa",
        description: "El PDF ha sido verificado como auténtico",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo verificar el archivo",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    } else {
      toast({
        title: "Error",
        description: "Por favor seleccione un archivo PDF válido",
        variant: "destructive",
      });
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

        {/* Métodos de verificación */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Métodos de Verificación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-6">
              <Button
                variant={verificationMethod === 'hash' ? 'default' : 'outline'}
                onClick={() => setVerificationMethod('hash')}
                className="flex-1"
              >
                <Hash className="mr-2 h-4 w-4" />
                Verificar por Hash
              </Button>
              <Button
                variant={verificationMethod === 'file' ? 'default' : 'outline'}
                onClick={() => setVerificationMethod('file')}
                className="flex-1"
              >
                <Upload className="mr-2 h-4 w-4" />
                Subir PDF
              </Button>
            </div>

            {/* Verificación por Hash */}
            {verificationMethod === 'hash' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="hash">Hash de Verificación</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="hash"
                      placeholder="Ingrese el hash del documento..."
                      value={hashInput}
                      onChange={(e) => setHashInput(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      onClick={handleHashVerification}
                      disabled={isVerifying || !hashInput.trim()}
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
                </div>
              </div>
            )}

            {/* Verificación por Archivo */}
            {verificationMethod === 'file' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="file">Seleccionar PDF</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="file"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="flex-1"
                    />
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
                  {selectedFile && (
                    <p className="text-sm text-green-600 mt-2">
                      ✓ Archivo seleccionado: {selectedFile.name}
                    </p>
                  )}
                </div>
              </div>
            )}
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

                {/* Detalles del documento */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
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
                      <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded text-xs">
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
                    {result.isValid 
                      ? "Este documento fue emitido oficialmente por Notificas.com y está certificado en la red Blockchain. Puede ser utilizado como evidencia legal."
                      : "Este documento no pudo ser verificado como auténtico. Puede ser una falsificación o haber sido modificado."
                    }
                  </p>
                </div>
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
