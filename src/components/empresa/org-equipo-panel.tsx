"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Building2, KeyRound, Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { EmpresaEquipoPayload } from "@/lib/empresa-equipo-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "d MMM yyyy, HH:mm", { locale: es });
}

async function authFetch(url: string, init?: RequestInit) {
  const user = auth.currentUser;
  if (!user) throw new Error("No hay sesión activa");
  const token = await user.getIdToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Error en la solicitud");
  }
  return data;
}

export function OrgEquipoPanel({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [equipo, setEquipo] = useState<EmpresaEquipoPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newNombre, setNewNombre] = useState("");
  const [newBocaId, setNewBocaId] = useState("");
  const [newEnvios, setNewEnvios] = useState("0");

  const [bocaNombre, setBocaNombre] = useState("");
  const [bocaDescripcion, setBocaDescripcion] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await authFetch(`/api/empresa/${encodeURIComponent(orgId)}/equipo`)) as EmpresaEquipoPayload;
      setEquipo(data);
    } catch (e: unknown) {
      setEquipo(null);
      setError(e instanceof Error ? e.message : "No se pudo cargar");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) void load();
      else {
        setEquipo(null);
        setLoading(false);
      }
    });
    return () => unsub();
  }, [load]);

  async function onAddMember(e: React.FormEvent) {
    e.preventDefault();
    setBusy("add-member");
    try {
      const data = (await authFetch(`/api/empresa/${encodeURIComponent(orgId)}/equipo`, {
        method: "POST",
        body: JSON.stringify({
          email: newEmail.trim(),
          nombre: newNombre.trim() || undefined,
          bocaId: newBocaId || undefined,
          enviosIniciales: Math.max(0, parseInt(newEnvios, 10) || 0),
        }),
      })) as { equipo?: EmpresaEquipoPayload; inviteEmailSent?: boolean };
      if (data.equipo) setEquipo(data.equipo);
      setNewEmail("");
      setNewNombre("");
      setNewBocaId("");
      setNewEnvios("0");
      toast({
        title: "Operador agregado",
        description: data.inviteEmailSent
          ? "Se envió el correo para definir la contraseña."
          : "El usuario quedó habilitado. Revisá el envío del correo de activación.",
      });
    } catch (e: unknown) {
      toast({
        title: "No se pudo agregar",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  async function onAddBoca(e: React.FormEvent) {
    e.preventDefault();
    setBusy("add-boca");
    try {
      const data = (await authFetch(`/api/empresa/${encodeURIComponent(orgId)}/bocas`, {
        method: "POST",
        body: JSON.stringify({
          nombre: bocaNombre.trim(),
          descripcion: bocaDescripcion.trim() || undefined,
        }),
      })) as { equipo?: EmpresaEquipoPayload };
      if (data.equipo) setEquipo(data.equipo);
      setBocaNombre("");
      setBocaDescripcion("");
      toast({ title: "Boca de envío creada" });
    } catch (e: unknown) {
      toast({
        title: "No se pudo crear la boca",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  async function updateMember(uid: string, patch: Record<string, unknown>) {
    setBusy(uid);
    try {
      const data = (await authFetch(
        `/api/empresa/${encodeURIComponent(orgId)}/equipo/${encodeURIComponent(uid)}`,
        { method: "PATCH", body: JSON.stringify(patch) },
      )) as { equipo?: EmpresaEquipoPayload };
      if (data.equipo) setEquipo(data.equipo);
      toast({ title: "Cambios guardados" });
    } catch (e: unknown) {
      toast({
        title: "No se pudo guardar",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  async function resetPassword(uid: string, email: string) {
    setBusy(`reset-${uid}`);
    try {
      const data = (await authFetch(
        `/api/empresa/${encodeURIComponent(orgId)}/equipo/${encodeURIComponent(uid)}/reset-password`,
        { method: "POST" },
      )) as { email?: string };
      toast({
        title: "Enlace enviado",
        description: `Correo enviado a ${data.email || email} para definir o restablecer la contraseña.`,
      });
      await load();
    } catch (e: unknown) {
      toast({
        title: "No se pudo enviar",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  async function assignEnvios(uid: string) {
    const raw = prompt("¿Cuántos envíos querés asignar desde tu saldo?");
    if (raw == null) return;
    const add = Math.max(0, parseInt(raw, 10) || 0);
    if (add <= 0) return;
    await updateMember(uid, { addEnvios: add });
  }

  async function removeMember(uid: string) {
    if (!confirm("¿Quitar a este operador de la organización?")) return;
    setBusy(`remove-${uid}`);
    try {
      const data = (await authFetch(
        `/api/empresa/${encodeURIComponent(orgId)}/equipo/${encodeURIComponent(uid)}`,
        { method: "DELETE" },
      )) as { equipo?: EmpresaEquipoPayload };
      if (data.equipo) setEquipo(data.equipo);
      toast({ title: "Operador removido" });
    } catch (e: unknown) {
      toast({
        title: "No se pudo quitar",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !equipo) {
    return <p className="p-6 text-sm text-destructive">{error || "No se pudo cargar el equipo"}</p>;
  }

  if (!equipo.isAdmin) {
    const me = equipo.members[0];
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mi acceso</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Solo el administrador de la empresa puede gestionar operadores y bocas de envío.
          </p>
        </div>
        {me ? (
          <dl className="grid max-w-md grid-cols-[9rem_1fr] gap-x-3 gap-y-2 rounded-lg border p-4 text-sm">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{me.email}</dd>
            <dt className="text-muted-foreground">Boca asignada</dt>
            <dd>{me.bocaNombre || "Sin boca"}</dd>
            <dt className="text-muted-foreground">Envíos disponibles</dt>
            <dd>{me.enviosDisponibles.toLocaleString("es-AR")}</dd>
            <dt className="text-muted-foreground">Mis envíos</dt>
            <dd>{me.enviadosTotal.toLocaleString("es-AR")}</dd>
          </dl>
        ) : null}
      </div>
    );
  }

  const bocasActivas = equipo.bocas.filter((b) => b.activa);

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Equipo y bocas de envío</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Administrá operadores, asigná bocas de envío y distribuí envíos disponibles. Cada operador
          ve sus propios envíos individuales; las campañas masivas son visibles para toda la
          organización.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Tus envíos disponibles:{" "}
          <span className="font-medium text-foreground">
            {equipo.adminEnviosDisponibles.toLocaleString("es-AR")}
          </span>
        </p>
      </div>

      <section className="space-y-4 rounded-lg border p-6">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">Bocas de envío</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Una boca identifica desde dónde opera cada subusuario (sucursal, área legal, filial, etc.).
        </p>

        <form onSubmit={(e) => void onAddBoca(e)} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1">
            <Label htmlFor="boca-nombre">Nombre</Label>
            <Input
              id="boca-nombre"
              value={bocaNombre}
              onChange={(e) => setBocaNombre(e.target.value)}
              placeholder="Legales CABA"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="boca-desc">Descripción (opcional)</Label>
            <Input
              id="boca-desc"
              value={bocaDescripcion}
              onChange={(e) => setBocaDescripcion(e.target.value)}
              placeholder="Piso 4, sector cobranzas"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={busy === "add-boca"}>
              {busy === "add-boca" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Agregar boca
            </Button>
          </div>
        </form>

        {equipo.bocas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay bocas configuradas.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Operadores</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipo.bocas.map((boca) => {
                  const count = equipo.members.filter((m) => m.bocaId === boca.id).length;
                  return (
                    <TableRow key={boca.id}>
                      <TableCell className="font-medium">{boca.nombre}</TableCell>
                      <TableCell>{boca.descripcion || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={boca.activa ? "secondary" : "outline"}>
                          {boca.activa ? "Activa" : "Inactiva"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{count}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-lg border p-6">
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">Agregar operador</h2>
        </div>
        <form onSubmit={(e) => void onAddMember(e)} className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="op-email">Email</Label>
            <Input
              id="op-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="operador@empresa.com"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="op-nombre">Nombre</Label>
            <Input
              id="op-nombre"
              value={newNombre}
              onChange={(e) => setNewNombre(e.target.value)}
              placeholder="María González"
            />
          </div>
          <div className="space-y-1">
            <Label>Boca de envío</Label>
            <Select value={newBocaId || "__none__"} onValueChange={(v) => setNewBocaId(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sin boca" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin boca</SelectItem>
                {bocasActivas.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="op-envios">Envíos iniciales</Label>
            <Input
              id="op-envios"
              type="number"
              min={0}
              value={newEnvios}
              onChange={(e) => setNewEnvios(e.target.value)}
            />
          </div>
          <div className="lg:col-span-2">
            <Button type="submit" disabled={busy === "add-member"}>
              {busy === "add-member" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Invitar operador
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Operadores</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operador</TableHead>
                <TableHead>Boca</TableHead>
                <TableHead className="text-right">Envíos disp.</TableHead>
                <TableHead className="text-right">Realizados</TableHead>
                <TableHead>Último acceso</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equipo.members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No hay operadores vinculados.
                  </TableCell>
                </TableRow>
              ) : (
                equipo.members.map((op) => (
                  <TableRow key={op.uid}>
                    <TableCell>
                      <div className="font-medium">{op.nombre || op.email}</div>
                      <div className="text-xs text-muted-foreground">{op.email}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {op.isOrgAdmin ? <Badge variant="secondary">Administrador</Badge> : null}
                        {op.mustSetPassword ? (
                          <Badge variant="outline">Debe definir contraseña</Badge>
                        ) : null}
                        {op.estado === "suspendido" ? (
                          <Badge variant="destructive">Suspendido</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {op.isOrgAdmin ? (
                        "—"
                      ) : (
                        <Select
                          value={op.bocaId || "__none__"}
                          disabled={busy === op.uid}
                          onValueChange={(v) =>
                            void updateMember(op.uid, { bocaId: v === "__none__" ? null : v })
                          }
                        >
                          <SelectTrigger className="h-8 w-[10rem]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Sin boca</SelectItem>
                            {bocasActivas.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{op.enviosDisponibles.toLocaleString("es-AR")}</TableCell>
                    <TableCell className="text-right">
                      <div>{op.enviadosTotal.toLocaleString("es-AR")}</div>
                      <div className="text-xs text-muted-foreground">
                        {op.campanasCount} camp. · {op.enviosIndividualesCount} ind.
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{formatWhen(op.lastLoginAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!op.email || busy === `reset-${op.uid}`}
                          onClick={() => void resetPassword(op.uid, op.email)}
                        >
                          {busy === `reset-${op.uid}` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <KeyRound className="h-4 w-4" />
                          )}
                        </Button>
                        {!op.isOrgAdmin ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy === op.uid}
                            onClick={() => void assignEnvios(op.uid)}
                          >
                            + envíos
                          </Button>
                        ) : null}
                        {!op.isOrgAdmin ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy === `remove-${op.uid}`}
                            onClick={() => void removeMember(op.uid)}
                          >
                            {busy === `remove-${op.uid}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
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
