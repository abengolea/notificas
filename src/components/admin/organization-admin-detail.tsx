"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Copy, KeyRound, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { AdminOrganizationDetail } from "@/lib/admin-organization-detail-types";

const TIPO_OPTIONS = [
  { value: "empresa", label: "Empresa" },
  { value: "estudio_juridico", label: "Estudio jurídico" },
  { value: "consumidores", label: "Consumidores" },
  { value: "art", label: "ART / autoasegurado" },
  { value: "otro", label: "Otro" },
] as const;

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "d MMM yyyy, HH:mm", { locale: es });
}

export function OrganizationAdminDetail({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [org, setOrg] = useState<AdminOrganizationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingUid, setResettingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [cuit, setCuit] = useState("");
  const [tipo, setTipo] = useState("empresa");
  const [plan, setPlan] = useState("starter");
  const [telefono, setTelefono] = useState("");

  const applyOrg = useCallback((next: AdminOrganizationDetail) => {
    setOrg(next);
    setNombre(next.nombre);
    setCuit(next.cuit);
    setTipo(next.tipo || "empresa");
    setPlan(next.plan || "starter");
    const admin = next.operators.find((o) => o.isOrgAdmin) || next.operators[0];
    setTelefono(admin?.telefono || "");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/organizations/${encodeURIComponent(orgId)}`, {
        credentials: "include",
      });
      const data = (await res.json()) as { organization?: AdminOrganizationDetail; error?: string };
      if (!res.ok || !data.organization) {
        throw new Error(typeof data.error === "string" ? data.error : "No se pudo cargar");
      }
      applyOrg(data.organization);
    } catch (e: unknown) {
      setOrg(null);
      setError(e instanceof Error ? e.message : "No se pudo cargar");
    } finally {
      setLoading(false);
    }
  }, [orgId, applyOrg]);

  useEffect(() => {
    void load();
  }, [load]);

  async function copyText(label: string, value: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copiado` });
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  }

  async function onSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/organizations/${encodeURIComponent(orgId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          cuit: cuit.trim(),
          tipo,
          plan,
          telefono: telefono.trim(),
        }),
      });
      const data = (await res.json()) as { organization?: AdminOrganizationDetail; error?: unknown };
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : "Revisá CUIT (XX-XXXXXXXX-X) y el resto de los datos.";
        throw new Error(msg);
      }
      if (data.organization) applyOrg(data.organization);
      toast({ title: "Datos guardados" });
    } catch (e: unknown) {
      toast({
        title: "No se pudo guardar",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(memberUid: string, email: string) {
    setResettingUid(memberUid);
    try {
      const res = await fetch(`/api/admin/organizations/${encodeURIComponent(orgId)}/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberUid }),
      });
      const data = (await res.json()) as { error?: string; email?: string };
      if (!res.ok) throw new Error(data.error || "No se pudo enviar el correo");
      toast({
        title: "Enlace enviado",
        description: `Se envió el correo para definir o restablecer la contraseña a ${data.email || email}.`,
      });
      await load();
    } catch (e: unknown) {
      toast({
        title: "No se pudo restablecer",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setResettingUid(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" className="gap-2 px-0" asChild>
          <Link href="/admin/empresas">
            <ArrowLeft className="h-4 w-4" />
            Volver al listado
          </Link>
        </Button>
        <p className="text-sm text-destructive">{error || "Organización no encontrada"}</p>
      </div>
    );
  }

  const admin = org.operators.find((o) => o.isOrgAdmin);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <Button variant="ghost" className="h-auto gap-2 px-0 text-muted-foreground" asChild>
            <Link href="/admin/empresas">
              <ArrowLeft className="h-4 w-4" />
              Volver al listado
            </Link>
          </Button>
          <h3 className="text-xl font-semibold tracking-tight">{org.nombre || "Sin nombre"}</h3>
          <p className="text-sm text-muted-foreground">
            {org.campaignCount.toLocaleString("es-AR")} envíos masivos ·{" "}
            {org.recipientCount.toLocaleString("es-AR")} destinatarios en {org.listCount} listas
            {org.isTestOrganization ? " · organización de prueba" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!admin?.email || resettingUid === admin?.uid}
            onClick={() => admin && void resetPassword(admin.uid, admin.email)}
          >
            {resettingUid === admin?.uid ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="mr-2 h-4 w-4" />
            )}
            Restablecer contraseña
          </Button>
          <Button type="button" onClick={() => void onSave()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Guardar cambios
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-lg border p-6">
          <h4 className="font-semibold">Datos de la empresa</h4>
          <div className="space-y-2">
            <Label htmlFor="org-nombre">Nombre</Label>
            <Input id="org-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-cuit">CUIT</Label>
            <Input id="org-cuit" value={cuit} onChange={(e) => setCuit(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPO_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Plan</Label>
            <Select value={plan} onValueChange={setPlan}>
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
            <Label htmlFor="org-tel">Teléfono del administrador</Label>
            <Input
              id="org-tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+54 9 11 0000-0000"
            />
          </div>
          <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Alta</dt>
            <dd>{formatWhen(org.createdAt)}</dd>
            <dt className="text-muted-foreground">ID</dt>
            <dd className="truncate font-mono text-xs">{org.id}</dd>
            {org.environment ? (
              <>
                <dt className="text-muted-foreground">Entorno</dt>
                <dd>{org.environment}</dd>
              </>
            ) : null}
          </dl>
        </section>

        <section className="space-y-4 rounded-lg border p-6">
          <h4 className="font-semibold">Acceso del administrador</h4>
          <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="flex min-w-0 items-center gap-2">
              <span className="truncate">{admin?.email || org.adminUserEmail || "—"}</span>
              {(admin?.email || org.adminUserEmail) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label="Copiar email"
                  onClick={() => void copyText("Email", admin?.email || org.adminUserEmail)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </dd>
            <dt className="text-muted-foreground">Nombre</dt>
            <dd>{admin?.nombre || "—"}</dd>
            <dt className="text-muted-foreground">Teléfono</dt>
            <dd>{admin?.telefono || telefono || "—"}</dd>
            <dt className="text-muted-foreground">Estado</dt>
            <dd>
              <Badge variant={admin?.estado === "activo" ? "secondary" : "destructive"}>
                {admin?.estado || "—"}
              </Badge>
              {admin?.mustSetPassword ? (
                <Badge variant="outline" className="ml-2">
                  Debe definir contraseña
                </Badge>
              ) : null}
            </dd>
            <dt className="text-muted-foreground">Último acceso</dt>
            <dd>{formatWhen(admin?.lastLoginAt ?? null)}</dd>
            <dt className="text-muted-foreground">Envíos</dt>
            <dd>{(admin?.enviosDisponibles ?? 0).toLocaleString("es-AR")}</dd>
          </dl>
          <p className="text-sm text-muted-foreground">
            El enlace de restablecimiento llega al email del operador. Después entra en{" "}
            <span className="font-mono text-xs">/empresa</span>.
          </p>
        </section>
      </div>

      <section className="space-y-3">
        <h4 className="font-semibold">Operadores</h4>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="text-right">Contraseña</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {org.operators.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No hay operadores vinculados.
                  </TableCell>
                </TableRow>
              ) : (
                org.operators.map((op) => (
                  <TableRow key={op.uid}>
                    <TableCell className="font-medium">{op.email || op.uid}</TableCell>
                    <TableCell>{op.nombre || "—"}</TableCell>
                    <TableCell>{op.telefono || "—"}</TableCell>
                    <TableCell>{op.isOrgAdmin ? "Administrador" : "Miembro"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!op.email || resettingUid === op.uid}
                        onClick={() => void resetPassword(op.uid, op.email)}
                      >
                        {resettingUid === op.uid ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <KeyRound className="mr-2 h-4 w-4" />
                        )}
                        Enviar enlace
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="font-semibold">Destinatarios y teléfonos</h4>
        <p className="text-sm text-muted-foreground">
          Contactos cargados en listas de envío masivo
          {org.contactsTruncated
            ? ` (se muestran ${org.contacts.length} de ${org.recipientCount.toLocaleString("es-AR")})`
            : ""}
          .
        </p>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Lista</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {org.contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Esta organización todavía no cargó destinatarios en listas de envío masivo.
                  </TableCell>
                </TableRow>
              ) : (
                org.contacts.map((c, i) => (
                  <TableRow key={`${c.email}-${c.telefono}-${i}`}>
                    <TableCell>{c.nombre || "—"}</TableCell>
                    <TableCell>{c.email || "—"}</TableCell>
                    <TableCell>{c.telefono || "—"}</TableCell>
                    <TableCell>{c.lista || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
