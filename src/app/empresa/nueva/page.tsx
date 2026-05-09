import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function EmpresaNuevaRedirectPage() {
  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <Button variant="ghost" asChild className="gap-2">
          <Link href="/empresa">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Alta de organizaciones</CardTitle>
            <CardDescription>
              Las empresas y organizaciones B2B se dan de alta únicamente desde el{" "}
              <strong>panel de administración de Notificas</strong>, con sesión de staff. El responsable de la
              empresa debe tener ya una cuenta de usuario en la aplicación (mismo email que usará para ingresar).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="outline">
              <Link href="/empresa">Ir a mis organizaciones</Link>
            </Button>
            <Button asChild>
              <Link href="/admin/login">Acceder al admin</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
