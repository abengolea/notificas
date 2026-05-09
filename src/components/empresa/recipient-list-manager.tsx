"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import type { RecipientEntry } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2 } from "lucide-react";

function emptyRow(): RecipientEntry {
  return { email: "", nombre: "" };
}

function parseCsvText(text: string): { rows: Record<string, string>[]; headers: string[] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { rows: [], headers: [] };
  const splitRow = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        q = !q;
        continue;
      }
      if (!q && c === ",") {
        out.push(cur.trim());
        cur = "";
        continue;
      }
      cur += c;
    }
    out.push(cur.trim());
    return out;
  };
  const headers = splitRow(lines[0]).map((h) => h.toLowerCase().replace(/^\ufeff/, ""));
  const rows = lines.slice(1).map((line) => {
    const cells = splitRow(line);
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => {
      rec[h] = cells[i] ?? "";
    });
    return rec;
  });
  return { rows, headers };
}

type RowErr = { line: number; message: string };

export function RecipientListManager(props: {
  orgId: string;
  listId?: string;
  initialNombre?: string;
  initialRecipients?: RecipientEntry[];
}) {
  const { orgId, listId, initialNombre = "", initialRecipients } = props;
  const router = useRouter();
  const { toast } = useToast();
  const [nombre, setNombre] = useState(initialNombre);
  const [rows, setRows] = useState<RecipientEntry[]>(
    initialRecipients?.length ? initialRecipients : [emptyRow()]
  );
  const [csvPreview, setCsvPreview] = useState<RecipientEntry[] | null>(null);
  const [csvErrors, setCsvErrors] = useState<RowErr[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!listId) return;
    let cancelled = false;
    (async () => {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch(`/api/recipient-lists/${listId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      setNombre(String(data.nombre || ""));
      if (Array.isArray(data.recipients)) setRows(data.recipients);
    })();
    return () => {
      cancelled = true;
    };
  }, [listId]);

  const validateAll = useCallback((data: RecipientEntry[]) => {
    const errs: RowErr[] = [];
    const emails = new Set<string>();
    data.forEach((r, i) => {
      const line = i + 1;
      const email = r.email.trim().toLowerCase();
      if (!email) {
        errs.push({ line, message: "Email vacío" });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errs.push({ line, message: "Email inválido" });
      }
      if (emails.has(email)) {
        errs.push({ line, message: "Email duplicado" });
      }
      emails.add(email);
      if (!r.nombre?.trim()) {
        errs.push({ line, message: "Falta nombre" });
      }
    });
    return errs;
  }, []);

  const manualErrors = useMemo(() => validateAll(rows), [rows, validateAll]);

  function updateRow(i: number, patch: Partial<RecipientEntry>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(i: number) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));
  }

  function onCsvFile(f: File | null) {
    setCsvPreview(null);
    setCsvErrors([]);
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const { rows: raw, headers } = parseCsvText(text);
      if (!headers.includes("email") || !headers.includes("nombre")) {
        toast({
          title: "CSV inválido",
          description: "Encabezados requeridos: email, nombre",
          variant: "destructive",
        });
        return;
      }
      const mapped: RecipientEntry[] = raw.map((r) => ({
        email: (r.email || "").trim(),
        nombre: (r.nombre || "").trim(),
        dni: (r.dni || "").trim() || undefined,
        legajo: (r.legajo || "").trim() || undefined,
        telefono: (r.telefono || "").trim() || undefined,
        area: (r.area || "").trim() || undefined,
      }));
      const errs = validateAll(mapped);
      setCsvErrors(errs);
      setCsvPreview(mapped.slice(0, 5));
      if (!errs.length) {
        setRows(mapped);
        toast({ title: "CSV importado", description: `${mapped.length} filas` });
      }
    };
    reader.readAsText(f);
  }

  async function save() {
    if (!nombre.trim()) {
      toast({ title: "Nombre de lista requerido", variant: "destructive" });
      return;
    }
    const errs = validateAll(rows);
    if (errs.length) {
      toast({ title: "Revisá los datos", description: `${errs.length} errores`, variant: "destructive" });
      return;
    }
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    setSaving(true);
    try {
      const recipients = rows.map((r) => ({
        ...r,
        email: r.email.trim().toLowerCase(),
        nombre: r.nombre.trim(),
      }));
      if (listId) {
        const res = await fetch(`/api/recipient-lists/${listId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ nombre, recipients }),
        });
        if (!res.ok) throw new Error("No se pudo guardar");
        toast({ title: "Lista actualizada" });
      } else {
        const res = await fetch("/api/recipient-lists", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ orgId, nombre, recipients }),
        });
        if (!res.ok) throw new Error("No se pudo crear");
        toast({ title: "Lista creada" });
      }
      router.push(`/empresa/${orgId}/listas`);
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="space-y-2">
        <Label>Nombre de la lista</Label>
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Empleados planta norte" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importar CSV</CardTitle>
          <CardDescription>
            Columnas: email, nombre, dni (opcional), legajo, telefono, area
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="file" accept=".csv,text/csv" onChange={(e) => onCsvFile(e.target.files?.[0] ?? null)} />
          {csvErrors.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm max-h-40 overflow-auto">
              {csvErrors.slice(0, 30).map((e) => (
                <div key={`${e.line}-${e.message}`}>
                  Fila {e.line}: {e.message}
                </div>
              ))}
            </div>
          )}
          {csvPreview && csvPreview.length > 0 && (
            <div className="text-xs text-muted-foreground">Vista previa (primeras 5 filas importadas)</div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Destinatarios manuales</Label>
          <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1">
            <Plus className="h-4 w-4" />
            Agregar fila
          </Button>
        </div>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>DNI</TableHead>
                <TableHead>Legajo</TableHead>
                <TableHead>Tel.</TableHead>
                <TableHead>Área</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Input value={r.email} onChange={(e) => updateRow(i, { email: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input value={r.nombre} onChange={(e) => updateRow(i, { nombre: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input value={r.dni ?? ""} onChange={(e) => updateRow(i, { dni: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input value={r.legajo ?? ""} onChange={(e) => updateRow(i, { legajo: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input value={r.telefono ?? ""} onChange={(e) => updateRow(i, { telefono: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input value={r.area ?? ""} onChange={(e) => updateRow(i, { area: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {manualErrors.length > 0 && (
          <p className="text-sm text-destructive">{manualErrors.length} error(es) en la tabla.</p>
        )}
      </div>

      <Button onClick={save} disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Guardando…
          </>
        ) : listId ? (
          "Guardar cambios"
        ) : (
          "Crear lista"
        )}
      </Button>
    </div>
  );
}
