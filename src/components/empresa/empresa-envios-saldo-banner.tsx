"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { Send } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { empresaMassSendSaldoMessage, normalizeEnviosDisponibles } from "@/lib/envios";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export function EmpresaEnviosSaldoBanner({
  creditos,
  loaded = true,
}: {
  creditos: number;
  loaded?: boolean;
}) {
  if (!loaded) {
    return <Skeleton className="h-[4.5rem] w-full rounded-lg" />;
  }
  const msg = empresaMassSendSaldoMessage(creditos);
  return (
    <Alert
      variant={msg.empty ? "destructive" : "default"}
      className={msg.empty ? undefined : "border-primary/40 bg-primary/5"}
    >
      <Send className="h-4 w-4" aria-hidden />
      <AlertTitle>{msg.title}</AlertTitle>
      <AlertDescription className="mt-1 text-foreground/90">{msg.body}</AlertDescription>
    </Alert>
  );
}

/** Lee `organizations/{orgId}.creditos` del saldo compartido de la empresa. */
export function EmpresaEnviosSaldoLiveBanner({ orgId }: { orgId: string }) {
  const [creditos, setCreditos] = useState<number | null>(null);

  useEffect(() => {
    if (!orgId) {
      setCreditos(0);
      return;
    }
    let unsubOrg: (() => void) | undefined;
    const unsubAuth = auth.onAuthStateChanged((u) => {
      unsubOrg?.();
      unsubOrg = undefined;
      if (!u) {
        setCreditos(0);
        return;
      }
      unsubOrg = onSnapshot(
        doc(db, "organizations", orgId),
        (snap) => {
          setCreditos(normalizeEnviosDisponibles(snap.data()?.creditos));
        },
        () => setCreditos(0),
      );
      void u.getIdToken().then((token) =>
        fetch(`/api/empresa/org-credits?orgId=${encodeURIComponent(orgId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
    });
    return () => {
      unsubAuth();
      unsubOrg?.();
    };
  }, [orgId]);

  return <EmpresaEnviosSaldoBanner creditos={creditos ?? 0} loaded={creditos !== null} />;
}
