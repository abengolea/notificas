"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface AdminAuthProps {
  children: React.ReactNode;
}

export function AdminAuth({ children }: AdminAuthProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    fetch("/api/admin/me", { credentials: "include" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 503) {
          setIsAuthenticated(false);
          setConfigError(
            "Falta configurar ADMIN_PANEL_EMAIL, ADMIN_PANEL_PASSWORD y ADMIN_SESSION_SECRET en el servidor (.env.local).",
          );
          return;
        }
        if (!res.ok) {
          setIsAuthenticated(false);
          setTimeout(() => {
            router.push("/admin/login");
          }, 100);
          return;
        }
        setIsAuthenticated(true);
      })
      .catch(() => {
        if (!cancelled) setIsAuthenticated(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-teal-600" />
          <p className="text-gray-600">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (configError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <p className="text-center text-gray-700 max-w-md">{configError}</p>
        </div>
      );
    }
    return null;
  }

  return <>{children}</>;
}

export async function logoutAdmin() {
  try {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
  } catch {
    /* ignore */
  }
  window.location.href = "/admin/login";
}
