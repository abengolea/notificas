"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Scale, Plus, Trash2 } from "lucide-react";
import type { ColegioCollegeRow } from "@/lib/colegio-discount-types";
import { COLEGIO_NOMBRE_FALLBACK_CLIENT } from "@/lib/colegio-discount-client";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

type ParsedRow = { nombre: string; email: string };

function pickColumnKey(
  row: Record<string, unknown>,
  candidates: string[],
): string | null {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const nc = normHeader(cand);
    const hit = keys.find((k) => normHeader(k) === nc);
    if (hit) return hit;
  }
  for (const k of keys) {
    const nk = normHeader(k);
    if (candidates.some((c) => normHeader(c) === nk)) return k;
  }
  return null;
}

export async function parseColegioSpreadsheet(file: File): Promise<ParsedRow[]> {
  const buf = await file.arrayBuffer();
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array" });
  const name = wb.SheetNames[0];
  if (!name) return [];
  const sheet = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  const out: ParsedRow[] = [];

  for (const row of rows) {
    const ek = pickColumnKey(row, [
      "email",
      "mail",
      "correo",
      "e-mail",
      "e mail",
    ]);
    const nk = pickColumnKey(row, ["nombre", "name", "apellido y nombre", "matriculado"]);
    const emailRaw = ek ? row[ek] : "";
    const nombreRaw = nk ? row[nk] : "";
    const email = String(emailRaw ?? "")
      .trim()
      .replace(/\s+/g, "");
    const nombre = String(nombreRaw ?? "").trim();
    if (email && email.includes("@")) {
      out.push({ email, nombre });
    }
  }

  return out;
}

function ColegioTableRow({
  college,
  onRefresh,
  disabledGlobal,
}: {
  college: ColegioCollegeRow;
  onRefresh: () => void;
  disabledGlobal: boolean;
}) {
  const { toast } = useToast();
  const [nombre, setNombre] = React.useState(college.nombreColegio);
  const [pct, setPct] = React.useState(String(college.discountPercent));
  const [enabled, setEnabled] = React.useState(college.enabled);
  const [memberCount, setMemberCount] = React.useState(college.memberCount);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [lastFileName, setLastFileName] = React.useState<string | null>(null);

  React.useEffect(() => {
    setNombre(college.nombreColegio);
    setPct(String(college.discountPercent));
    setEnabled(college.enabled);
    setMemberCount(college.memberCount);
  }, [
    college.id,
    college.nombreColegio,
    college.discountPercent,
    college.enabled,
    college.memberCount,
  ]);

  const busy = saving || uploading || deleting || disabledGlobal;
  const pctNum = Number(String(pct).replace(",", "."));

  async function saveRow() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/colegio-discount/colleges/${college.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombreColegio: nombre,
          discountPercent: pctNum,
          enabled,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j?.error === "string" ? j.error : `HTTP ${res.status}`);
      const c = j.college as ColegioCollegeRow | undefined;
      if (c) {
        setNombre(c.nombreColegio);
        setPct(String(c.discountPercent));
        setEnabled(c.enabled);
        setMemberCount(c.memberCount);
      }
      toast({ title: "Colegio actualizado" });
      onRefresh();
    } catch (e) {
      toast({
        title: "No se pudo guardar",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function onFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    setUploading(true);
    setLastFileName(file.name);
    try {
      const rows = await parseColegioSpreadsheet(file);
      if (rows.length === 0) {
        toast({
          title: "Lista vacía",
          description:
            "No encontramos filas con email. Revisá que la primera hoja tenga columnas “nombre” y “email” (o equivalentes).",
          variant: "destructive",
        });
        return;
      }
      const res = await fetch(`/api/admin/colegio-discount/colleges/${college.id}/members`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members: rows }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j?.error === "string" ? j.error : `HTTP ${res.status}`);
      const n = typeof j.memberCount === "number" ? j.memberCount : 0;
      setMemberCount(n);
      toast({
        title: "Lista cargada",
        description: `Se reemplazó la nómina por ${n} direcciones únicas (normalizadas por mail).`,
      });
      onRefresh();
    } catch (e) {
      toast({
        title: "No se pudo procesar el archivo",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  async function doDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/colegio-discount/colleges/${college.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j?.error === "string" ? j.error : `HTTP ${res.status}`);
      toast({ title: "Colegio eliminado" });
      onRefresh();
    } catch (e) {
      toast({
        title: "No se pudo eliminar",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <tr className="border-b last:border-b-0 align-middle">
      <td className="px-3 py-2">
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={160}
          disabled={busy}
          className="min-w-[220px] font-medium"
          aria-label="Nombre del colegio"
        />
      </td>
      <td className="px-3 py-2">
        <Input
          type="number"
          min={0}
          max={100}
          step="0.5"
          className="w-[90px] font-mono"
          value={pct}
          onChange={(e) => setPct(e.target.value)}
          disabled={busy}
          aria-label="Descuento porcentaje"
        />
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`colegio-enabled-${college.id}`}
            checked={enabled}
            onCheckedChange={(v) => setEnabled(v === true)}
            disabled={busy}
          />
          <Label htmlFor={`colegio-enabled-${college.id}`} className="cursor-pointer font-normal text-xs sm:text-sm">
            Activo
          </Label>
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 whitespace-nowrap">
          <span className="text-muted-foreground text-sm tabular-nums">
            {memberCount} mail{memberCount === 1 ? "" : "s"}
          </span>
          <Button type="button" variant="outline" size="sm" disabled={busy} asChild>
            <label className="cursor-pointer">
              <Upload className="mr-1 h-3.5 w-3.5" />
              Subir lista
              <input
                type="file"
                accept=".xlsx,.csv"
                className="sr-only"
                disabled={busy}
                onChange={(e) => void onFile(e)}
              />
            </label>
          </Button>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
          {lastFileName ? (
            <span title={lastFileName} className="max-w-[100px] truncate text-xs text-muted-foreground">
              {lastFileName}
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" disabled={busy || !Number.isFinite(pctNum)} onClick={() => void saveRow()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="text-destructive" disabled={busy}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar este colegio?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se borrará la configuración y toda la nómina de correos asociada a «{college.nombreColegio}». Esta
                  acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <Button variant="destructive" onClick={() => void doDelete()}>
                  Eliminar
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </td>
    </tr>
  );
}

export default function ColegioDiscountAdminCard() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [colleges, setColleges] = React.useState<ColegioCollegeRow[]>([]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/colegio-discount/colleges", { credentials: "include" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j?.error === "string" ? j.error : `HTTP ${res.status}`);
      const list = j.colleges;
      if (!Array.isArray(list)) throw new Error("Respuesta inválida");
      setColleges(list as ColegioCollegeRow[]);
    } catch (e) {
      toast({
        title: "No se cargaron los colegios",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function addCollege() {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/colegio-discount/colleges", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j?.error === "string" ? j.error : `HTTP ${res.status}`);
      toast({ title: "Colegio creado", description: "Completá la fila y guardá." });
      await load();
    } catch (e) {
      toast({
        title: "No se pudo crear",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 shrink-0">
              <Scale className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Descuentos por colegio de abogados</CardTitle>
              <CardDescription>
                Cada fila es un colegio: nombre, porcentaje sobre precio de lista, activación y nómina de mails. En la
                billetera se compara el mail de la sesión (Firebase) con la lista del colegio; si coincide y el
                descuento está activo, Mercado Pago cobra el precio rebajado manteniendo los envíos del plan. Si un
                matriculado está en más de un colegio con descuento vigente, aplica el mayor porcentaje.
              </CardDescription>
            </div>
          </div>
          <Button type="button" onClick={() => void addCollege()} disabled={loading || creating} className="shrink-0">
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Nuevo colegio
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : colleges.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">
            No hay colegios cargados. Usá «Nuevo colegio» para agregar el primero.
          </p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Colegio</th>
                  <th className="px-3 py-2">Desc. %</th>
                  <th className="px-3 py-2">Activo</th>
                  <th className="px-3 py-2">Matriculados</th>
                  <th className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {colleges.map((c) => (
                  <ColegioTableRow key={c.id} college={c} onRefresh={() => void load()} disabledGlobal={creating} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Cada carga de planilla <strong>reemplaza</strong> solo la lista de ese colegio. Encabezados reconocidos:
          email, mail, correo, nombre, name, etc. Si el nombre queda vacío al guardar, en la billetera se muestra «
          {COLEGIO_NOMBRE_FALLBACK_CLIENT}».
        </p>
      </CardContent>
    </Card>
  );
}
