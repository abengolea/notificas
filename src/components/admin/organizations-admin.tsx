"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

const cuitRegex = /^\d{2}-\d{8}-\d{1}$/;

const schema = z.object({
  nombre: z.string().min(2),
  cuit: z.string().regex(cuitRegex, "Formato XX-XXXXXXXX-X"),
  tipo: z.enum(["empresa", "estudio_juridico", "consumidores", "otro"]),
  adminUserEmail: z.string().email(),
  plan: z.enum(["starter", "business", "enterprise"]),
  extraMemberEmails: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type OrgRow = {
  id: string;
  nombre?: string;
  cuit?: string;
  tipo?: string;
  plan?: string;
  adminUserEmail?: string;
  adminUserId?: string;
  members?: string[];
};

export default function OrganizationsAdmin() {
  const { toast } = useToast();
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: "",
      cuit: "",
      tipo: "empresa",
      adminUserEmail: "",
      plan: "starter",
      extraMemberEmails: "",
    },
  });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/organizations", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setRows(data.organizations || []);
    } catch (e: unknown) {
      toast({
        title: "No se pudo cargar",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(values: FormValues) {
    const extra = (values.extraMemberEmails || "")
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const extraMemberEmails = [...new Set(extra)].filter((e) => e !== values.adminUserEmail.trim().toLowerCase());

    setSaving(true);
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: values.nombre.trim(),
          cuit: values.cuit.trim(),
          tipo: values.tipo,
          adminUserEmail: values.adminUserEmail.trim().toLowerCase(),
          plan: values.plan,
          extraMemberEmails: extraMemberEmails.length ? extraMemberEmails : undefined,
        }),
      });
      const data = (await res.json()) as {
        id?: string;
        error?: string;
        inviteEmailSent?: boolean;
        inviteEmailError?: string;
        warning?: string;
        authCreated?: boolean;
      };
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Error al crear");
      if (data.inviteEmailSent) {
        toast({
          title: "Organización creada",
          description: `ID: ${data.id}. Se envió el correo de activación al administrador.`,
        });
      } else {
        toast({
          title: "Organización creada (sin correo)",
          description:
            data.inviteEmailError ||
            data.warning ||
            "No se pudo enviar el mail de activación. Revisá la configuración de correo.",
          variant: "destructive",
        });
      }
      form.reset({
        nombre: "",
        cuit: "",
        tipo: "empresa",
        adminUserEmail: "",
        plan: "starter",
        extraMemberEmails: "",
      });
      await load();
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo crear",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Alta de empresa / organización
          </CardTitle>
          <CardDescription>
            Si el email no tiene cuenta, se crea automáticamente y se envía un correo con enlace para definir contraseña y
            acceder al módulo <span className="font-mono text-xs">/empresa</span>. Requiere{' '}
            <span className="font-mono text-xs">NEXT_PUBLIC_APP_URL</span> configurada en el servidor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input {...form.register("nombre")} />
              {form.formState.errors.nombre && (
                <p className="text-sm text-destructive">{form.formState.errors.nombre.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>CUIT</Label>
              <Input placeholder="20-12345678-9" {...form.register("cuit")} />
              {form.formState.errors.cuit && (
                <p className="text-sm text-destructive">{form.formState.errors.cuit.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.watch("tipo")}
                onValueChange={(v) => form.setValue("tipo", v as FormValues["tipo"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="empresa">Empresa</SelectItem>
                  <SelectItem value="estudio_juridico">Estudio jurídico</SelectItem>
                  <SelectItem value="consumidores">Consumidores</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Email del administrador (usuario app)</Label>
              <Input type="email" placeholder="responsable@empresa.com" {...form.register("adminUserEmail")} />
              {form.formState.errors.adminUserEmail && (
                <p className="text-sm text-destructive">{form.formState.errors.adminUserEmail.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Plan B2B (límites de envío masivo)</Label>
              <Select
                value={form.watch("plan")}
                onValueChange={(v) => form.setValue("plan", v as FormValues["plan"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter (500 dest.)</SelectItem>
                  <SelectItem value="business">Business (2000)</SelectItem>
                  <SelectItem value="enterprise">Enterprise (sin tope práctico)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Miembros adicionales (emails, opcional)</Label>
              <Textarea
                placeholder="uno@mail.com, otro@mail.com"
                rows={3}
                {...form.register("extraMemberEmails")}
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Dar de alta"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Organizaciones</CardTitle>
            <CardDescription>Listado reciente</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto max-h-[480px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>CUIT</TableHead>
                  <TableHead>Admin email</TableHead>
                  <TableHead>Plan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      No hay organizaciones.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.nombre}</TableCell>
                      <TableCell>{r.cuit}</TableCell>
                      <TableCell className="text-sm">{r.adminUserEmail || r.adminUserId || "—"}</TableCell>
                      <TableCell>{r.plan}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
