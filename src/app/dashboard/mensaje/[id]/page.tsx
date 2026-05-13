"use client";

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserNav } from '@/components/dashboard/user-nav';
import { Logo } from '@/components/logo';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User as AppUser } from '@/lib/types';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, CheckCircle } from 'lucide-react';
import MailTraceability from '@/components/dashboard/mail-traceability';
import { buildSenderViewHtml } from '@/lib/message-views';
import PolygonCertifications from '@/components/dashboard/polygon-certifications';
import { AttachmentsTracking } from '@/components/dashboard/attachments-tracking';
import { DownloadCertificate } from '@/components/dashboard/download-certificate';

/** Misma lógica que /api/track-app-open: destinatarios del documento mail. */
function isAuthenticatedUserMailRecipient(mailData: Record<string, unknown>, userEmail: string | undefined) {
  if (!userEmail) return false;
  const normalizeEmail = (e: unknown) =>
    typeof e === 'string' ? e.trim().toLowerCase() : '';
  const recipientsRaw = Array.isArray(mailData.to) ? mailData.to : [mailData.to];
  const fromTo = recipientsRaw.map(normalizeEmail).filter(Boolean);
  const rec = normalizeEmail(mailData.recipientEmail);
  const recipients = [...new Set([...fromTo, rec].filter(Boolean))];
  return recipients.includes(userEmail.trim().toLowerCase());
}

function mapAuthUserToAppUser(u: any | null): AppUser | null {
  if (!u) return null;
  return {
    uid: u.uid,
    email: u.email || '',
    tipo: 'individual',
    estado: 'activo',
    perfil: { nombre: u.displayName || u.email || 'Usuario', verificado: true },
    createdAt: new Date(),
    lastLogin: new Date(),
    avatarUrl: u.photoURL || undefined,
    creditos: 0,
  };
}

function MailMessageView({ data }: { data: any }) {
  const sentAt = data?.delivery?.time?.toDate?.() || data?.tracking?.sentAt?.toDate?.() || null;
  const subject = data?.message?.subject || 'Sin asunto';
  const from = data?.from || data?.senderName || 'contacto@notificas.com';
  const to = Array.isArray(data?.to) ? data.to.join(', ') : data?.to || data?.recipientEmail || '';
  let state = data?.delivery?.state || 'PENDIENTE';

  // Traducir estados al español
  if (state === 'DELIVERED') state = 'Entregado';
  if (state === 'SUCCESS') state = 'Entregado';
  if (state === 'ERROR') state = 'Error';
  if (state === 'PENDING') state = 'Pendiente';

  // Remitente y destinatario: mismo bloque (solo cuerpo, detalles y adjuntos), sin plantilla de email.
  const bodyHtml = buildSenderViewHtml(data);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>{subject}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm text-muted-foreground">
          <div><strong className="text-foreground">De:</strong> {from}</div>
          <div><strong className="text-foreground">Para:</strong> {to}</div>
          <div><strong className="text-foreground">Estado:</strong> {state}</div>
          <div><strong className="text-foreground">Fecha:</strong> {sentAt ? sentAt.toLocaleString() : '-'}</div>
        </div>
        <div className="mt-4 prose prose-sm max-w-none [&_.mensaje-html-view]:space-y-4">
          <div className="mensaje-html-view" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        </div>
      </CardContent>
    </Card>
  );
}

function MessageContent() {
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [messageData, setMessageData] = useState<any | null>(null);
  const [trackingStopped, setTrackingStopped] = useState(false);
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : null;

  /**
   * Registra `attachment_opened` y abre el archivo en una pestaña nueva.
   * Solo se llama para destinatarios logueados (el remitente igual ve el botón, pero
   * el endpoint rechaza el evento si quien dispara no aparece como recipient — ver
   * /api/track-attachment, que valida con Bearer token).
   */
  const handleViewAttachment = async (attachmentId: string, fileUrl: string) => {
    if (!id) return;
    const attachment = (messageData?.attachments || []).find(
      (a: any) => (a.id || a.fileName) === attachmentId
    );
    try {
      const token = await auth.currentUser?.getIdToken();
      if (token) {
        await fetch('/api/track-attachment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messageId: id,
            attachmentId,
            fileName: attachment?.fileName || attachmentId,
            action: 'opened',
          }),
        });
      }
    } catch {
      /* no bloquear la apertura si falla el tracking */
    }
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };

  // Función para manejar la descarga del certificado
  const handleDownloadCertificate = async () => {
    if (!id) return;

    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/download-certificate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messageId: id
        })
      });

      if (response.ok) {
        // Crear blob del PDF
        const blob = await response.blob();
        
        // Crear enlace de descarga
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `certificado-lectura-${id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        setTrackingStopped(true);
        console.log('✅ Certificado descargado y tracking detenido');
      } else {
        const error = await response.text();
        console.error('❌ Error descargando certificado:', error);
        throw new Error(error);
      }
    } catch (error) {
      console.error('❌ Error al descargar certificado:', error);
      throw error;
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setAppUser(mapAuthUserToAppUser(u)));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        // Obtener datos del mensaje desde la colección 'mail' (misma que usa el dashboard)
        const mailSnap = await getDoc(doc(db, 'mail', id));
        if (!mailSnap.exists()) {
          setNotFound(true);
          setMessageData(null);
          return;
        }
        const mailData = mailSnap.data();
        
        setMessageData({ 
          id, 
          ...mailData
        });
        
        // Verificar si el tracking está detenido
        if (mailData.tracking?.trackingStopped) {
          setTrackingStopped(true);
        }
      } catch (e) {
        setNotFound(true);
        setMessageData(null);
      }
    })();
  }, [id]);

  // Trackear apertura solo si quien entra es destinatario (no el remitente en el panel).
  useEffect(() => {
    if (!id || !appUser?.email || trackingStopped || !messageData) return;
    if (!isAuthenticatedUserMailRecipient(messageData, appUser.email)) return;

    const timer = setTimeout(async () => {
      // Verificar que estamos en el cliente
      if (typeof window === 'undefined') return;

      try {
        console.log('📱 Registrando apertura desde app para mensaje:', id);
        
        // Crear un AbortController para timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 10000); // 10 segundos timeout
        
        try {
          const apiUrl = `${window.location.origin}/api/track-app-open`;
          const token = await auth.currentUser?.getIdToken();

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              messageId: id,
              userEmail: appUser.email
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response) {
            console.error('❌ No se recibió respuesta del servidor');
            return;
          }

          if (response.ok) {
            try {
              const result = await response.json();
              console.log('✅ Apertura desde app registrada:', result);
            } catch (jsonError) {
              console.error('❌ Error parseando respuesta JSON:', jsonError);
            }
          } else {
            try {
              const errorText = await response.text();
              console.error('❌ Error al registrar apertura desde app:', response.status, response.statusText, errorText);
            } catch (textError) {
              console.error('❌ Error leyendo respuesta de error:', response.status, response.statusText);
            }
          }
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          
          if (fetchError.name === 'AbortError') {
            console.error('❌ Timeout al trackear apertura desde app (10s)');
          } else if (fetchError.message === 'Failed to fetch' || fetchError.message?.includes('fetch')) {
            console.error('❌ Error de red al trackear apertura desde app:', {
              message: fetchError.message,
              name: fetchError.name,
              stack: fetchError.stack
            });
            console.error('💡 Verifica que el servidor esté corriendo en', window.location.origin);
          } else {
            console.error('❌ Error al trackear apertura desde app:', {
              error: fetchError,
              message: fetchError?.message,
              name: fetchError?.name
            });
          }
        }
      } catch (error: any) {
        console.error('❌ Error inesperado al trackear apertura desde app:', {
          error,
          message: error?.message,
          name: error?.name,
          stack: error?.stack
        });
      }
    }, 500); // Esperar 500ms para asegurar que el mensaje se cargó

    return () => clearTimeout(timer);
  }, [id, appUser?.email, trackingStopped, messageData]);

  if (notFound) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center text-center p-4">
        <h1 className="text-2xl font-bold">Mensaje no encontrado</h1>
        <p className="text-muted-foreground">El mensaje que estás buscando no existe o fue eliminado.</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard">Volver al Dashboard</Link>
        </Button>
      </div>
    );
  }

  if (!messageData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Cargando mensaje...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-6">
        <div className='hidden lg:flex items-center gap-2'>
          <Logo className="h-10 w-auto" />
          <span className="font-bold text-xl">Notificas</span>
        </div>
        <div className="flex-1">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver</span>
            </Link>
          </Button>
        </div>
        {appUser ? <UserNav user={appUser} /> : null}
      </header>

      <main className="flex-1 p-4 md:p-8 lg:p-12">
        <div className="mx-auto max-w-4xl space-y-6">
          {messageData?.message?.subject ? (
            <>
              <MailMessageView data={messageData} />
              <MailTraceability mail={messageData} />
              {/**
                * Sección de adjuntos con tracking: el botón "Ver Documento" dispara
                * /api/track-attachment (registra `attachment_opened`) y abre el archivo en otra pestaña.
                * Mapeamos del shape Firestore (fileName/fileSize/fileUrl) al shape del componente (name/size/url).
                */}
              {Array.isArray(messageData.attachments) && messageData.attachments.length > 0 && (
                <AttachmentsTracking
                  attachments={messageData.attachments.map((a: any) => ({
                    id: a.id || a.fileName,
                    name: a.fileName,
                    size: a.fileSize || 0,
                    url: a.fileUrl,
                    hash: a.hash,
                    integrityCertificate: a.integrityCertificate,
                    tracking: a.tracking,
                  }))}
                  onViewPDF={handleViewAttachment}
                />
              )}
              <PolygonCertifications certifications={messageData.polygonCertifications} messageId={id ?? undefined} />
              
              {/* Botón de descarga de certificado - SIEMPRE DISPONIBLE */}
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <div className="flex items-center justify-center gap-2 text-lg font-semibold text-gray-700">
                      <FileText className="h-5 w-5" />
                      {trackingStopped ? 'Descargar Certificado de Lectura' : 'Generar Certificado de Lectura'}
                    </div>
                    <p className="text-sm text-gray-600 max-w-2xl mx-auto">
                      {trackingStopped 
                        ? 'Descarga el certificado PDF oficial ya generado con toda la información del mensaje, movimientos registrados y documentos adjuntos para presentar ante autoridades.'
                        : 'Descarga un certificado PDF oficial con toda la información del mensaje, movimientos registrados y documentos adjuntos para presentar ante autoridades.'
                      }
                    </p>
                    {id && (
                      <DownloadCertificate 
                        messageId={id}
                        onDownload={handleDownloadCertificate}
                      />
                    )}
                    
                    {/* Mensaje si el tracking está detenido */}
                    {trackingStopped && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-green-700 mb-2">
                          <CheckCircle className="h-4 w-4" />
                          Certificado Generado
                        </div>
                        <p className="text-xs text-green-800">
                          El tracking ha sido detenido. Ya no se registrarán nuevos movimientos para este mensaje.
                        </p>
                        <p className="text-xs text-green-800 mt-1">
                          ✅ Este mensaje está listo para ser presentado ante autoridades judiciales.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card><CardHeader><CardTitle>Mensaje no compatible</CardTitle></CardHeader><CardContent>El formato de este mensaje no es compatible.</CardContent></Card>
          )}
        </div>
      </main>
    </div>
  );
}

export default function MessageDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Cargando mensaje...</p>
        </div>
      </div>
    }>
      <MessageContent />
    </Suspense>
  );
}
