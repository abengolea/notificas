"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Copy, KeyRound, Loader2, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { OrgWaTemplatesAdmin } from "@/components/admin/org-wa-templates-admin";

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
  const [adminEmail, setAdminEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);
  const [confirmEmailOpen, setConfirmEmailOpen] = useState(false);
  const [keepPreviousAsMember, setKeepPreviousAsMember] = useState(true);
  const [addEnvios, setAddEnvios] = useState("50");
  const [addingEnvios, setAddingEnvios] = useState(false);

  const applyOrg = useCallback((next: AdminOrganizationDetail) => {
    setOrg(next);
    setNombre(next.nombre);
    setCuit(next.cuit);
    setTipo(next.tipo || "empresa");
    setPlan(next.plan || "starter");
    const admin = next.operators.find((o) => o.isOrgAdmin) || next.operators[0];
    setTelefono(admin?.telefono || "");
    setAdminEmail(admin?.email || next.adminUserEmail || "");
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

  async function addCreditsToOrg() {
    const amount = Math.floor(Number(addEnvios));
    if (!Number.isFinite(amount) || amount < 1) {
      toast({
        title: "Cantidad inválida",
        description: "Indicá cuántos envíos sumar (mínimo 1).",
        variant: "destructive",
      });
      return;
    }
    setAddingEnvios(true);
    try {
      const res = await fetch(`/api/admin/organizations/${encodeURIComponent(orgId)}/credits`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ add: amount }),
      });
      const data = (await res.json()) as { error?: string; enviosDisponibles?: number };
      if (!res.ok) throw new Error(data.error || "No se pudo acreditar");
      toast({
        title: "Envíos acreditados",
        description: `Se sumaron ${amount.toLocaleString("es-AR")} envíos a la empresa. Saldo: ${(data.enviosDisponibles ?? 0).toLocaleString("es-AR")}.`,
      });
      await load();
    } catch (e: unknown) {
      toast({
        title: "No se pudieron sumar envíos",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setAddingEnvios(false);
    }
  }

  const currentAdminEmail = (
    org?.operators.find((o) => o.isOrgAdmin)?.email || org?.adminUserEmail || ""
  ).trim().toLowerCase();
  const nextAdminEmail = adminEmail.trim().toLowerCase();
  const emailDirty = Boolean(nextAdminEmail) && nextAdminEmail !== currentAdminEmail;

  async function changeAdminEmail() {
    if (!emailDirty) return;
    setChangingEmail(true);
    try {
      const res = await fetch(`/api/admin/organizations/${encodeURIComponent(orgId)}/admin-email`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: nextAdminEmail,
          keepPreviousAsMember,
        }),
      });
      const data = (await res.json()) as {
        organization?: AdminOrganizationDetail;
        error?: string;
        warning?: string;
        inviteEmailSent?: boolean;
      };
      if (!res.ok) throw new Error(data.error || "No se pudo cambiar el email");
      if (data.organization) applyOrg(data.organization);
      setConfirmEmailOpen(false);
      toast({
        title: "Email del administrador actualizado",
        description: data.warning
          || (data.inviteEmailSent === false
            ? "Se cambió el mail, pero no salió el correo de activación."
            : `Se envió el correo de activación a ${nextAdminEmail}.`),
      });
    } catch (e: unknown) {
      toast({
        title: "No se pudo cambiar el email",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setChangingEmail(false);
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
          <div className="space-y-2">
            <Label htmlFor="org-admin-email">Email de acceso</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                id="org-admin-email"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="responsable@empresa.com"
                autoComplete="off"
              />
              <div className="flex shrink-0 gap-2">
                {(admin?.email || org.adminUserEmail) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    aria-label="Copiar email"
                    onClick={() => void copyText("Email", admin?.email || org.adminUserEmail)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!emailDirty || changingEmail}
                  onClick={() => setConfirmEmailOpen(true)}
                >
                  {changingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Cambiar email
                </Button>
              </div>
            </div>
          </div>
          <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-3 text-sm">
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
            <dd>
              <div className="flex flex-col gap-2">
                <p>
                  Saldo de la empresa:{" "}
                  <span className="font-medium tabular-nums">
                    {(org.enviosDisponibles ?? 0).toLocaleString("es-AR")}
                  </span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="org-add-envios"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    className="w-28"
                    value={addEnvios}
                    onChange={(e) => setAddEnvios(e.target.value)}
                    aria-label="Cantidad de envíos a sumar"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={addingEnvios}
                    onClick={() => void addCreditsToOrg()}
                  >
                    {addingEnvios ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Sumar envíos
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Se acreditan al saldo de la empresa. Todos los operadores lo ven y lo usan.
                </p>
              </div>
            </dd>
          </dl>
          <p className="text-sm text-muted-foreground">
            Cambiá el mail para pasarle la cuenta al responsable real. Recibe el correo para definir
            contraseña e ingresa en <span className="font-mono text-xs">/empresa</span>. El enlace de
            restablecimiento también llega a este email.
          </p>
        </section>
      </div>

      <OrgWaTemplatesAdmin orgId={org.id} />

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

      <AlertDialog open={confirmEmailOpen} onOpenChange={setConfirmEmailOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Pasar el acceso a {nextAdminEmail}?</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de servir el mail actual ({currentAdminEmail || "—"}). Al nuevo correo le llega la
              activación para definir contraseña y entrar por empresas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={keepPreviousAsMember}
              onCheckedChange={(v) => setKeepPreviousAsMember(v === true)}
            />
            <span>
              Si el correo nuevo ya existe, mantener {currentAdminEmail || "el mail anterior"} como
              operador de esta empresa.
            </span>
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={changingEmail}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={changingEmail}
              onClick={(e) => {
                e.preventDefault();
                void changeAdminEmail();
              }}
            >
              {changingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Cambiar y enviar activación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
