"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReaderPage() {
  const params = useParams();
  const search = useSearchParams();
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';
  const token = search.get('k') || '';

  const [error, setError] = useState<string | null>(null);
  const [mail, setMail] = useState<any | null>(null);

  useEffect(() => {
    if (!id || !token) {
      setError('Link inválido.');
      return;
    }
    (async () => {
      try {
        const ref = doc(db, 'mail', id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setError('Mensaje no encontrado.');
          return;
        }
        const data = snap.data() as any;
        if (data?.tracking?.token !== token) {
          setError('Acceso no autorizado.');
          return;
        }
        setMail({ id, ...data });
        // Confirmar lectura explícita si aún no está marcada
        await setDoc(ref, { tracking: { readConfirmed: true, readConfirmedAt: new Date() } }, { merge: true });
      } catch (e: any) {
        setError(e?.message || 'Error al cargar el mensaje.');
      }
    })();
  }, [id, token]);

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader><CardTitle>Lectura</CardTitle></CardHeader>
          <CardContent className="text-sm text-red-600">{error}</CardContent>
        </Card>
      </div>
    );
  }

  if (!mail) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader><CardTitle>Lectura</CardTitle></CardHeader>
          <CardContent>Cargando…</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{mail?.message?.subject || 'Sin asunto'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><strong>De:</strong> {mail.from || 'contacto@notificas.com'}</div>
          <div><strong>Para:</strong> {Array.isArray(mail.to) ? mail.to.join(', ') : mail.to}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contenido</CardTitle></CardHeader>
        <CardContent>
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: mail?.message?.html || '' }} />
        </CardContent>
      </Card>
    </div>
  );
}