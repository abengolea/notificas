"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { parseScopeString, scopeDescriptions, type McpScope } from "@/mcp/scopes";

type Org = { id: string; nombre?: string; plan?: string };

export function AuthorizeClient() {
  const search = useSearchParams();
  const clientId = search.get("client_id") || "";
  const redirectUri = search.get("redirect_uri") || "";
  const state = search.get("state") || "";
  const scope = search.get("scope") || "";
  const challenge = search.get("code_challenge") || "";
  const method = search.get("code_challenge_method") || "S256";
  const resource = search.get("resource") || "";
  const nextLogin = useMemo(() => {
    const qs = search.toString();
    return `/login?next=${encodeURIComponent(`/oauth/authorize?${qs}`)}`;
  }, [search]);

  const scopes = parseScopeString(scope);
  const descriptions = scopeDescriptions();

  const [ready, setReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState("");
  const [clientName, setClientName] = useState("una aplicación");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = nextLogin;
        return;
      }
      setUserEmail(user.email);
      try {
        const token = await user.getIdToken();
        const [orgRes, clientRes] = await Promise.all([
          fetch("/api/organizations", { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`/oauth/consent?client_id=${encodeURIComponent(clientId)}`),
        ]);
        const orgJson = (await orgRes.json().catch(() => ({}))) as { organizations?: Org[] };
        const list = Array.isArray(orgJson.organizations) ? orgJson.organizations : [];
        setOrgs(list);
        if (list[0]?.id) setOrgId(list[0].id);
        const clientJson = (await clientRes.json().catch(() => ({}))) as { client_name?: string };
        if (clientJson.client_name) setClientName(clientJson.client_name);
      } catch {
        setError("No se pudo cargar la sesión.");
      } finally {
        setReady(true);
      }
    });
    return () => unsub();
  }, [clientId, nextLogin]);

  const submit = async (deny: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const user = auth.currentUser;
      if (!user) {
        window.location.href = nextLogin;
        return;
      }
      const token = await user.getIdToken();
      const res = await fetch("/oauth/consent", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          state,
          scope,
          code_challenge: challenge,
          code_challenge_method: method,
          resource,
          org_id: orgId,
          deny,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { redirect_to?: string; error_description?: string; error?: string };
      if (!res.ok || !data.redirect_to) {
        setError(data.error_description || data.error || "No se pudo completar la autorización.");
        setBusy(false);
        return;
      }
      window.location.href = data.redirect_to;
    } catch {
      setError("Error de red.");
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="brand-canvas relative flex min-h-screen items-center justify-center p-4">
      <Card className="mx-auto w-full max-w-lg shadow-xl">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <Logo className="h-16 w-16" />
          </div>
          <CardTitle className="text-2xl font-bold">Conectar Notificas</CardTitle>
          <CardDescription>
            {clientName} pide acceso limitado a tu cuenta
            {userEmail ? ` (${userEmail})` : ""}. No se comparte tu contraseña ni claves de Meta, Resend o Firebase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {method.toUpperCase() !== "S256" || !challenge ? (
            <p className="text-sm text-destructive">Esta solicitud OAuth no incluye PKCE S256 y no puede autorizarse.</p>
          ) : null}

          <div>
            <p className="mb-2 text-sm font-medium">Empresa</p>
            {orgs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay organizaciones asociadas a esta cuenta.</p>
            ) : (
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
              >
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre || o.id} {o.plan ? `(${o.plan})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Permisos solicitados</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {scopes.map((s: McpScope) => (
                <li key={s}>
                  <span className="font-medium text-foreground">{s}</span> — {descriptions[s]}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            El envío masivo de campañas no está permitido desde ChatGPT ni Claude. Las notificaciones individuales
            consumen créditos y quedan registradas con la misma evidencia que en la web.
          </p>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" disabled={busy} onClick={() => void submit(true)}>
              Denegar
            </Button>
            <Button className="flex-1" disabled={busy || !orgId} onClick={() => void submit(false)}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Autorizar
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            <Link href="/dashboard" className="underline">
              Volver a Notificas
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
