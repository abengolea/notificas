"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, CheckCircle } from "lucide-react";

const CONFIRM_READ_URL = "https://confirmread-ju7n3yysfq-uc.a.run.app";

interface MailData {
  from?: string;
  to?: string;
  subject?: string;
  message?: {
    html?: string;
    subject?: string;
  };
  delivery?: {
    state: string;
    time: any;
    info?: string;
  };
  tracking?: {
    opened: boolean;
    openedAt: any;
    openCount: number;
    clickCount: number;
    readConfirmed: boolean;
    readConfirmedAt: any;
    sentAt: any;
    movements?: any[];
    attachmentsOpened?: number;
  };
  attachments?: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    uploadedAt: any;
    hash?: string;
    integrityCertificate?: any;
    tracking?: any;
  }>;
  createdAt?: any;
}

// Reemplaza el bloque redundante "Leer Notificación" / "[El enlace se agregará...]" con mensaje
// adecuado para cuando ya estás en el reader, y convierte "Confirmar lectura" en enlace real
function sanitizeHtmlForReader(
  html: string,
  messageId: string,
  trackingToken?: string | null
): string {
  if (!html) return "";

  let sanitized = html;

  // 1. Reemplazar "Leer Notificación" por "Confirmar lectura" (el usuario YA está leyendo)
  const confirmUrl = trackingToken
    ? `${CONFIRM_READ_URL}?msg=${encodeURIComponent(messageId)}&k=${encodeURIComponent(trackingToken)}`
    : "#";
  const confirmButtonHtml = trackingToken
    ? `<a class="btn" href="${confirmUrl}" target="_blank" rel="noopener" style="display:inline-block;background:#0D9488;color:#fff!important;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700;">Confirmar lectura</a>`
    : '<p style="margin:20px 0;padding:12px 16px;background:#dcfce7;border-radius:8px;color:#166534;font-weight:600;">✓ Ya está en la página de lectura certificada</p>';
  // Regex: botón "Leer Notificación" con href="#" → reemplazar por "Confirmar lectura"
  sanitized = sanitized.replace(
    /<a(?=[^>]*href\s*=\s*["']#["'])[^>]*>[\s]*Leer\s+Notificaci[oó]n[\s]*<\/a>/gi,
    confirmButtonHtml
  );

  // 2. Reemplazar el enlace "[El enlace se agregará al enviar el mensaje]" por mensaje útil
  sanitized = sanitized.replace(
    /<a[^>]*href\s*=\s*["']#["'][^>]*>\[El enlace se agregará al enviar el mensaje\]<\/a>/gi,
    "Ya accedió mediante el enlace del correo."
  );

  // 3. Para "Confirmar lectura": si tenemos token, usar la URL real; si no, convertir en span
  if (trackingToken) {
    const confirmUrl = `${CONFIRM_READ_URL}?msg=${encodeURIComponent(messageId)}&k=${encodeURIComponent(trackingToken)}`;
    sanitized = sanitized.replace(
      /<a([^>]*)href\s*=\s*["']#confirm["']([^>]*)>\s*Confirmar lectura\s*<\/a>/gi,
      `<a$1href="${confirmUrl}" target="_blank" rel="noopener"$2>Confirmar lectura</a>`
    );
  }

  // 4. Cualquier otro enlace con href="#" o href="#algo" que aún quede → convertir en span
  sanitized = sanitized.replace(
    /<a\s+([^>]*)href\s*=\s*["']#["']([^>]*)>([^<]*)<\/a>/gi,
    "<span $1$2>$3</span>"
  );
  sanitized = sanitized.replace(
    /<a\s+([^>]*)href\s*=\s*["']#([^"'\s>]*)["']([^>]*)>([^<]*)<\/a>/gi,
    "<span $1$3>$4</span>"
  );

  return sanitized;
}

export default function ReaderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const trackingToken = searchParams.get("k");
  const [mail, setMail] = useState<MailData | null>(null);
  const [loading, setLoading] = useState(true);

  const handleAttachmentClick = async (attachment: any) => {
    if (!mail || !params.id) return;
    try {
      await fetch('/api/track-attachment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: params.id,
          attachmentId: attachment.id,
          fileName: attachment.fileName,
          action: 'opened'
        })
      });
    } catch { /* ignore */ }
    window.open(attachment.fileUrl, '_blank');
  };

  useEffect(() => {
    if (!params.id) return;

    const unsubscribe = onSnapshot(
      doc(db, 'mail', params.id as string),
      (doc) => {
        if (doc.exists()) {
          setMail(doc.data() as MailData);
        }
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando mensaje...</p>
        </div>
      </div>
    );
  }

  if (!mail) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Mail className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Mensaje no encontrado</h1>
          <p className="text-gray-600">El mensaje que buscas no existe o ha sido eliminado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Card className="p-6 md:p-8">
          <div
            className="prose prose-lg max-w-none [&_.container]:!max-w-none [&_.wrapper]:!max-w-none [&_table]:!max-w-full"
            dangerouslySetInnerHTML={{
              __html: sanitizeHtmlForReader(
                mail?.message?.html || "",
                params.id as string,
                trackingToken
              ),
            }}
          />
          <div className="mt-8 pt-6 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {trackingToken && !mail?.tracking?.readConfirmed ? (
              <a
                href={`${CONFIRM_READ_URL}?msg=${encodeURIComponent(params.id as string)}&k=${encodeURIComponent(trackingToken)}`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors w-fit"
              >
                <CheckCircle className="h-5 w-5" />
                Confirmar que he leído
              </a>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {mail.tracking?.readConfirmed ? "Lectura confirmada." : "Acceso registrado y certificado."}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}