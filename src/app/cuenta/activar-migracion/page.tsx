"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

function ActivarMigracionForm() {
  const searchParams = useSearchParams();
  const initial = searchParams.get("email")?.trim() ?? "";
  const [email, setEmail] = useState(initial);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!em) {
      toast({ title: "Email requerido", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const sendRes = await fetch("/api/auth/send-migration-reset-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em }),
      });
      const sendJson = (await sendRes.json().catch(() => ({}))) as { error?: string };

      if (sendRes.status === 404) {
        toast({
          title: "No encontramos ese correo",
          description:
            sendJson.error ??
            "No hay una cuenta en este sistema con ese email. Revisá la dirección o creá una cuenta nueva en Registro.",
          variant: "destructive",
        });
        return;
      }
      if (sendRes.status === 400) {
        toast({
          title: "Configuración del sitio",
          description:
            sendJson.error ??
            "La URL de esta página no está permitida para enviar el enlace. Revisá NEXT_PUBLIC_APP_URL o el dominio en Firebase (Authorized domains).",
          variant: "destructive",
        });
        return;
      }
      if (!sendRes.ok) {
        toast({
          title: "No se pudo enviar el enlace",
          description: sendJson.error ?? "Intentá de nuevo en unos minutos.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Revisá tu correo",
        description:
          "Te enviamos el enlace desde nuestro servidor de correo (el mismo canal que el formulario de contacto). Revisá también spam.",
      });
    } catch (err) {
      console.error("[activar-migracion]", err);
      toast({
        title: "No se pudo enviar el enlace",
        description: "Error de red. Comprobá tu conexión e intentá de nuevo.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-md shadow-xl">
      <CardHeader className="text-center">
        <div className="mb-4 flex justify-center">
          <Logo className="h-16 w-16" />
        </div>
        <CardTitle className="text-2xl font-bold">Activá tu cuenta migrada</CardTitle>
        <CardDescription>
          Si tu usuario venía de Notificas anterior, ingresá tu email y te enviamos un enlace para definir una
          contraseña nueva en este sistema.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-mig">Correo electrónico</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email-mig"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                className="pl-10"
                placeholder="nombre@ejemplo.com"
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando…
              </>
            ) : (
              "Enviar enlace"
            )}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="underline" prefetch={false}>
            Volver al inicio de sesión
          </Link>
          {" · "}
          <Link href="/signup" className="underline" prefetch={false}>
            Registro nuevo
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function ActivarMigracionPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4 md:right-8 md:top-8">
        <ThemeToggle />
      </div>
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando…
          </div>
        }
      >
        <ActivarMigracionForm />
      </Suspense>
    </div>
  );
}
