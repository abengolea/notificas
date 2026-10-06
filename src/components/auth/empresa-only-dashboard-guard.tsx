"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { Building2, Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { EMPRESA_ONLY_LOGIN_MESSAGE } from "@/lib/user-account-kind";
import { empresaHomeHrefFromOrgs } from "@/lib/resolve-post-login-href";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function EmpresaOnlyDashboardGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ok" }
    | { kind: "blocked"; href: string }
  >({ kind: "loading" });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      void (async () => {
        if (!user) {
          setState({ kind: "ok" });
          return;
        }
        try {
          const token = await user.getIdToken();
          const res = await fetch("/api/organizations", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) {
            setState({ kind: "ok" });
            return;
          }
          const data = (await res.json()) as {
            organizations?: unknown[];
            empresaOnly?: boolean;
          };
          if (data.empresaOnly === true) {
            const href = empresaHomeHrefFromOrgs(data.organizations || []) ?? "/empresa";
            setState({ kind: "blocked", href });
            return;
          }
          setState({ kind: "ok" });
        } catch {
          setState({ kind: "ok" });
        }
      })();
    });
    return () => unsub();
  }, []);

  if (state.kind === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Cargando" />
      </div>
    );
  }

  if (state.kind === "blocked") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Building2 className="h-5 w-5" aria-hidden />
              Cuenta de empresa
            </CardTitle>
            <CardDescription>{EMPRESA_ONLY_LOGIN_MESSAGE}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href={state.href}>Ir al acceso empresas</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
