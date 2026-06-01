"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { sendPasswordResetEmail, updateProfile } from "firebase/auth";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { Building, Loader2, Mail, Phone, User, Wallet } from "lucide-react";

import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import type { User as AppUser } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const cuentaSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  cuit: z.string().min(8, "El documento debe tener al menos 8 caracteres."),
  telefono: z.string().min(8, "Introduce un teléfono válido."),
  direccion: z.string().optional(),
});

type CuentaFormValues = z.infer<typeof cuentaSchema>;

function documentoLabel(tipo: AppUser["tipo"]) {
  return tipo === "empresa" ? "CUIT" : "DNI / CUIT / CUIL";
}

function nombreLabel(tipo: AppUser["tipo"]) {
  return tipo === "empresa" ? "Razón social" : "Nombre completo";
}

function syncDniFromDocumento(cuit: string): string | undefined {
  const digits = cuit.replace(/\D/g, "");
  if (digits.length >= 6 && digits.length <= 11) return digits;
  return undefined;
}

export function CuentaPageComponent() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useFirebaseAuth();
  const [tipo, setTipo] = useState<AppUser["tipo"]>("individual");
  const [email, setEmail] = useState("");
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const form = useForm<CuentaFormValues>({
    resolver: zodResolver(cuentaSchema),
    defaultValues: {
      nombre: "",
      cuit: "",
      telefono: "",
      direccion: "",
    },
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user?.uid) {
      router.replace("/login?next=/dashboard/cuenta");
      return;
    }

    const userRef = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        setLoadingDoc(false);
        if (!snap.exists()) {
          form.reset({
            nombre: user.displayName || "",
            cuit: "",
            telefono: "",
            direccion: "",
          });
          setEmail(user.email || "");
          setTipo("individual");
          return;
        }
        const data = snap.data() as {
          email?: string;
          tipo?: AppUser["tipo"];
          perfil?: {
            nombre?: string;
            cuit?: string;
            telefono?: string;
            direccion?: string;
          };
        };
        const perfil = data.perfil || {};
        setEmail(data.email || user.email || "");
        setTipo(data.tipo === "empresa" ? "empresa" : "individual");
        form.reset({
          nombre: perfil.nombre || user.displayName || "",
          cuit: perfil.cuit || "",
          telefono: perfil.telefono || "",
          direccion: perfil.direccion || "",
        });
      },
      () => setLoadingDoc(false)
    );

    return () => unsub();
  }, [user, authLoading, router, form]);

  const onSubmit = async (data: CuentaFormValues) => {
    if (!user?.uid || saving) return;
    setSaving(true);
    try {
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      const existingPerfil = (snap.data()?.perfil || {}) as Record<string, unknown>;

      const perfilUpdate: Record<string, unknown> = {
        ...existingPerfil,
        nombre: data.nombre.trim(),
        cuit: data.cuit.trim(),
        telefono: data.telefono.trim(),
        verificado: existingPerfil.verificado ?? true,
      };
      const direccion = data.direccion?.trim();
      if (direccion) perfilUpdate.direccion = direccion;

      const dni = syncDniFromDocumento(data.cuit);
      if (dni) perfilUpdate.dni = dni;

      if (tipo === "empresa") {
        perfilUpdate.razonSocial = data.nombre.trim();
      }

      await updateDoc(userRef, {
        perfil: perfilUpdate,
      });

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: data.nombre.trim() });
      }

      toast({
        title: "Datos guardados",
        description: "Tu información de cuenta se actualizó correctamente.",
      });
    } catch (e) {
      console.error("Error guardando cuenta:", e);
      toast({
        title: "No se pudo guardar",
        description: "Revisá los datos e intentá de nuevo.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    const mail = email || user?.email;
    if (!mail || sendingReset) return;
    setSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, mail);
      toast({
        title: "Correo enviado",
        description: "Revisá tu bandeja para restablecer la contraseña.",
      });
    } catch (e) {
      console.error("Error enviando reset:", e);
      toast({
        title: "No se pudo enviar el correo",
        description: "Intentá de nuevo en unos minutos.",
        variant: "destructive",
      });
    } finally {
      setSendingReset(false);
    }
  };

  if (authLoading || loadingDoc) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Datos personales</CardTitle>
          <CardDescription>
            Información que usamos en tus envíos y en la facturación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Tipo de cuenta</span>
            <Badge variant="secondary" className="gap-1">
              {tipo === "empresa" ? (
                <>
                  <Building className="h-3 w-3" />
                  Empresa
                </>
              ) : (
                <>
                  <User className="h-3 w-3" />
                  Individual
                </>
              )}
            </Badge>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{nombreLabel(tipo)}</FormLabel>
                    <FormControl>
                      <Input placeholder="Juan Pérez o ExampleCorp S.A." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="cuit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{documentoLabel(tipo)}</FormLabel>
                      <FormControl>
                        <Input placeholder="20-12345678-9" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="telefono"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono</FormLabel>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <FormControl>
                          <Input
                            type="tel"
                            className="pl-9"
                            placeholder="+54 9 11 1234-5678"
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="direccion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dirección (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Calle, número, localidad" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  "Guardar cambios"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cuenta</CardTitle>
          <CardDescription>Datos de acceso a Notificas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Correo electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                className="pl-9"
                value={email}
                disabled
                readOnly
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Para cambiar el correo, contactanos desde soporte.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Seguridad</CardTitle>
          <CardDescription>
            Te enviaremos un enlace a tu correo para elegir una nueva contraseña.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            onClick={handlePasswordReset}
            disabled={sendingReset || !email}
          >
            {sendingReset ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando…
              </>
            ) : (
              "Enviar enlace para restablecer contraseña"
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billetera y facturación</CardTitle>
          <CardDescription>Envíos disponibles, compra de planes e historial de pagos con descarga de facturas.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="secondary" asChild>
            <Link href="/dashboard/billetera">
              <Wallet className="mr-2 h-4 w-4" />
              Comprar envíos
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/billetera?tab=movimientos">
              Historial de pagos y facturas
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
