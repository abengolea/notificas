"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Copy, Download, Loader2, RefreshCw, Upload } from "lucide-react";

type Row = {
  id: string;
  fullName: string;
  cuil: string;
  phone: string;
  email: string;
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

export default function AdhesionesElectronicasPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<{ jobId: string; total: number; processed?: number; invited?: number; errors?: number; pending?: number } | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [retentionCopy, setRetentionCopy] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    cuil: "",
    dni: "",
    phone: "",
    email: "",
    identityPrevalidatedByArt: true,
    identityVerificationMethod: "ART_INTERNAL_KYC",
    identitySource: "NOTIFICAS_INTERNAL_PILOT",
    identityExternalReference: "",
    identityVerifiedBy: "",
    identityAssuranceLevel: "TEST_DECLARED",
    sendInvite: true,
  });
  const [bulkPrevalidated, setBulkPrevalidated] = useState(true);
  const [actionReason, setActionReason] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);

  useEffect(() => {
    void fetch(`/api/art/status?orgId=${encodeURIComponent(orgId)}`)
      .then((r) => r.json())
      .then((d) => {
        setEnabled(d.enabled === true);
        setRetentionCopy(typeof d.retentionCopy === "string" ? d.retentionCopy : null);
      })
      .catch(() => setEnabled(false));
  }, [orgId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/empresa/art/recipients?orgId=${orgId}&status=${filter}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setRows(json.recipients || []);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filter, orgId, toast]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) void load();
    });
    return () => unsub();
  }, [load]);

  async function createOne() {
    const identityAttestation = form.identityPrevalidatedByArt
      ? {
          identityVerificationMethod: form.identityVerificationMethod,
          identitySource: form.identitySource,
          identityExternalReference: form.identityExternalReference || null,
          identityVerifiedBy: form.identityVerifiedBy || auth.currentUser?.email || auth.currentUser?.uid || "",
          identityAssuranceLevel: form.identityAssuranceLevel,
        }
      : undefined;
    const res = await authFetch("/api/empresa/art/recipients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, ...form, identityAttestation }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast({ title: "No se pudo crear", variant: "destructive" });
      return;
    }
    setCreateOpen(false);
    toast({ title: "Trabajador cargado" });
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
    <div className="space-y-6 p-6 lg:p-8">
      {enabled === false ? (
        <Card>
          <CardHeader>
            <CardTitle>Módulo desactivado</CardTitle>
            <CardDescription>
              Definí <code>ART_MODULE_ENABLED=true</code> y, en piloto, incluí esta organización en <code>ART_ALLOWED_ORGS</code>.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Adhesiones electrónicas</h1>
          <p className="text-sm text-muted-foreground">Alta, invitación, evidencia y estado de habilitación. Prueba interna sin efectos frente a terceros.</p>
          {retentionCopy ? <p className="mt-1 text-xs text-muted-foreground">{retentionCopy}</p> : null}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>
          <Button onClick={() => setCreateOpen(true)}>Alta individual</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alta masiva</CardTitle>
          <CardDescription>CSV o XLSX. En piloto el máximo es 10 destinatarios, todos en allowlist.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <label className="text-sm">
            <input type="checkbox" checked={bulkPrevalidated} onChange={(e) => setBulkPrevalidated(e.target.checked)} className="mr-2" />
            Identidad prevalidada (ART_INTERNAL_KYC, operador = tu usuario)
          </label>
          <Label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <Upload className="h-4 w-4" />
            Subir archivo
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
          </Label>
          {job ? (
            <p className="text-sm text-muted-foreground">
              Total {job.total} · procesados {job.processed ?? 0} · invitados {job.invited ?? 0} · errores {job.errors ?? 0} · pendientes {job.pending ?? 0}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button key={f.id} size="sm" variant={filter === f.id ? "default" : "outline"} onClick={() => setFilter(f.id)}>
            {f.label}
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trabajador</TableHead>
              <TableHead>CUIL</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Identidad</TableHead>
              <TableHead>Adhesión</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Cargando…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-muted-foreground">Sin registros.</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.fullName}</TableCell>
                <TableCell>{r.cuil}</TableCell>
                <TableCell>{r.phone}</TableCell>
                <TableCell>{r.email || "—"}</TableCell>
                <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                <TableCell>{r.identity}</TableCell>
                <TableCell>{r.activatedAt ? new Date(r.activatedAt).toLocaleDateString("es-AR") : "—"}</TableCell>
                <TableCell className="space-x-1 whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>Ver</Button>
                  <Button size="sm" variant="ghost" onClick={() => void act(r.id, "invite")}><Copy className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" asChild>
                    <a href={`/api/empresa/art/recipients/${r.id}/evidence?orgId=${orgId}`} onClick={async (e) => {
                      e.preventDefault();
                      const res = await authFetch(`/api/empresa/art/recipients/${r.id}/evidence?orgId=${orgId}`);
                      if (!res.ok) return;
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `constancia-${r.id}.pdf`;
                      a.click();
                    }}><Download className="h-4 w-4" /></a>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alta de trabajador</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Input placeholder="Nombre y apellido" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            <Input placeholder="CUIL" value={form.cuil} onChange={(e) => setForm({ ...form, cuil: e.target.value })} />
            <Input placeholder="DNI" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} />
            <Input placeholder="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <label className="text-sm"><input type="checkbox" checked={form.identityPrevalidatedByArt} onChange={(e) => setForm({ ...form, identityPrevalidatedByArt: e.target.checked })} className="mr-2" />Identidad prevalidada por la ART</label>
            {form.identityPrevalidatedByArt ? (
              <div className="grid gap-2 rounded-md border p-3">
                <Label>Método</Label>
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={form.identityVerificationMethod}
                  onChange={(e) => setForm({ ...form, identityVerificationMethod: e.target.value })}
                >
                  <option value="ART_INTERNAL_KYC">ART_INTERNAL_KYC</option>
                  <option value="RENAPER">RENAPER</option>
                  <option value="DIDIT">DIDIT</option>
                  <option value="PRESENCIAL">PRESENCIAL</option>
                  <option value="OTHER">OTHER</option>
                </select>
                <Input placeholder="Fuente (identitySource)" value={form.identitySource} onChange={(e) => setForm({ ...form, identitySource: e.target.value })} />
                <Input placeholder="Referencia externa (opcional)" value={form.identityExternalReference} onChange={(e) => setForm({ ...form, identityExternalReference: e.target.value })} />
                <Input placeholder="Identificado por (operador)" value={form.identityVerifiedBy} onChange={(e) => setForm({ ...form, identityVerifiedBy: e.target.value })} />
                <Input placeholder="Nivel de aseguramiento" value={form.identityAssuranceLevel} onChange={(e) => setForm({ ...form, identityAssuranceLevel: e.target.value })} />
              </div>
            ) : null}
            <label className="text-sm"><input type="checkbox" checked={form.sendInvite} onChange={(e) => setForm({ ...form, sendInvite: e.target.checked })} className="mr-2" />Enviar invitación</label>
          </div>
          <DialogFooter>
            <Button onClick={() => void createOne()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{selected?.fullName}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{selected?.status} · identidad {selected?.identity}</p>
          <Textarea placeholder="Motivo (obligatorio para suspender o reactivar)" value={actionReason} onChange={(e) => setActionReason(e.target.value)} />
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button variant="outline" onClick={() => selected && void act(selected.id, "invite")}>Reenviar invitación / copiar link</Button>
            <Button variant="outline" onClick={() => selected && void act(selected.id, "suspend")}>Suspender</Button>
            <Button variant="outline" onClick={() => selected && void act(selected.id, "reactivate")}>Reactivar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
