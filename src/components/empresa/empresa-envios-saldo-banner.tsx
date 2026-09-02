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

/** Lee `users/{uid}.creditos` del usuario de empresa logueado. */
export function EmpresaEnviosSaldoLiveBanner() {
  const [creditos, setCreditos] = useState<number | null>(null);

  useEffect(() => {
    let unsubUser: (() => void) | undefined;
    const unsubAuth = auth.onAuthStateChanged((u) => {
      unsubUser?.();
      unsubUser = undefined;
      if (!u) {
        setCreditos(0);
        return;
      }
      unsubUser = onSnapshot(doc(db, "users", u.uid), (snap) => {
        setCreditos(normalizeEnviosDisponibles(snap.data()?.creditos));
      });
    });
    return () => {
      unsubAuth();
      unsubUser?.();
    };
  }, []);

  return <EmpresaEnviosSaldoBanner creditos={creditos ?? 0} loaded={creditos !== null} />;
}
