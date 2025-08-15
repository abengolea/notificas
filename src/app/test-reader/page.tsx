"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import MailTraceability from "@/components/dashboard/mail-traceability";

export default function TestReaderPage() {
  const [docId, setDocId] = useState("");
  const [token, setToken] = useState("");
  const [mail, setMail] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const readerUrl = docId && token ? `/reader/${encodeURIComponent(docId)}?k=${encodeURIComponent(token)}` : "";

  const fetchMail = async () => {
    setError(null);
    setMail(null);
    try {
      if (!docId) {
        setError("Ingresa un ID de documento");
        return;
      }
      const snap = await getDoc(doc(db, "mail", docId));
      if (!snap.exists()) {
        setError("Documento no encontrado");
        return;
      }
      const data = snap.data() as any;
      setMail({ id: docId, ...data });
      if (!token && data?.tracking?.token) setToken(data.tracking.token);
    } catch (e: any) {
      setError(e?.message || "Error al cargar");
    }
  };

  useEffect(() => {
    // Intentar autocompletar token si ya cargamos el mail
    if (mail && !token && mail.tracking?.token) setToken(mail.tracking.token);
  }, [mail, token]);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Test Reader (Flujo destinatario)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">mail/{"{id}"}</label>
              <Input value={docId} onChange={(e) => setDocId(e.target.value)} placeholder="ID de documento en mail" />
            </div>
            <div>
              <label className="block text-sm mb-1">Token (k)</label>
              <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="token de tracking (k)" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchMail}>Cargar</Button>
            <Button variant="outline" disabled={!readerUrl} asChild>
              <a href={readerUrl || "#"} target="_blank" rel="noopener noreferrer">Abrir lector</a>
            </Button>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          {readerUrl && (
            <div className="text-xs opacity-80 break-all">URL lector: {readerUrl}</div>
          )}
        </CardContent>
      </Card>

      {mail && (
        <>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>{mail?.message?.subject || "Sin asunto"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><strong>De:</strong> {mail.from || "contacto@notificas.com"}</div>
              <div><strong>Para:</strong> {Array.isArray(mail.to) ? mail.to.join(", ") : mail.to}</div>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader><CardTitle>Contenido</CardTitle></CardHeader>
            <CardContent>
              <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: mail?.message?.html || "" }} />
            </CardContent>
          </Card>

          <MailTraceability mail={mail} />
        </>
      )}
    </div>
  );
}