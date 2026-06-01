"use client";

import { useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

/** Acredita envíos reservados para matriculados (una vez por sesión). */
export function ColegioPendingBonusApplier() {
  const attempted = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user || attempted.current) return;
      attempted.current = true;
      try {
        const token = await user.getIdToken();
        await fetch("/api/auth/apply-pending-colegio-envios", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        /* no bloquear la app */
      }
    });
    return () => unsub();
  }, []);

  return null;
}
