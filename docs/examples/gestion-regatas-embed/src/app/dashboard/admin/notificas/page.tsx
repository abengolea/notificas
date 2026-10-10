"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Loader2, Send } from "lucide-react";
import { useUserProfile, useFirebase } from "@/firebase";
import { getAuth } from "firebase/auth";

declare global {
  interface Window {
    Notificas?: {
      embed: (
        target: string | Element,
        options?: Record<string, unknown>
      ) => { destroy: () => void };
    };
  }
}

export default function NotificasEmbedPage() {
  const router = useRouter();
  const { app } = useFirebase();
  const { isSuperAdmin, isReady } = useUserProfile();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;
    if (!isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [isReady, isSuperAdmin, router]);

  useEffect(() => {
    if (!isReady || !isSuperAdmin || !app) return;
    let cancelled = false;

    async function prepare() {
      try {
        const auth = getAuth(app);
        const user = auth.currentUser;
        if (!user) {
          setError("No estás logueado.");
          setStatus("error");
          return;
        }
        const token = await user.getIdToken();
        const res = await fetch("/api/notificas/session", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json().catch(() => ({}))) as {
          configured?: boolean;
          error?: { message?: string };
        };
        if (!res.ok) {
          setError(data.error?.message || `Error ${res.status}`);
          setStatus("error");
          return;
        }
        if (cancelled) return;
        setConfigured(Boolean(data.configured));
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "No se pudo abrir la sesión de Notificas.");
        setStatus("error");
      }
    }

    void prepare();
    return () => {
      cancelled = true;
    };
  }, [isReady, isSuperAdmin, app]);

  useEffect(() => {
    if (status !== "ready") return;
    const existing = document.querySelector<HTMLScriptElement>('script[data-notificas-sdk="v1"]');
    const mount = () => {
      const host = document.querySelector("#notificas-regatas-embed");
      if (!host || host.childElementCount > 0 || !window.Notificas) return;
      window.Notificas.embed("#notificas-regatas-embed", {
        proxyUrl: configured ? "/api/notificas" : undefined,
        demo: !configured,
        channel: "whatsapp",
        template: "notificacion_deuda_180_dias",
        title: "Notificas · Regatas+",
        buttonLabel: configured ? "Enviar notificación certificada" : "Enviar (demo)",
      });
    };

    if (existing && window.Notificas) {
      mount();
      return;
    }
    const script = document.createElement("script");
    script.src = "/sdk/v1/notificas.js";
    script.async = true;
    script.dataset.notificasSdk = "v1";
    script.onload = mount;
    document.body.appendChild(script);
  }, [status, configured]);

  if (!isReady || !isSuperAdmin) return null;

  return (
    <div className="container max-w-xl py-6">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground" asChild>
        <Link href="/dashboard/admin/config">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Configuración global
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Send className="h-6 w-6 text-primary" />
            <CardTitle>Probar Notificas</CardTitle>
          </div>
          <CardDescription>
            Esta es la misma ventana que se inserta en sitios de terceros. La API key queda en el
            servidor de Regatas+; el widget solo habla con <code>/api/notificas</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            La constancia es evidencia técnica del envío. No es firma digital, acto notarial ni
            carta documento.
          </div>

          {status === "loading" ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparando el widget…
            </p>
          ) : null}

          {status === "error" ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          {status === "ready" && !configured ? (
            <p className="text-sm text-muted-foreground">
              Falta <code>NOTIFICAS_API_KEY</code> en <code>.env.local</code>. El widget está en modo
              demo (no envía). Generá una clave en Notificas (<code>/admin/api-keys</code>) y
              reiniciá <code>npm run dev</code>. Para pegarle a un Notificas local usá{" "}
              <code>NOTIFICAS_API_BASE=http://localhost:9006/api/v1</code>.
            </p>
          ) : null}

          {status === "ready" && configured ? (
            <p className="text-sm text-muted-foreground">
              Listo para enviar de verdad. Completá destinatario y plantilla, y usá un teléfono o
              email que puedas verificar.
            </p>
          ) : null}

          <div id="notificas-regatas-embed" />
        </CardContent>
      </Card>
    </div>
  );
}
