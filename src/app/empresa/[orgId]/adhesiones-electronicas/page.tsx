"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { ArtStatusBadge } from "@/components/art/art-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Copy, Download, MoreHorizontal, RefreshCw, Search, Upload, UserPlus } from "lucide-react";
import {
  artIdentityStatusLabel,
  artRecipientStatusLabel,
  isPendingRecipientStatus,
  recipientMatchesStatusFilter,
} from "@/lib/art/status-labels";
import { artPersonRelationLabel, parseArtPersonRelation, type ArtPersonRelation } from "@/lib/art/types";

type Row = {
  id: string;
  fullName: string;
  cuil: string;
  phone: string;
  email: string;
  relation?: ArtPersonRelation;
  status: string;
  identity: string;
  activatedAt: string | null;
  updatedAt: unknown;
};

const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "active", label: "Activo" },
  { id: "pending_group", label: "Pendiente" },
  { id: "not_adhered", label: "No adherido" },
  { id: "revoked", label: "Revocado" },
  { id: "requires_conventional_channel", label: "Requiere canal convencional" },
];

async function authFetch(url: string, init?: RequestInit) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sin sesión");
  const token = await user.getIdToken();
  return fetch(url, { ...init, headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` } });
}

function digitsLen(value: string): number {
  return value.replace(/\D/g, "").length;
}

function createRecipientErrorMessage(json: unknown): string {
  if (!json || typeof json !== "object") return "No se pudo crear.";
  const err = (json as { error?: unknown; code?: unknown }).error;
  const code = (json as { code?: unknown }).code;
  const token = typeof err === "string" ? err : typeof code === "string" ? code : "";
  if (token === "PILOT_RECIPIENT_NOT_ALLOWED") {
    return "Ese email o teléfono no está en la allowlist del piloto.";
  }
  if (token === "PILOT_BULK_LIMIT") return "El piloto admite como máximo 10 destinatarios.";
  if (token === "identity_attestation_required" || token === "identity_verified_by_required") {
    return "Falta completar la verificación de identidad del operador.";
  }
  if (err && typeof err === "object" && "fieldErrors" in err) {
    const fields = (err as { fieldErrors?: Record<string, unknown> }).fieldErrors || {};
    if (fields.cuil) return "Completá el CUIL.";
    if (fields.dni) return "Completá el DNI.";
    if (fields.fullName) return "Completá nombre y apellido.";
    if (fields.phone) return "Completá el teléfono.";
    if (fields.email) return "El email no es válido.";
  }
  if (token) return token;
  return "No se pudo crear.";
}

export default function AdhesionesElectronicasPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<{ jobId: string; total: number; processed?: number; invited?: number; errors?: number; pending?: number } | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [pilotMode, setPilotMode] = useState(false);
  const [retentionCopy, setRetentionCopy] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    cuil: "",
    dni: "",
    phone: "",
    email: "",
    identityPrevalidatedByArt: true,
    sendInvite: true,
    relation: "trabajador" as ArtPersonRelation,
  });
  const [bulkPrevalidated, setBulkPrevalidated] = useState(true);
  const [actionReason, setActionReason] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);

  useEffect(() => {
    void fetch(`/api/art/status?orgId=${encodeURIComponent(orgId)}`)
      .then((r) => r.json())
      .then((d) => {
        setEnabled(d.enabled === true);
        setPilotMode(d.pilotMode === true);
        setRetentionCopy(typeof d.retentionCopy === "string" ? d.retentionCopy : null);
      })
      .catch(() => setEnabled(false));
  }, [orgId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/empresa/art/recipients?orgId=${orgId}&status=all&limit=100`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setRows(json.recipients || []);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [orgId, toast]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) void load();
    });
    return () => unsub();
  }, [load]);

  const summary = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.status === "active").length;
    const pending = rows.filter((r) => isPendingRecipientStatus(r.status)).length;
    const revoked = rows.filter((r) => r.status === "revoked").length;
    return { total, active, pending, revoked };
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (!recipientMatchesStatusFilter(r.status, filter)) return false;
      if (!q) return true;
      return (
        r.fullName.toLowerCase().includes(q) ||
        r.cuil.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
        r.cuil.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.phone.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
      );
    });
  }, [rows, filter, query]);

  async function createOne() {
    if (form.fullName.trim().length < 2) {
      toast({ title: "Completá nombre y apellido.", variant: "destructive" });
      return;
    }
    if (digitsLen(form.cuil) < 8) {
      toast({ title: "Completá el CUIL.", variant: "destructive" });
      return;
    }
    if (digitsLen(form.dni) < 6) {
      toast({ title: "Completá el DNI.", variant: "destructive" });
      return;
    }
    if (digitsLen(form.phone) < 8) {
      toast({ title: "Completá el teléfono.", variant: "destructive" });
      return;
    }
    const identityAttestation = form.identityPrevalidatedByArt
      ? {
          identityVerificationMethod: "ART_INTERNAL_KYC",
          identitySource: "NOTIFICAS_INTERNAL_PILOT",
          identityExternalReference: null,
          identityVerifiedBy: auth.currentUser?.email || auth.currentUser?.uid || "",
          identityAssuranceLevel: "TEST_DECLARED",
        }
      : undefined;
    const res = await authFetch("/api/empresa/art/recipients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, ...form, identityAttestation }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast({ title: createRecipientErrorMessage(json), variant: "destructive" });
      return;
    }
    setCreateOpen(false);
    toast({ title: "Persona cargada" });
    if (json.invite?.url) {
      await navigator.clipboard.writeText(json.invite.url).catch(() => undefined);
    }
    await load();
  }

  async function act(id: string, action: string, extra?: Record<string, string>) {
    if ((action === "suspend" || action === "reactivate") && !actionReason.trim()) {
      toast({ title: "Indicá quién y por qué", variant: "destructive" });
      return;
    }
    const res = await authFetch(`/api/empresa/art/recipients/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, action, reason: actionReason, ...extra }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast({ title: json.error || "Error", variant: "destructive" });
      return;
    }
    if (json.url) {
      await navigator.clipboard.writeText(json.url);
      toast({ title: "Link copiado" });
    } else {
      toast({ title: "Listo" });
    }
    setSelected(null);
    setActionReason("");
    await load();
  }

  async function downloadEvidence(id: string) {
    const res = await authFetch(`/api/empresa/art/recipients/${id}/evidence?orgId=${orgId}`);
    if (!res.ok) {
      toast({ title: "No se pudo descargar la evidencia", variant: "destructive" });
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `constancia-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function upload(file: File) {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("sendInvites", "true");
    fd.set("identityPrevalidated", bulkPrevalidated ? "true" : "false");
    if (bulkPrevalidated) {
      fd.set("identityVerificationMethod", "ART_INTERNAL_KYC");
      fd.set("identitySource", "bulk_import");
      fd.set("identityVerifiedBy", auth.currentUser?.email || auth.currentUser?.uid || "");
      fd.set("identityAssuranceLevel", "ART_DECLARED");
    }
    const res = await authFetch(`/api/empresa/art/bulk?orgId=${orgId}`, { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) {
      toast({ title: "No se pudo importar", variant: "destructive" });
      return;
    }
    setJob(json);
    toast({ title: `Lote ${json.jobId}: ${json.total} filas` });
    await load();
  }

  useEffect(() => {
    if (!job?.jobId) return;
    const t = setInterval(() => {
      void (async () => {
        const res = await authFetch(`/api/empresa/art/bulk?orgId=${orgId}&jobId=${job.jobId}`);
        const json = await res.json();
        if (res.ok) setJob((j) => ({ ...j!, ...json.job }));
      })();
    }, 2500);
    return () => clearInterval(t);
  }, [job?.jobId, orgId]);

  return (
    <TooltipProvider>
      <div className="space-y-5 p-5 lg:p-8">
        {enabled === false ? (
          <div className="rounded-lg border border-border/80 bg-card px-4 py-3">
            <p className="app-panel-title">Módulo desactivado</p>
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
              Este módulo no está habilitado para la organización.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="app-page-title">Adhesiones electrónicas</h1>
              {pilotMode ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-5 items-center rounded border border-border/80 bg-muted/60 px-1.5 text-[10px] font-medium tracking-wide text-muted-foreground"
                    aria-label="Entorno piloto"
                  >
                    PILOTO
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-[13px] leading-5">
                  Entorno piloto. Las adhesiones realizadas en este entorno no producen efectos frente a terceros.
                </TooltipContent>
              </Tooltip>
              ) : null}
            </div>
            <p className="mt-1.5 max-w-xl text-[13px] leading-5 text-muted-foreground">
              Administrá la adhesión de trabajadores, clientes u otras personas al canal electrónico y conservá la evidencia de cada alta.
            </p>
            {retentionCopy ? <p className="mt-1 text-[12px] leading-4 text-muted-foreground/80">{retentionCopy}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Importar personas
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Alta individual
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border/80 bg-card">
          <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] leading-5 text-muted-foreground">
              <span className="tabular-nums">{summary.total}</span> personas
              <span className="px-1.5 text-border">·</span>
              <span className="tabular-nums">{summary.active}</span> activos
              <span className="px-1.5 text-border">·</span>
              <span className="tabular-nums">{summary.pending}</span> pendientes
              <span className="px-1.5 text-border">·</span>
              <span className="tabular-nums">{summary.revoked}</span> revocados
            </p>
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:max-w-xl">
              <div className="relative min-w-[12rem] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nombre, CUIL o email"
                  className="h-8 bg-background pl-8 text-[13px]"
                  aria-label="Buscar personas"
                />
              </div>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-[13px] text-foreground"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                aria-label="Filtrar por estado"
              >
                {FILTERS.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void load()} aria-label="Actualizar">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {job ? (
            <p className="border-b border-border/70 px-4 py-2 text-[13px] leading-5 text-muted-foreground">
              Importación {job.jobId}: {job.processed ?? 0}/{job.total} procesados · {job.invited ?? 0} invitados · {job.errors ?? 0} errores
            </p>
          ) : null}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 px-4 text-[13px] font-medium">Persona</TableHead>
                  <TableHead className="h-10 px-4 text-[13px] font-medium">Vínculo</TableHead>
                  <TableHead className="h-10 px-4 text-[13px] font-medium">CUIL</TableHead>
                  <TableHead className="h-10 px-4 text-[13px] font-medium">Teléfono</TableHead>
                  <TableHead className="h-10 px-4 text-[13px] font-medium">Email</TableHead>
                  <TableHead className="h-10 px-4 text-[13px] font-medium">Estado</TableHead>
                  <TableHead className="h-10 px-4 text-[13px] font-medium">Identidad</TableHead>
                  <TableHead className="h-10 px-4 text-[13px] font-medium">Adhesión</TableHead>
                  <TableHead className="h-10 w-12 px-3 text-[13px] font-medium">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      <TableCell colSpan={9} className="px-4 py-3">
                        <Skeleton className="h-4 w-full max-w-xl" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : visible.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9} className="px-4 py-10 text-center text-[14px] leading-6 text-muted-foreground">
                      {rows.length === 0
                        ? "Todavía no hay personas. Cargá una o importá un archivo."
                        : "Nadie coincide con la búsqueda o el filtro."}
                    </TableCell>
                  </TableRow>
                ) : visible.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="px-4 py-3 text-[14px] font-medium leading-5 text-foreground">{r.fullName}</TableCell>
                    <TableCell className="px-4 py-3 text-[13px] leading-5 text-muted-foreground">{artPersonRelationLabel(r.relation)}</TableCell>
                    <TableCell className="px-4 py-3 text-[13px] leading-5 tabular-nums text-muted-foreground">{r.cuil}</TableCell>
                    <TableCell className="px-4 py-3 text-[13px] leading-5 tabular-nums text-muted-foreground">{r.phone}</TableCell>
                    <TableCell className="px-4 py-3 text-[13px] leading-5 text-muted-foreground">{r.email || "—"}</TableCell>
                    <TableCell className="px-4 py-3"><ArtStatusBadge status={r.status} /></TableCell>
                    <TableCell className="px-4 py-3 text-[13px] leading-5 text-muted-foreground">{artIdentityStatusLabel(r.identity)}</TableCell>
                    <TableCell className="px-4 py-3 text-[13px] leading-5 text-muted-foreground">
                      {r.activatedAt ? new Date(r.activatedAt).toLocaleDateString("es-AR") : "—"}
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Acciones de ${r.fullName}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => setSelected(r)}>Ver detalle</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void act(r.id, "invite")}>
                            <Copy className="h-4 w-4" />
                            Copiar enlace
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void downloadEvidence(r.id)}>
                            <Download className="h-4 w-4" />
                            Descargar evidencia
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-headline text-lg font-semibold">Alta de persona</DialogTitle>
              <DialogDescription>Completá los datos. La invitación se puede enviar al guardar.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="art-alta-relation">Vínculo</Label>
                <select
                  id="art-alta-relation"
                  className="h-9 rounded-md border border-input bg-background px-2 text-[13px] text-foreground"
                  value={form.relation}
                  onChange={(e) => setForm({ ...form, relation: parseArtPersonRelation(e.target.value) })}
                >
                  <option value="trabajador">Trabajador</option>
                  <option value="cliente">Cliente</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="art-alta-nombre">Nombre y apellido</Label>
                <Input id="art-alta-nombre" placeholder="Como figura en el DNI" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="art-alta-cuil">CUIL</Label>
                <Input id="art-alta-cuil" inputMode="numeric" placeholder="Obligatorio" value={form.cuil} onChange={(e) => setForm({ ...form, cuil: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="art-alta-dni">DNI</Label>
                <Input id="art-alta-dni" inputMode="numeric" placeholder="Obligatorio" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="art-alta-phone">Teléfono</Label>
                <Input id="art-alta-phone" inputMode="tel" placeholder="3364645357" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="art-alta-email">Email</Label>
                <Input id="art-alta-email" type="email" placeholder="persona@correo.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <label className="flex items-start gap-2 text-[13px] leading-5">
                <Checkbox
                  checked={form.identityPrevalidatedByArt}
                  onCheckedChange={(v) => setForm({ ...form, identityPrevalidatedByArt: v === true })}
                  className="mt-0.5"
                />
                Identidad del operador verificada
              </label>
              <label className="flex items-start gap-2 text-[13px] leading-5">
                <Checkbox
                  checked={form.sendInvite}
                  onCheckedChange={(v) => setForm({ ...form, sendInvite: v === true })}
                  className="mt-0.5"
                />
                Enviar invitación
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button onClick={() => void createOne()}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-headline text-lg font-semibold">Importar personas</DialogTitle>
              <DialogDescription>
                CSV o XLSX con nombre, CUIL, DNI, teléfono y email. En piloto el máximo es 10 destinatarios, todos en allowlist.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <label className="flex items-start gap-2 text-[13px] leading-5">
                <Checkbox
                  checked={bulkPrevalidated}
                  onCheckedChange={(v) => setBulkPrevalidated(v === true)}
                  className="mt-0.5"
                />
                Identidad del operador verificada
              </label>
              <Label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-[14px] font-semibold">
                <Upload className="h-4 w-4" />
                Subir archivo
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void upload(f);
                    e.target.value = "";
                  }}
                />
              </Label>
              {job ? (
                <p className="text-[13px] leading-5 text-muted-foreground">
                  Total {job.total} · procesados {job.processed ?? 0} · invitados {job.invited ?? 0} · errores {job.errors ?? 0} · pendientes {job.pending ?? 0}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportOpen(false)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-headline text-lg font-semibold">{selected?.fullName}</DialogTitle>
              <DialogDescription>
                {selected ? `${artRecipientStatusLabel(selected.status)} · ${artIdentityStatusLabel(selected.identity)}` : ""}
              </DialogDescription>
            </DialogHeader>
            <Textarea placeholder="Motivo (obligatorio para suspender o reactivar)" value={actionReason} onChange={(e) => setActionReason(e.target.value)} />
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button variant="outline" onClick={() => selected && void act(selected.id, "invite")}>Reenviar invitación / copiar link</Button>
              <Button variant="outline" onClick={() => selected && void act(selected.id, "suspend")}>Suspender</Button>
              <Button variant="outline" onClick={() => selected && void act(selected.id, "reactivate")}>Reactivar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
