"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { addDoc, collection, doc, onSnapshot } from "firebase/firestore";
import { scheduleEmail } from "@/lib/email";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TestEmailPage() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("Prueba Notificas");
  const [html, setHtml] = useState("<h1>Hola</h1><p>Esto es una prueba de envío</p>");
  const [docId, setDocId] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<any | null>(null);
  const [tracking, setTracking] = useState<any | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const email = auth.currentUser?.email || "";
    if (!to && email) setTo(email);
  }, []);

  useEffect(() => {
    if (!docId) return;
    const unsub = onSnapshot(doc(db, "mail", docId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as any;
      setDelivery(data.delivery || null);
      setTracking(data.tracking || null);
    });
    return () => unsub();
  }, [docId]);

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      const id = await scheduleEmail({ to, subject, html });
      setDocId(id);
    } catch (e: any) {
      setError(e?.message || "Error desconocido");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Prueba de Envío de Email (Firestore -> Cloud Function)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Destinatario</label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="correo@dominio.com" />
          </div>
          <div>
            <label className="block text-sm mb-1">Asunto</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">Contenido HTML</label>
            <Textarea className="min-h-[160px]" value={html} onChange={(e) => setHtml(e.target.value)} />
          </div>
          <Button onClick={handleSend} disabled={sending || !to}> {sending ? "Enviando..." : "Enviar prueba"} </Button>
        </CardContent>
      </Card>

      {docId && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><strong>Documento:</strong> {docId}</div>
            <div><strong>Estado de entrega:</strong> {delivery?.state || "PENDIENTE"}</div>
            {delivery?.error && <div className="text-red-600"><strong>Error:</strong> {delivery.error}</div>}
            <div><strong>Info:</strong> {delivery?.info || "-"}</div>
            {tracking && (
              <div className="mt-2">
                <div><strong>Tracking:</strong> opened={String(tracking.opened)} openCount={tracking.openCount || 0} clickCount={tracking.clickCount || 0}</div>
              </div>
            )}
            <div className="mt-2 opacity-70">Actualiza esta sección en vivo desde Firestore.</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}