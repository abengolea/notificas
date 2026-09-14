"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle, FileText, Search, Shield, Upload, XCircle } from "lucide-react";

import { BrazilHeader } from "@/components/br/brazil-header";
import { PublicFooter } from "@/components/public-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { BRAZIL_PATH } from "@/lib/brazil-site";
import { hashArrayBuffer } from "@/lib/storage";
import { extractVerifyHints } from "@/lib/verify-hints";

type VerifyResult = {
  isValid: boolean;
  issuedByNotificas?: boolean;
  messageId?: string;
  hash?: string;
  fileName?: string;
  summary?: string;
};

function mapResult(
  data: Record<string, unknown> | undefined,
  extras?: Partial<VerifyResult>
): VerifyResult {
  return {
    isValid: true,
    issuedByNotificas:
      data?.issuedByNotificas === true ||
      data?.isCertificate === true ||
      data?.isCampaignDocument === true,
    messageId: (data?.messageId as string) || (data?.docId as string),
    hash: typeof data?.hash === "string" ? data.hash : undefined,
    fileName: data?.fileName as string | undefined,
    summary: data?.summary as string | undefined,
    ...extras,
  };
}

export function BrazilVerify() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [messageIdInput, setMessageIdInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autoVerifyDone = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = (params.get("id") || params.get("messageId") || "").trim();
    const hash = (params.get("hash") || params.get("h") || "").trim().toLowerCase();
    if ((!id && !hash) || autoVerifyDone.current) return;
    autoVerifyDone.current = true;
    setMessageIdInput(id);
    void runVerify({ messageId: id || undefined, hash: hash || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot from the query string
  }, []);

  async function runVerify(body: Record<string, unknown>) {
    setIsVerifying(true);
    setResult(null);
    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        const data = await response.json();
        setResult(mapResult(data?.data, { hash: body.hash as string | undefined }));
        return;
      }
      if (response.status === 404) {
        setResult({
          isValid: false,
          issuedByNotificas: false,
          messageId: typeof body.messageId === "string" ? body.messageId : undefined,
          hash: typeof body.hash === "string" ? body.hash : undefined,
          fileName: typeof body.fileName === "string" ? body.fileName : undefined,
        });
        return;
      }
      throw new Error("verify-failed");
    } catch {
      setResult({ isValid: false });
      toast({
        variant: "destructive",
        title: "Não foi possível verificar",
        description: "Tente de novo em alguns minutos.",
      });
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleFileVerification() {
    if (!selectedFile) {
      toast({
        variant: "destructive",
        title: "Falta o arquivo",
        description: "Selecione o PDF do comprovante.",
      });
      return;
    }
    const buffer = await selectedFile.arrayBuffer();
    const hash = await hashArrayBuffer(buffer);
    const hints = extractVerifyHints(buffer, selectedFile.name);
    const hintText = new TextDecoder("latin1").decode(buffer);
    await runVerify({
      hash,
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      hintText: hintText.slice(0, 200_000),
      campaignId: hints.campaignId,
      campaignNombre: hints.campaignNombre,
      batchId: hints.batchId,
      kind: hints.kind,
      messageId: hints.messageId,
    });
  }

  function acceptFile(file: File | undefined) {
    if (!file) return;
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setSelectedFile(file);
      return;
    }
    setSelectedFile(null);
    toast({
      variant: "destructive",
      title: "Arquivo inválido",
      description: "Envie um PDF do comprovante gerado pela Notificas.",
    });
  }

  const authentic = Boolean(result?.isValid && result.issuedByNotificas);

  return (
    <div className="brand-canvas flex min-h-screen flex-col text-foreground">
      <BrazilHeader />
      <main className="flex-1 px-4 py-12 sm:py-16">
        <div className="container max-w-3xl">
          <p className="mb-4 text-sm text-muted-foreground">
            <Link href={BRAZIL_PATH} className="underline-offset-4 hover:underline">
              Notificas Brasil
            </Link>
            {" / "}
            Verificar evidência
          </p>
          <h1 className="section-title mb-4">Verificar evidência</h1>
          <p className="mb-10 max-w-[65ch] leading-relaxed text-muted-foreground">
            Envie o PDF gerado pela Notificas ou informe o identificador da comunicação.
            Comparamos o arquivo e os dados com o registro técnico original. A consulta é pública:
            não é preciso ter conta.
          </p>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" aria-hidden />
                Verificar PDF
              </CardTitle>
            </CardHeader>
            <CardContent>
              <input
                id="br-verify-file"
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(event) => acceptFile(event.target.files?.[0])}
              />
              <div
                className={`cursor-pointer rounded-lg border border-dashed px-6 py-10 text-center transition-colors ${
                  isDragging ? "border-primary bg-primary/5" : "border-border"
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  acceptFile(event.dataTransfer.files?.[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <Upload className="mx-auto h-8 w-8 text-primary" aria-hidden />
                <p className="mt-3 font-semibold">
                  {selectedFile ? selectedFile.name : "Enviar ou arrastar o PDF"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Formato aceito: PDF</p>
              </div>
              <div className="mt-6 flex justify-end">
                <Button
                  type="button"
                  onClick={() => void handleFileVerification()}
                  disabled={isVerifying || !selectedFile}
                >
                  <Search className="mr-2 h-4 w-4" aria-hidden />
                  {isVerifying ? "Verificando…" : "Verificar PDF"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" aria-hidden />
                Verificar pelo identificador
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                Use o identificador da mensagem impresso no comprovante.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={messageIdInput}
                  onChange={(event) => setMessageIdInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void runVerify({ messageId: messageIdInput.trim() });
                    }
                  }}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                  placeholder="Identificador da comunicação"
                  aria-label="Identificador da comunicação"
                />
                <Button
                  type="button"
                  onClick={() => void runVerify({ messageId: messageIdInput.trim() })}
                  disabled={isVerifying || !messageIdInput.trim()}
                >
                  Verificar
                </Button>
              </div>
            </CardContent>
          </Card>

          {result ? (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {authentic ? (
                    <CheckCircle className="h-5 w-5 text-emerald-600" aria-hidden />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive" aria-hidden />
                  )}
                  Resultado da verificação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-relaxed">
                <p className="font-semibold">
                  {authentic
                    ? "Comprovante autêntico gerado pela Notificas."
                    : "Não foi possível validar este comprovante."}
                </p>
                <p className="text-muted-foreground">
                  {authentic
                    ? "O arquivo ou o identificador coincide com o registro técnico original."
                    : "Não há registro emitido com esses dados. Confira se o PDF é o original gerado pela plataforma."}
                </p>
                {result.messageId ? (
                  <p>
                    Identificador:{" "}
                    <span className="font-mono">{result.messageId}</span>
                  </p>
                ) : null}
                {result.hash ? (
                  <p className="break-all">
                    Hash: <span className="font-mono text-xs">{result.hash}</span>
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <section className="max-w-[65ch] space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            <h2 className="section-title text-foreground">Como a verificação funciona</h2>
            <p>
              A Notificas gera evidência digital e trilha de auditoria. O PDF é um comprovante do
              que estava registrado naquele instante. A consulta pública compara identificadores e
              hash com o registro original — não transforma a Notificas em autoridade certificadora
              nem em certificadora ICP-Brasil.
            </p>
            <p>
              Enviar não é o mesmo que entregar. O comprovante descreve os eventos técnicos
              disponíveis: envio, entrega quando o canal informa e leitura quando disponível.
            </p>
          </section>
        </div>
      </main>
      <PublicFooter locale="pt-BR" />
    </div>
  );
}
