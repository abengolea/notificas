"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface AdminAuthProps {
  children: React.ReactNode;
}

export function AdminAuth({ children }: AdminAuthProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Verificar si está autenticado
    const authStatus = sessionStorage.getItem("admin_authenticated");
    const adminUser = sessionStorage.getItem("admin_user");
    
    if (authStatus === "true" && adminUser === "contacto@notificas.com") {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
      // Redirigir al login después de un breve delay
      setTimeout(() => {
        router.push("/admin/login");
      }, 100);
    }
  }, [router]);

  // Mostrar loading mientras verifica
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

  // Si no está autenticado, no mostrar nada (se redirige)
  if (!isAuthenticated) {
    return null;
  }

  // Si está autenticado, mostrar el contenido
  return <>{children}</>;
}

// Función para cerrar sesión
export function logoutAdmin() {
  sessionStorage.removeItem("admin_authenticated");
  sessionStorage.removeItem("admin_user");
  window.location.href = "/admin/login";
}
