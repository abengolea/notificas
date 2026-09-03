"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResendCommunicationPanel } from "@/components/verify/resend-communication-panel";
import { Mail, Search } from "lucide-react";

export function ResendVerificationWorkspace({
  adminSession = false,
  campaignId,
  showHeading = true,
}: {
  adminSession?: boolean;
  campaignId?: string;
  showHeading?: boolean;
}) {
  const searchParams = useSearchParams();
  const [input, setInput] = useState("");
  const [queryId, setQueryId] = useState("");

  useEffect(() => {
    const fromUrl = (
      searchParams.get("id") ||
      searchParams.get("emailId") ||
      searchParams.get("messageId") ||
      ""
    ).trim();
    if (fromUrl) {
      setInput(fromUrl);
      setQueryId(fromUrl);
    }
  }, [searchParams]);

  const submit = () => {
    const next = input.trim();
    setQueryId(next);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {showHeading && (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Verificación Resend</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-prose">
            Comprobá el email_id contra la API de Resend y la evidencia histórica de webhooks
            conservada por Notificas. delivered no afirma bandeja de entrada; open/click no es
            lectura fehaciente.
          </p>
        </div>
      )}
      {!showHeading && (
        <p className="text-sm text-muted-foreground max-w-prose">
          Comprobá el email_id contra la API de Resend y la evidencia histórica de webhooks
          conservada por Notificas. delivered no afirma bandeja de entrada; open/click no es
          lectura fehaciente.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Identificar la comunicación
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Ingresá el ID de la notificación, el ID del destinatario de campaña, el email_id de
            Resend o el Message-ID SMTP.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="ID, campaign message ID o email_id de Resend"
              className="font-mono text-sm"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <Button type="button" onClick={submit} disabled={!input.trim()}>
              <Search className="mr-2 h-4 w-4" />
              Verificar
            </Button>
          </div>
        </CardContent>
      </Card>

      {queryId ? (
        <ResendCommunicationPanel
          messageId={queryId}
          campaignId={campaignId}
          enabled
          adminSession={adminSession}
          requireAuthPrompt={!adminSession}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Todavía no hay una comunicación seleccionada. Ingresá un identificador para ver la
          consulta en vivo y la cronología histórica.
        </p>
      )}
    </div>
  );
}
