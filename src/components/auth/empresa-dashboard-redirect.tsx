"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

/**
 * Si el usuario tiene organizaciones B2B pero entró al panel de particulares,
 * lo envía al módulo empresas (mismo criterio que post-login).
 */
export function EmpresaDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      void (async () => {
        if (!user) return;
        try {
          const token = await user.getIdToken();
          const res = await fetch("/api/organizations", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const data = (await res.json()) as { organizations?: unknown };
          const orgs = Array.isArray(data.organizations) ? data.organizations : [];
          if (orgs.length > 0) {
            router.replace("/empresa?aviso=modulo-empresas");
          }
        } catch {
          /* ignorar */
        }
      })();
    });
    return () => unsub();
  }, [router]);

  return null;
}
