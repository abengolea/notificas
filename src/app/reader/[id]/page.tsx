"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Card } from "@/components/ui/card";
import { Mail, CheckCircle } from "lucide-react";
import { injectContentForReader } from "@/lib/inject-content-for-reader";
import { ThemeToggle } from "@/components/theme-toggle";

const CONFIRM_READ_URL = "https://confirmread-ju7n3yysfq-uc.a.run.app";

interface MailData {
  from?: string;
  to?: string;
  subject?: string;
  message?: {
    html?: string;
    subject?: string;
    content?: string;
    details?: { priority?: string; requireCertificate?: boolean; fecha?: string; attachmentsCount?: number };
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

// En el reader, el usuario YA accedió. Quitar bloque redundante:
// "Acceder a la notificación" + "Si el botón no funciona... Ya accedió mediante el enlace del correo."
// El botón "Confirmar que he leído" se muestra aparte al final de la página.
function sanitizeHtmlForReader(
  html: string,
  messageId: string,
  trackingToken?: string | null
): string {
  if (!html) return "";

  let sanitized = html;

  // 1. Quitar el párrafo "Si el boton no funciona, copie y pegue este enlace..."
  sanitized = sanitized.replace(
    /<p[^>]*class="muted"[^>]*>[\s\S]*?Si el boton no funciona[\s\S]*?<\/p>/gi,
    ""
  );

  // 2. Quitar el párrafo con el botón "Acceder a la notificación" (redundante: ya está leyendo)
  sanitized = sanitized.replace(
    /<p[^>]*style="margin:\s*20px\s*0;"[^>]*>[\s\S]*?(?:Acceder\s+a\s+la\s+notificaci[oó]n|Leer\s+Notificaci[oó]n)[\s\S]*?<\/p>/gi,
    ""
  );

  // 3. Si quedó un p vacío o solo espacios, limpiar
  sanitized = sanitized.replace(/<p[^>]*>\s*<\/p>/gi, "");

  return sanitized;
}

export default function ReaderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const trackingToken = searchParams.get("k");
  const [mail, setMail] = useState<MailData | null>(null);
  const [loading, setLoading] = useState(true);
  /** Permiso Firestore denegado o enlace incorrecto — mensaje más claro que "no existe". */
  const [accessDenied, setAccessDenied] = useState(false);

  const handleAttachmentClick = async (attachment: any) => {
    if (!mail || !params.id) return;
    try {
      await fetch('/api/track-attachment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: params.id,
          attachmentId: attachment.id || (attachment.hash ? `hash:${attachment.hash}` : attachment.fileName),
          fileName: attachment.fileName,
          action: 'opened',
          k: trackingToken, // magic link token para autenticación del reader público
        })
      });
    } catch { /* ignore */ }
    window.open(attachment.fileUrl, '_blank');
  };

  useEffect(() => {
    if (!params.id) return;

    const id = params.id as string;

    // Enlace estándar: ?k=... — Firestore en cliente no permite lectura anónima (reglas mailReadable).
    if (trackingToken) {
      let cancelled = false;
      setAccessDenied(false);
      setLoading(true);

      fetch(
        `/api/mail/for-reader?id=${encodeURIComponent(id)}&k=${encodeURIComponent(trackingToken)}`
      )
        .then(async (res) => {
          if (!res.ok) {
            if (!cancelled) {
              setMail(null);
              setAccessDenied(res.status === 401);
            }
            return;
          }
          const payload = await res.json();
          if (!cancelled && payload.mail) {
            setMail(payload.mail as MailData);
          }
        })
        .catch(() => {
          if (!cancelled) setMail(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }

    // Sin `k`: solo usuarios Firebase con permiso en rules pueden leer (p. ej. enlace viejo guardado).
    setAccessDenied(false);
    let unsubAuth: (() => void) | undefined;
    let unsubSnap: (() => void) | undefined;

    unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubSnap?.();
      unsubSnap = undefined;

      if (!user) {
        setMail(null);
        setLoading(false);
        setAccessDenied(true);
        return;
      }

      setLoading(true);
      unsubSnap = onSnapshot(
        doc(db, "mail", id),
        (d) => {
          if (d.exists()) setMail(d.data() as MailData);
          else setMail(null);
          setLoading(false);
          setAccessDenied(false);
        },
        () => {
          setMail(null);
          setLoading(false);
          setAccessDenied(true);
        }
      );
    });

    return () => {
      unsubAuth?.();
      unsubSnap?.();
    };
  }, [params.id, trackingToken]);

  useEffect(() => {
    if (!params.id || !trackingToken || mail?.tracking?.readConfirmed) return;
    const id = params.id as string;
    const k = trackingToken;
    const t = window.setInterval(() => {
      fetch(`/api/mail/for-reader?id=${encodeURIComponent(id)}&k=${encodeURIComponent(k)}`)
        .then(async (res) => {
          if (!res.ok) return;
          const payload = await res.json();
          if (payload.mail?.tracking?.readConfirmed) {
            setMail(payload.mail as MailData);
          }
        })
        .catch(() => {});
    }, 6000);
    return () => window.clearInterval(t);
  }, [params.id, trackingToken, mail?.tracking?.readConfirmed]);

  useEffect(() => {
    if (!params.id || !trackingToken || !mail?.tracking?.readConfirmed) return;
    const id = params.id as string;
    fetch('/api/campaigns/sync-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mailId: id, k: trackingToken }),
    }).catch(() => {});
  }, [params.id, trackingToken, mail?.tracking?.readConfirmed]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando mensaje...</p>
        </div>
      </div>
    );
  }

  if (!mail) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Mail className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {accessDenied && !trackingToken
              ? "Enlace incompleto"
              : accessDenied && trackingToken
                ? "Enlace no válido"
                : "Mensaje no encontrado"}
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            {!trackingToken && accessDenied ? (
              <>
                Esta dirección debe incluir el parámetro de seguridad del correo
                (<code className="text-xs bg-muted px-1 rounded">?k=...</code>). Usa el botón o el
                enlace completo que recibiste.
              </>
            ) : accessDenied && trackingToken ? (
              <>El token del enlace no coincide con este mensaje. Solicita que te reenvíen la notificación.</>
            ) : (
              <>El mensaje que buscas no existe o ha sido eliminado.</>
            )}
          </p>
        </div>
      </div>
    );
  }

  const hasAttachments = Array.isArray(mail?.attachments) && mail.attachments.length > 0;

  return (
    <div className="relative min-h-screen bg-background py-8 px-4">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <div className="max-w-4xl mx-auto">
        <Card className="p-6 md:p-8">
          {/* Template de notificación (cabecera NOTIFICACIÓN, cuerpo, etc.) */}
          <div
            className="prose prose-lg max-w-none [&_.container]:!max-w-none [&_.wrapper]:!max-w-none [&_table]:!max-w-full"
            dangerouslySetInnerHTML={{
              __html: sanitizeHtmlForReader(
                injectContentForReader(mail?.message?.html || "", mail),
                params.id as string,
                trackingToken
              ),
            }}
          />

          {/* Adjuntos con enlace para ver/descargar */}
          {hasAttachments && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-foreground mb-3">
                Documentos adjuntos ({mail!.attachments!.length})
              </h2>
              <div className="space-y-3">
                {mail!.attachments!.map((att: any) => (
                  <div
                    key={att.id || att.fileName}
                    className="flex items-center gap-4 p-3 bg-card border border-border rounded-lg hover:bg-muted/40 transition-colors"
                  >
                    <div className="w-10 h-10 bg-destructive/15 rounded flex items-center justify-center">
                      <span className="text-destructive font-bold text-xs">
                        {(att.fileName || "").split(".").pop()?.toUpperCase() || "DOC"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{att.fileName}</p>
                      <p className="text-sm text-muted-foreground">
                        {att.fileSize ? `${(att.fileSize / 1024).toFixed(1)} KB` : ""}
                        {att.hash ? " • Con hash de integridad" : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAttachmentClick(att)}
                      className="shrink-0 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium text-sm"
                    >
                      Ver documento
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-8 pt-6 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {trackingToken && !mail?.tracking?.readConfirmed ? (
              <a
                href={`${CONFIRM_READ_URL}?msg=${encodeURIComponent(params.id as string)}&k=${encodeURIComponent(trackingToken)}`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors w-fit"
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