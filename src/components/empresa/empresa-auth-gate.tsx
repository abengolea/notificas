"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

export function EmpresaAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || "/empresa";

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        const next = pathname.startsWith("/empresa") ? pathname : "/empresa";
        router.replace(`/login?next=${encodeURIComponent(next)}`);
      }
    });
    return () => unsub();
  }, [router, pathname]);

  return <>{children}</>;
}
