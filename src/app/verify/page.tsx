"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Search, CheckCircle, XCircle, FileText, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generatePDFHash } from "@/lib/storage";
import { ThemeToggle } from "@/components/theme-toggle";

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
  const [messageIdInput, setMessageIdInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const handleMessageIdVerification = async () => {
    const messageId = messageIdInput.trim();
    if (!messageId) {
      toast({
        title: "Error",
        description: "Ingrese el ID del mensaje del certificado",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    setResult(null);
    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
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
          blockchainVerified: data?.data?.blockchainVerified ?? true,
        };
        setResult(verification);
        toast({
          title: "Certificado válido",
          description: "El mensaje existe y fue certificado por Notificas.com.",
        });
      } else if (response.status === 404) {
        setResult({
          isValid: false,
          messageId: messageId,
        });
        toast({
          title: "No encontrado",
          description: "No existe un certificado con ese ID de mensaje.",
          variant: "destructive",
        });
      } else {
        throw new Error("Respuesta inválida");
      }
    } catch (error) {
      console.error("Error verificando por ID:", error);
      setResult({ isValid: false });
      toast({
        title: "Error",
        description: "No se pudo verificar. Intenta nuevamente.",
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
        // Intentar verificar por ID extraído del nombre del archivo (certificado-lectura-{id}.pdf)
        const match = selectedFile.name.match(/^certificado-lectura-([^.]+)\.pdf$/i);
        if (match) {
          const messageId = match[1];
          const idResponse = await fetch("/api/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId }),
          });
          if (idResponse.ok) {
            const data = await idResponse.json();
            setResult({
              isValid: true,
              messageId: data?.data?.messageId || data?.data?.docId,
              senderName: data?.data?.senderName,
              recipientEmail: data?.data?.recipientEmail,
              sentAt: data?.data?.sentAt
                ? new Date(data.data.sentAt).toLocaleString("es-ES")
                : undefined,
              hash,
              blockchainVerified: data?.data?.blockchainVerified ?? true,
              fileName: selectedFile.name,
            });
            toast({
              title: "Certificado válido",
              description: "El certificado fue emitido por Notificas.com.",
            });
            return;
          }
        }
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
    <div className="relative min-h-screen bg-background py-8">
      <div className="absolute right-4 top-4 md:right-8 z-10">
        <ThemeToggle />
      </div>
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Verificar Autenticidad de Documentos
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
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

        {/* O verificar por ID de certificado (certificado de lectura) */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1 h-px bg-gray-300" />
          <span className="text-sm text-gray-500 font-medium">O verificar por ID</span>
          <div className="flex-1 h-px bg-gray-300" />
        </div>
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Certificado de Lectura
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Si descargaste un certificado de lectura del dashboard, copia el &quot;Identificador de mensaje&quot; que figura en el PDF e ingrésalo aquí.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <input
                type="text"
                value={messageIdInput}
                onChange={(e) => setMessageIdInput(e.target.value)}
                placeholder="Ej: abc123xyz..."
                className="flex-1 px-3 py-2 border rounded-md font-mono text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleMessageIdVerification()}
              />
              <Button
                onClick={handleMessageIdVerification}
                disabled={isVerifying || !messageIdInput.trim()}
              >
                {isVerifying ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
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
                        {result.fileName && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Archivo:</span>
                            <span className="text-sm font-medium truncate max-w-[180px]" title={result.fileName}>
                              {result.fileName}
                            </span>
                          </div>
                        )}
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
                        {result.hash && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Hash:</span>
                            <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded text-xs" title={result.hash}>
                              {result.hash.substring(0, 16)}...
                            </span>
                          </div>
                        )}
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
                    {(result.fileName || result.messageId) && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">{result.fileName ? "Archivo:" : "ID buscado:"}</span>
                        <span className="text-sm font-medium truncate max-w-[200px]" title={result.fileName || result.messageId || ""}>
                          {result.fileName || result.messageId}
                        </span>
                      </div>
                    )}
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

        {/* Sistema de certificación - Explicación para usuarios y autoridades */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-primary" />
              Cómo funciona el sistema de certificación
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Información para usuarios, autoridades y magistrados
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-semibold text-foreground mb-2">1. ¿Qué es Notificas.com?</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Notificas.com es un sistema de notificaciones fehacientes digitales que permite enviar comunicaciones con valor probatorio. Cada mensaje enviado queda registrado de forma inmutable en la blockchain de Polygon (red pública, descentralizada y auditable).
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">2. ¿Qué se certifica?</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li><strong>Envío:</strong> Cuándo y por quién se envió el mensaje</li>
                <li><strong>Contenido:</strong> Hash criptográfico (SHA-256) del asunto y cuerpo, registrado en blockchain</li>
                <li><strong>Recepción:</strong> Cuándo el destinatario accedió al mensaje</li>
                <li><strong>Lectura:</strong> Cuándo se descargó el certificado oficial</li>
                <li><strong>Adjuntos:</strong> Hash de integridad de cada archivo adjunto</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">3. ¿Por qué es inmutable?</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Las transacciones se registran en la blockchain de Polygon (polygonscan.com). Una vez confirmadas, no pueden modificarse. La verificación de integridad del contenido utiliza el hash almacenado en la blockchain como fuente de verdad, no en bases de datos centralizadas.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">4. ¿Cómo verificar un documento?</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li><strong>Certificado de lectura (PDF):</strong> Ingrese el &quot;Identificador de mensaje&quot; que figura en el PDF.</li>
                <li><strong>Adjunto enviado por correo:</strong> Suba el archivo PDF original; el sistema compara su hash con el registrado.</li>
              </ul>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg border">
              <h4 className="font-semibold text-foreground mb-2">5. Valor probatorio</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Los certificados emitidos por Notificas.com pueden ser presentados ante autoridades administrativas, judiciales o cualquier organismo público o privado como medio de prueba del envío, contenido, recepción y/o lectura del mensaje. Las transacciones en blockchain son verificables de forma independiente en polygonscan.com.
              </p>
            </div>

            {/* Detalle técnico */}
            <div className="border-t pt-6 mt-6">
              <h4 className="font-semibold text-foreground mb-3">Detalle técnico (para peritos e informes)</h4>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="font-medium text-foreground mb-1">Algoritmo criptográfico</p>
                  <p className="text-muted-foreground">
                    Hash SHA-256 (Secure Hash Algorithm 256 bits). El contenido se normaliza (asunto + cuerpo en texto plano, sin HTML) y se codifica en UTF-8 antes de calcular el hash. Resultado: 64 caracteres hexadecimales.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Red blockchain</p>
                  <p className="text-muted-foreground">
                    Polygon Mainnet (Chain ID: 137). Red pública, descentralizada, con consenso Proof of Stake. Explorador: <a href="https://polygonscan.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">polygonscan.com</a>.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Formato del payload en blockchain</p>
                  <p className="text-muted-foreground mb-1">Cada transacción incluye datos codificados en UTF-8. Tipos de evento:</p>
                  <code className="block bg-muted px-3 py-2 rounded text-xs font-mono break-all">
                    SEND|messageId|remitente|destinatario|contentHash|timestamp
                  </code>
                  <code className="block bg-muted px-3 py-2 rounded text-xs font-mono break-all mt-1">
                    RECEIVE|messageId|usuario|timestamp
                  </code>
                  <code className="block bg-muted px-3 py-2 rounded text-xs font-mono break-all mt-1">
                    READ|messageId|usuario|timestamp
                  </code>
                  <p className="text-muted-foreground mt-2">
                    El <code className="bg-muted px-1 rounded">contentHash</code> es el SHA-256 del contenido. Cualquier alteración del mensaje produce un hash distinto.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Verificación de integridad (fuente de verdad)</p>
                  <p className="text-muted-foreground">
                    El sistema obtiene el hash certificado directamente de la transacción en Polygon (no de bases de datos). Flujo: 1) Obtener tx por hash; 2) Decodificar datos de la tx; 3) Extraer contentHash del payload; 4) Calcular hash del contenido actual; 5) Comparar. Si coinciden, el contenido no fue alterado.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Verificación independiente</p>
                  <p className="text-muted-foreground">
                    Cualquier persona puede verificar una transacción en polygonscan.com ingresando el hash de la tx (visible en el certificado PDF). Los datos de la transacción son públicos e inmutables.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pasos de verificación */}
        <Card>
          <CardHeader>
            <CardTitle>Pasos de verificación</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-semibold mb-2">1. Documento</h3>
                <p className="text-sm text-gray-600">
                  Notificas genera un PDF con hash criptográfico o adjuntos con hash de integridad
                </p>
              </div>
              <div className="text-center">
                <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Shield className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-semibold mb-2">2. Blockchain</h3>
                <p className="text-sm text-gray-600">
                  Envío, contenido, recepción y lectura se registran en Polygon (inmutable)
                </p>
              </div>
              <div className="text-center">
                <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-semibold mb-2">3. Verificación</h3>
                <p className="text-sm text-gray-600">
                  Ingrese el ID del certificado o suba el PDF adjunto para verificar
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
