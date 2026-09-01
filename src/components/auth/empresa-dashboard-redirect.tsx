"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { empresaHomeHrefFromOrgs } from "@/lib/resolve-post-login-href";

/**
 * Si el usuario tiene organizaciones B2B pero entró al panel de particulares,
 * lo envía al dashboard de su empresa (o al selector si tiene más de una).
 * Billetera y cuenta siguen disponibles: los envíos 1:1 usan esos créditos.
 */
export function EmpresaDashboardRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname?.startsWith("/dashboard/billetera") || pathname?.startsWith("/dashboard/cuenta")) {
      return;
    }

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
          const dest = empresaHomeHrefFromOrgs(orgs);
          if (dest) router.replace(dest);
        } catch {
          /* ignorar */
        }
      })();
    });
    return () => unsub();
  }, [router, pathname]);

  return null;
}
