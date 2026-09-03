"use client";

import Link from "next/link";
import { ArrowLeft, FileText, CheckCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { UserNav } from "@/components/dashboard/user-nav";
import { Logo } from "@/components/logo";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import type { User as AppUser } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MailTraceability from "@/components/dashboard/mail-traceability";
import { buildSenderViewHtml } from "@/lib/message-views";
import PolygonCertifications from "@/components/dashboard/polygon-certifications";
import { DownloadCertificate } from "@/components/dashboard/download-certificate";
import { emailDeliveryLabel } from "@/lib/email-delivery-label";
import { isSyntheticCampaignEmail } from "@/lib/parse-campaign-csv";

function isAuthenticatedUserMailRecipient(mailData: Record<string, unknown>, userEmail: string | undefined) {
  if (!userEmail) return false;
  const normalizeEmail = (e: unknown) => (typeof e === "string" ? e.trim().toLowerCase() : "");
  const recipientsRaw = Array.isArray(mailData.to) ? mailData.to : [mailData.to];
  const fromTo = recipientsRaw.map(normalizeEmail).filter(Boolean);
  const rec = normalizeEmail(mailData.recipientEmail);
  const recipients = [...new Set([...fromTo, rec].filter(Boolean))];
  return recipients.includes(userEmail.trim().toLowerCase());
}

function shouldTrackAppOpen(mailData: Record<string, unknown>, user: { uid: string; email: string } | null) {
  if (!user?.email) return false;
  if (typeof mailData.createdBy === "string" && mailData.createdBy === user.uid) return false;
  return isAuthenticatedUserMailRecipient(mailData, user.email);
}

function mapAuthUserToAppUser(u: { uid: string; email: string | null; displayName: string | null; photoURL: string | null } | null): AppUser | null {
  if (!u) return null;
  return {
    uid: u.uid,
    email: u.email || "",
    tipo: "individual",
    estado: "activo",
    perfil: { nombre: u.displayName || u.email || "Usuario", verificado: true },
    createdAt: new Date(),
    lastLogin: new Date(),
    avatarUrl: u.photoURL || undefined,
    creditos: 0,
  };
}

function MailMessageView({ data }: { data: Record<string, unknown> }) {
  const delivery = data?.delivery as { time?: { toDate?: () => Date }; state?: string } | undefined;
  const tracking = data?.tracking as { sentAt?: { toDate?: () => Date } } | undefined;
  const message = data?.message as { subject?: string } | undefined;
  const sentAt = delivery?.time?.toDate?.() || tracking?.sentAt?.toDate?.() || null;
  const subject = message?.subject || "Sin asunto";
  const from = (data?.from as string) || (data?.senderName as string) || "contacto@notificas.com";
  const rawTo = Array.isArray(data?.to) ? (data.to as string[]) : data?.to ? [String(data.to)] : [];
  const visibleEmails = [...rawTo, String(data?.recipientEmail || "")].filter(
    (email) => email && !isSyntheticCampaignEmail(email),
  );
  const to = [...new Set(visibleEmails)].join(", ")
    || (typeof data?.recipientPhone === "string" ? data.recipientPhone : "")
    || "";
  const state = emailDeliveryLabel(delivery?.state, data?.emailBounce);

  const bodyHtml = buildSenderViewHtml(data);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>{subject}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm text-muted-foreground">
          <div>
            <strong className="text-foreground">De:</strong> {from}
          </div>
          <div>
            <strong className="text-foreground">Para:</strong> {to}
          </div>
          <div>
            <strong className="text-foreground">Estado:</strong> {state}
          </div>
          <div>
            <strong className="text-foreground">Fecha:</strong> {sentAt ? sentAt.toLocaleString() : "-"}
          </div>
        </div>
        <div className="mt-4 prose prose-sm max-w-none [&_.mensaje-html-view]:space-y-4">
          <div className="mensaje-html-view" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        </div>
      </CardContent>
    </Card>
  );
}

export function MailMessageDetail({
  messageId,
  backHref,
  showAppChrome = true,
}: {
  messageId: string | null;
  backHref: string;
  showAppChrome?: boolean;
}) {
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [messageData, setMessageData] = useState<Record<string, unknown> | null>(null);
  const [trackingStopped, setTrackingStopped] = useState(false);
  const appOpenTrackedRef = useRef(false);

  const handleDownloadCertificate = async () => {
    if (!messageId) return;

    const token = await auth.currentUser?.getIdToken();
    const response = await fetch("/api/download-certificate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ messageId }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `certificado-lectura-${messageId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setTrackingStopped(true);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setAppUser(mapAuthUserToAppUser(u)));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!messageId) return;
    void (async () => {
      try {
        const mailSnap = await getDoc(doc(db, "mail", messageId));
        if (!mailSnap.exists()) {
          setNotFound(true);
          setMessageData(null);
          return;
        }
        const mailData = mailSnap.data();
        setMessageData({ id: messageId, ...mailData });
        if (mailData.tracking?.trackingStopped) {
          setTrackingStopped(true);
        }
      } catch {
        setNotFound(true);
        setMessageData(null);
      }
    })();
  }, [messageId]);

  useEffect(() => {
    appOpenTrackedRef.current = false;
  }, [messageId]);

  useEffect(() => {
    if (!messageId || !appUser || trackingStopped || !messageData) return;
    if (!shouldTrackAppOpen(messageData, appUser)) return;
    if (appOpenTrackedRef.current) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (typeof window === "undefined" || appOpenTrackedRef.current) return;
      appOpenTrackedRef.current = true;

      try {
        const token = await auth.currentUser?.getIdToken();
        await fetch(`${window.location.origin}/api/track-app-open`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            messageId,
            userEmail: appUser.email,
          }),
          signal: controller.signal,
        });
      } catch (fetchError: unknown) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [messageId, appUser, trackingStopped, messageData]);

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[40vh]">
        <h1 className="text-2xl font-bold">Mensaje no encontrado</h1>
        <p className="text-muted-foreground">El mensaje que estás buscando no existe o fue eliminado.</p>
        <Button asChild className="mt-4">
          <Link href={backHref}>Volver</Link>
        </Button>
      </div>
    );
  }

  if (!messageData) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] p-8">
        <p className="text-muted-foreground">Cargando mensaje…</p>
      </div>
    );
  }

  const subject = (messageData.message as { subject?: string } | undefined)?.subject;

  const body = (
    <div className="mx-auto max-w-4xl space-y-6">
      {subject ? (
        <>
          <MailMessageView data={messageData} />
          <MailTraceability mail={messageData} />
          <PolygonCertifications
            certifications={messageData.polygonCertifications as never}
            messageId={messageId ?? undefined}
          />

          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-lg font-semibold">
                  <FileText className="h-5 w-5" />
                  {trackingStopped ? "Certificado de lectura emitido" : "Certificado de lectura"}
                </div>
                <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
                  {trackingStopped
                    ? "El PDF ya se emitió. Podés bajar la misma copia. No se le agregan lecturas ni rebotes nuevos."
                    : "Se saca una sola vez, como una foto de este momento. Si todavía esperás una lectura o un rebote, esperá."}
                </p>
                {messageId ? (
                  <DownloadCertificate
                    messageId={messageId}
                    onDownload={handleDownloadCertificate}
                    alreadyIssued={trackingStopped}
                  />
                ) : null}

                {trackingStopped ? (
                  <div className="mt-4 rounded-lg border bg-muted/40 p-3">
                    <div className="mb-2 flex items-center justify-center gap-2 text-sm font-semibold">
                      <CheckCircle className="h-4 w-4" />
                      Certificado emitido
                    </div>
                    <p className="text-xs text-muted-foreground">Esta copia quedó fija. Lo que pase después no entra en este PDF.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Es una constancia para presentar. Un juez decide qué valor le da.</p>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Mensaje no compatible</CardTitle>
          </CardHeader>
          <CardContent>El formato de este mensaje no es compatible.</CardContent>
        </Card>
      )}
    </div>
  );

  if (!showAppChrome) {
    return (
      <div className="space-y-6 p-4 sm:p-8">
        <Button variant="outline" size="icon" asChild>
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Volver</span>
          </Link>
        </Button>
        {body}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-6">
        <div className="hidden items-center gap-2 lg:flex">
          <Logo className="h-10 w-auto" />
          <span className="text-xl font-bold">Notificas</span>
        </div>
        <div className="flex-1">
          <Button variant="outline" size="icon" asChild>
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver</span>
            </Link>
          </Button>
        </div>
        {appUser ? <UserNav user={appUser} /> : null}
      </header>
      <main className="flex-1 p-4 md:p-8 lg:p-12">{body}</main>
    </div>
  );
}
