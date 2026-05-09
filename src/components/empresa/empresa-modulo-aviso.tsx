"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function EmpresaModuloAviso() {
  const searchParams = useSearchParams();
  const router = useRouter();
  if (searchParams.get("aviso") !== "modulo-empresas") return null;

  return (
    <div className="max-w-5xl mx-auto px-8 pt-8">
      <Alert className="border-primary/40 bg-primary/5">
        <Building2 className="h-4 w-4" aria-hidden />
        <AlertTitle>Cuenta de empresa</AlertTitle>
        <AlertDescription className="mt-2 space-y-3 text-foreground/90">
          <p>
            Esta sesión corresponde a una <strong>cuenta de empresa</strong> (tenés al menos una organización
            asignada). Para campañas y envíos masivos usá este módulo, no el panel de usuarios particulares.
          </p>
          <p className="text-sm text-muted-foreground">
            El inicio para empresas es el enlace <span className="font-medium text-foreground">Acceso empresas</span> en
            la página principal; si entrás desde <span className="font-medium text-foreground">Iniciar sesión</span>{" "}
            igual te redirigimos aquí.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => router.replace("/empresa")}>
            Entendido
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
