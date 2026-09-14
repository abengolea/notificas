"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type GmailState = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  redirectUri: string;
};

export function MarketingGmailBar({ fromEmail }: { fromEmail: string }) {
  const { toast } = useToast();
  const [state, setState] = useState<GmailState | null>(null);
  const [busy, setBusy] = useState<"sync" | "disconnect" | null>(null);

  async function load() {
    const res = await fetch("/api/admin/marketing/gmail", { credentials: "include" });
    const data = await res.json();
    if (res.ok) setState(data);
  }

  useEffect(() => {
    void load();
  }, []);

  async function sync() {
    setBusy("sync");
    try {
      const res = await fetch("/api/admin/marketing/gmail/sync", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo sincronizar");
      toast({ title: `Bandeja leída: ${data.scanned} correos, ${data.matched} respuestas` });
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy("disconnect");
    try {
      const res = await fetch("/api/admin/marketing/gmail/disconnect", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("No se pudo desconectar");
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  if (!state) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Gmail…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          Sale por Resend como {fromEmail}
        </p>
        <p className="text-sm text-muted-foreground">
          {state.connected
            ? `Respuestas: Gmail conectado (${state.email || fromEmail})${state.lastSyncAt ? ` · última sync ${new Date(state.lastSyncAt).toLocaleString("es-AR")}` : ""}`
            : state.configured
              ? "Gmail no conectado: las respuestas no se marcan en el CRM hasta que autorices la casilla."
              : `Para leer respuestas, registrá un cliente OAuth de Google y las variables GOOGLE_MARKETING_OAUTH_*. Redirect: ${state.redirectUri}`}
        </p>
        {state.lastError ? <p className="text-sm text-destructive mt-1">{state.lastError}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        {state.connected ? (
          <>
            <Button size="sm" variant="outline" onClick={() => void sync()} disabled={busy !== null}>
              {busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Leer bandeja</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void disconnect()} disabled={busy !== null}>
              <Unplug className="h-4 w-4" />
              <span className="ml-2">Desconectar</span>
            </Button>
          </>
        ) : state.configured ? (
          <Button size="sm" asChild>
            <a href="/api/admin/marketing/gmail/connect">
              <Mail className="h-4 w-4" />
              <span className="ml-2">Conectar Gmail</span>
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
