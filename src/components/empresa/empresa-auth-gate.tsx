"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

export function EmpresaAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || "/empresa";
  const [signedIn, setSignedIn] = useState(() => Boolean(auth.currentUser));

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setSignedIn(false);
        const next = pathname.startsWith("/empresa") ? pathname : "/empresa";
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      setSignedIn(true);
    });
    return () => unsub();
  }, [router, pathname]);

  if (!signedIn) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
          aria-label="Cargando sesión"
        />
      </div>
    );
  }

  return <>{children}</>;
}
