"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Search, CheckCircle, XCircle, FileText, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { hashArrayBuffer } from "@/lib/storage";
import { extractVerifyHints } from "@/lib/verify-hints";
import { ThemeToggle } from "@/components/theme-toggle";

interface VerificationResult {
  isValid: boolean;
  issuedByNotificas?: boolean;
  messageId?: string;
  senderName?: string;
  recipientEmail?: string;
  recipientDni?: string;
  recipientCuit?: string;
  sentAt?: string;
  hash?: string;
  hashKind?: string;
  blockchainVerified?: boolean;
  integrityValid?: boolean | null;
  snapshotHash?: string;
  wamid?: string;
  waBodyHash?: string;
  waExplorerUrl?: string;
  whatsappRole?: string;
  contentHash?: string;
  explorerUrl?: string;
  summary?: string;
  fileName?: string;
  attachmentUrl?: string;
  isCampaignDocument?: boolean;
  kindLabel?: string;
  campaignNombre?: string;
  orgNombre?: string;
  orgCuit?: string;
}

function mapVerifyApiData(
  data: Record<string, unknown> | undefined,
  extras?: Partial<VerificationResult>
): VerificationResult {
  const sentAtRaw = data?.sentAt;
  return {
    isValid: true,
    issuedByNotificas:
      data?.issuedByNotificas === true ||
      data?.isCertificate === true ||
      data?.isCampaignDocument === true,
    messageId: (data?.messageId as string) || (data?.docId as string),
    senderName: data?.senderName as string | undefined,
    recipientEmail: data?.recipientEmail as string | undefined,
    recipientDni: data?.recipientDni as string | undefined,
    recipientCuit: data?.recipientCuit as string | undefined,
    sentAt:
      typeof sentAtRaw === "string"
        ? new Date(sentAtRaw).toLocaleString("es-ES")
        : undefined,
    blockchainVerified: (data?.blockchainVerified as boolean | undefined) ?? true,
    integrityValid: (data?.integrityValid as boolean | null | undefined) ?? (data?.intact as boolean | undefined),
    snapshotHash: data?.snapshotHash as string | undefined,
    wamid: data?.wamid as string | undefined,
    waBodyHash:
      ((data?.waBodyHash as { stored?: string; current?: string } | undefined)?.stored) ||
      ((data?.waBodyHash as { stored?: string; current?: string } | undefined)?.current) ||
      (typeof data?.waBodyHash === "string" ? data.waBodyHash : undefined),
    waExplorerUrl: data?.waExplorerUrl as string | undefined,
    whatsappRole: data?.whatsappRole as string | undefined,
    contentHash:
      ((data?.contentHash as { stored?: string; current?: string } | undefined)?.stored) ||
      ((data?.contentHash as { stored?: string; current?: string } | undefined)?.current) ||
      (typeof data?.contentHash === "string" ? data.contentHash : undefined),
    explorerUrl: data?.explorerUrl as string | undefined,
    summary: data?.summary as string | undefined,
    hash: (typeof data?.hash === "string" ? data.hash : undefined),
    hashKind: data?.hashKind as string | undefined,
    orgNombre: data?.orgNombre as string | undefined,
    orgCuit: data?.orgCuit as string | undefined,
    isCampaignDocument: data?.isCampaignDocument === true,
    kindLabel: data?.kindLabel as string | undefined,
    campaignNombre: data?.campaignNombre as string | undefined,
    fileName: data?.fileName as string | undefined,
    attachmentUrl: data?.attachmentUrl as string | undefined,
    ...extras,
  };
}

export default function VerifyPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [messageIdInput, setMessageIdInput] = useState("");
  const [hashInput, setHashInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const autoVerifyDone = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = (params.get("id") || params.get("messageId") || "").trim();
    const campaignId = (params.get("campaignId") || "").trim();
    const batchId = (params.get("batchId") || "").trim();
    const kind = (params.get("kind") || "").trim();
    const hash = (params.get("hash") || params.get("h") || "").trim().toLowerCase();
    if ((!id && !campaignId && !batchId && !hash) || autoVerifyDone.current) return;
    autoVerifyDone.current = true;
    setMessageIdInput(id || campaignId);
    if (hash) setHashInput(hash);
    void (async () => {
      setIsVerifying(true);
      try {
        const response = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(id ? { messageId: id } : {}),
            ...(campaignId ? { campaignId } : {}),
            ...(batchId ? { batchId } : {}),
            ...(kind ? { kind } : {}),
            ...(hash ? { hash } : {}),
          }),
        });
        if (response.ok) {
          const data = await response.json();
          const mapped = mapVerifyApiData(data?.data, { hash: hash || (data?.data?.hash as string | undefined) });
          setResult(mapped);
          if (mapped.hash) setHashInput(mapped.hash);
        } else if (response.status === 404) {
          setResult({
            isValid: false,
            issuedByNotificas: false,
            messageId: id || campaignId,
            hash: hash || undefined,
          });
        }
      } finally {
        setIsVerifying(false);
      }
    })();
  }, []);

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
        setResult(mapVerifyApiData(data?.data));
        toast({
          title: "Certificado válido",
          description: "Notificas emitió este certificado.",
        });
      } else if (response.status === 404) {
        setResult({
          isValid: false,
          issuedByNotificas: false,
          messageId: messageId,
        });
        toast({
          title: "No emitido por Notificas",
          description: "No hay un certificado emitido con esos datos.",
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
      const buffer = await selectedFile.arrayBuffer();
      const hash = await hashArrayBuffer(buffer);
      const hints = extractVerifyHints(buffer, selectedFile.name);
      const hintText = new TextDecoder("latin1").decode(buffer);
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hash,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          hintText: hintText.slice(0, 200_000),
          campaignId: hints.campaignId,
          campaignNombre: hints.campaignNombre,
          batchId: hints.batchId,
          kind: hints.kind,
          messageId: hints.messageId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const verification = mapVerifyApiData(data?.data, {
          hash,
          fileName: (data?.data?.fileName as string | undefined) || selectedFile.name,
        });
        setResult(verification);
        toast({
          title: "Documento válido",
          description: data?.data?.isCampaignDocument
            ? "El PDF de campaña coincide con un registro de Notificas."
            : "El PDF coincide con un registro certificado.",
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
            setResult(
              mapVerifyApiData(data?.data, {
                hash,
                fileName: selectedFile.name,
              })
            );
            toast({
              title: "Certificado válido",
              description: "Notificas emitió este certificado.",
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
    <div className="brand-canvas relative min-h-screen py-8">
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
            Al escanear el QR, se carga el hash y esta página contrasta sola si Notificas lo emitió.
            También puede subir el PDF o ingresar el identificador.
          </p>
        </div>

        {hashInput && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" />
                Hash cargado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-xs break-all bg-muted rounded-md px-3 py-2">{hashInput}</p>
            </CardContent>
          </Card>
        )}

        {isVerifying && !result && (
          <Card className="mb-8">
            <CardContent className="py-8 text-center text-muted-foreground">
              Validando si Notificas emitió este certificado…
            </CardContent>
          </Card>
        )}

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
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={result.isValid ? "default" : "destructive"}>
                    {result.isValid && result.issuedByNotificas
                      ? "NOTIFICAS EMITIÓ ESTE CERTIFICADO"
                      : result.isValid
                        ? "DOCUMENTO VÁLIDO"
                        : "NOTIFICAS NO EMITIÓ ESTE DOCUMENTO"}
                  </Badge>
                  {result.blockchainVerified && result.isValid && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <Shield className="mr-1 h-3 w-3" />
                      VERIFICADO EN BLOCKCHAIN
                    </Badge>
                  )}
                </div>
                {result.isValid ? (
                  <p className="text-sm text-muted-foreground">
                    {result.hash
                      ? "El hash del QR coincide con un registro emitido por Notificas."
                      : "El identificador del QR coincide con un registro emitido por Notificas."}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No hay constancia de emisión con esos datos. El QR puede ser inventado o el documento no es de Notificas.
                  </p>
                )}

                {result.isValid ? (
                  <>
                    {/* Detalles del documento */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        {result.fileName && (
                          <div className="flex justify-between gap-3">
                            <span className="text-sm text-muted-foreground">Archivo:</span>
                            <span className="text-sm font-medium truncate max-w-[180px]" title={result.fileName}>
                              {result.fileName}
                            </span>
                          </div>
                        )}
                        {result.isCampaignDocument ? (
                          <>
                            <div className="flex justify-between gap-3">
                              <span className="text-sm text-muted-foreground">Tipo:</span>
                              <span className="text-sm font-medium">{result.kindLabel || "Documento de campaña"}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-sm text-muted-foreground">Organización:</span>
                              <span className="text-sm font-medium">{result.orgNombre || result.senderName || "—"}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-sm text-muted-foreground">Campaña:</span>
                              <span className="text-sm font-medium">{result.campaignNombre || "—"}</span>
                            </div>
                            {result.recipientEmail && (
                              <div className="flex justify-between gap-3">
                                <span className="text-sm text-muted-foreground">Destinatario:</span>
                                <span className="text-sm font-medium">{result.recipientEmail}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between gap-3">
                              <span className="text-sm text-muted-foreground">ID del Mensaje:</span>
                              <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                {result.messageId}
                              </span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-sm text-muted-foreground">Remitente:</span>
                              <span className="text-sm font-medium">{result.senderName}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-sm text-muted-foreground">Destinatario:</span>
                              <span className="text-sm font-medium">{result.recipientEmail}</span>
                            </div>
                            {result.recipientDni && (
                              <div className="flex justify-between gap-3">
                                <span className="text-sm text-muted-foreground">DNI:</span>
                                <span className="text-sm font-medium">{result.recipientDni}</span>
                              </div>
                            )}
                            {result.recipientCuit && (
                              <div className="flex justify-between gap-3">
                                <span className="text-sm text-muted-foreground">CUIT:</span>
                                <span className="text-sm font-medium">{result.recipientCuit}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <div className="space-y-2">
                        {result.sentAt && (
                          <div className="flex justify-between gap-3">
                            <span className="text-sm text-muted-foreground">Fecha de Envío:</span>
                            <span className="text-sm font-medium">{result.sentAt}</span>
                          </div>
                        )}
                        {result.hash && (
                          <div className="flex justify-between gap-3">
                            <span className="text-sm text-muted-foreground">
                              {result.hashKind === "merkle"
                                ? "Raíz Merkle:"
                                : result.hashKind === "content"
                                  ? "Hash intimación:"
                                  : result.hashKind === "csv"
                                    ? "Hash CSV:"
                                    : "Hash:"}
                            </span>
                            <span className="text-sm font-mono bg-muted px-2 py-1 rounded text-xs break-all text-right max-w-[240px]" title={result.hash}>
                              {result.hash}
                            </span>
                          </div>
                        )}
                        {result.integrityValid === true && (
                          <div className="flex justify-between gap-3">
                            <span className="text-sm text-muted-foreground">Integridad:</span>
                            <span className="text-sm font-medium">Coincide con el snapshot / Polygon</span>
                          </div>
                        )}
                        {result.integrityValid === false && (
                          <div className="flex justify-between gap-3">
                            <span className="text-sm text-muted-foreground">Integridad:</span>
                            <span className="text-sm font-medium text-destructive">No coincide</span>
                          </div>
                        )}
                        {result.contentHash && (
                          <div className="flex justify-between gap-3">
                            <span className="text-sm text-muted-foreground">Hash intimación:</span>
                            <span className="text-sm font-mono truncate max-w-[180px]" title={result.contentHash}>
                              {result.contentHash.substring(0, 16)}…
                            </span>
                          </div>
                        )}
                        {result.wamid && (
                          <div className="flex justify-between gap-3">
                            <span className="text-sm text-muted-foreground">WAMID:</span>
                            <span className="text-sm font-mono truncate max-w-[180px]" title={result.wamid}>
                              {result.wamid}
                            </span>
                          </div>
                        )}
                        {result.waBodyHash && (
                          <div className="flex justify-between gap-3">
                            <span className="text-sm text-muted-foreground">Hash aviso WA:</span>
                            <span className="text-sm font-mono truncate max-w-[180px]" title={result.waBodyHash}>
                              {result.waBodyHash.substring(0, 16)}…
                            </span>
                          </div>
                        )}
                        {result.explorerUrl && (
                          <div className="flex justify-between gap-3">
                            <span className="text-sm text-muted-foreground">Polygon (intimación):</span>
                            <a
                              href={result.explorerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-primary underline"
                            >
                              Ver transacción
                            </a>
                          </div>
                        )}
                        {result.waExplorerUrl && (
                          <div className="flex justify-between gap-3">
                            <span className="text-sm text-muted-foreground">Polygon (aviso WA):</span>
                            <a
                              href={result.waExplorerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-primary underline"
                            >
                              Ver transacción
                            </a>
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
                        {result.summary ||
                          "Este documento fue emitido por Notificas.com. La integridad se recálcula contra el snapshot sellado y, si existe, contra la transacción en Polygon."}
                      </p>
                      {result.whatsappRole && (
                        <p className="text-sm text-blue-700 mt-2">{result.whatsappRole}</p>
                      )}
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
                Notificas.com deja constancia de un mensaje digital: qué se envió, a quién y cuándo. La huella de ese texto queda en Polygon, una red pública que no se puede reescribir. El expediente (el texto y los eventos) se guarda en Notificas; no está “dentro” de la blockchain.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">2. ¿Qué se certifica?</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li><strong>Envío:</strong> qué texto salió y si el servidor de correo lo tomó para enviar (no prueba que haya llegado a la bandeja)</li>
                <li><strong>Contenido:</strong> huella del texto que ve el destinatario en el correo o en el lector</li>
                <li><strong>Aviso WhatsApp:</strong> la plantilla de Meta con los datos de esa persona, no la carta completa salvo que coincidan</li>
                <li><strong>Recepción:</strong> primer click al enlace de lectura, si ocurre — no es haber abierto Gmail u Outlook</li>
                <li><strong>Lectura:</strong> confirmación en nuestra pantalla, o WhatsApp marca el aviso como leído</li>
                <li><strong>Certificado PDF:</strong> se emite una sola vez, como una foto de ese momento. No se le agregan hechos posteriores</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">3. ¿Por qué es inmutable?</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Lo publicado en Polygon (polygonscan.com) no se puede cambiar. Esa huella sirve para comprobar que el texto es el mismo. Adjuntos y PDFs quedan trabados 5 años. El archivo de trabajo en Notificas se copia a ese depósito trabado al enviar, para que el texto también sobreviva.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">4. ¿Cómo verificar un documento?</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li><strong>Certificado de lectura (PDF):</strong> Ingrese el &quot;Identificador de mensaje&quot; que figura en el PDF.</li>
                <li><strong>Reporte o acta de campaña:</strong> Suba el PDF descargado desde la campaña. El sistema compara su hash y la referencia impresa en el documento.</li>
                <li><strong>Constancia PDF de Notificas:</strong> Suba el archivo PDF de constancia; el sistema compara su hash con el registrado en Polygon.</li>
              </ul>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg border">
              <h4 className="font-semibold text-foreground mb-2">5. Valor probatorio</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Estos PDF se pueden presentar en un expediente. No son una carta documento. Quien juzga decide qué valor les da. El certificado de lectura se saca una sola vez: es una foto de ese instante.
              </p>
            </div>

            {/* Detalle técnico */}
            <div className="border-t pt-6 mt-6">
              <h4 className="font-semibold text-foreground mb-3">Detalle técnico (para peritos e informes)</h4>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="font-medium text-foreground mb-1">Algoritmo criptográfico</p>
                  <p className="text-muted-foreground mb-2">
                    Hash SHA-256 (Secure Hash Algorithm 256 bits). Resultado: 64 caracteres hexadecimales.
                  </p>
                  <p className="font-medium text-foreground mb-1">Fórmula exacta de reproducción</p>
                  <code className="block bg-muted px-3 py-2 rounded text-xs font-mono break-all mb-2">
                    SHA-256( UTF-8( trim(texto_plano_del_mensaje) ) )
                  </code>
                  <p className="text-muted-foreground text-xs">
                    El hash se calcula sobre el <strong>texto plano del mensaje escrito por el remitente</strong> (sin HTML, sin asunto, sin boilerplate del email).
                    Es exactamente el contenido visible en el certificado, con trim() aplicado.
                    Implementación de referencia: <code className="bg-muted px-1 rounded">crypto.subtle.digest(&apos;SHA-256&apos;, new TextEncoder().encode(texto.trim()))</code> (Web Crypto API estándar, idéntica en Node.js y navegadores).
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
                    SEND|messageId|remitente|destinatario|contentHash|smtp:smtpMessageId|timestamp
                  </code>
                  <code className="block bg-muted px-3 py-2 rounded text-xs font-mono break-all mt-1">
                    FIRST_READ|messageId|usuario|contentHash|ref:txHashEnvio|timestamp
                  </code>
                  <code className="block bg-muted px-3 py-2 rounded text-xs font-mono break-all mt-1">
                    READ|messageId|usuario|timestamp
                  </code>
                  <code className="block bg-muted px-3 py-2 rounded text-xs font-mono break-all mt-1">
                    CERTIFICATE|messageId|sha256:hashPDF|ref:txHashEnvio|timestamp
                  </code>
                  <p className="text-muted-foreground mt-2">
                    El <code className="bg-muted px-1 rounded">contentHash</code> es el SHA-256 del asunto + cuerpo. El campo <code className="bg-muted px-1 rounded">ref:</code> encadena cada evento al TX de envío, permitiendo verificar la continuidad sin depender de bases de datos. El campo <code className="bg-muted px-1 rounded">smtp:</code> vincula la TX con el registro del servidor de correo.
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
                  Notificas genera un certificado PDF con hash criptográfico anclado en Polygon
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
